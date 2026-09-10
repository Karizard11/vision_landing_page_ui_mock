import assert from "node:assert/strict";
import test from "node:test";

import { dorisUpstream } from "../lib/doris-upstream.ts";

test("Doris service bindings retain their generated base path", () => {
  const previous = process.env.DORIS_API_BASE_URL;
  process.env.DORIS_API_BASE_URL = "https://internal.example/backend-service";
  try {
    assert.equal(
      dorisUpstream("/api/contracts").toString(),
      "https://internal.example/backend-service/api/contracts",
    );
  } finally {
    if (previous === undefined) delete process.env.DORIS_API_BASE_URL;
    else process.env.DORIS_API_BASE_URL = previous;
  }
});
