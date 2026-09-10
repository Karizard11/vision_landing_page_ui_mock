import assert from "node:assert/strict";
import test from "node:test";

import { periodBucketMinutes, periodGranularity } from "../lib/period-resolution.ts";

test("date ranges select the requested chart resolution", () => {
  assert.equal(periodGranularity(1),"5min");
  assert.equal(periodGranularity(2),"30min");
  assert.equal(periodGranularity(4),"30min");
  assert.equal(periodGranularity(5),"hour");
  assert.equal(periodGranularity(14),"hour");
  assert.equal(periodGranularity(15),"day");
  assert.equal(periodGranularity(31),"day");
});

test("interval resolutions expose their bucket size", () => {
  assert.equal(periodBucketMinutes("5min"),5);
  assert.equal(periodBucketMinutes("30min"),30);
  assert.equal(periodBucketMinutes("hour"),60);
  assert.equal(periodBucketMinutes("day"),null);
});
