import unittest
from datetime import datetime, timedelta
from contract_performance import build_contract_performance, granularity
from time_context import build_query_window

SITE = {"contractId":"3", "capacityKwp":100, "guarantee":95, "degradationPercent":1, "cocoDate":"2024-01-01"}

def fixture(start=datetime(2026,8,22,8)):
    return {
        "predictions":[{"timestamp":start,"system_output_power_kw":100,"degradation":.98,"yield_guarantee":95}],
        "model":[],
        "pvsol":[{"timestamp":start,"horiz_flux":1}],
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
        src["model"]=[{"timestamp":datetime(2019,8,22,8),"system_output_power_kw":100}]
        p=build_contract_performance(SITE,self.window(),src)
        self.assertEqual(p["summary"]["predictedKwh"],98)
        src["model"]=[{"timestamp":datetime(2019,2,28,8),"system_output_power_kw":100}]
        w=build_query_window("2028-02-29","2028-02-29","10:00","10:59",max_days=3660)
        p=build_contract_performance(SITE,w,src)
        self.assertIsNone(p["summary"]["predictedKwh"])

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
