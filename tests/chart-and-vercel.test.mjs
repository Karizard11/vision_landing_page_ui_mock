import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const component = readFileSync(new URL("components/mock-energy-dashboard.tsx", root), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));

test("every chart series can be toggled from its legend", () => {
  assert.match(component, /function useChartSeriesVisibility/);
  const seriesCount = component.match(/<(?:Area|Line|Bar)\b/g)?.length ?? 0;
  const toggleCount = component.match(/\bhide=\{/g)?.length ?? 0;
  assert.equal(toggleCount, seriesCount);
});

test("the PreCool site overview stacks grid and solar supply", () => {
  assert.match(component, /stackId="site-supply"[^>]*dataKey="grid"/);
  assert.match(component, /stackId="site-supply"[^>]*dataKey="solar"/);
});

test("Vercel uses a native Next.js build", () => {
  assert.equal(packageJson.scripts["build:vercel"], "next build");
  assert.ok(existsSync(new URL("vercel.json", root)));
  const vercel = JSON.parse(readFileSync(new URL("vercel.json", root), "utf8"));
  assert.equal(vercel.framework, "nextjs");
  assert.equal(vercel.buildCommand, "npm run build:vercel");
});
