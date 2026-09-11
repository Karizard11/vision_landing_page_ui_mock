import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as navigation from "../lib/portfolio-data.ts";

test("portfolio arrows are separate from selection and control their own site lists",()=>{
  const component=readFileSync(new URL("../components/mock-energy-dashboard.tsx",import.meta.url),"utf8");
  assert.match(component,/className="portfolio-toggle"[^>]*aria-expanded=\{expandedPortfolios\.has\(portfolio\.id\)\}[^>]*onClick=\{\(\) => togglePortfolio\(portfolio\.id\)\}/);
  assert.match(component,/className="portfolio-link"[^>]*onClick=\{\(\) => selectPortfolio\(portfolio\.id\)\}/);
  assert.match(component,/hidden=\{!expandedPortfolios\.has\(portfolio\.id\)\}/);
  assert.doesNotMatch(component,/selectedPortfolio === portfolio\.id \|\| query/);
});
test("both portfolios can be expanded or collapsed independently",()=>{
  const original=new Set(["terradew-four","redefine-properties"]);
  const td4Closed=navigation.togglePortfolioExpansion(original,"terradew-four");
  assert.deepEqual([...td4Closed],["redefine-properties"]);
  assert.deepEqual([...original],["terradew-four","redefine-properties"]);
  const bothClosed=navigation.togglePortfolioExpansion(td4Closed,"redefine-properties");
  assert.equal(bothClosed.size,0);
  assert.deepEqual([...navigation.togglePortfolioExpansion(bothClosed,"terradew-four")],["terradew-four"]);
  assert.deepEqual([...navigation.togglePortfolioExpansion(original,"redefine-properties")],["terradew-four"]);
});
