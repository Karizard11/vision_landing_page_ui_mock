import assert from "node:assert/strict";
import test from "node:test";

import { isLoadNode, isVirtualTotalNode, portfolioSites, siteNavigationNodes } from "../lib/portfolio-data.ts";

const precool = portfolioSites.find(site => site.code === "P0480");

test("PreCool preserves the electrical and solar SLD branches", () => {
  assert.ok(precool);
  const navigation = siteNavigationNodes(precool);
  const branch = key => navigation.find(node => node.navigationKey === key);

  assert.equal(branch("load-total")?.parentId,"site-total");
  assert.equal(branch("municipal-total")?.parentId,"site-total");
  assert.equal(branch("municipal-incomer-1")?.parentId,"municipal-total");
  assert.equal(branch("municipal-pvdb-1")?.parentId,"municipal-incomer-1");
  assert.equal(branch("municipal-incomer-2")?.parentId,"municipal-total");
  assert.equal(branch("municipal-pvdb-2")?.parentId,"municipal-incomer-2");
  assert.equal(branch("solar-total")?.parentId,"site-total");
  assert.equal(branch("solar-pvdb-1")?.parentId,"solar-total");
  assert.equal(branch("solar-pvdb-2")?.parentId,"solar-total");
});

test("PreCool exposes its calculated load total as a selectable node", () => {
  assert.ok(precool);
  const load = siteNavigationNodes(precool).find(node => node.navigationKey === "load-total");
  assert.equal(load?.seriesKey,"load");
  assert.equal(load?.measurementKind,"calculated");
  assert.equal(isLoadNode(load),true);
});

test("PreCool site selection contains only its five physical meters", () => {
  assert.ok(precool);
  const names = precool.nodes.filter(node => !isVirtualTotalNode(node)).map(node => node.name);
  assert.deepEqual(names,["Incomer 1","PVDB 1","Incomer 2","PVDB 2","Incomer 3"]);
});
