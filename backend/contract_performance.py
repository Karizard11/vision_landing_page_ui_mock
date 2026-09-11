"""Read-only, contract-scoped prediction and solar performance read model.

Doris event times are UTC. PVModel is hourly mean kW; PVSOL horiz_flux is
hourly kWh/m2. Solcast GHI is W/m2, timestamped at the end of 30 minutes.
Missing intervals are never manufactured as zero.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from contracts import _optional_number as number, _select
from time_context import QueryWindow, doris_utc_to_sast

HOUR = timedelta(hours=1)
FIVE = timedelta(minutes=5)


def granularity(minutes: int) -> str:
    days = minutes / 1440
    return "5min" if days <= 1 else "30min" if days <= 4 else "hour" if days <= 14 else "day" if days <= 31 else "month" if days <= 366 else "year"


def query_performance_sources(connection, site: dict, window: QueryWindow) -> dict:
    start, end = window.start_utc, window.end_utc
    floor_start = start.replace(minute=0, second=0, microsecond=0)
    ceil_end = end.replace(minute=0, second=0, microsecond=0) + HOUR
    serials = sorted(set(site.get("solarMeterSerials", [])))
    # Do not substitute every solar meter on the physical site: different
    # contracts/phases may share that site but have different measurement scopes.
    coarse = window.duration_minutes > 14 * 1440
    with connection.cursor() as cursor:
        predictions = _select(cursor, """
            SELECT f.contract_timestamp AS timestamp, m.system_output_power_kw,
                   f.degradation, f.yield_guarantee, f.forecast_year, f.coco_date
            FROM mv_pv_model_forecasts f
            JOIN pv_model m ON m.contract_id = f.contract_id AND m.timestamp = f.pv_model_timestamp
            WHERE f.contract_id = %s AND f.contract_timestamp >= %s AND f.contract_timestamp < %s
            ORDER BY f.contract_timestamp, f.forecast_year
        """, (site["contractId"], floor_start, ceil_end))
        # The annual source profile is contract-specific; never join by system key.
        model = []
        if not predictions:
            model = _select(cursor, """
                SELECT timestamp, system_output_power_kw FROM pv_model
                WHERE contract_id = %s ORDER BY timestamp
            """, (site["contractId"],))
        pvsol = _select(cursor, """
            SELECT timestamp, horiz_flux FROM pv_sol
            WHERE contract_id = %s ORDER BY timestamp
        """, (site["contractId"],))
        solar = []
        if serials:
            placeholders = ", ".join(["%s"] * len(serials))
            # Registers describe the preceding five minutes. A reset or gap
            # invalidates that interval; other meters cannot hide its absence.
            bucket = "DATE_TRUNC(interval_start, 'hour')" if coarse else "interval_start"
            solar = _select(cursor, f"""
                WITH normalized AS (
                    SELECT MINUTE_FLOOR(timestamp, 5) AS timestamp, meter_serial, MAX(export_wh) AS export_wh
                    FROM electricity_energy_power
                    WHERE meter_serial IN ({placeholders}) AND timestamp >= %s AND timestamp < %s
                    GROUP BY MINUTE_FLOOR(timestamp, 5), meter_serial
                ), ordered AS (
                    SELECT timestamp, meter_serial, export_wh,
                        LAG(timestamp) OVER (PARTITION BY meter_serial ORDER BY timestamp) AS previous_at,
                        LAG(export_wh) OVER (PARTITION BY meter_serial ORDER BY timestamp) AS previous_wh
                    FROM normalized
                ), intervals AS (
                    SELECT DATE_SUB(timestamp, INTERVAL 5 MINUTE) AS interval_start,
                           SUM((export_wh - previous_wh) / 1000.0) AS energy_kwh
                    FROM ordered
                    WHERE TIMESTAMPDIFF(SECOND, previous_at, timestamp) = 300
                      AND export_wh >= previous_wh AND previous_wh >= 0
                    GROUP BY timestamp
                    HAVING COUNT(DISTINCT meter_serial) = %s
                )
                SELECT {bucket} AS timestamp, SUM(energy_kwh) AS energy_kwh, COUNT(*) * 300 AS valid_seconds
                FROM intervals
                WHERE interval_start >= %s AND interval_start < %s
                GROUP BY {bucket} ORDER BY {bucket}
            """, (*serials, floor_start - FIVE, ceil_end + timedelta(minutes=1), len(serials), floor_start, ceil_end))
        weather = []
        if site.get("systemKey"):
            weather = _select(cursor, """
                SELECT DATE_SUB(period_end, INTERVAL 30 MINUTE) AS timestamp, ghi
                FROM solcast_data
                WHERE system_key = %s AND period_end >= %s AND period_end < %s
                ORDER BY period_end
            """, (site["systemKey"], floor_start + timedelta(minutes=30), ceil_end + timedelta(minutes=30)))
    return {"predictions": predictions, "model": model, "pvsol": pvsol, "solar": solar,
            "weather": weather, "serials": serials, "stepMinutes": 60 if coarse else 5}


def _annual_profile(rows: list[dict], field: str) -> tuple[dict, int | None]:
    # Select one reference year; holes remain unavailable rather than mixing versions.
    year = max((r["timestamp"].year for r in rows), default=None)
    return {(r["timestamp"].month, r["timestamp"].day, r["timestamp"].hour): number(r[field])
            for r in rows if r["timestamp"].year == year}, year


def _bucket(at: datetime, resolution: str) -> str:
    if resolution == "year":
        return at.strftime("%Y")
    if resolution == "month":
        return at.strftime("%Y-%m")
    if resolution == "day":
        return at.strftime("%Y-%m-%d")
    minute = 0 if resolution == "hour" else at.minute // (30 if resolution == "30min" else 5) * (30 if resolution == "30min" else 5)
    return at.replace(minute=minute, second=0, microsecond=0).isoformat()


def _ratio(a, b, scale=100):
    return a / b * scale if a is not None and b is not None and b > 0 else None


def build_contract_performance(site: dict, window: QueryWindow, source: dict) -> dict[str, Any]:
    resolution = granularity(window.duration_minutes)
    step = timedelta(minutes=source["stepMinutes"])
    seconds_per_step = step.total_seconds()
    model, model_year = _annual_profile(source["model"], "system_output_power_kw")
    pvsol, pvsol_year = _annual_profile(source["pvsol"], "horiz_flux")
    predictions: dict[datetime, list[dict]] = defaultdict(list)
    for row in source["predictions"]:
        predictions[row["timestamp"]].append(row)
    solar = {row["timestamp"]: row for row in source["solar"]}
    weather = {row["timestamp"]: number(row["ghi"]) for row in source["weather"]}
    capacity = number(site.get("capacityKwp"))
    guarantee_pct = number(site.get("guarantee"))
    degradation_pct = number(site.get("degradationPercent"))
    coco = site.get("cocoDate")
    coco_day = datetime.fromisoformat(coco).date() if coco else None
    messages = []
    forecast_coco = sorted({str(row["coco_date"]) for row in source["predictions"] if row.get("coco_date")})
    if predictions and not coco_day and forecast_coco:
        messages.append("The dated forecast uses COCO " + ", ".join(forecast_coco) + "; the current contract has no COCO recorded.")
    if not predictions and model:
        messages.append("Using the contract's annual PVModel profile; dated forecasts are unavailable.")
    if not predictions and model and not coco_day:
        messages.append("COCO is unavailable: the annual model is shown without an ageing adjustment.")
    if not predictions and not model:
        messages.append("No contract PVModel prediction is available for this period.")
    if not pvsol:
        messages.append("PVSOL irradiance is unavailable; irradiance and PR comparisons remain incomplete.")
    if not source["serials"]:
        messages.append("No solar meter mapping is available for this contract.")
    totals = defaultdict(float)
    buckets: dict[str, dict] = {}
    at = window.start_utc.replace(second=0, microsecond=0)
    at = at.replace(minute=at.minute // source["stepMinutes"] * source["stepMinutes"])
    ambiguous = False
    before_coco = False
    last_actual = None
    while at < window.end_utc:
        left, right = max(at, window.start_utc), min(at + step, window.end_utc)
        seconds = (right - left).total_seconds()
        hours = seconds / 3600
        hour = at.replace(minute=0)
        profile_key = (hour.month, hour.day, hour.hour)
        options = predictions.get(hour, [])
        p = None
        guarantee = None
        if len(options) == 1:
            row = options[0]
            kw, factor = number(row["system_output_power_kw"]), number(row["degradation"])
            if kw is not None and factor is not None and kw >= 0 and factor >= 0:
                p = kw * factor * hours
                g = number(row.get("yield_guarantee"))
                guarantee = p * g / 100 if g is not None and 0 < g <= 100 else None
        elif len(options) > 1:
            ambiguous = True
        elif not predictions and profile_key in model:
            kw = model[profile_key]
            factor = 1.0
            local_date = doris_utc_to_sast(at).date()
            if coco_day and local_date < coco_day:
                before_coco = True
                kw = None
            elif coco_day and degradation_pct is not None:
                years = local_date.year - coco_day.year - ((local_date.month, local_date.day) < (coco_day.month, coco_day.day))
                factor = max(0, 1 - years * degradation_pct / 100)
            p = kw * factor * hours if kw is not None and kw >= 0 else None
            guarantee = p * guarantee_pct / 100 if p is not None and guarantee_pct is not None and 0 < guarantee_pct <= 100 else None
        actual_row = solar.get(at)
        # Hourly aggregation is used only for full-day-or-larger chart buckets.
        valid_seconds = number(actual_row.get("valid_seconds")) if actual_row else 0
        a = number(actual_row.get("energy_kwh")) if actual_row else None
        full_actual = valid_seconds == seconds_per_step
        # Boundary-hour coverage cannot be apportioned from a partial hour.
        if source["stepMinutes"] == 60 and seconds < seconds_per_step and not full_actual:
            a, valid_seconds = None, 0
        elif a is not None:
            a *= seconds / seconds_per_step
            valid_seconds = min(seconds, valid_seconds * seconds / seconds_per_step)
        pg = pvsol.get(profile_key)
        pg = pg * hours if pg is not None and pg >= 0 else None
        if source["stepMinutes"] == 60:
            values = [weather.get(hour), weather.get(hour + timedelta(minutes=30))]
            ag = sum(values) * .5 * hours / 1000 if all(v is not None and v >= 0 for v in values) else None
        else:
            value = weather.get(at.replace(minute=at.minute // 30 * 30))
            ag = value * hours / 1000 if value is not None and value >= 0 else None
        key = _bucket(doris_utc_to_sast(left), resolution)
        b = buckets.setdefault(key, {"time": key, "seconds": 0, "actualSeconds": 0, "predictionSeconds": 0,
                                    "predicted": None, "actual": None, "guarantee": None,
                                    "predictedGhi": None, "actualGhi": None,
                                    "matchedPredicted": None, "matchedActual": None,
                                    "weatherEffect": None, "otherEffect": None,
                                    "prActualEnergy": 0, "prPredictedEnergy": 0, "prActualGhi": 0, "prPredictedGhi": 0})
        b["seconds"] += seconds
        totals["seconds"] += seconds
        for name, value in (("predicted", p), ("actual", a), ("guarantee", guarantee), ("predictedGhi", pg), ("actualGhi", ag)):
            if value is not None:
                b[name] = (b[name] or 0) + value
                totals[name] += value
                totals[name + "Seconds"] += seconds
        b["actualSeconds"] += valid_seconds or 0
        b["predictionSeconds"] += seconds if p is not None else 0
        totals["actualCoverageSeconds"] += valid_seconds or 0
        if a is not None:
            last_actual = doris_utc_to_sast(right).isoformat()
        if p is not None and a is not None and full_actual:
            for name, value in (("matchedPredicted", p), ("matchedActual", a)):
                b[name] = (b[name] or 0) + value
                totals[name] += value
            totals["matchedSeconds"] += seconds
            # Only shared, daytime irradiation intervals support attribution or PR.
            if pg is not None and pg > 0 and ag is not None and ag > 0:
                weather_adjusted = p * ag / pg
                for name, value in (("weatherEffect", weather_adjusted - p), ("otherEffect", a - weather_adjusted)):
                    b[name] = (b[name] or 0) + value
                    totals[name] += value
                for name, value in (("prActualEnergy", a), ("prPredictedEnergy", p), ("prActualGhi", ag), ("prPredictedGhi", pg)):
                    b[name] += value
                    totals[name] += value
                totals["explanationSeconds"] += seconds
        at += step
    for b in buckets.values():
        b["actualCoverage"] = _ratio(b["actualSeconds"], b["seconds"])
        b["predictionCoverage"] = _ratio(b["predictionSeconds"], b["seconds"])
        b["predictedPr"] = _ratio(b.pop("prPredictedEnergy"), (capacity or 0) * b.pop("prPredictedGhi"))
        b["actualPr"] = _ratio(b.pop("prActualEnergy"), (capacity or 0) * b.pop("prActualGhi"))
        for key, value in b.items():
            if isinstance(value, float):
                b[key] = round(value, 5)
    if ambiguous:
        messages.append("Overlapping contract forecasts were excluded where the baseline is ambiguous.")
    if before_coco:
        messages.append("Annual-profile predictions before COCO were excluded.")
    coverage = _ratio(totals["actualCoverageSeconds"], totals["seconds"]) or 0
    if coverage < 99.9:
        messages.append("Solar meter data is incomplete. Attainment uses only intervals with both actuals and predictions.")
    def total(name):
        return round(totals[name], 5) if totals[name + "Seconds"] > 0 else None
    matched = totals["matchedSeconds"] > 0
    return {
        "contractId": site["contractId"],
        "range": {"from": window.start_day.isoformat(), "to": window.end_day.isoformat(),
                  "fromTime": window.from_time, "toTime": window.to_time, "timeZone": "Africa/Johannesburg",
                  "durationMinutes": window.duration_minutes, "granularity": resolution},
        "series": list(buckets.values()),
        "summary": {
            "predictedKwh": total("predicted"), "actualKwh": total("actual"), "guaranteedKwh": total("guarantee"),
            "attainmentPercent": _ratio(totals["matchedActual"], totals["matchedPredicted"]) if matched else None,
            "varianceKwh": totals["matchedActual"] - totals["matchedPredicted"] if matched else None,
            "actualCoverage": coverage, "predictionCoverage": _ratio(totals["predictedSeconds"], totals["seconds"]),
            "comparisonCoverage": _ratio(totals["matchedSeconds"], totals["seconds"]),
            "predictedPr": _ratio(totals["prPredictedEnergy"], (capacity or 0) * totals["prPredictedGhi"]),
            "actualPr": _ratio(totals["prActualEnergy"], (capacity or 0) * totals["prActualGhi"]),
            "weatherEffectKwh": totals["weatherEffect"] if totals["explanationSeconds"] else None,
            "otherEffectKwh": totals["otherEffect"] if totals["explanationSeconds"] else None,
            "lastActualAt": last_actual,
        },
        "provenance": {
            "prediction": "mv_pv_model_forecasts → pv_model" if predictions else "pv_model annual profile",
            "predictionResolution": "hourly; allocated by overlap for shorter selections",
            "pvsolReferenceYear": pvsol_year, "modelReferenceYear": model_year,
            "irradiance": "pv_sol.horiz_flux (kWh/m²/hour) and solcast_data.ghi (W/m²)",
            "actual": "Solar meter export register deltas; readings aligned to five-minute slots, gaps excluded",
            "meterSerials": source["serials"], "prBasis": "GHI-based: energy / (contract kWp × horizontal irradiation)",
            "degradation": "Applied once using the dated forecast multiplier; annual fallback uses linear contract ageing after COCO.",
            "explanation": "Irradiance effect = predicted energy × (actual GHI / predicted GHI − 1). The remaining gap is unattributed; it is not evidence of outages or load shedding.",
        },
        "messages": messages,
    }
