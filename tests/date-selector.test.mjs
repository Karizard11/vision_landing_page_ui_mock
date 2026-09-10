import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../components/mock-energy-dashboard.tsx", import.meta.url), "utf8");
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

  assert.match(component, /MMM dd, yyyy.*\[00:00\].*MMM dd, yyyy.*\[23:59\]/);
  assert.doesNotMatch(component, /Previous period|Next period/);
  assert.match(styles, /\.top-actions \.date-button\{[^}]*width:352px!important/);
  assert.match(styles, /\.top-actions \.date-button\{[^}]*height:41px!important/);
});
