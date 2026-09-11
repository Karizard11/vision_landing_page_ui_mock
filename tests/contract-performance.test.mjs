import assert from "node:assert/strict";
import test from "node:test";
import {siteNavigationId,sitesForPortfolio} from "../lib/portfolio-data.ts";

test("contract identity distinguishes identical project codes and phases",()=>{
  assert.notEqual(siteNavigationId({code:"P0100",contractId:"1"}),siteNavigationId({code:"P0100",contractId:"2"}));
});
test("account portfolio membership does not mix provider contracts",()=>{
  const sites=[{code:"A",portfolioId:"terradew-four"},{code:"B",portfolioId:"redefine-properties"},{code:"C",portfolioId:"redefine-properties"}];
  assert.deepEqual(sitesForPortfolio(sites,"redefine-properties").map(s=>s.code),["B","C"]);
  assert.deepEqual(sitesForPortfolio(sites,"terradew-four").map(s=>s.code),["A"]);
});
