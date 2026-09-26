import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { BoundedRateLimit } from "../lib/bounded-rate-limit.ts";
import { cmsServerRequest } from "../lib/cms-server-client.ts";

const originalFetch = globalThis.fetch;
const originalNodeEnv = process.env.NODE_ENV;
const originalToken = process.env.CMS_API_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalToken === undefined) delete process.env.CMS_API_TOKEN;
  else process.env.CMS_API_TOKEN = originalToken;
});

test("rate-limit state stays bounded and expired keys are reclaimed", () => {
  const limiter = new BoundedRateLimit(2, 100, 3);
  assert.equal(limiter.consume("a", 0), true);
  assert.equal(limiter.consume("a", 1), true);
  assert.equal(limiter.consume("a", 2), false);
  limiter.consume("b", 3);
  limiter.consume("c", 4);
  limiter.consume("d", 5);
  assert.equal(limiter.size, 3);
  assert.equal(limiter.consume("a", 101), true);
  assert.ok(limiter.size <= 3);
});

test("server client rejects the published development token in production", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.CMS_API_TOKEN;
  globalThis.fetch = async () => { throw new Error("fetch should not be reached"); };
  await assert.rejects(cmsServerRequest("/v1"), /CMS_API_TOKEN must be configured/);
});

test("server client reports malformed upstream JSON without leaking its body", async () => {
  process.env.NODE_ENV = "test";
  process.env.CMS_API_TOKEN = "test-secret";
  globalThis.fetch = async () => new Response("<html>upstream details</html>", { status: 502 });
  await assert.rejects(cmsServerRequest("/v1"), /invalid JSON response \(502\)/);
});
