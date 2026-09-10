import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { contractSiteLabel } from "../lib/portfolio-data.ts";

test("contract labels use project, site, and only non-primary phases", () => {
  assert.equal(contractSiteLabel({code:"P0428",name:"Norwood Mall",phaseNumber:"1"}),"P0428 | Norwood Mall");
  assert.equal(contractSiteLabel({code:"P0533",name:"SPAR DC",phaseNumber:"2"}),"P0533 | SPAR DC | Phase 2");
});

test("top navigation has no Add Site or notification controls", () => {
  const source = readFileSync(new URL("../components/mock-energy-dashboard.tsx",import.meta.url),"utf8");
  const topbar = source.slice(source.indexOf("function Topbar"),source.indexOf("function PageTitle"));
  assert.equal(topbar.includes("Add Site"),false);
  assert.equal(topbar.includes("Notifications"),false);
  assert.match(source,/\/api\/contracts/);
  assert.match(source,/\/api\/site\?contract_id=/);
});
