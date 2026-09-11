import assert from "node:assert/strict";
import test from "node:test";

import { inclusiveRangeMinutes, selectedTimestampIsInRange } from "../lib/date-time-range.ts";
import { periodBucketMinutes, periodGranularity, periodUsesBars } from "../lib/period-resolution.ts";

test("date ranges select the requested chart resolution", () => {
  assert.equal(periodGranularity(1),"5min");
  assert.equal(periodGranularity(2),"30min");
  assert.equal(periodGranularity(4),"30min");
  assert.equal(periodGranularity(5),"hour");
  assert.equal(periodGranularity(14),"hour");
  assert.equal(periodGranularity(15),"day");
  assert.equal(periodGranularity(31),"day");
  assert.equal(periodGranularity(32),"month");
  assert.equal(periodGranularity(366),"month");
  assert.equal(periodGranularity(367),"year");
  assert.equal(periodGranularity(900),"year");
});

test("interval resolutions expose their bucket size", () => {
  assert.equal(periodBucketMinutes("5min"),5);
  assert.equal(periodBucketMinutes("30min"),30);
  assert.equal(periodBucketMinutes("hour"),60);
  assert.equal(periodBucketMinutes("day"),null);
  assert.equal(periodBucketMinutes("month"),null);
  assert.equal(periodBucketMinutes("year"),null);
});

test("summary resolutions use bar charts", () => {
  assert.equal(periodUsesBars("hour"),false);
  assert.equal(periodUsesBars("day"),true);
  assert.equal(periodUsesBars("month"),true);
  assert.equal(periodUsesBars("year"),true);
});

test("SAST date-time ranges retain the inclusive selected end minute", () => {
  assert.equal(inclusiveRangeMinutes("2026-08-22","00:00","2026-08-22","23:59"),1440);
  assert.equal(inclusiveRangeMinutes("2026-08-22","10:00","2026-08-22","10:30"),31);
  assert.equal(inclusiveRangeMinutes("2026-08-22","23:30","2026-08-23","00:30"),61);
});

test("interval filtering uses the selected SAST date and time", () => {
  assert.equal(selectedTimestampIsInRange("2026-08-22","09:55","2026-08-22","10:00","2026-08-22","10:30"),false);
  assert.equal(selectedTimestampIsInRange("2026-08-22","10:00","2026-08-22","10:00","2026-08-22","10:30"),true);
  assert.equal(selectedTimestampIsInRange("2026-08-22","10:30","2026-08-22","10:00","2026-08-22","10:30"),true);
  assert.equal(selectedTimestampIsInRange("2026-08-22","10:35","2026-08-22","10:00","2026-08-22","10:30"),false);
});
