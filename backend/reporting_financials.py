from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4


DEFAULT_REPORTING_ROOT = Path("/home/kavishchetty/reporting")
PRICING_LOGIC_VERSION = "dashboard-tariff-pricing@1.0.0"


def _unavailable(
    message: str,
    *,
    reason_code: str = "MUNICIPAL_TARIFF_PRICING_UNAVAILABLE",
) -> dict[str, Any]:
    return {
        "state": "blocked",
        "reasonCodes": [reason_code],
        "messages": [message],
        "calculation": "worker_py.tariff_pricing",
        "sourceContractId": None,
        "tariffProfileId": None,
        "tariffProfileName": None,
        "tariffCurrency": None,
        "totalImportKwh": None,
        "totalExportKwh": None,
        "peakDemandKva": None,
        "peakDemandAt": None,
        "averageCostRPerKwh": None,
        "energyChargeR": None,
        "demandChargeR": None,
        "fixedChargeR": None,
        "otherChargeR": None,
        "subtotalExcludingVatR": None,
        "vatRatePercent": None,
        "vatAmountR": None,
        "totalIncludingVatR": None,
        "costLines": [],
    }


def load_municipal_financials(
    municipal_device_node_id: str | None,
    start_day: date,
    end_day: date,
) -> dict[str, Any]:
    if not municipal_device_node_id or not municipal_device_node_id.isdigit():
        return _unavailable(
            "The solar contract does not identify a municipal total Device Node.",
            reason_code="MUNICIPAL_TOTAL_DEVICE_NODE_MISSING",
        )

    reporting_root = Path(
        os.getenv("REPORTING_ROOT", str(DEFAULT_REPORTING_ROOT))
    )
    python = Path(
        os.getenv(
            "REPORTING_PYTHON",
            str(reporting_root / "services" / "worker-py" / ".venv" / "bin" / "python"),
        )
    )
    worker_source = Path(
        os.getenv(
            "REPORTING_WORKER_SRC",
            str(reporting_root / "services" / "worker-py" / "src"),
        )
    )
    if not python.is_file() or not worker_source.is_dir():
        return _unavailable(
            "The reporting tariff-pricing runtime is not available on this host.",
            reason_code="REPORTING_TARIFF_RUNTIME_MISSING",
        )

    try:
        result = subprocess.run(
            [
                str(python),
                str(Path(__file__).resolve()),
                "--worker",
                "--device-node-id",
                municipal_device_node_id,
                "--from",
                start_day.isoformat(),
                "--to",
                end_day.isoformat(),
                "--worker-source",
                str(worker_source),
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=90,
            env=os.environ.copy(),
        )
    except (OSError, subprocess.TimeoutExpired):
        return _unavailable(
            "The reporting tariff-pricing run could not be completed.",
            reason_code="REPORTING_TARIFF_RUNTIME_FAILED",
        )

    if result.returncode != 0:
        return _unavailable(
            "The reporting tariff-pricing run did not produce a complete Pricing Result.",
            reason_code="REPORTING_TARIFF_PRICING_FAILED",
        )
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return _unavailable(
            "The reporting tariff-pricing result could not be read.",
            reason_code="REPORTING_TARIFF_RESULT_INVALID",
        )
    return payload if isinstance(payload, dict) else _unavailable(
        "The reporting tariff-pricing result had an invalid shape.",
        reason_code="REPORTING_TARIFF_RESULT_INVALID",
    )


def _worker_payload(
    device_node_id: int,
    start_day: date,
    end_day: date,
    worker_source: Path,
) -> dict[str, Any]:
    sys.path.insert(0, str(worker_source))

    from worker_py.clients import DorisSqlExecutor
    from worker_py.doris_identifiers import DorisRelationQualifier
    from worker_py.single_meter_period import (
        SingleMeterContractRepository,
        SingleMeterPeriodLoader,
        calculate_current_metrics,
    )
    from worker_py.single_meter_pricing import (
        SingleMeterPricingContext,
        SingleMeterPricingService,
    )
    from worker_py.single_meter_pricing.historical_demand_repository import (
        SingleMeterHistoricalDemandRepository,
    )
    from worker_py.tariff_pricing.provider import TariffConfigurationRepository
    from worker_py.virtual_meter import VirtualMeterRepository, VirtualMeterService

    required = ("DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_DATABASE")
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        return _unavailable(
            "Doris credentials are unavailable to the reporting tariff-pricing runtime.",
            reason_code="REPORTING_DORIS_CONFIGURATION_MISSING",
        )

    database = os.environ["DB_DATABASE"]
    executor = DorisSqlExecutor(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=database,
        timeout_seconds=90,
    )
    relation = DorisRelationQualifier(database).relation("mv_contracts_single_meter")
    candidates = executor.fetch_all(
        f"""
        SELECT contract_id
        FROM {relation}
        WHERE device_node_id = %s
          AND (valid_from IS NULL OR valid_from < %s)
          AND (valid_to IS NULL OR valid_to > %s)
        ORDER BY contract_id
        LIMIT 2
        """,
        (
            device_node_id,
            datetime.combine(end_day + timedelta(days=1), datetime.min.time()),
            datetime.combine(start_day, datetime.min.time()),
        ),
    )
    if not candidates:
        return _unavailable(
            "No Single Meter contract is mapped to this municipal total for the selected dates.",
            reason_code="MUNICIPAL_SINGLE_METER_CONTRACT_MISSING",
        )
    if len(candidates) > 1:
        return _unavailable(
            "More than one Single Meter contract is mapped to this municipal total.",
            reason_code="MUNICIPAL_SINGLE_METER_CONTRACT_AMBIGUOUS",
        )

    contract_id = str(candidates[0]["contract_id"])
    period_start = f"{start_day.isoformat()}T00:00:00Z"
    period_end = f"{(end_day + timedelta(days=1)).isoformat()}T00:00:00Z"
    virtual_meter_service = VirtualMeterService(
        VirtualMeterRepository(executor, database)
    )
    loader = SingleMeterPeriodLoader(
        SingleMeterContractRepository(executor, database),
        virtual_meter_service,
    )
    dataset = loader.load(contract_id, period_start, period_end)
    if dataset.contract is None:
        return _unavailable(
            "The mapped Single Meter contract could not be loaded.",
            reason_code="MUNICIPAL_SINGLE_METER_CONTRACT_UNAVAILABLE",
        )

    current_metrics = calculate_current_metrics(dataset.resolved_intervals)
    pricing_service = SingleMeterPricingService(
        TariffConfigurationRepository(executor, database),
        SingleMeterHistoricalDemandRepository(executor, database),
        virtual_meter_service,
    )
    projection = pricing_service.price_single_meter_period(
        SingleMeterPricingContext(
            run_id=str(uuid4()),
            logic_version=PRICING_LOGIC_VERSION,
            contract=dataset.contract,
            dataset=dataset,
        ),
        current_metrics,
        attempt_number=1,
        previous_run_id=None,
    )

    return {
        "state": projection.section_readiness.state,
        "reasonCodes": list(projection.section_readiness.reasonCodes),
        "messages": list(projection.section_readiness.messages),
        "calculation": "worker_py.tariff_pricing",
        "sourceContractId": contract_id,
        "tariffProfileId": projection.tariff_profile_id,
        "tariffProfileName": projection.tariff_profile_name,
        "tariffCurrency": projection.tariff_currency,
        "totalImportKwh": (
            float(current_metrics.total_import_kwh)
            if current_metrics.total_import_kwh is not None
            else None
        ),
        "totalExportKwh": (
            float(current_metrics.total_export_kwh)
            if current_metrics.total_export_kwh is not None
            else None
        ),
        "peakDemandKva": (
            float(current_metrics.peak_demand_kva)
            if current_metrics.peak_demand_kva is not None
            else None
        ),
        "peakDemandAt": (
            current_metrics.peak_demand_at.isoformat()
            if current_metrics.peak_demand_at is not None
            else None
        ),
        "averageCostRPerKwh": projection.average_cost_r_per_kwh,
        "energyChargeR": projection.energy_charge_r,
        "demandChargeR": projection.demand_charge_r,
        "fixedChargeR": projection.fixed_charge_r,
        "otherChargeR": projection.other_charge_r,
        "subtotalExcludingVatR": projection.subtotal_excluding_vat_r,
        "vatRatePercent": projection.vat_rate_percent,
        "vatAmountR": projection.vat_amount_r,
        "totalIncludingVatR": projection.total_including_vat_r,
        "costLines": [
            line.to_manifest_dict() for line in projection.cost_lines
        ],
    }


def _parse_day(value: str) -> date:
    return date.fromisoformat(value)


def _main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--worker", action="store_true")
    parser.add_argument("--device-node-id", type=int, required=True)
    parser.add_argument("--from", dest="start_day", type=_parse_day, required=True)
    parser.add_argument("--to", dest="end_day", type=_parse_day, required=True)
    parser.add_argument("--worker-source", type=Path, required=True)
    args = parser.parse_args()
    payload = _worker_payload(
        args.device_node_id,
        args.start_day,
        args.end_day,
        args.worker_source,
    )
    print(json.dumps(payload, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
