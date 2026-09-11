import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../components/mock-energy-dashboard.tsx", import.meta.url), "utf8");
const siteRoute = readFileSync(new URL("../app/api/site/route.ts", import.meta.url), "utf8");
const precoolRoute = readFileSync(new URL("../app/api/precool/route.ts", import.meta.url), "utf8");
const telemetryRoute = readFileSync(new URL("../app/api/precool/telemetry/route.ts", import.meta.url), "utf8");
const backendSources = readFileSync(new URL("../backend/app.py", import.meta.url), "utf8") + readFileSync(new URL("../backend/contracts.py", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("date selector exposes the complete range-picker control", () => {
  for (const label of [
    "Today",
    "Yesterday",
    "Since Yesterday",
    "Last 7 days",
    "Last 30 days",
    "This Month",
    "Last Month",
    "Year to date",
    "Twelve Months",
    "Apply",
    "Clear",
  ]) {
    assert.match(component, new RegExp(`>${label}<|\\[\"${label}\"`));
  }

  assert.match(component, /type="time"/);
  assert.match(component, /step=\{300\}/);
  assert.match(component, />Start time</);
  assert.match(component, />End time</);
  assert.match(component, />SAST</);
  assert.doesNotMatch(component, /Previous period|Next period/);
  assert.match(styles, /\.top-actions \.date-button\{[^}]*width:352px!important/);
  assert.match(styles, /\.top-actions \.date-button\{[^}]*height:41px!important/);
});

test("selected SAST times are forwarded through every data route", () => {
  assert.match(component, /from_time=/);
  assert.match(component, /to_time=/);
  for (const route of [siteRoute,precoolRoute,telemetryRoute]) {
    assert.match(route, /from_time/);
    assert.match(route, /to_time/);
  }
});

test("Solcast period-end timestamps are shifted to period start", () => {
  assert.match(backendSources, /DATE_SUB\(period_end, INTERVAL 30 MINUTE\)/);
});
