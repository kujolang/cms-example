import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { authenticateLocalCredentials, authenticateStudioRequest } from "../lib/cms-auth.ts";

const originalFetch = globalThis.fetch;
const originalSecret = process.env.CMS_PLATFORM_IDENTITY_SECRET;
const originalLogin = process.env.CMS_STUDIO_ALLOW_PASSWORD_LOGIN;
const originalNodeEnv = process.env.NODE_ENV;
const secret = "test-only-private-identity-secret-123456789";

const record = {
  id: 1, email: "admin@example.test", username: "admin", display_name: "Admin",
  first_name: "", last_name: "", bio: "", website_url: "", avatar_url: "",
  social_json: "{}", role_key: "super_admin", status: "active", created_at: "2026-01-01",
  last_login_at: null,
};

before(() => {
  globalThis.fetch = async (input) => {
    const path = new URL(input).pathname;
    if (path === "/v1/users") return Response.json({ ok: true, data: { items: [record] } });
    if (path === "/v1/auth/providers/resolve") {
      return Response.json({ ok: true, data: { authenticated: true, user: {
        ...record, role_name: "Administrator", capabilities: ["manage_users", "view_content"],
      } } });
    }
    throw new Error(`Unexpected CMS request: ${path}`);
  };
});

after(() => {
  globalThis.fetch = originalFetch;
  if (originalSecret === undefined) delete process.env.CMS_PLATFORM_IDENTITY_SECRET;
  else process.env.CMS_PLATFORM_IDENTITY_SECRET = originalSecret;
  if (originalLogin === undefined) delete process.env.CMS_STUDIO_ALLOW_PASSWORD_LOGIN;
  else process.env.CMS_STUDIO_ALLOW_PASSWORD_LOGIN = originalLogin;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

function identityRequest(extraHeaders = {}) {
  return new Request("https://example.test/api/cms/auth", { headers: {
    "oai-authenticated-user-id": "attacker-chosen-id",
    "oai-authenticated-user-email": record.email,
    ...extraHeaders,
  } });
}

test("untrusted identity headers cannot impersonate an administrator", async () => {
  delete process.env.CMS_PLATFORM_IDENTITY_SECRET;
  assert.equal(await authenticateStudioRequest(identityRequest()), null);
  process.env.CMS_PLATFORM_IDENTITY_SECRET = secret;
  assert.equal(await authenticateStudioRequest(identityRequest()), null);
  assert.equal(await authenticateStudioRequest(identityRequest({ "x-cms-platform-identity-secret": "wrong" })), null);
});

test("identity from an ingress carrying the configured private secret is accepted", async () => {
  process.env.CMS_PLATFORM_IDENTITY_SECRET = secret;
  const user = await authenticateStudioRequest(identityRequest({ "x-cms-platform-identity-secret": secret }));
  assert.equal(user?.email, record.email);
  assert.ok(user?.capabilities.includes("manage_users"));
});

test("a forged loopback Host does not enable password login in production", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.CMS_STUDIO_ALLOW_PASSWORD_LOGIN;
  const result = await authenticateLocalCredentials(
    new Request("https://localhost/api/cms/auth"), record.email, "anything",
  );
  assert.equal(result.user, null);
  assert.match(result.error, /not enabled/);
});

test("production never accepts known demo accounts even if password login is enabled", async () => {
  process.env.NODE_ENV = "production";
  process.env.CMS_STUDIO_ALLOW_PASSWORD_LOGIN = "true";
  const result = await authenticateLocalCredentials(
    new Request("https://cms.example.test/api/cms/auth"), "admin@fieldnotes.local", "fieldnotes-demo",
  );
  assert.equal(result.user, null);
  assert.match(result.error, /Demo accounts/);
});
