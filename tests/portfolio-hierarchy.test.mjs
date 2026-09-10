import assert from "node:assert/strict";
import test from "node:test";

import { isVirtualTotalNode, portfolioSites, siteNavigationNodes } from "../lib/portfolio-data.ts";

const precool = portfolioSites.find(site => site.code === "P0480");

test("PreCool preserves the electrical and solar SLD branches", () => {
  assert.ok(precool);
  const navigation = siteNavigationNodes(precool);
  const branch = key => navigation.find(node => node.navigationKey === key);

  assert.equal(branch("municipal-total")?.parentId,"1140726");
  assert.equal(branch("municipal-incomer-1")?.parentId,"1140727");
  assert.equal(branch("municipal-pvdb-1")?.parentId,"1140724");
  assert.equal(branch("municipal-incomer-2")?.parentId,"1140727");
  assert.equal(branch("municipal-pvdb-2")?.parentId,"1140728");
  assert.equal(branch("solar-total")?.parentId,"1140726");
  assert.equal(branch("solar-pvdb-1")?.parentId,"1140723");
  assert.equal(branch("solar-pvdb-2")?.parentId,"1140723");
});

test("PreCool site selection contains only its five physical meters", () => {
  assert.ok(precool);
  const names = precool.nodes.filter(node => !isVirtualTotalNode(node)).map(node => node.name);
  assert.deepEqual(names,["Incomer 1","PVDB 1","Incomer 2","PVDB 2","Incomer 3"]);
});
