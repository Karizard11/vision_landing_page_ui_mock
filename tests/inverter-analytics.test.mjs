import assert from "node:assert/strict";
import test from "node:test";

import { buildInverterEnergySeries, buildInverterHeatmap } from "../lib/inverter-analytics.ts";

test("inverter interval power becomes bucket energy and a running cumulative", () => {
  const result = buildInverterEnergySeries({
    granularity:"5min",
    power:[
      {time:"09:00",inverter:120},
      {time:"09:05",inverter:60},
      {time:"09:10",inverter:null},
    ],
  });
  assert.deepEqual(result,[
    {time:"09:00",energy:10,cumulative:10},
    {time:"09:05",energy:5,cumulative:15},
    {time:"09:10",energy:null,cumulative:15},
  ]);
});

test("daily inverter energy remains MWh and accumulates across the selection", () => {
  const result = buildInverterEnergySeries({
    granularity:"day",
    power:[{time:"21 Aug",inverter:6.2},{time:"22 Aug",inverter:6.8}],
  });
  assert.deepEqual(result,[
    {time:"21 Aug",energy:6.2,cumulative:6.2},
    {time:"22 Aug",energy:6.8,cumulative:13},
  ]);
});

test("heatmap keeps missing readings separate and normalises against the selected maximum", () => {
  const result = buildInverterHeatmap({
    inverterSummary:[{code:"01"},{code:"02"}],
    inverterAc:[
      {time:"09:00",i01:50,i02:100},
      {time:"09:05",i01:75},
    ],
  });
  assert.equal(result.maximum,100);
  assert.deepEqual(result.rows[0].cells.map(cell => cell.intensity),[.5,.75]);
  assert.deepEqual(result.rows[1].cells.map(cell => cell.intensity),[1,null]);
});
