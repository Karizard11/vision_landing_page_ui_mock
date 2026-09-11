import assert from "node:assert/strict";
import test from "node:test";
import { municipalSummaryMeterCount } from "../lib/site-summary.ts";

test("virtual municipal totals resolve actual meter membership without double counting branches",()=>{
  const incomer={isPhysical:true,type:"Transformer",meterSerials:["GRID1"]};
  const nodes=[
    {seriesKey:"grid",meterSerials:[],meters:0},
    incomer,incomer,{isPhysical:true,type:"Solar",meterSerials:["PV1"]},
    {isPhysical:false,type:"Load",meterSerials:["GRID1","PV1"]},
  ];
  assert.equal(municipalSummaryMeterCount({nodes}),1);
  assert.equal(municipalSummaryMeterCount({nodes:[{seriesKey:"grid",meterSerials:["A","B","A"]}]}),2);
  assert.equal(municipalSummaryMeterCount({nodes:[]}),0);
});
