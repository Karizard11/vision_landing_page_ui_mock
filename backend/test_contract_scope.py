import unittest
from unittest.mock import MagicMock
from contract_performance import query_performance_sources
from time_context import build_query_window


class ContractScopeTests(unittest.TestCase):
    def test_unmapped_contract_does_not_borrow_other_phase_meters(self):
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchall.return_value = []
        site = {"contractId": "7", "contractTimeZone": "Africa/Johannesburg", "solarMeterSerials": [], "systemKey": "", "nodes": [
            {"type": "Solar", "meterSerials": ["another-phase"]},
        ]}
        window = build_query_window("2026-08-22", "2026-08-22", max_days=3660)
        source = query_performance_sources(connection, site, window)
        self.assertEqual(source["serials"], [])
        self.assertFalse(any("electricity_energy_power" in call.args[0] for call in cursor.execute.call_args_list))

    def test_forecast_source_is_joined_by_contract_and_model_timestamp(self):
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchall.return_value = []
        window = build_query_window("2026-08-22", "2026-08-22", max_days=3660)
        query_performance_sources(connection, {"contractId":"7","contractTimeZone":"Africa/Johannesburg","solarMeterSerials":[],"nodes":[]}, window)
        sql, params = cursor.execute.call_args_list[0].args
        self.assertIn("m.contract_id = f.contract_id", sql)
        self.assertIn("m.timestamp = f.pv_model_timestamp", sql)
        self.assertEqual(params[0], "7")
