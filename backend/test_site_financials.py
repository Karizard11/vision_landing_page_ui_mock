import unittest
from datetime import date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace as NS
from zoneinfo import ZoneInfo
from unittest.mock import patch

from site_financials import metric, net_metric, ppa_applicable, selected_quantities, empty_result, pricing_scope_rows, ppa_chargeable_quantities
from time_context import build_query_window
from app import app


class SiteFinancialsTests(unittest.TestCase):
    def setUp(self):
        self.start = datetime(2026, 8, 22, 8)
        self.end = self.start + timedelta(minutes=30)
        self.metadata = NS(solar_total_device_node_id=1, municipal_total_device_node_id=2,
                           no_incomer_meter_installed=False)
        self.rows = [self.row(1, 12000), self.row(2, 2000)]
        self.mappings = [NS(device_node_id=i, valid_from=self.start, valid_to=self.end) for i in (1, 2)]

    def row(self, node, export, **kw):
        return NS(device_node_id=node, interval_start=self.start, interval_end=self.end,
                  export_diff_wh=Decimal(export), contributing_meters=kw.get("contributors", 1))

    def calculate(self, **kwargs):
        acquisition = NS(resolved_intervals=self.rows, mappings=self.mappings)
        return selected_quantities(acquisition, self.metadata, kwargs.get("start", self.start), kwargs.get("end", self.end))

    def test_municipal_export_deducted_from_solar(self):
        quantities, coverage, notes = self.calculate()
        self.assertEqual(quantities[0][2], Decimal(10))
        self.assertEqual(coverage, 100)
        self.assertEqual(notes, [])

    def test_missing_incomer_not_silently_zero(self):
        self.rows = self.rows[:1]
        quantities, coverage, notes = self.calculate()
        self.assertEqual(quantities, [])
        self.assertEqual(coverage, 0)
        self.assertTrue(notes)

    def test_incomplete_virtual_node_is_not_counted(self):
        self.mappings.append(self.mappings[0])
        self.assertEqual(self.calculate()[0], [])

    def test_duplicate_readings_are_not_double_counted(self):
        self.rows.append(self.rows[0])
        self.assertEqual(self.calculate()[0], [])

    def test_partial_minutes_are_prorated_and_labelled(self):
        quantities, coverage, notes = self.calculate(start=self.start+timedelta(minutes=5),end=self.start+timedelta(minutes=20))
        self.assertEqual(quantities[0][2], Decimal(5))
        self.assertEqual(coverage, 100)
        self.assertTrue(any("prorated" in n for n in notes))

    def test_missing_intervals_remain_partial(self):
        _, coverage, notes = self.calculate(end=self.end+timedelta(minutes=30))
        self.assertEqual(coverage, 50)
        self.assertTrue(any("Partial data" in n for n in notes))

    def test_no_incomer_is_an_explicit_estimate(self):
        self.metadata.no_incomer_meter_installed = True
        self.rows = self.rows[:1]
        quantities, _, notes = self.calculate()
        self.assertEqual(quantities[0][2], Decimal(12))
        self.assertTrue(any("Estimated self-consumption" in n for n in notes))

    def test_negative_retained_energy_clamps_with_warning(self):
        self.rows[1] = self.row(2, 13000)
        quantities, _, notes = self.calculate()
        self.assertEqual(quantities[0][2], 0)
        self.assertTrue(notes)

    def test_ppa_is_deducted_once_not_added(self):
        net = net_metric(metric(100), metric(70), True)
        self.assertEqual(net["amount"], 30)
        self.assertEqual(net_metric(metric(100),metric(110),True)["amount"], -10)

    def test_epc_has_no_ppa_deduction(self):
        self.assertFalse(ppa_applicable(" EPC "))
        self.assertEqual(net_metric(metric(100),metric(state="not-applicable"),False)["amount"],100)
        self.assertTrue(ppa_applicable("ppa"))
        self.assertIsNone(ppa_applicable(None))

    def test_missing_tariff_not_zero_and_partial_carries_to_net(self):
        self.assertIsNone(net_metric(metric(100),metric(),True)["amount"])
        self.assertEqual(net_metric(metric(100,state="partial"),metric(60),True)["state"],"partial")
        self.assertIsNone(net_metric(metric(100),metric(60),None)["amount"])

    def test_unavailable_epc_still_has_applicability(self):
        data=empty_result({"contractId":"9","contractType":"epc"},"Unavailable")
        self.assertEqual(data["ppaIncome"]["state"],"not-applicable")
        self.assertIsNone(data["municipalSavings"]["amount"])

    def test_selected_time_is_sast_once_inclusive_end_minute(self):
        window=build_query_window("2026-08-22","2026-08-22","10:00","10:29",max_days=3660)
        self.assertEqual(window.start_utc,self.start)
        self.assertEqual(window.end_utc,self.end)


    def test_pricing_exclusions_preserve_selected_energy(self):
        rows=[(self.start+timedelta(minutes=5),self.start+timedelta(minutes=20),Decimal(5))]
        priced=pricing_scope_rows(rows,ZoneInfo("Africa/Johannesburg"))
        self.assertEqual(sum(q for _,_,q,_ in priced),Decimal(5))
        self.assertEqual([r[:3] for r in priced if r[3]],rows)
        self.assertEqual(priced[0][0],datetime(2026,8,21,22))
        self.assertEqual(priced[-1][1],datetime(2026,8,22,22))
        self.assertTrue(all(a[1]==b[0] for a,b in zip(priced,priced[1:])))
        for a,b,_,selected in priced:
            if not selected:
                self.assertLessEqual((b-a).total_seconds(),1800)
                self.assertEqual(a.hour,b.hour if b.minute else (b-timedelta(seconds=1)).hour)

    def test_ppa_starts_at_contract_local_midnight(self):
        rows=[(datetime(2026,8,21,21,45),datetime(2026,8,21,22,15),Decimal(10))]
        selected=ppa_chargeable_quantities(rows,date(2026,8,22),"Africa/Johannesburg")
        self.assertEqual(selected,[(datetime(2026,8,21,22),datetime(2026,8,21,22,15),Decimal(5))])
        self.assertEqual(ppa_chargeable_quantities(rows,date(2026,8,23),"Africa/Johannesburg"),[])

    def test_zero_measured_production_is_valid(self):
        self.rows=[self.row(1,0),self.row(2,0)]
        quantities,coverage,notes=self.calculate()
        self.assertEqual(quantities[0][2],0)
        self.assertEqual(coverage,100)
        self.assertEqual(notes,[])

    def test_nonfinite_energy_not_priced(self):
        self.rows[0]=self.row(1,"NaN")
        self.assertEqual(self.calculate()[0],[])

    def test_route_validates_before_accessing_doris(self):
        client=app.test_client()
        with patch("app.doris_connection") as db:
            self.assertEqual(client.get("/api/site/financials?contract_id=no&from=2026-08-22&to=2026-08-22").status_code,400)
            self.assertEqual(client.get("/api/site/financials?contract_id=3&from=2026-08-23&to=2026-08-22").status_code,400)
            db.assert_not_called()

    def test_route_scopes_contract_and_forwards_exact_window(self):
        site={"contractId":"3","contractType":"ppa"}
        with patch("app.doris_connection"), patch("app.query_contract_catalog",return_value=[site]), patch("app.load_site_financials",return_value=empty_result(site,"No data")) as load:
            client=app.test_client()
            response=client.get("/api/site/financials?contract_id=3&from=2026-08-22&to=2026-08-22&from_time=10:00&to_time=10:29")
            self.assertEqual(response.status_code,200)
            self.assertEqual(load.call_args.args[1].start_utc,self.start)
            self.assertEqual(load.call_args.args[1].end_utc,self.end)
            load.reset_mock()
            self.assertEqual(client.get("/api/site/financials?contract_id=99&from=2026-08-22&to=2026-08-22").status_code,404)
            load.assert_not_called()


if __name__ == "__main__":
    unittest.main()
