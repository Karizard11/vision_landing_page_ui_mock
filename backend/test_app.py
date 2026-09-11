from datetime import date, datetime
from unittest import TestCase

from app import (
    period_granularity,
    select_inverter_metadata,
    telemetry_series_from_daily,
    telemetry_series_from_raw,
)
from contracts import _navigation_nodes, aggregate_contract_payload, contract_navigation_label
from reporting_financials import load_municipal_financials
from time_context import (
    build_query_window,
    doris_utc_to_sast,
    solcast_period_start_sast,
)


class PeriodGranularityTests(TestCase):
    def test_all_resolution_thresholds(self):
        self.assertEqual(period_granularity(1), "5min")
        self.assertEqual(period_granularity(4), "30min")
        self.assertEqual(period_granularity(14), "hour")
        self.assertEqual(period_granularity(31), "day")
        self.assertEqual(period_granularity(366), "month")
        self.assertEqual(period_granularity(367), "year")


class TimeContextTests(TestCase):
    def test_full_sast_day_maps_to_previous_utc_evening(self):
        window = build_query_window(
            "2026-08-22", "2026-08-22", "00:00", "23:59", max_days=3660
        )

        self.assertEqual(window.start_utc, datetime(2026, 8, 21, 22, 0))
        self.assertEqual(window.end_utc, datetime(2026, 8, 22, 22, 0))
        self.assertEqual(window.duration_day_count, 1)
        self.assertTrue(window.is_full_day_selection)

    def test_partial_sast_window_keeps_inclusive_end_minute(self):
        window = build_query_window(
            "2026-08-22", "2026-08-22", "10:00", "10:30", max_days=3660
        )

        self.assertEqual(window.start_utc, datetime(2026, 8, 22, 8, 0))
        self.assertEqual(window.end_utc, datetime(2026, 8, 22, 8, 31))
        self.assertEqual(window.duration_minutes, 31)
        self.assertFalse(window.is_full_day_selection)

    def test_doris_and_solcast_timestamps_are_presented_in_sast(self):
        doris_timestamp = datetime(2026, 8, 22, 8, 30)

        self.assertEqual(doris_utc_to_sast(doris_timestamp).isoformat(), "2026-08-22T10:30:00+02:00")
        self.assertEqual(solcast_period_start_sast(doris_timestamp).isoformat(), "2026-08-22T10:00:00+02:00")


class TelemetryAggregationTests(TestCase):
    def test_duplicate_inverter_name_prefers_candidate_with_selected_readings(self):
        rows = [
            {"inverter_id": "Id227186.1", "inverter_name": "07 - SG125CX", "selected_readings": 0},
            {"inverter_id": "Id227186.13", "inverter_name": "07 - SG125CX", "selected_readings": 864},
        ]

        result = select_inverter_metadata(rows, "07")

        self.assertEqual(result["inverter_id"], "Id227186.13")

    def test_raw_rows_roll_up_to_half_hour(self):
        rows = [
            {"timestamp": datetime(2026, 8, 21, 9, 0), "I_DC1": 10, "U_DC1": 700},
            {"timestamp": datetime(2026, 8, 21, 9, 5), "I_DC1": 12, "U_DC1": 700},
        ]

        result = telemetry_series_from_raw(rows, [1], "30min", 2)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["channels"][0]["current"], 11)
        self.assertEqual(result[0]["channels"][0]["power"], 7.7)

    def test_daily_energy_sums_into_months(self):
        rows = [
            {"bucket_time": datetime(2026, 8, 1), "sample_count": 288, "I_DC1": 10, "U_DC1": 700, "P_DC1": 0.7},
            {"bucket_time": datetime(2026, 8, 2), "sample_count": 288, "I_DC1": 20, "U_DC1": 710, "P_DC1": 0.8},
        ]

        result = telemetry_series_from_daily(rows, [1], "month")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["label"], "Aug 2026")
        self.assertEqual(result[0]["channels"][0]["current"], 15)
        self.assertEqual(result[0]["channels"][0]["power"], 1.5)


class ContractCatalogTests(TestCase):
    def test_contract_navigation_label_omits_phase_one(self):
        row = {"project_code": "P0428", "site_name": "Norwood Mall", "contract_phase": "1"}
        self.assertEqual(contract_navigation_label(row), "P0428 | Norwood Mall")

    def test_contract_navigation_label_keeps_later_phase(self):
        row = {"project_code": "P0533", "site_name": "SPAR DC", "contract_phase": "2"}
        self.assertEqual(contract_navigation_label(row), "P0533 | SPAR DC | Phase 2")

    def test_navigation_has_contract_totals_and_sld_parentage(self):
        contract = {
            "contract_id": 3,
            "site_id": 4,
            "solar_total_device_node_id": 100,
            "municipal_total_device_node_id": 200,
        }
        rows = [
            {
                "site_id": 4, "sld_id": 1, "sld_node_id": 10,
                "device_node_id": 201, "parent_sld_node_id": None,
                "parent_device_node_id": None,
                "device_node_name": "Incomer 1", "device_node_type": "Transformer",
                "meter_serial": "GRID", "device_node_calc_mode": "GROSS_METERING",
            },
            {
                "site_id": 4, "sld_id": 1, "sld_node_id": 11,
                "device_node_id": 101, "parent_sld_node_id": 10,
                "parent_device_node_id": 201,
                "device_node_name": "PVDB 1", "device_node_type": "Solar",
                "meter_serial": "SOLAR", "device_node_calc_mode": "GROSS_METERING",
            },
        ]
        nodes = _navigation_nodes(
            contract,
            rows,
            {"solar": ["SOLAR"], "municipal": ["GRID"], "load": []},
        )
        by_key = {node["navigationKey"]: node for node in nodes}
        self.assertEqual(by_key["municipal-total"]["parentNavigationKey"], "site-total")
        self.assertEqual(by_key["base-101"]["parentNavigationKey"], "base-201")
        self.assertEqual(by_key["solar-101"]["parentNavigationKey"], "solar-total")

    def test_virtual_load_nodes_keep_their_descendant_meter_mapping(self):
        contract = {
            "contract_id": 3,
            "site_id": 4,
            "load_device_node_id": 300,
            "solar_total_device_node_id": 100,
            "municipal_total_device_node_id": 200,
        }
        rows = [
            {
                "site_id": 4, "device_node_id": 300, "parent_device_node_id": None,
                "device_node_name": "Load Total", "device_node_type": "Load total",
                "meter_serial": None, "device_node_calc_mode": "SUM_CHILDREN",
            },
            {
                "site_id": 4, "device_node_id": 301, "parent_device_node_id": 300,
                "device_node_name": "Refrigeration Load", "device_node_type": "Load",
                "meter_serial": "VIRTUAL-LOAD", "device_node_calc_mode": "SUM_CHILDREN",
            },
            {
                "site_id": 4, "device_node_id": 302, "parent_device_node_id": 301,
                "device_node_name": "Compressor Meter", "device_node_type": "Meter",
                "meter_serial": "LOAD-1", "device_node_calc_mode": "GROSS_METERING",
            },
        ]

        nodes = _navigation_nodes(
            contract,
            rows,
            {"solar": [], "municipal": [], "load": []},
        )
        by_key = {node["navigationKey"]: node for node in nodes}

        self.assertEqual(by_key["load-total"]["meterSerials"], ["VIRTUAL-LOAD"])
        self.assertEqual(by_key["base-301"]["parentNavigationKey"], "load-total")
        self.assertEqual(by_key["base-301"]["meterSerials"], ["VIRTUAL-LOAD"])
        self.assertFalse(by_key["base-301"]["isPhysical"])
        self.assertEqual(by_key["base-302"]["parentNavigationKey"], "base-301")


class ContractPowerAggregationTests(TestCase):
    def test_active_and_apparent_power_roll_up_to_all_three_totals(self):
        site = {
            "contractId": "P0480-1",
            "code": "P0480",
            "capacityKwp": 100,
            "tariff": 1,
            "nodes": [
                {"type": "Solar", "seriesKey": "pvdb1", "meterSerials": ["SOLAR"], "isPhysical": True},
                {"type": "Transformer", "seriesKey": "incomer1", "meterSerials": ["GRID"], "isPhysical": True},
                {"type": "Load total", "seriesKey": "load", "meterSerials": ["LOAD"], "isPhysical": False},
            ],
            "solarMeterSerials": ["SOLAR"],
            "municipalMeterSerials": ["GRID"],
            "loadMeterSerials": ["LOAD"],
        }
        source = {
            "daily": False,
            "meters": [
                {"timestamp": datetime(2026, 8, 22, 0, 0), "meter_serial": "SOLAR", "import_wh": 0, "export_wh": 1000, "ptot": 10_000, "stot": 11_000},
                {"timestamp": datetime(2026, 8, 22, 0, 0), "meter_serial": "GRID", "import_wh": 1000, "export_wh": 0, "ptot": 20_000, "stot": 22_000},
                {"timestamp": datetime(2026, 8, 22, 0, 0), "meter_serial": "LOAD", "import_wh": 1000, "export_wh": 0, "ptot": 35_000, "stot": 37_000},
            ],
            "inverters": [],
            "solcast": [],
            "sensors": [],
        }

        payload = aggregate_contract_payload(site, date(2026, 8, 22), date(2026, 8, 22), source)
        point = payload["days"]["2026-08-22"]["power"][0]

        self.assertEqual(point["solar"], 10)
        self.assertEqual(point["solarStot"], 11)
        self.assertEqual(point["grid"], 20)
        self.assertEqual(point["gridStot"], 22)
        self.assertEqual(point["site"], 30)
        self.assertEqual(point["siteStot"], 33)
        self.assertEqual(point["load"], 35)
        self.assertEqual(point["loadStot"], 37)

    def test_payload_preserves_tariff_pricing_result(self):
        site = {
            "contractId": "1",
            "code": "P1",
            "capacityKwp": 1,
            "tariff": 1,
            "nodes": [],
            "solarMeterSerials": [],
            "municipalMeterSerials": [],
        }
        source = {
            "daily": False,
            "meters": [],
            "inverters": [],
            "solcast": [],
            "sensors": [],
        }
        financials = {"municipal": {"state": "ready", "totalIncludingVatR": 12.34}}

        payload = aggregate_contract_payload(
            site,
            date(2026, 8, 22),
            date(2026, 8, 22),
            source,
            financials,
        )

        self.assertEqual(payload["financials"], financials)


class ReportingFinancialBridgeTests(TestCase):
    def test_missing_municipal_node_fails_closed_without_partial_cost(self):
        result = load_municipal_financials(None, date(2026, 8, 22), date(2026, 8, 22))

        self.assertEqual(result["state"], "blocked")
        self.assertEqual(result["reasonCodes"], ["MUNICIPAL_TOTAL_DEVICE_NODE_MISSING"])
        self.assertIsNone(result["totalIncludingVatR"])


if __name__ == "__main__":
    import unittest

    unittest.main()
