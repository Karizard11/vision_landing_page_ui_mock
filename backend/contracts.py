from __future__ import annotations

import math
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any
from time_context import doris_utc_to_sast, sast_bucket_datetime


PROVIDER_NAME = "Terradew Four"
EXPECTED_READINGS_PER_DAY = 288


def _number(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return result if math.isfinite(result) else default


def _optional_number(value: Any) -> float | None:
    if value is None:
        return None
    result = _number(value, float("nan"))
    return result if math.isfinite(result) else None


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _identifier(value: Any) -> str:
    text = _text(value)
    return text[:-2] if text.endswith(".0") and text[:-2].isdigit() else text


def _phase_suffix(value: Any) -> str:
    phase = _text(value)
    return "" if phase in {"", "1", "1.0"} else f" | Phase {phase}"


def contract_navigation_label(row: dict[str, Any]) -> str:
    return f"{_text(row.get('project_code'))} | {_text(row.get('site_name'))}{_phase_suffix(row.get('contract_phase'))}"


def _series_key(device_node_id: Any) -> str:
    return "node_" + re.sub(r"[^a-zA-Z0-9]+", "_", _identifier(device_node_id)).strip("_")


def _physical(row: dict[str, Any]) -> bool:
    serial = _text(row.get("meter_serial"))
    mode = _text(row.get("device_node_calc_mode")).upper()
    return bool(serial) and mode in {"", "GROSS_METERING"}


def _select(cursor, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    cursor.execute(sql, params)
    return list(cursor.fetchall())


def _navigation_nodes(
    contract: dict[str, Any],
    hierarchy_rows: list[dict[str, Any]],
    role_serials: dict[str, list[str]],
) -> list[dict[str, Any]]:
    site_id = _identifier(contract.get("site_id"))
    site_rows = [row for row in hierarchy_rows if _identifier(row.get("site_id")) == site_id]
    contract_id = _identifier(contract.get("contract_id"))
    site_total_id = f"site-total-{contract_id}"
    load_total_id = _identifier(contract.get("load_device_node_id"))
    municipal_total_id = _identifier(contract.get("municipal_total_device_node_id")) or f"municipal-total-{contract_id}"
    solar_total_id = _identifier(contract.get("solar_total_device_node_id")) or f"solar-total-{contract_id}"
    role_ids = {value for value in (load_total_id, municipal_total_id, solar_total_id) if value}
    grouped: dict[str, dict[str, Any]] = {}
    for row in site_rows:
        device_node_id = _identifier(row.get("device_node_id"))
        if not device_node_id:
            continue
        record = grouped.setdefault(
            device_node_id,
            {
                "id": device_node_id,
                "parentDeviceNodeIds": set(),
                "name": _text(row.get("device_node_name")),
                "type": _text(row.get("device_node_type")) or "Meter",
                "meterSerials": set(),
                "physicalMeterSerials": set(),
            },
        )
        parent_device_node_id = _identifier(row.get("parent_device_node_id"))
        if parent_device_node_id:
            record["parentDeviceNodeIds"].add(parent_device_node_id)
        meter_serial = _text(row.get("meter_serial"))
        if meter_serial:
            record["meterSerials"].add(meter_serial)
        if _physical(row):
            record["physicalMeterSerials"].add(meter_serial)

    physical = {
        key: value for key, value in grouped.items()
        if value["physicalMeterSerials"] and key not in role_ids
    }
    hierarchy_children: dict[str, set[str]] = defaultdict(set)
    for child_id, record in grouped.items():
        for parent_id in record["parentDeviceNodeIds"]:
            if parent_id in grouped and parent_id != child_id:
                hierarchy_children[parent_id].add(child_id)

    def rollup_serials(device_node_id: str, trail: set[str] | None = None) -> set[str]:
        if device_node_id not in grouped:
            return set()
        seen = set(trail or ())
        if device_node_id in seen:
            return set()
        seen.add(device_node_id)
        own_serials = set(grouped[device_node_id]["meterSerials"])
        if own_serials:
            return own_serials
        return {
            serial
            for child_id in hierarchy_children.get(device_node_id, set())
            for serial in rollup_serials(child_id, seen)
        }

    def is_load_record(record: dict[str, Any]) -> bool:
        descriptor = f"{record['name']} {record['type']}".lower()
        return "load" in descriptor or "remainder" in descriptor

    base_records = {
        key: value for key, value in grouped.items()
        if key not in role_ids and (value["physicalMeterSerials"] or is_load_record(value))
    }

    role_navigation = {
        load_total_id: "load-total",
        municipal_total_id: "municipal-total",
        solar_total_id: "solar-total",
    }

    def base_parent_navigation(device_node_id: str, record: dict[str, Any]) -> str:
        parent_order = lambda parent_id: (
            parent_id not in base_records,
            role_navigation.get(parent_id) == "solar-total",
            parent_id,
        )
        pending = sorted(record["parentDeviceNodeIds"], key=parent_order)
        visited: set[str] = {device_node_id}
        while pending:
            parent_id = pending.pop(0)
            if parent_id in visited:
                continue
            visited.add(parent_id)
            if parent_id in role_navigation:
                return role_navigation[parent_id]
            if parent_id in base_records:
                return f"base-{parent_id}"
            parent_record = grouped.get(parent_id)
            if parent_record:
                pending.extend(sorted(parent_record["parentDeviceNodeIds"]))
                pending.sort(key=parent_order)
        return "load-total" if load_total_id and is_load_record(record) else "municipal-total"

    load_total_serials = set(role_serials.get("load", []))
    if not load_total_serials and load_total_id:
        load_total_serials = rollup_serials(load_total_id)
    nodes: list[dict[str, Any]] = [
        {
            "id": site_total_id, "navigationKey": "site-total", "name": "Site Total",
            "type": "Site total",
            "meters": len(load_total_serials | set(role_serials.get("municipal", [])) | set(role_serials.get("solar", []))),
            "seriesKey": "site",
            "meterSerials": sorted(load_total_serials | set(role_serials.get("municipal", [])) | set(role_serials.get("solar", []))),
            "isPhysical": False, "measurementKind": "calculated",
        },
        {
            "id": municipal_total_id, "navigationKey": "municipal-total",
            "parentNavigationKey": "site-total", "name": "Municipal Total",
            "type": "Municipal total", "meters": len(role_serials.get("municipal", [])),
            "seriesKey": "grid", "meterSerials": role_serials.get("municipal", []),
            "isPhysical": False,
            "measurementKind": "metered" if role_serials.get("municipal") else "calculated",
        },
        {
            "id": solar_total_id, "navigationKey": "solar-total",
            "parentNavigationKey": "site-total", "name": "Solar Total",
            "type": "Solar total", "meters": len(role_serials.get("solar", [])),
            "seriesKey": "solar", "meterSerials": role_serials.get("solar", []),
            "isPhysical": False,
            "measurementKind": "metered" if role_serials.get("solar") else "calculated",
        },
    ]
    if load_total_id:
        nodes.insert(1, {
            "id": load_total_id, "navigationKey": "load-total",
            "parentNavigationKey": "site-total", "name": "Load Total",
            "type": "Load total", "meters": len(load_total_serials),
            "seriesKey": "load", "meterSerials": sorted(load_total_serials),
            "isPhysical": False,
            "measurementKind": "metered" if load_total_serials else "calculated",
        })

    for device_node_id, record in base_records.items():
        is_physical = bool(record["physicalMeterSerials"])
        serials = set(record["meterSerials"]) or rollup_serials(device_node_id)
        nodes.append({
            "id": record["id"], "navigationKey": f"base-{device_node_id}",
            "parentNavigationKey": base_parent_navigation(device_node_id, record),
            "name": record["name"] or (f"Load {record['id']}" if is_load_record(record) else f"Meter {record['id']}"),
            "type": record["type"],
            "meters": len(serials), "seriesKey": _series_key(record["id"]),
            "meterSerials": sorted(serials), "isPhysical": is_physical,
            "measurementKind": "metered" if is_physical else "calculated",
        })

    solar_physical = {
        key: value for key, value in physical.items()
        if "solar" in value["type"].lower() or "pv" in value["name"].lower()
    }
    for device_node_id, record in solar_physical.items():
        parents = [parent for parent in record["parentDeviceNodeIds"] if parent in solar_physical and parent != device_node_id]
        parent = sorted(parents)[0] if parents else None
        nodes.append({
            "id": record["id"], "navigationKey": f"solar-{device_node_id}",
            "parentNavigationKey": f"solar-{parent}" if parent else "solar-total",
            "name": record["name"] or f"Solar meter {record['id']}", "type": record["type"],
            "meters": len(record["meterSerials"]), "seriesKey": _series_key(record["id"]),
            "meterSerials": sorted(record["meterSerials"]), "isPhysical": True,
            "measurementKind": "metered",
        })
    children: dict[str | None, list[dict[str, Any]]] = defaultdict(list)
    for node in nodes:
        children[node.get("parentNavigationKey")].append(node)
    ordered: list[dict[str, Any]] = []
    seen: set[str] = set()

    def visit(node: dict[str, Any]) -> None:
        key = node["navigationKey"]
        if key in seen:
            return
        seen.add(key)
        ordered.append(node)
        for child in children.get(key, []):
            visit(child)

    for root in children.get(None, []):
        visit(root)
    for node in nodes:
        visit(node)
    return ordered


def query_contract_catalog(connection) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        contracts = _select(
            cursor,
            """
            SELECT DISTINCT c.contract_id, c.contract_phase, c.site_id, c.site_name,
                   c.project_code, c.provider_name, c.practical_completion_date,
                   c.current_ppa_rate, c.yield_guarantee, c.system_size_kwp,
                   c.system_yield_kwh_year, c.solar_total_device_node_id,
                   c.municipal_total_device_node_id, c.load_device_node_id,
                   c.bluelog_total_node_id, c.no_incomer_meter_installed,
                   bridge.system_key, systems.city, systems.commission_date,
                   systems.nominal_power, systems.system_active
            FROM mv_contracts_solar c
            LEFT JOIN mv_device_bluelogs bridge
              ON bridge.device_node_id = c.bluelog_total_node_id
            LEFT JOIN vcom_systems systems
              ON systems.system_key = bridge.system_key
            WHERE c.provider_name = %s
              AND c.contract_type_id = 2
              AND c.project_code IS NOT NULL
            ORDER BY c.project_code, c.contract_phase, c.contract_id
            """,
            (PROVIDER_NAME,),
        )
        site_ids = sorted({_identifier(row.get("site_id")) for row in contracts if row.get("site_id")})
        hierarchy_rows: list[dict[str, Any]] = []
        if site_ids:
            placeholders = ", ".join(["%s"] * len(site_ids))
            hierarchy_rows = _select(
                cursor,
                f"""
                SELECT s.site_id, s.id AS sld_id, s.name AS sld_name,
                       node.id AS sld_node_id, node.device_node_id,
                       node.parent_node_id AS parent_sld_node_id,
                       parent.device_node_id AS parent_device_node_id,
                       meter.device_node_name, meter.device_node_type,
                       meter.meter_serial, meter.device_node_calc_mode
                FROM prod.sld s
                JOIN prod.sld_device_nodes node ON node.sld_id = s.id
                LEFT JOIN prod.sld_device_nodes parent ON parent.id = node.parent_node_id
                LEFT JOIN mv_device_electricity_meters meter
                  ON meter.device_node_id = node.device_node_id
                WHERE s.site_id IN ({placeholders})
                ORDER BY s.site_id, s.id, node.id, meter.meter_serial
                """,
                tuple(site_ids),
            )
        role_ids = sorted({
            _identifier(row.get(column))
            for row in contracts
            for column in ("solar_total_device_node_id", "municipal_total_device_node_id", "load_device_node_id")
            if row.get(column)
        })
        role_rows: list[dict[str, Any]] = []
        if role_ids:
            placeholders = ", ".join(["%s"] * len(role_ids))
            role_rows = _select(
                cursor,
                f"""
                SELECT device_node_id, meter_serial, device_node_calc_mode
                FROM mv_device_electricity_meters
                WHERE device_node_id IN ({placeholders})
                  AND meter_serial IS NOT NULL
                """,
                tuple(role_ids),
            )

    role_lookup: dict[str, set[str]] = defaultdict(set)
    for row in role_rows:
        if _physical(row):
            role_lookup[_identifier(row.get("device_node_id"))].add(_text(row.get("meter_serial")))

    sites: list[dict[str, Any]] = []
    for row in contracts:
        role_serials = {
            "solar": sorted(role_lookup[_identifier(row.get("solar_total_device_node_id"))]),
            "municipal": sorted(role_lookup[_identifier(row.get("municipal_total_device_node_id"))]),
            "load": sorted(role_lookup[_identifier(row.get("load_device_node_id"))]),
        }
        nodes = _navigation_nodes(row, hierarchy_rows, role_serials)
        physical_serials = {
            serial for node in nodes if node.get("isPhysical")
            for serial in node.get("meterSerials", [])
        }
        commissioned = row.get("practical_completion_date") or row.get("commission_date")
        sites.append({
            "contractId": _identifier(row.get("contract_id")),
            "siteId": _identifier(row.get("site_id")),
            "phaseNumber": _text(row.get("contract_phase")) or None,
            "providerName": _text(row.get("provider_name")),
            "displayName": contract_navigation_label(row),
            "code": _text(row.get("project_code")),
            "name": _text(row.get("site_name")),
            "city": _text(row.get("city")) or "South Africa",
            "capacityKwp": _number(row.get("system_size_kwp") or row.get("nominal_power")),
            "annualYieldKwh": _number(row.get("system_yield_kwh_year")),
            "guarantee": _number(row.get("yield_guarantee")),
            "tariff": _optional_number(row.get("current_ppa_rate")),
            "commissioned": commissioned.strftime("%d %b %Y") if hasattr(commissioned, "strftime") else _text(commissioned),
            "meterCount": len(physical_serials),
            "nodeCount": len({node["navigationKey"] for node in nodes}),
            "systemKey": _text(row.get("system_key")),
            "solarTotalDeviceNodeId": _identifier(row.get("solar_total_device_node_id")) or None,
            "municipalTotalDeviceNodeId": _identifier(row.get("municipal_total_device_node_id")) or None,
            "loadDeviceNodeId": _identifier(row.get("load_device_node_id")) or None,
            "systemActive": bool(row.get("system_active")) if row.get("system_active") is not None else None,
            "solarMeterSerials": role_serials["solar"],
            "municipalMeterSerials": role_serials["municipal"],
            "loadMeterSerials": role_serials["load"],
            "nodes": nodes,
        })
    return sites


def _as_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    return datetime.fromisoformat(str(value))


def _inverter_code(name: Any, inverter_id: Any) -> str:
    match = re.match(r"^(\d+)", _text(name))
    if match:
        return match.group(1).zfill(2)
    fallback = re.search(r"(\d+)$", _text(inverter_id))
    return fallback.group(1).zfill(2) if fallback else _text(inverter_id)


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _register_delta(rows: list[dict[str, Any]], field: str) -> float:
    values = [_optional_number(row.get(field)) for row in rows]
    clean = [value for value in values if value is not None and value >= 0]
    return max(clean[-1] - clean[0], 0) if len(clean) > 1 else 0


def query_contract_source(
    connection,
    site: dict[str, Any],
    start: datetime,
    end: datetime,
    daily: bool,
) -> dict[str, Any]:
    serials = sorted({
        serial for node in site["nodes"]
        for serial in node.get("meterSerials", [])
    })
    system_key = site.get("systemKey")
    with connection.cursor() as cursor:
        meters: list[dict[str, Any]] = []
        if serials:
            placeholders = ", ".join(["%s"] * len(serials))
            if daily:
                meters = _select(
                    cursor,
                    f"""
                    SELECT DATE(DATE_ADD(timestamp, INTERVAL 2 HOUR)) AS bucket_date, meter_serial,
                           MIN(import_wh) AS import_start, MAX(import_wh) AS import_end,
                           MIN(export_wh) AS export_start, MAX(export_wh) AS export_end,
                           MAX(ABS(ptot)) AS peak_ptot,
                           MAX(ABS(stot)) AS peak_stot, COUNT(*) AS readings
                    FROM electricity_energy_power
                    WHERE meter_serial IN ({placeholders})
                      AND timestamp >= %s AND timestamp < %s
                    GROUP BY DATE(DATE_ADD(timestamp, INTERVAL 2 HOUR)), meter_serial
                    ORDER BY DATE(DATE_ADD(timestamp, INTERVAL 2 HOUR)), meter_serial
                    """,
                    (*serials, start, end),
                )
            else:
                meters = _select(
                    cursor,
                    f"""
                    SELECT timestamp, meter_serial, import_wh, export_wh, ptot, stot
                    FROM electricity_energy_power
                    WHERE meter_serial IN ({placeholders})
                      AND timestamp >= %s AND timestamp < %s
                    ORDER BY timestamp, meter_serial
                    """,
                    (*serials, start, end),
                )
        inverters: list[dict[str, Any]] = []
        solcast: list[dict[str, Any]] = []
        sensors: list[dict[str, Any]] = []
        if system_key:
            if daily:
                inverters = _select(
                    cursor,
                    """
                    SELECT DATE(DATE_ADD(d.timestamp, INTERVAL 2 HOUR)) AS bucket_date, d.inverter_id,
                           i.inverter_name, i.inverter_model,
                           MAX(d.P_AC) AS peak_ac, MAX(d.P_DC) AS peak_dc,
                           MAX(d.E_DAY) AS energy_day, MAX(d.E_TOTAL) AS cumulative,
                           COUNT(*) AS readings
                    FROM vcom_inverter_data d
                    LEFT JOIN vcom_inverters i
                      ON i.system_key = d.system_key AND i.inverter_id = d.inverter_id
                    WHERE d.system_key = %s AND d.timestamp >= %s AND d.timestamp < %s
                    GROUP BY DATE(DATE_ADD(d.timestamp, INTERVAL 2 HOUR)), d.inverter_id, i.inverter_name, i.inverter_model
                    ORDER BY DATE(DATE_ADD(d.timestamp, INTERVAL 2 HOUR)), d.inverter_id
                    """,
                    (system_key, start, end),
                )
                solcast = _select(
                    cursor,
                    """
                    SELECT DATE(DATE_ADD(period_end, INTERVAL 90 MINUTE)) AS bucket_date,
                           SUM(ghi) * 0.5 / 1000 AS irradiation_kwh_m2,
                           MAX(ghi) AS peak_ghi
                    FROM solcast_data
                    WHERE system_key = %s AND period_end >= %s AND period_end < %s
                    GROUP BY DATE(DATE_ADD(period_end, INTERVAL 90 MINUTE)) ORDER BY DATE(DATE_ADD(period_end, INTERVAL 90 MINUTE))
                    """,
                    (system_key, start + timedelta(minutes=30), end + timedelta(minutes=30)),
                )
                sensors = _select(
                    cursor,
                    """
                    SELECT DATE(DATE_ADD(timestamp, INTERVAL 2 HOUR)) AS bucket_date, MAX(SRAD) AS peak_srad,
                           COUNT(*) AS readings
                    FROM vcom_sensor_data
                    WHERE system_key = %s AND timestamp >= %s AND timestamp < %s
                    GROUP BY DATE(DATE_ADD(timestamp, INTERVAL 2 HOUR)) ORDER BY DATE(DATE_ADD(timestamp, INTERVAL 2 HOUR))
                    """,
                    (system_key, start, end),
                )
            else:
                inverters = _select(
                    cursor,
                    """
                    SELECT d.timestamp, d.inverter_id, i.inverter_name, i.inverter_model,
                           d.P_AC, d.P_DC, d.E_DAY, d.E_TOTAL
                    FROM vcom_inverter_data d
                    LEFT JOIN vcom_inverters i
                      ON i.system_key = d.system_key AND i.inverter_id = d.inverter_id
                    WHERE d.system_key = %s AND d.timestamp >= %s AND d.timestamp < %s
                    ORDER BY d.timestamp, d.inverter_id
                    """,
                    (system_key, start, end),
                )
                solcast = _select(
                    cursor,
                    """
                    SELECT DATE_SUB(period_end, INTERVAL 30 MINUTE) AS timestamp, ghi
                    FROM solcast_data
                    WHERE system_key = %s AND period_end >= %s AND period_end < %s
                    ORDER BY period_end
                    """,
                    (system_key, start + timedelta(minutes=30), end + timedelta(minutes=30)),
                )
                sensors = _select(
                    cursor,
                    """
                    SELECT timestamp, SRAD
                    FROM vcom_sensor_data
                    WHERE system_key = %s AND timestamp >= %s AND timestamp < %s
                    ORDER BY timestamp
                    """,
                    (system_key, start, end),
                )
    if not daily:
        for collection in (meters, inverters, solcast, sensors):
            for row in collection:
                if row.get("timestamp") is not None:
                    row["timestamp"] = doris_utc_to_sast(row["timestamp"])
    return {"meters": meters, "inverters": inverters, "solcast": solcast, "sensors": sensors, "daily": daily}


def aggregate_contract_payload(
    site: dict[str, Any],
    start_day: date,
    end_day: date,
    source: dict[str, Any],
    financials: dict[str, Any] | None = None,
) -> dict[str, Any]:
    daily = bool(source["daily"])
    days = [(start_day + timedelta(days=index)).isoformat() for index in range((end_day - start_day).days + 1)]
    meter_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    meter_buckets: dict[tuple[str, int, str, str], list[float]] = defaultdict(list)
    for row in source["meters"]:
        timestamp = sast_bucket_datetime(row.get("bucket_date")) if daily else _as_datetime(row.get("timestamp"))
        day = timestamp.date().isoformat()
        serial = _text(row.get("meter_serial"))
        meter_groups[(day, serial)].append(row)
        if not daily:
            bucket = timestamp.hour * 12 + timestamp.minute // 5
            for field in ("ptot", "stot"):
                value = _optional_number(row.get(field))
                if value is not None:
                    meter_buckets[(day, bucket, serial, field)].append(abs(value) / 1000)

    inverter_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    inverter_buckets: dict[tuple[str, int, str, str], list[float]] = defaultdict(list)
    for row in source["inverters"]:
        timestamp = sast_bucket_datetime(row.get("bucket_date")) if daily else _as_datetime(row.get("timestamp"))
        day = timestamp.date().isoformat()
        inverter_id = _text(row.get("inverter_id"))
        inverter_groups[(day, inverter_id)].append(row)
        if not daily:
            code = _inverter_code(row.get("inverter_name"), inverter_id)
            bucket = timestamp.hour * 12 + timestamp.minute // 5
            for field in ("P_AC", "P_DC"):
                value = _optional_number(row.get(field))
                if value is not None:
                    inverter_buckets[(day, bucket, code, field)].append(value / 1000)

    solcast_buckets: dict[tuple[str, int], list[float]] = defaultdict(list)
    solcast_days: dict[str, list[float]] = defaultdict(list)
    for row in source["solcast"]:
        timestamp = sast_bucket_datetime(row.get("bucket_date")) if daily else _as_datetime(row.get("timestamp"))
        day = timestamp.date().isoformat()
        if daily:
            solcast_days[day].append(_number(row.get("irradiation_kwh_m2")))
        else:
            value = _optional_number(row.get("ghi"))
            if value is not None:
                solcast_days[day].append(value)
                solcast_buckets[(day, timestamp.hour * 12 + timestamp.minute // 5)].append(value)
    sensor_buckets: dict[tuple[str, int], list[float]] = defaultdict(list)
    sensor_days: dict[str, list[float]] = defaultdict(list)
    for row in source["sensors"]:
        timestamp = sast_bucket_datetime(row.get("bucket_date")) if daily else _as_datetime(row.get("timestamp"))
        day = timestamp.date().isoformat()
        value = _optional_number(row.get("peak_srad") if daily else row.get("SRAD"))
        if value is not None and value >= 0:
            sensor_days[day].append(value)
            if not daily:
                sensor_buckets[(day, timestamp.hour * 12 + timestamp.minute // 5)].append(value)

    solar_serials = set(site.get("solarMeterSerials", []))
    grid_serials = set(site.get("municipalMeterSerials", []))
    load_serials = set(site.get("loadMeterSerials", []))
    if not load_serials:
        load_serials = {
            serial
            for node in site["nodes"]
            if node.get("navigationKey") == "load-total"
            for serial in node.get("meterSerials", [])
        }
    if not solar_serials:
        solar_serials = {
            serial for node in site["nodes"]
            if "solar" in node["type"].lower()
            for serial in node.get("meterSerials", [])
        }
    if not grid_serials:
        grid_serials = {
            serial for node in site["nodes"]
            if node.get("isPhysical") and "solar" not in node["type"].lower()
            for serial in node.get("meterSerials", [])
        }

    payload_days: dict[str, Any] = {}
    latest_timestamp: datetime | None = None
    for collection in ("meters", "inverters", "solcast", "sensors"):
        for row in source[collection]:
            raw = row.get("timestamp") or row.get("bucket_date")
            if raw:
                timestamp = sast_bucket_datetime(raw) if daily else _as_datetime(raw)
                latest_timestamp = timestamp if latest_timestamp is None or timestamp > latest_timestamp else latest_timestamp

    for day in days:
        serial_energy: dict[tuple[str, bool], float] = {}
        serial_peak: dict[str, float] = {}
        serial_apparent_peak: dict[str, float] = {}
        serial_readings: dict[str, int] = {}
        all_serials = {serial for node in site["nodes"] for serial in node.get("meterSerials", [])}
        for serial in all_serials:
            rows = meter_groups[(day, serial)]
            if daily and rows:
                row = rows[0]
                serial_energy[(serial, False)] = max(_number(row.get("import_end")) - _number(row.get("import_start")), 0) / 1_000_000
                serial_energy[(serial, True)] = max(_number(row.get("export_end")) - _number(row.get("export_start")), 0) / 1_000_000
                serial_peak[serial] = _number(row.get("peak_ptot")) / 1000
                serial_apparent_peak[serial] = _number(row.get("peak_stot")) / 1000
                serial_readings[serial] = int(row.get("readings") or 0)
            else:
                serial_energy[(serial, False)] = _register_delta(rows, "import_wh") / 1_000_000
                serial_energy[(serial, True)] = _register_delta(rows, "export_wh") / 1_000_000
                serial_peak[serial] = max([abs(_number(row.get("ptot"))) / 1000 for row in rows] or [0])
                serial_apparent_peak[serial] = max([abs(_number(row.get("stot"))) / 1000 for row in rows] or [0])
                serial_readings[serial] = len(rows)

        meters: dict[str, Any] = {}
        for node in site["nodes"]:
            key = node.get("seriesKey")
            if not key or key in {"site", "solar", "grid", "load"}:
                continue
            serials = set(node.get("meterSerials", []))
            is_solar = "solar" in node["type"].lower()
            meters[key] = {
                "energyMwh": round(sum(serial_energy[(serial, is_solar)] for serial in serials), 6),
                "peakKw": round(sum(serial_peak.get(serial, 0) for serial in serials), 3),
                "peakKva": round(sum(serial_apparent_peak.get(serial, 0) for serial in serials), 3),
                "readings": sum(serial_readings.get(serial, 0) for serial in serials),
            }

        solar_energy = sum(serial_energy[(serial, True)] for serial in solar_serials)
        grid_energy = sum(serial_energy[(serial, False)] for serial in grid_serials)
        grid_export = sum(serial_energy[(serial, True)] for serial in grid_serials) * 1000
        load_energy = sum(serial_energy[(serial, False)] for serial in load_serials)
        meters["solar"] = {
            "energyMwh": round(solar_energy, 6),
            "peakKw": round(sum(serial_peak.get(serial, 0) for serial in solar_serials), 3),
            "peakKva": round(sum(serial_apparent_peak.get(serial, 0) for serial in solar_serials), 3),
            "readings": sum(serial_readings.get(serial, 0) for serial in solar_serials),
        }
        meters["grid"] = {
            "energyMwh": round(grid_energy, 6),
            "peakKw": round(sum(serial_peak.get(serial, 0) for serial in grid_serials), 3),
            "peakKva": round(sum(serial_apparent_peak.get(serial, 0) for serial in grid_serials), 3),
            "readings": sum(serial_readings.get(serial, 0) for serial in grid_serials),
        }
        meters["load"] = {
            "energyMwh": round(load_energy if load_serials else grid_energy + solar_energy - grid_export / 1000, 6),
            "peakKw": round(
                sum(serial_peak.get(serial, 0) for serial in load_serials)
                if load_serials else meters["grid"]["peakKw"] + meters["solar"]["peakKw"],
                3,
            ),
            "peakKva": round(
                sum(serial_apparent_peak.get(serial, 0) for serial in load_serials)
                if load_serials else meters["grid"]["peakKva"] + meters["solar"]["peakKva"],
                3,
            ),
            "readings": (
                sum(serial_readings.get(serial, 0) for serial in load_serials)
                if load_serials else sum(serial_readings.get(serial, 0) for serial in solar_serials | grid_serials)
            ),
        }
        meters["site"] = {
            "energyMwh": round(grid_energy + solar_energy - grid_export / 1000, 6),
            "peakKw": round(meters["grid"]["peakKw"] + meters["solar"]["peakKw"], 3),
            "peakKva": round(meters["grid"]["peakKva"] + meters["solar"]["peakKva"], 3),
            "readings": sum(serial_readings.values()),
        }

        summaries = []
        ac_rows: dict[str, dict[str, Any]] = {}
        dc_rows: dict[str, dict[str, Any]] = {}
        for (group_day, inverter_id), rows in inverter_groups.items():
            if group_day != day:
                continue
            last = rows[-1]
            code = _inverter_code(last.get("inverter_name"), inverter_id)
            if daily:
                peak_ac = _number(last.get("peak_ac")) / 1000
                peak_dc = _number(last.get("peak_dc")) / 1000
                energy = _number(last.get("energy_day"))
                cumulative = _number(last.get("cumulative"))
                readings = int(last.get("readings") or 0)
            else:
                peak_ac = max([_number(row.get("P_AC")) for row in rows] or [0]) / 1000
                peak_dc = max([_number(row.get("P_DC")) for row in rows] or [0]) / 1000
                energy = max([_number(row.get("E_DAY")) for row in rows] or [0])
                cumulative = _number(rows[-1].get("E_TOTAL"))
                readings = len(rows)
                for bucket in range(288):
                    label = f"{bucket // 12:02d}:{bucket % 12 * 5:02d}"
                    ac = _mean(inverter_buckets[(day, bucket, code, "P_AC")])
                    dc = _mean(inverter_buckets[(day, bucket, code, "P_DC")])
                    if ac is not None:
                        ac_rows.setdefault(label, {"time": label})[f"i{code}"] = round(ac, 3)
                    if dc is not None:
                        dc_rows.setdefault(label, {"time": label})[f"i{code}"] = round(dc, 3)
            summaries.append({
                "code": code, "id": inverter_id,
                "name": _text(last.get("inverter_name")) or code,
                "model": _text(last.get("inverter_model")) or "Unknown model",
                "peakAc": round(peak_ac, 3), "peakDc": round(peak_dc, 3),
                "energy": round(energy, 3), "cumulative": round(cumulative, 3),
                "readings": readings,
            })
        summaries.sort(key=lambda row: row["code"])

        points = []
        if daily:
            point: dict[str, Any] = {"time": "00:00"}
            for key, snapshot in meters.items():
                point[key] = snapshot["peakKw"]
                point[f"{key}Stot"] = snapshot["peakKva"]
            point["solar"] = meters["solar"]["peakKw"]
            point["grid"] = meters["grid"]["peakKw"]
            point["site"] = meters["site"]["peakKw"]
            point["inverter"] = sum(item["peakAc"] for item in summaries) if summaries else None
            irradiation = sum(solcast_days[day])
            point["ghi"] = irradiation * 1000
            point["sensorGhi"] = max(sensor_days[day], default=0) or None
            point["expected"] = irradiation * site["capacityKwp"] * 0.78 / 1000
            points.append(point)
            ac_rows = {"00:00": {"time": "00:00", **{f"i{item['code']}": item["peakAc"] for item in summaries}}}
            dc_rows = {"00:00": {"time": "00:00", **{f"i{item['code']}": item["peakDc"] for item in summaries}}}
        else:
            for bucket in range(288):
                point = {"time": f"{bucket // 12:02d}:{bucket % 12 * 5:02d}"}
                for node in site["nodes"]:
                    key = node.get("seriesKey")
                    if not key or key in {"site", "solar", "grid", "load"}:
                        continue
                    serials = set(node.get("meterSerials", []))
                    point[key] = round(sum(_mean(meter_buckets[(day, bucket, serial, "ptot")]) or 0 for serial in serials), 3)
                    point[f"{key}Stot"] = round(sum(_mean(meter_buckets[(day, bucket, serial, "stot")]) or 0 for serial in serials), 3)
                point["solar"] = round(sum(_mean(meter_buckets[(day, bucket, serial, "ptot")]) or 0 for serial in solar_serials), 3)
                point["solarStot"] = round(sum(_mean(meter_buckets[(day, bucket, serial, "stot")]) or 0 for serial in solar_serials), 3)
                point["grid"] = round(sum(_mean(meter_buckets[(day, bucket, serial, "ptot")]) or 0 for serial in grid_serials), 3)
                point["gridStot"] = round(sum(_mean(meter_buckets[(day, bucket, serial, "stot")]) or 0 for serial in grid_serials), 3)
                point["load"] = round(sum(_mean(meter_buckets[(day, bucket, serial, "ptot")]) or 0 for serial in load_serials), 3) if load_serials else round(point["grid"] + point["solar"], 3)
                point["loadStot"] = round(sum(_mean(meter_buckets[(day, bucket, serial, "stot")]) or 0 for serial in load_serials), 3) if load_serials else round(point["gridStot"] + point["solarStot"], 3)
                point["site"] = round(point["grid"] + point["solar"], 3)
                point["siteStot"] = round(point["gridStot"] + point["solarStot"], 3)
                inverter_values = [_mean(inverter_buckets[(day, bucket, item["code"], "P_AC")]) for item in summaries]
                point["inverter"] = round(sum(value for value in inverter_values if value is not None), 3) if any(value is not None for value in inverter_values) else None
                solcast_bucket = bucket - bucket % 6
                point["ghi"] = round(_mean(solcast_buckets[(day, solcast_bucket)]) or 0, 1)
                point["sensorGhi"] = round(_mean(sensor_buckets[(day, bucket)]) or 0, 1) or None
                point["expected"] = round(point["ghi"] * site["capacityKwp"] * 0.78 / 1000, 3)
                points.append(point)

        irradiation = sum(solcast_days[day]) if daily else sum(solcast_days[day]) * 0.5 / 1000
        inverter_readings = sum(item["readings"] for item in summaries)
        expected_inverter_readings = EXPECTED_READINGS_PER_DAY * max(len(summaries), 1)
        physical_serials = set(solar_serials) | set(grid_serials) | set(load_serials)
        expected_meter_readings = EXPECTED_READINGS_PER_DAY * max(len(physical_serials), 1)
        cumulative_values = [item["cumulative"] for item in summaries if item["cumulative"]]
        payload_days[day] = {
            "totals": {
                "solarEnergyMwh": round(solar_energy, 6),
                "inverterEnergyMwh": round(sum(item["energy"] for item in summaries) / 1000, 6),
                "gridImportMwh": round(grid_energy, 6),
                "gridExportKwh": round(grid_export, 3),
                "estimatedLoadMwh": round(grid_energy + solar_energy - grid_export / 1000, 6),
                "avoidedCostZar": round(solar_energy * 1000 * _number(site.get("tariff")), 2),
                "cumulativeEnergyGwh": round(sum(cumulative_values) / 1_000_000, 6) if cumulative_values else None,
                "peakAcMw": round(max([point.get("inverter") or 0 for point in points] or [0]) / 1000, 6),
                "peakSolarKw": round(max([point["solar"] for point in points] or [0]), 3),
                "solcastPeakGhi": round(max(solcast_days[day], default=0), 1),
                "prEstimate": round(solar_energy * 1000 / (site["capacityKwp"] * irradiation) * 100, 2) if site["capacityKwp"] and irradiation else 0,
                "meterAvailability": round(sum(serial_readings.get(serial, 0) for serial in physical_serials) / expected_meter_readings * 100, 2),
                "inverterAvailability": round(inverter_readings / expected_inverter_readings * 100, 2) if summaries else 0,
                "inverterReadings": inverter_readings,
            },
            "meters": meters,
            "power": points,
            "inverterSummary": summaries,
            "inverterAc": [ac_rows[key] for key in sorted(ac_rows)],
            "inverterDc": [dc_rows[key] for key in sorted(dc_rows)],
            "telemetry": {},
        }

    return {
        "site": {
            "contractId": site["contractId"],
            "projectCode": site["code"],
            "capacityKwp": site["capacityKwp"],
            "meterKeys": sorted({node["seriesKey"] for node in site["nodes"] if node.get("seriesKey")}),
            "inverterCount": max([len(day["inverterSummary"]) for day in payload_days.values()] or [0]),
        },
        "range": {
            "from": start_day.isoformat(), "to": end_day.isoformat(),
            "latestCompleteInverterDay": None, "partialInverterDay": None,
            "partialInverterThrough": None, "sensorAvailable": bool(source["sensors"]),
            "powerIntervalMinutes": 60 if daily else 5,
            "meterSource": "electricity_energy_power",
            "inverterSource": "vcom_inverter_data",
            "irradianceSource": "solcast_data",
            "dataAsOf": latest_timestamp.isoformat() if latest_timestamp else None,
        },
        "financials": financials or {},
        "days": payload_days,
    }
