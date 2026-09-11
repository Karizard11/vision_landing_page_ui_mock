import assert from "node:assert/strict";
import test from "node:test";
import { siteOperationalSummary } from "../lib/site-summary.ts";

const period = {
  expectedFiveMinuteReadings:288,
  totals:{solarEnergyMwh:8,gridImportMwh:12,gridExportKwh:250,meterAvailability:100,inverterAvailability:97},
  meters:{grid:{readings:864},solar:{readings:576}},
};
test("site summary preserves real meter totals and export-adjusted solar",()=>{
  assert.deepEqual(siteOperationalSummary(period,3),{
    gridImportMwh:12,retainedSolarMwh:7.75,gridCoverage:100,meterAvailability:100,inverterAvailability:97,
  });
});
test("absent or unmapped grid data is unavailable, not zero",()=>{
  assert.equal(siteOperationalSummary(null,3),null);
  assert.equal(siteOperationalSummary(period,0).gridImportMwh,null);
  const empty={...period,meters:{grid:{readings:0},solar:{readings:0}}};
  assert.equal(siteOperationalSummary(empty,3).gridImportMwh,null);
  assert.equal(siteOperationalSummary(empty,3).retainedSolarMwh,null);
});
test("partial coverage does not claim a complete retained-solar balance",()=>{
  const partial={...period,meters:{...period.meters,grid:{readings:432}}};
  assert.equal(siteOperationalSummary(partial,3).gridCoverage,50);
  assert.equal(siteOperationalSummary(partial,3).retainedSolarMwh,null);
});
test("measured zero import remains zero",()=>{
  assert.equal(siteOperationalSummary({...period,totals:{...period.totals,gridImportMwh:0}},3).gridImportMwh,0);
});
