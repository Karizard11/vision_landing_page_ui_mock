from datetime import date, datetime
from unittest import TestCase

from app import (
    period_granularity,
    telemetry_series_from_daily,
    telemetry_series_from_raw,
)
from contracts import _navigation_nodes, aggregate_contract_payload, contract_navigation_label


class PeriodGranularityTests(TestCase):
    def test_all_resolution_thresholds(self):
        self.assertEqual(period_granularity(1), "5min")
        self.assertEqual(period_granularity(4), "30min")
        self.assertEqual(period_granularity(14), "hour")
        self.assertEqual(period_granularity(31), "day")
        self.assertEqual(period_granularity(366), "month")
        self.assertEqual(period_granularity(367), "year")


class TelemetryAggregationTests(TestCase):
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
            ],
            "solarMeterSerials": ["SOLAR"],
            "municipalMeterSerials": ["GRID"],
        }
        source = {
            "daily": False,
            "meters": [
                {"timestamp": datetime(2026, 8, 22, 0, 0), "meter_serial": "SOLAR", "import_wh": 0, "export_wh": 1000, "ptot": 10_000, "stot": 11_000},
                {"timestamp": datetime(2026, 8, 22, 0, 0), "meter_serial": "GRID", "import_wh": 1000, "export_wh": 0, "ptot": 20_000, "stot": 22_000},
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


if __name__ == "__main__":
    import unittest

    unittest.main()
