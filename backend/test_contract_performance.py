import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock
from contract_performance import build_contract_performance, granularity, query_performance_sources
from time_context import build_query_window

SITE = {"contractId":"3", "contractTimeZone":"Africa/Johannesburg", "capacityKwp":100, "guarantee":95, "degradationPercent":1, "cocoDate":"2024-01-01"}

def fixture(start=datetime(2026,8,22,8)):
    # Meter and Solcast source rows are UTC; prediction profiles are already SAST.
    local_start = start + timedelta(hours=2)
    return {
        "predictions":[{"timestamp":local_start,"system_output_power_kw":100,"degradation":.98,"yield_guarantee":95}],
        "model":[],
        "pvsol":[{"timestamp":local_start,"horiz_flux":1}],
        "solar":[{"timestamp":start+timedelta(minutes=i*5),"energy_kwh":5,"valid_seconds":300} for i in range(12)],
        "weather":[{"timestamp":start,"ghi":800},{"timestamp":start+timedelta(minutes=30),"ghi":800}],
        "serials":["m1"],"stepMinutes":5,
    }

class ContractPerformanceTests(unittest.TestCase):
    def window(self,start="10:00",end="10:59"):
        return build_query_window("2026-08-22","2026-08-22",start,end,max_days=3660)

    def test_partial_time_selection_weights_all_sources_once(self):
        p=build_contract_performance(SITE,self.window("10:00","10:30"),fixture())
        self.assertAlmostEqual(p["summary"]["predictedKwh"],98*31/60,places=4)
        self.assertAlmostEqual(p["summary"]["actualKwh"],31)
        self.assertAlmostEqual(p["summary"]["guaranteedKwh"],98*31/60*.95,places=4)
        self.assertEqual(p["summary"]["comparisonCoverage"],100)
        self.assertTrue(p["series"][0]["time"].endswith("+02:00"))

    def test_missing_reading_is_not_zero_and_attainment_is_matched(self):
        src=fixture();src["solar"]=src["solar"][1:]
        p=build_contract_performance(SITE,self.window(),src)
        self.assertIsNone(p["series"][0]["actual"])
        self.assertAlmostEqual(p["summary"]["actualCoverage"],100*55/60)
        self.assertAlmostEqual(p["summary"]["attainmentPercent"],60/98*100)

    def test_zero_production_remains_real_data(self):
        src=fixture()
        for row in src["solar"]:row["energy_kwh"]=0
        p=build_contract_performance(SITE,self.window(),src)
        self.assertEqual(p["summary"]["actualKwh"],0)
        self.assertEqual(p["summary"]["attainmentPercent"],0)
        self.assertEqual(p["summary"]["actualCoverage"],100)

    def test_irradiance_effect_plus_residual_reconciles(self):
        p=build_contract_performance(SITE,self.window(),fixture())
        s=p["summary"]
        self.assertAlmostEqual(s["weatherEffectKwh"]+s["otherEffectKwh"],s["varianceKwh"])
        self.assertAlmostEqual(s["predictedPr"],98)
        self.assertAlmostEqual(s["actualPr"],75)

    def test_overlapping_forecasts_are_not_summed(self):
        src=fixture();src["predictions"]*=2
        p=build_contract_performance(SITE,self.window(),src)
        self.assertIsNone(p["summary"]["predictedKwh"])
        self.assertTrue(any("Overlapping" in m for m in p["messages"]))

    def test_missing_irradiance_hides_pr_not_energy(self):
        src=fixture();src["pvsol"]=[]
        p=build_contract_performance(SITE,self.window(),src)
        self.assertEqual(p["summary"]["actualKwh"],60)
        self.assertIsNone(p["summary"]["actualPr"])
        self.assertIsNone(p["summary"]["weatherEffectKwh"])

    def test_annual_fallback_uses_contract_age_and_leap_gaps_stay_missing(self):
        src=fixture();src["predictions"]=[]
        src["model"]=[{"timestamp":datetime(2019,8,22,10),"system_output_power_kw":100}]
        p=build_contract_performance(SITE,self.window(),src)
        self.assertEqual(p["summary"]["predictedKwh"],98)
        src["model"]=[{"timestamp":datetime(2019,2,28,10),"system_output_power_kw":100}]
        w=build_query_window("2028-02-29","2028-02-29","10:00","10:59",max_days=3660)
        p=build_contract_performance(SITE,w,src)
        self.assertIsNone(p["summary"]["predictedKwh"])


    def test_local_model_hour_matches_utc_actual_without_a_second_shift(self):
        src=fixture()
        # Different values at 08:00 prove we select 10:00 SAST, not 08:00 UTC.
        src["predictions"].append({"timestamp":datetime(2026,8,22,8),
            "system_output_power_kw":20,"degradation":1,"yield_guarantee":95})
        src["pvsol"].append({"timestamp":datetime(2026,8,22,8),"horiz_flux":.2})
        p=build_contract_performance(SITE,self.window(),src)
        self.assertAlmostEqual(p["summary"]["predictedKwh"],98)
        self.assertAlmostEqual(sum(row["predictedGhi"] for row in p["series"]),1,places=4)
        self.assertAlmostEqual(p["summary"]["actualKwh"],60)
        self.assertAlmostEqual(p["summary"]["predictedPr"],98)
        self.assertEqual(p["series"][0]["time"],"2026-08-22T10:00:00+02:00")

    def test_sast_year_boundary_uses_local_annual_profile_date(self):
        src=fixture(datetime(2025,12,31,22))
        src["predictions"]=[]
        src["model"]=[{"timestamp":datetime(2019,1,1,0),"system_output_power_kw":100},
                      {"timestamp":datetime(2019,12,31,22),"system_output_power_kw":20}]
        src["pvsol"]=[{"timestamp":datetime(2019,1,1,0),"horiz_flux":1},
                      {"timestamp":datetime(2019,12,31,22),"horiz_flux":.2}]
        w=build_query_window("2026-01-01","2026-01-01","00:00","00:59",max_days=3660)
        p=build_contract_performance(SITE,w,src)
        self.assertEqual(p["summary"]["predictedKwh"],98)
        self.assertAlmostEqual(p["summary"]["predictedPr"],98)
        self.assertEqual(p["series"][0]["time"],"2026-01-01T00:00:00+02:00")
        self.assertEqual(p["summary"]["actualKwh"],60)

    def test_forecast_query_is_sast_while_telemetry_queries_remain_utc(self):
        connection=MagicMock()
        cursor=connection.cursor.return_value.__enter__.return_value
        cursor.fetchall.return_value=[]
        w=build_query_window("2026-01-01","2026-01-01","00:00","00:30",max_days=3660)
        query_performance_sources(connection,{"contractId":"3","contractTimeZone":"Africa/Johannesburg","solarMeterSerials":["m1"],"systemKey":"test"},w)
        calls=cursor.execute.call_args_list
        forecast=next(c for c in calls if "mv_pv_model_forecasts" in c.args[0])
        solar=next(c for c in calls if "electricity_energy_power" in c.args[0])
        weather=next(c for c in calls if "solcast_data" in c.args[0])
        self.assertEqual(forecast.args[1][1:],(datetime(2026,1,1,0),datetime(2026,1,1,1)))
        self.assertEqual(solar.args[1][-2:],(datetime(2025,12,31,22),datetime(2025,12,31,23)))
        self.assertEqual(weather.args[1][1:],(datetime(2025,12,31,22,30),datetime(2025,12,31,23,30)))
        self.assertIn("DATE_SUB(period_end, INTERVAL 30 MINUTE)",weather.args[0])


    def test_explicit_contract_zone_overrides_portfolio_default(self):
        site={**SITE,"portfolioId":"terradew-four","contractTimeZone":"Asia/Dubai"}
        src=fixture()
        src["predictions"][0]["timestamp"]=datetime(2026,8,22,12)
        src["pvsol"][0]["timestamp"]=datetime(2026,8,22,12)
        p=build_contract_performance(site,self.window(),src)
        self.assertEqual(p["summary"]["predictedKwh"],98)
        self.assertAlmostEqual(p["summary"]["predictedPr"],98)
        self.assertEqual(p["provenance"]["predictionTimeZone"],"Asia/Dubai")
        # The chart remains in the user's selected SAST display timezone.
        self.assertEqual(p["series"][0]["time"],"2026-08-22T10:00:00+02:00")

    def test_contract_zone_controls_query_bounds(self):
        connection=MagicMock()
        cursor=connection.cursor.return_value.__enter__.return_value
        cursor.fetchall.return_value=[]
        query_performance_sources(connection,{**SITE,"contractTimeZone":"Asia/Dubai","solarMeterSerials":[]},
                                  self.window("10:00","10:30"))
        forecast=cursor.execute.call_args_list[0]
        self.assertEqual(forecast.args[1][1:],(datetime(2026,8,22,12),datetime(2026,8,22,13)))

    def test_contract_iana_zone_observes_seasonal_offset(self):
        site={**SITE,"contractTimeZone":"Europe/London"}
        for month,local_hour in [(1,8),(8,9)]:
            with self.subTest(month=month):
                src=fixture(datetime(2026,month,22,8))
                src["predictions"][0]["timestamp"]=datetime(2026,month,22,local_hour)
                src["pvsol"][0]["timestamp"]=datetime(2026,month,22,local_hour)
                w=build_query_window(f"2026-{month:02d}-22",f"2026-{month:02d}-22","10:00","10:59",max_days=3660)
                p=build_contract_performance(site,w,src)
                self.assertEqual(p["summary"]["predictedKwh"],98)
                self.assertAlmostEqual(p["summary"]["predictedPr"],98)

    def test_unknown_contract_zone_is_not_silently_sast(self):
        site={key:value for key,value in SITE.items() if key!="contractTimeZone"}
        with self.assertRaisesRegex(ValueError,"timezone"):
            build_contract_performance(site,self.window(),fixture())
        with self.assertRaisesRegex(ValueError,"timezone"):
            build_contract_performance({**site,"contractTimeZone":"Invalid/Zone"},self.window(),fixture())

    def test_confirmed_portfolios_use_sast_without_global_default(self):
        site={key:value for key,value in SITE.items() if key!="contractTimeZone"}
        for portfolio in ["terradew-four","redefine-properties"]:
            p=build_contract_performance({**site,"portfolioId":portfolio},self.window(),fixture())
            self.assertEqual(p["summary"]["predictedKwh"],98)
            self.assertEqual(p["provenance"]["predictionTimeZone"],"Africa/Johannesburg")


    def test_coarse_utc_hour_splits_across_half_hour_contract_offset(self):
        site={**SITE,"contractTimeZone":"Asia/Kolkata"}
        src=fixture()
        src["stepMinutes"]=60
        src["predictions"]=[
            {"timestamp":datetime(2026,8,22,h),"system_output_power_kw":kw,"degradation":1,"yield_guarantee":95}
            for h,kw in [(13,100),(14,200)]]
        src["pvsol"]=[{"timestamp":datetime(2026,8,22,h),"horiz_flux":ghi} for h,ghi in [(13,1),(14,2)]]
        src["solar"]=[{"timestamp":datetime(2026,8,22,8),"energy_kwh":60,"valid_seconds":3600}]
        w=build_query_window("2026-08-01","2026-09-01",max_days=3660)
        p=build_contract_performance(site,w,src)
        # UTC 08:00-09:00 overlaps local 13:30-14:30: 50 + 100 kWh.
        self.assertEqual(p["summary"]["actualKwh"],60)
        self.assertAlmostEqual(p["summary"]["attainmentPercent"],40)
        self.assertAlmostEqual(p["summary"]["predictedPr"],100)

    def test_resolutions_follow_shared_rules(self):
        self.assertEqual([granularity(n*1440) for n in (1,2,4,5,14,15,31,32,366,367)],
                         ["5min","30min","30min","hour","hour","day","day","month","month","year"])

    def test_monthly_totals_sum_energy_and_recompute_ratios(self):
        src=fixture();src["stepMinutes"]=60
        src["solar"]=[{"timestamp":datetime(2026,8,22,8),"energy_kwh":60,"valid_seconds":3600}]
        w=build_query_window("2026-08-01","2026-09-01",max_days=3660)
        p=build_contract_performance(SITE,w,src)
        self.assertEqual(p["range"]["granularity"],"month")
        self.assertEqual(len(p["series"]),2)
        self.assertAlmostEqual(p["series"][0]["actualPr"],75)
        self.assertEqual(p["series"][0]["actual"],60)
        self.assertIsNone(p["series"][1]["actual"])

if __name__=="__main__":
    unittest.main()
