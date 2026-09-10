from __future__ import annotations

import math
import os
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterable

import pymysql
from dotenv import load_dotenv
from flask import Flask, jsonify, request


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = os.getenv("PRECOOL_DORIS_ENV_FILE")
load_dotenv(ENV_FILE or PROJECT_ROOT / ".env")

app = Flask(__name__)

SYSTEM_KEY = "5ID4A"
CAPACITY_KWP = 1851.33
TARIFF = 0.88
MAX_RANGE_DAYS = 31
EXPECTED_METER_READINGS = 288
EXPECTED_INVERTER_READINGS = 288
METER_LABELS = {
    "230502183": "pvdb1",
    "230508643": "pvdb2",
    "230711634": "incomer1",
    "230711751": "incomer2",
    "230711742": "incomer3",
}
SOLAR_SERIALS = {"230502183", "230508643"}
INCOMER_SERIALS = set(METER_LABELS) - SOLAR_SERIALS
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
CHANNEL_PATTERN = re.compile(r"^(I|U)_DC(\d+)$", re.IGNORECASE)


def doris_connection():
    required = ("DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_DATABASE")
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise RuntimeError(f"Missing Doris environment variables: {', '.join(missing)}")
    return pymysql.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=os.environ["DB_DATABASE"],
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
        connect_timeout=10,
        read_timeout=90,
        write_timeout=30,
    )


def parse_range() -> tuple[date, date, datetime, datetime]:
    from_value = request.args.get("from", "")
    to_value = request.args.get("to", "")
    if not DATE_PATTERN.fullmatch(from_value) or not DATE_PATTERN.fullmatch(to_value):
        raise ValueError("from and to must be valid YYYY-MM-DD dates")
    try:
        start_day = datetime.strptime(from_value, "%Y-%m-%d").date()
        end_day = datetime.strptime(to_value, "%Y-%m-%d").date()
    except ValueError as error:
        raise ValueError("from and to must be valid calendar dates") from error
    if end_day < start_day:
        raise ValueError("to must not be earlier than from")
    if (end_day - start_day).days + 1 > MAX_RANGE_DAYS:
        raise ValueError(f"date range must not exceed {MAX_RANGE_DAYS} days")
    return (
        start_day,
        end_day,
        datetime.combine(start_day, datetime.min.time()),
        datetime.combine(end_day + timedelta(days=1), datetime.min.time()),
    )


def finite_number(value: Any) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    return numeric if math.isfinite(numeric) else None


def rounded(value: Any, digits: int = 3) -> float | None:
    numeric = finite_number(value)
    return None if numeric is None else round(numeric, digits)


def mean(values: Iterable[float]) -> float | None:
    items = list(values)
    return sum(items) / len(items) if items else None


def inverter_code(name: Any, inverter_id: Any) -> str:
    match = re.match(r"^(\d+)", str(name or ""))
    if match:
        return match.group(1).zfill(2)
    fallback = re.search(r"(\d+)$", str(inverter_id or ""))
    return fallback.group(1).zfill(2) if fallback else str(inverter_id)


def date_keys(start_day: date, end_day: date) -> list[str]:
    return [
        (start_day + timedelta(days=offset)).isoformat()
        for offset in range((end_day - start_day).days + 1)
    ]


def available_channels(cursor) -> list[int]:
    cursor.execute("DESCRIBE vcom_inverter_data")
    current: set[int] = set()
    voltage: set[int] = set()
    for row in cursor.fetchall():
        name = str(row.get("Field") or next(iter(row.values())))
        match = CHANNEL_PATTERN.fullmatch(name)
        if not match:
            continue
        target = current if match.group(1).upper() == "I" else voltage
        target.add(int(match.group(2)))
    return sorted(current & voltage)


def select_rows(cursor, query: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
    cursor.execute(query, params)
    return list(cursor.fetchall())


def query_doris(start: datetime, end: datetime) -> dict[str, Any]:
    serial_placeholders = ", ".join(["%s"] * len(METER_LABELS))
    with doris_connection() as connection:
        with connection.cursor() as cursor:
            channels = available_channels(cursor)
            meter_rows = select_rows(
                cursor,
                f"""
                SELECT timestamp, meter_serial, import_wh, export_wh, ptot
                FROM electricity_energy_power
                WHERE meter_serial IN ({serial_placeholders})
                  AND timestamp >= %s AND timestamp < %s
                ORDER BY timestamp, meter_serial
                """,
                (*METER_LABELS.keys(), start, end),
            )
            inverter_rows = select_rows(
                cursor,
                """
                SELECT d.timestamp, d.inverter_id, i.inverter_name, i.inverter_model,
                       d.P_AC, d.P_DC, d.E_DAY, d.E_TOTAL
                FROM vcom_inverter_data d
                LEFT JOIN vcom_inverters i
                  ON d.system_key = i.system_key AND d.inverter_id = i.inverter_id
                WHERE d.system_key = %s
                  AND d.timestamp >= %s AND d.timestamp < %s
                ORDER BY d.timestamp, d.inverter_id
                """,
                (SYSTEM_KEY, start, end),
            )
            solcast_rows = select_rows(
                cursor,
                """
                SELECT period_end AS timestamp, ghi
                FROM solcast_data
                WHERE system_key = %s
                  AND period_end >= %s AND period_end < %s
                ORDER BY period_end
                """,
                (SYSTEM_KEY, start, end),
            )
            sensor_rows = select_rows(
                cursor,
                """
                SELECT timestamp, sensor_id, SRAD
                FROM vcom_sensor_data
                WHERE system_key = %s
                  AND timestamp >= %s AND timestamp < %s
                ORDER BY timestamp, sensor_id
                """,
                (SYSTEM_KEY, start, end),
            )

            latest_inverter_day = max(
                (row["timestamp"].date() for row in inverter_rows if row.get("timestamp")),
                default=None,
            )
            latest_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
            if latest_inverter_day:
                for row in inverter_rows:
                    timestamp = row.get("timestamp")
                    if timestamp and timestamp.date() == latest_inverter_day:
                        latest_groups[str(row.get("inverter_id"))].append(row)

            peak_pairs: list[tuple[str, datetime]] = []
            for inverter_id, rows in latest_groups.items():
                peak = max(rows, key=lambda row: finite_number(row.get("P_AC")) or -1)
                peak_pairs.append((inverter_id, peak["timestamp"]))

            telemetry_rows: list[dict[str, Any]] = []
            if peak_pairs and channels:
                conditions = " OR ".join(
                    ["(inverter_id = %s AND timestamp = %s)"] * len(peak_pairs)
                )
                channel_select = ", ".join(
                    [f"I_DC{channel}, U_DC{channel}" for channel in channels]
                )
                pair_params: list[Any] = []
                for inverter_id, timestamp in peak_pairs:
                    pair_params.extend([inverter_id, timestamp])
                telemetry_rows = select_rows(
                    cursor,
                    f"""
                    SELECT timestamp, inverter_id, {channel_select}
                    FROM vcom_inverter_data
                    WHERE system_key = %s AND ({conditions})
                    """,
                    (SYSTEM_KEY, *pair_params),
                )

    return {
        "channels": channels,
        "meters": meter_rows,
        "inverters": inverter_rows,
        "solcast": solcast_rows,
        "sensors": sensor_rows,
        "telemetry": telemetry_rows,
    }


def aggregate_payload(start_day: date, end_day: date, source: dict[str, Any]) -> dict[str, Any]:
    keys = date_keys(start_day, end_day)
    meter_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    meter_bucket_values: dict[tuple[str, int, str], list[float]] = defaultdict(list)
    for row in source["meters"]:
        timestamp = row["timestamp"]
        day = timestamp.date().isoformat()
        serial = str(row["meter_serial"])
        meter_groups[(day, serial)].append(row)
        value = finite_number(row.get("ptot"))
        if value is not None:
            bucket = timestamp.hour * 12 + timestamp.minute // 5
            meter_bucket_values[(day, bucket, serial)].append(abs(value) / 1000)

    inverter_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    inverter_bucket_values: dict[tuple[str, int, str, str], list[float]] = defaultdict(list)
    for row in source["inverters"]:
        timestamp = row["timestamp"]
        day = timestamp.date().isoformat()
        code = inverter_code(row.get("inverter_name"), row.get("inverter_id"))
        row["_code"] = code
        inverter_groups[(day, str(row["inverter_id"]))].append(row)
        bucket = timestamp.hour * 12 + timestamp.minute // 5
        for field in ("P_AC", "P_DC"):
            value = finite_number(row.get(field))
            if value is not None:
                inverter_bucket_values[(day, bucket, code, field)].append(value / 1000)

    solcast_bucket_values: dict[tuple[str, int], list[float]] = defaultdict(list)
    solcast_day_values: dict[str, list[float]] = defaultdict(list)
    for row in source["solcast"]:
        value = finite_number(row.get("ghi"))
        if value is None:
            continue
        timestamp = row["timestamp"]
        day = timestamp.date().isoformat()
        bucket = timestamp.hour * 12 + timestamp.minute // 5
        solcast_bucket_values[(day, bucket)].append(value)
        solcast_day_values[day].append(value)

    sensor_bucket_values: dict[tuple[str, int], list[float]] = defaultdict(list)
    for row in source["sensors"]:
        value = finite_number(row.get("SRAD"))
        if value is None or value <= 0:
            continue
        timestamp = row["timestamp"]
        bucket = timestamp.hour * 12 + timestamp.minute // 5
        sensor_bucket_values[(timestamp.date().isoformat(), bucket)].append(value)

    telemetry_lookup = {
        (str(row["inverter_id"]), row["timestamp"].isoformat()): row
        for row in source["telemetry"]
    }
    days: dict[str, Any] = {}
    availability_by_day: dict[str, float] = {}
    latest_source_timestamp: datetime | None = None
    for collection in ("meters", "inverters", "solcast", "sensors"):
        for row in source[collection]:
            timestamp = row.get("timestamp")
            if timestamp and (latest_source_timestamp is None or timestamp > latest_source_timestamp):
                latest_source_timestamp = timestamp

    for day in keys:
        meter_summary: dict[str, Any] = {}
        for serial, label in METER_LABELS.items():
            rows = sorted(meter_groups[(day, serial)], key=lambda row: row["timestamp"])
            register = "export_wh" if serial in SOLAR_SERIALS else "import_wh"
            values = [
                value
                for value in (finite_number(row.get(register)) for row in rows)
                if value is not None
            ]
            energy_mwh = max(values[-1] - values[0], 0) / 1_000_000 if len(values) > 1 else 0
            peaks = [
                abs(value) / 1000
                for value in (finite_number(row.get("ptot")) for row in rows)
                if value is not None
            ]
            meter_summary[label] = {
                "energyMwh": rounded(energy_mwh, 6) or 0,
                "peakKw": rounded(max(peaks, default=0), 3) or 0,
                "readings": len(rows),
            }

        inverter_summary: list[dict[str, Any]] = []
        ac_rows: dict[str, dict[str, Any]] = {}
        dc_rows: dict[str, dict[str, Any]] = {}
        telemetry: dict[str, Any] = {}
        day_inverter_groups = [
            (inverter_id, rows)
            for (group_day, inverter_id), rows in inverter_groups.items()
            if group_day == day
        ]
        for inverter_id, rows in day_inverter_groups:
            rows.sort(key=lambda row: row["timestamp"])
            last = rows[-1]
            code = str(last["_code"])
            ac_values = [value for value in (finite_number(row.get("P_AC")) for row in rows) if value is not None]
            dc_values = [value for value in (finite_number(row.get("P_DC")) for row in rows) if value is not None]
            energy_values = [value for value in (finite_number(row.get("E_DAY")) for row in rows) if value is not None]
            cumulative_values = [value for value in (finite_number(row.get("E_TOTAL")) for row in rows) if value is not None]
            inverter_summary.append({
                "code": code,
                "id": str(inverter_id),
                "name": str(last.get("inverter_name") or code),
                "model": str(last.get("inverter_model") or "Sungrow SG125CX-P2"),
                "peakAc": rounded(max(ac_values, default=0) / 1000, 3) or 0,
                "peakDc": rounded(max(dc_values, default=0) / 1000, 3) or 0,
                "energy": rounded(max(energy_values, default=0), 3) or 0,
                "cumulative": rounded(cumulative_values[-1], 3) if cumulative_values else 0,
                "readings": len(rows),
            })
            for bucket in range(288):
                ac = mean(inverter_bucket_values[(day, bucket, code, "P_AC")])
                dc = mean(inverter_bucket_values[(day, bucket, code, "P_DC")])
                label = f"{bucket // 12:02d}:{bucket % 12 * 5:02d}"
                if ac is not None:
                    ac_rows.setdefault(label, {"time": label})[f"i{code}"] = rounded(ac, 3)
                if dc is not None:
                    dc_rows.setdefault(label, {"time": label})[f"i{code}"] = rounded(dc, 3)

            peak = max(rows, key=lambda row: finite_number(row.get("P_AC")) or -1)
            measured = telemetry_lookup.get((inverter_id, peak["timestamp"].isoformat()))
            channels = []
            if measured:
                for channel in source["channels"]:
                    current = finite_number(measured.get(f"I_DC{channel}"))
                    voltage = finite_number(measured.get(f"U_DC{channel}"))
                    if current is None or voltage is None or current <= 0 or voltage <= 0:
                        continue
                    channels.append({
                        "channel": channel,
                        "current": rounded(current, 3),
                        "voltage": rounded(voltage, 3),
                        "power": rounded(current * voltage / 1000, 3),
                    })
            if channels:
                telemetry[code] = {
                    "capturedAt": peak["timestamp"].isoformat(),
                    "channels": channels,
                }

        inverter_summary.sort(key=lambda row: row["code"])
        power = []
        for bucket in range(288):
            point: dict[str, Any] = {
                "time": f"{bucket // 12:02d}:{bucket % 12 * 5:02d}"
            }
            for serial, label in METER_LABELS.items():
                point[label] = rounded(mean(meter_bucket_values[(day, bucket, serial)]) or 0, 3) or 0
            point["solar"] = rounded(point["pvdb1"] + point["pvdb2"], 3) or 0
            point["grid"] = rounded(point["incomer1"] + point["incomer2"] + point["incomer3"], 3) or 0
            inverter_values = [
                mean(inverter_bucket_values[(day, bucket, summary["code"], "P_AC")])
                for summary in inverter_summary
            ]
            measured_inverters = [value for value in inverter_values if value is not None]
            point["inverter"] = rounded(sum(measured_inverters), 3) if measured_inverters else None
            solcast_bucket = bucket - bucket % 6
            point["ghi"] = rounded(mean(solcast_bucket_values[(day, solcast_bucket)]) or 0, 1) or 0
            point["sensorGhi"] = rounded(mean(sensor_bucket_values[(day, bucket)]), 1)
            point["expected"] = rounded(point["ghi"] * CAPACITY_KWP * 0.78 / 1000, 3) or 0
            power.append(point)

        solar_energy_mwh = meter_summary["pvdb1"]["energyMwh"] + meter_summary["pvdb2"]["energyMwh"]
        grid_import_mwh = sum(meter_summary[label]["energyMwh"] for label in ("incomer1", "incomer2", "incomer3"))
        grid_export_kwh = 0.0
        for serial in INCOMER_SERIALS:
            rows = sorted(meter_groups[(day, serial)], key=lambda row: row["timestamp"])
            values = [
                value
                for value in (finite_number(row.get("export_wh")) for row in rows)
                if value is not None
            ]
            if len(values) > 1:
                grid_export_kwh += max(values[-1] - values[0], 0) / 1000
        irradiation_kwh_m2 = sum(solcast_day_values[day]) * 0.5 / 1000
        pr_estimate = (
            solar_energy_mwh * 1000 / (CAPACITY_KWP * irradiation_kwh_m2) * 100
            if irradiation_kwh_m2
            else 0
        )
        inverter_energy_mwh = sum(item["energy"] for item in inverter_summary) / 1000
        cumulative_values = [item["cumulative"] for item in inverter_summary if item["cumulative"]]
        inverter_readings = sum(item["readings"] for item in inverter_summary)
        inverter_availability = inverter_readings / (EXPECTED_INVERTER_READINGS * 12) * 100
        availability_by_day[day] = inverter_availability
        days[day] = {
            "totals": {
                "solarEnergyMwh": rounded(solar_energy_mwh, 6) or 0,
                "inverterEnergyMwh": rounded(inverter_energy_mwh, 6) or 0,
                "gridImportMwh": rounded(grid_import_mwh, 6) or 0,
                "gridExportKwh": rounded(grid_export_kwh, 3) or 0,
                "estimatedLoadMwh": rounded(grid_import_mwh + solar_energy_mwh - grid_export_kwh / 1000, 6) or 0,
                "avoidedCostZar": rounded(solar_energy_mwh * 1000 * TARIFF, 2) or 0,
                "cumulativeEnergyGwh": rounded(sum(cumulative_values) / 1_000_000, 6) if cumulative_values else None,
                "peakAcMw": rounded(max((point["inverter"] or 0) for point in power) / 1000, 6) or 0,
                "peakSolarKw": rounded(max(point["solar"] for point in power), 3) or 0,
                "solcastPeakGhi": rounded(max(solcast_day_values[day], default=0), 1) or 0,
                "prEstimate": rounded(pr_estimate, 2) or 0,
                "meterAvailability": rounded(
                    sum(item["readings"] for item in meter_summary.values())
                    / (EXPECTED_METER_READINGS * len(METER_LABELS))
                    * 100,
                    2,
                ) or 0,
                "inverterAvailability": rounded(inverter_availability, 2) or 0,
                "inverterReadings": inverter_readings,
            },
            "meters": meter_summary,
            "power": power,
            "inverterSummary": inverter_summary,
            "inverterAc": [ac_rows[label] for label in sorted(ac_rows)],
            "inverterDc": [dc_rows[label] for label in sorted(dc_rows)],
            "telemetry": telemetry,
        }

    complete_days = [day for day, availability in availability_by_day.items() if availability >= 99.9]
    partial_days = [day for day, availability in availability_by_day.items() if 0 < availability < 99.9]
    partial_day = partial_days[-1] if partial_days else None
    partial_timestamps = [
        row["timestamp"]
        for row in source["inverters"]
        if partial_day and row["timestamp"].date().isoformat() == partial_day
    ]
    return {
        "range": {
            "from": start_day.isoformat(),
            "to": end_day.isoformat(),
            "latestCompleteInverterDay": complete_days[-1] if complete_days else None,
            "partialInverterDay": partial_day,
            "partialInverterThrough": max(partial_timestamps).strftime("%H:%M") if partial_timestamps else None,
            "sensorAvailable": bool(sensor_bucket_values),
            "powerIntervalMinutes": 5,
            "meterSource": "electricity_energy_power",
            "inverterSource": "vcom_inverter_data",
            "irradianceSource": "solcast_data",
            "dataAsOf": latest_source_timestamp.isoformat() if latest_source_timestamp else None,
        },
        "days": days,
    }


@app.get("/health")
def health():
    try:
        with doris_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        return jsonify({"status": "ok", "source": "doris"})
    except Exception:
        app.logger.exception("Doris health check failed")
        return jsonify({"status": "unavailable"}), 503


@app.get("/api/precool")
def precool():
    try:
        start_day, end_day, start, end = parse_range()
        source = query_doris(start, end)
        response = jsonify(aggregate_payload(start_day, end_day, source))
        response.headers["Cache-Control"] = "private, no-store"
        return response
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 503
    except Exception:
        app.logger.exception("PreCool Doris query failed")
        return jsonify({"error": "Unable to query PreCool data from Doris."}), 500


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=int(os.getenv("DORIS_API_PORT", "8788")),
        debug=False,
        threaded=True,
    )
