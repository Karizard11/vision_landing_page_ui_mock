import assert from "node:assert/strict";
import test from "node:test";

import { combineMeterSnapshots } from "../lib/meter-period.ts";

test("period meter summary retains the maximum apparent demand", () => {
  const result = combineMeterSnapshots([
    { energyMwh:7.2475, peakKw:603.128, peakKva:637.587, readings:287 },
    { energyMwh:7.8995, peakKw:713.004, peakKva:756.247, readings:272 },
  ]);

  assert.ok(Math.abs(result.energyMwh-15.147) < 1e-9);
  assert.equal(result.peakKw,713.004);
  assert.equal(result.peakKva,756.247);
  assert.equal(result.readings,559);
});
