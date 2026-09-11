"""Selected-period solar energy savings using the reporting tariff core.

Amounts are ex VAT. Demand charges, feed-in credits and operating costs are
deliberately excluded: these cards are not a monthly invoice or project profit.
No reporting evidence is persisted by this adapter.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo


def metric(amount=None, detail="", state=None, codes=()):
    return {"amount": round(float(amount), 2) if amount is not None else None,
            "state": state or ("ready" if amount is not None else "unavailable"),
            "detail": detail, "reasonCodes": list(codes)}


def ppa_applicable(contract_type):
    kind = (contract_type or "").strip().lower()
    if kind == "epc":
        return False
    if kind in {"ppa", "ipp", "spv"}:
        return True
    return None


def empty_result(site, message):
    unavailable = metric(detail=message)
    applicable = ppa_applicable(site.get("contractType"))
    return {
        "contractId": str(site["contractId"]), "currency": "ZAR", "basis": "energy-only",
        "ppaApplicable": applicable, "coveragePercent": None, "selfConsumedKwh": None,
        "municipalSavings": unavailable.copy(),
        "ppaIncome": metric(detail="Not applicable to this EPC contract", state="not-applicable") if applicable is False else unavailable.copy(),
        "netSavings": unavailable.copy(), "messages": [],
        "source": "Doris metering · reporting tariff engine",
    }


def load_site_financials(site, window):
    root = Path(os.getenv("REPORTING_ROOT", "/home/kavishchetty/reporting"))
    python = Path(os.getenv("REPORTING_PYTHON", str(root / "services/worker-py/.venv/bin/python")))
    source = Path(os.getenv("REPORTING_WORKER_SRC", str(root / "services/worker-py/src")))
    if not python.is_file() or not source.is_dir():
        return empty_result(site, "Reporting tariff engine is unavailable")
    args = {"site": {k: site.get(k) for k in ("contractId", "contractType", "contractTimeZone")},
            "start": window.start_utc.isoformat(), "end": window.end_utc.isoformat(),
            "workerSource": str(source)}
    try:
        result = subprocess.run([str(python), str(Path(__file__).resolve()), "--worker"],
                                input=json.dumps(args), capture_output=True, text=True,
                                timeout=80, check=False, env=os.environ.copy())
        if result.returncode != 0:
            return empty_result(site, "Financial calculation unavailable; retry the selected period")
        payload = json.loads(result.stdout)
        if not isinstance(payload, dict) or payload.get("contractId") != str(site["contractId"]):
            raise ValueError("Invalid financial result")
        return payload
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return empty_result(site, "Financial calculation unavailable; retry the selected period")


def _naive_utc(value):
    return value.astimezone(UTC).replace(tzinfo=None) if value.tzinfo else value


def selected_quantities(acquisition, metadata, start, end):
    """Align complete virtual-node intervals; never replace absent nodes with zero.

    The reporting source uses interval-end 30-minute register markers. Partial
    boundary intervals are prorated and labelled as estimates, not exact readings.
    """
    solar_id = metadata.solar_total_device_node_id
    municipal_id = metadata.municipal_total_device_node_id
    no_incomer = metadata.no_incomer_meter_installed is True
    if solar_id is None or (not no_incomer and municipal_id is None):
        return [], 0.0, ["Required solar or municipal meter mapping is missing"]
    required = {solar_id} if no_incomer else {solar_id, municipal_id}
    rows = {(r.device_node_id, _naive_utc(r.interval_start)): r for r in acquisition.resolved_intervals}
    duplicates = Counter((r.device_node_id, _naive_utc(r.interval_start)) for r in acquisition.resolved_intervals)
    quantities, notes = [], []
    if no_incomer:
        notes.append("Estimated self-consumption: this contract has no incomer meter; solar generation is used")
    covered = 0.0
    for (node_id, instant), solar in sorted(rows.items()):
        if node_id != solar_id:
            continue
        stop = _naive_utc(solar.interval_end)
        a, b = max(start, instant), min(end, stop)
        if b <= a:
            continue
        valid = True
        for required_id in required:
            row = rows.get((required_id, instant))
            active = [m for m in acquisition.mappings if m.device_node_id == required_id
                      and _naive_utc(m.valid_from) <= instant and _naive_utc(m.valid_to) >= stop]
            if (row is None or duplicates[(required_id, instant)] != 1 or not active
                    or row.contributing_meters != len(active)
                    or _naive_utc(row.interval_end) != stop
                    or not row.export_diff_wh.is_finite() or row.export_diff_wh < 0):
                valid = False
                break
        if not valid:
            continue
        export = Decimal(0) if no_incomer else rows[(municipal_id, instant)].export_diff_wh
        retained = solar.export_diff_wh - export
        if retained < 0:
            notes.append("Negative interval self-consumption was clamped to zero, following the reporting policy")
        fraction = Decimal(str((b - a).total_seconds())) / Decimal(str((stop - instant).total_seconds()))
        if fraction != 1:
            notes.append("Estimated boundary energy: partial 30-minute intervals are prorated")
        quantities.append((a, b, max(retained, Decimal(0)) / Decimal(1000) * fraction))
        covered += (b - a).total_seconds()
    coverage = min(100.0, covered / (end - start).total_seconds() * 100)
    if coverage < 99.999:
        notes.append("Partial data: amounts cover matched meter intervals only, not the complete selected period")
    return quantities, coverage, list(dict.fromkeys(notes))


def net_metric(municipal, ppa, applicable):
    if applicable is None:
        return metric(detail="PPA applicability is not recorded")
    if municipal["amount"] is None or (applicable and ppa["amount"] is None):
        return metric(detail="Requires municipal savings and any applicable PPA price")
    amount = Decimal(str(municipal["amount"])) - (Decimal(str(ppa["amount"])) if applicable else Decimal(0))
    state = "partial" if any(m["state"] == "partial" for m in (municipal, ppa)) else "ready"
    return metric(amount, "Customer benefit · municipal savings less PPA payment" if applicable
                  else "Customer benefit · no PPA deduction", state)


def pricing_scope_rows(rows, zone):
    """Zero-quantity exclusions satisfy the core's whole-day tariff cohort checks.

    These are not meter readings and never contribute to energy or coverage.
    Their explicit lineage distinguishes excluded time from measured zero usage.
    """
    first = rows[0][0].replace(tzinfo=UTC).astimezone(zone)
    last = rows[-1][1].replace(tzinfo=UTC).astimezone(zone) - timedelta(microseconds=1)
    scope_start = first.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(UTC).replace(tzinfo=None)
    scope_end = (last.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).astimezone(UTC).replace(tzinfo=None)
    result, cursor = [], scope_start
    for a, b, q in [*rows, (scope_end, scope_end, Decimal(0))]:
        while cursor < a:
            next_bucket = cursor.replace(minute=cursor.minute // 30 * 30, second=0, microsecond=0) + timedelta(minutes=30)
            stop = min(a, next_bucket)
            result.append((cursor, stop, Decimal(0), False))
            cursor = stop
        if b > a:
            result.append((a, b, q, True))
            cursor = b
    return result


def price_energy(quantities, profile_id, role_name, time_zone, loader, contract_id):
    from worker_py.ipp_spv_pricing.models import (
        EnergyDirection, PricingBillingScope, PricingComponent, PricingCoordinates,
        PricingRole, PricingScenario, PricingScenarioIdentity, ReportEnergyQuantity,
    )
    from worker_py.ipp_spv_pricing.projection import IppSpvPricingProjector, BlockedPricingProjection
    from worker_py.ipp_spv_pricing.service import IppSpvPricingService
    from worker_py.ipp_spv_pricing.tariff_profile_policy import is_no_tariff_provided_profile

    if profile_id is None or is_no_tariff_provided_profile(profile_id):
        return metric(detail="No tariff profile is configured for this contract", codes=("MISSING_TARIFF",)), None
    zone = ZoneInfo(time_zone)
    groups = defaultdict(list)
    # Keep tariff billing scopes separate by local month, including UTC month edges.
    for start, end, quantity in quantities:
        cursor = start
        while cursor < end:
            local = cursor.replace(tzinfo=UTC).astimezone(zone)
            next_month = local.replace(day=1, hour=0, minute=0) + timedelta(days=32)
            boundary = next_month.replace(day=1).astimezone(UTC).replace(tzinfo=None)
            stop = min(end, boundary)
            portion = quantity * Decimal(str((stop - cursor).total_seconds())) / Decimal(str((end - start).total_seconds()))
            groups[(local.year, local.month)].append((cursor, stop, portion))
            cursor = stop
    if not groups:
        return metric(detail="No matched meter readings for the selection"), None
    role = PricingRole(role_name)
    total, currency = Decimal(0), None
    for rows in groups.values():
        identity = f"vision:{contract_id}:{uuid4()}"
        inputs = []
        for index, (start, end, quantity, included) in enumerate(pricing_scope_rows(rows, zone)):
            start_utc, end_utc = start.replace(tzinfo=UTC), end.replace(tzinfo=UTC)
            coordinates = PricingCoordinates(start_utc, end_utc, start_utc.astimezone(zone), end_utc.astimezone(zone))
            directions = (EnergyDirection.IMPORTED, EnergyDirection.EXPORTED) if role is PricingRole.TARIFF_BACKED_PPA else (EnergyDirection.IMPORTED,)
            for direction in directions:
                inputs.append(ReportEnergyQuantity(
                    f"{identity}:{index}:{direction.value}", coordinates, direction, quantity,
                    {"contract_id": str(contract_id), "derivation": "SELF_CONSUMPTION" if included else "EXCLUDED_FROM_FINANCIAL_SELECTION",
                     "boundary": "IPP_SPV" if direction is EnergyDirection.EXPORTED else "OFFTAKER"}))
        start_date = inputs[0].coordinates.local_start.date()
        end_date = (inputs[-1].coordinates.local_end - timedelta(microseconds=1)).date() + timedelta(days=1)
        scenario = PricingScenario(
            role=role, component=PricingComponent.ENERGY, tariff_profile_id=int(profile_id),
            identity=PricingScenarioIdentity(identity + ":request", identity + ":input"),
            billing_scope=PricingBillingScope(identity + ":scope", start_date, end_date, time_zone, {"contract_id": str(contract_id)}),
            requested_quantity_types=("EXPORTED_ACTIVE_ENERGY", "IMPORTED_ACTIVE_ENERGY") if role is PricingRole.TARIFF_BACKED_PPA else ("IMPORTED_ACTIVE_ENERGY",),
            energy_quantities=tuple(inputs), demand_reduction=None, source_lineage={"contract_id": str(contract_id)},
        )
        service = IppSpvPricingService(configuration_loader=loader, engine_build_id="vision-site-energy@1",
                                       pricing_run_id_factory=lambda: str(uuid4()))
        projection = IppSpvPricingProjector().project(service.price((scenario,)).role_outcomes[0])
        if isinstance(projection, BlockedPricingProjection):
            return metric(detail="The configured tariff cannot price all selected intervals",
                          codes=projection.blocking_codes), None
        if currency is not None and currency != projection.currency:
            return metric(detail="Tariff currencies differ across this selection", codes=("CURRENCY_MISMATCH",)), None
        currency = projection.currency
        amount = projection.amount_excluding_vat if role is PricingRole.TARIFF_BACKED_PPA else projection.energy_amount_excluding_vat
        total += Decimal(amount.numerator) / Decimal(amount.denominator)
    return metric(total), currency


def ppa_chargeable_quantities(quantities, contract_start_date, time_zone):
    contract_start = datetime.combine(contract_start_date, datetime.min.time(), ZoneInfo(time_zone)).astimezone(UTC).replace(tzinfo=None)
    return [(max(a, contract_start), b, q * Decimal(str((b-max(a, contract_start)).total_seconds())) / Decimal(str((b-a).total_seconds())))
            for a, b, q in quantities if b > contract_start]


def worker_payload(args):
    sys.path.insert(0, args["workerSource"])
    from worker_py.clients import DorisSqlExecutor
    from worker_py.report_month_lineage.repository import ReportMonthLineageRepository
    from worker_py.tariff_pricing.provider import TariffConfigurationRepository
    from worker_py.ipp_spv_pricing.service import ProviderTariffConfigurationLoader
    from worker_py.virtual_meter import VirtualMeterRepository, VirtualMeterService

    site = args["site"]
    payload = empty_result(site, "No matched meter readings for the selection")
    if not all(os.getenv(key) for key in ("DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_DATABASE")):
        return empty_result(site, "Reporting database configuration is unavailable")
    start, end = datetime.fromisoformat(args["start"]), datetime.fromisoformat(args["end"])
    zone = site.get("contractTimeZone")
    if not zone:
        return empty_result(site, "Contract time zone is not configured")
    executor = DorisSqlExecutor(host=os.environ["DB_HOST"], port=int(os.environ["DB_PORT"]),
                                user=os.environ["DB_USER"], password=os.environ["DB_PASSWORD"],
                                database=os.environ["DB_DATABASE"], timeout_seconds=45)
    metadata = ReportMonthLineageRepository(executor).fetch_contract_report_metadata(int(site["contractId"]))
    payload["ppaApplicable"] = applicable = ppa_applicable(metadata.contract_type)
    source_start = start.replace(minute=start.minute // 30 * 30, second=0, microsecond=0)
    source_end = end.replace(minute=end.minute // 30 * 30, second=0, microsecond=0)
    if source_end < end:
        source_end += timedelta(minutes=30)
    ids = [i for i in (metadata.solar_total_device_node_id, metadata.municipal_total_device_node_id) if i is not None]
    acquisition = VirtualMeterService(VirtualMeterRepository(executor, os.environ["DB_DATABASE"])).acquire_period(ids, source_start, source_end)
    quantities, coverage, notes = selected_quantities(acquisition, metadata, start, end)
    payload.update(coveragePercent=round(coverage, 1), messages=notes,
                   selfConsumedKwh=round(float(sum((q for _, _, q in quantities), Decimal(0))), 3) if quantities else None)
    if not quantities:
        return payload
    loader = ProviderTariffConfigurationLoader(TariffConfigurationRepository(executor, os.environ["DB_DATABASE"]))
    def price(rows, profile, role):
        try:
            return price_energy(rows, profile, role, zone, loader, site["contractId"])
        except Exception:
            return metric(detail="Tariff calculation unavailable for this selection", codes=("TARIFF_PRICING_FAILED",)), None
    municipal, municipal_currency = price(quantities, metadata.municipal_tariff_id, "MUNICIPAL_AVOIDED_COST")
    municipal["tariffProfileId"] = metadata.municipal_tariff_id
    municipal["currency"] = municipal_currency or "ZAR"
    municipal["detail"] = "Avoided municipal energy cost" if municipal["amount"] is not None else municipal["detail"]
    ppa_currency = None
    if applicable is False:
        ppa = metric(detail="Not applicable to this EPC contract", state="not-applicable")
    elif applicable is None:
        ppa = metric(detail="PPA applicability is not recorded")
    elif metadata.contract_start_date is None:
        ppa = metric(detail="Contract start date is missing")
    else:
        chargeable = ppa_chargeable_quantities(quantities, metadata.contract_start_date, zone)
        if not chargeable:
            ppa = metric(0, "Before contract start · no PPA payment")
        else:
            ppa, ppa_currency = price(chargeable, metadata.ppa_tariff_id, "TARIFF_BACKED_PPA")
            if ppa["amount"] is not None:
                ppa["detail"] = "Solar owner income · customer's PPA payment"
    ppa["tariffProfileId"] = metadata.ppa_tariff_id if applicable else None
    ppa["currency"] = ppa_currency or municipal_currency or "ZAR"
    if notes:
        for item in (municipal, ppa):
            if item["amount"] is not None:
                item["state"] = "partial"
    net = net_metric(municipal, ppa, applicable)
    if municipal_currency and ppa_currency and municipal_currency != ppa_currency:
        net = metric(detail="Municipal and PPA tariff currencies differ")
    net["currency"] = municipal_currency or ppa_currency or "ZAR"
    payload.update(municipalSavings=municipal, ppaIncome=ppa, netSavings=net,
                   currency=municipal_currency or ppa_currency or "ZAR")
    return payload


if __name__ == "__main__":
    print(json.dumps(worker_payload(json.load(sys.stdin)), separators=(",", ":")))
