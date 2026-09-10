from datetime import datetime
from unittest import TestCase

from app import (
    period_granularity,
    telemetry_series_from_daily,
    telemetry_series_from_raw,
)


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


if __name__ == "__main__":
    import unittest

    unittest.main()
