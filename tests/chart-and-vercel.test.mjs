import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const component = readFileSync(new URL("components/mock-energy-dashboard.tsx", root), "utf8");
const contractsApi = readFileSync(new URL("backend/contracts.py", root), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const vercel = JSON.parse(readFileSync(new URL("vercel.json", root), "utf8"));

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

test("meter power charts expose Ptot and Stot for site, municipal, and solar totals", () => {
  for (const total of ["Site Total", "Municipal Total", "Solar Total"]) {
    assert.match(component,new RegExp(`${total} Ptot`));
    assert.match(component,new RegExp(`${total} Stot`));
  }
  assert.match(contractsApi,/SELECT timestamp, meter_serial, import_wh, export_wh, ptot, stot/);
  assert.match(contractsApi,/point\["siteStot"\]/);
});

test("Vercel deploys the Next.js UI and private Doris backend as bound services", () => {
  assert.equal(packageJson.scripts["build:vercel"], "next build");
  assert.ok(existsSync(new URL("vercel.json", root)));
  assert.equal(vercel.services.frontend.framework,"nextjs");
  assert.equal(vercel.services.frontend.buildCommand,"npm run build:vercel");
  assert.equal(vercel.services.backend.root,"backend");
  assert.equal(vercel.services.backend.entrypoint,"app:app");
  assert.deepEqual(vercel.services.frontend.bindings,[{
    type:"service",
    service:"backend",
    format:"url",
    env:"DORIS_API_BASE_URL",
  }]);
  assert.ok(existsSync(new URL("backend/requirements.txt",root)));
});
