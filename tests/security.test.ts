import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, DEFAULT_WORKSPACE_ID, resolveWorkspaceId } from "../app/api/_lib/api";
import { applySecurityHeaders, authenticatedViewerFromHeaders } from "../lib/security";

test("workspace finansial tidak dapat diganti dari browser", () => {
  assert.equal(
    resolveWorkspaceId(new Request("https://planner.test/api/finance/bootstrap")),
    DEFAULT_WORKSPACE_ID,
  );
  assert.equal(
    resolveWorkspaceId(new Request(`https://planner.test/api/finance/bootstrap?workspaceId=${DEFAULT_WORKSPACE_ID}`)),
    DEFAULT_WORKSPACE_ID,
  );

  assert.throws(
    () => resolveWorkspaceId(new Request("https://planner.test/api/finance/bootstrap?workspaceId=workspace-lain")),
    (error: unknown) => error instanceof ApiError && error.status === 403 && error.code === "WORKSPACE_ACCESS_DENIED",
  );
  assert.throws(
    () => resolveWorkspaceId(
      new Request("https://planner.test/api/finance/bootstrap", { headers: { "X-Workspace-Id": "workspace-lain" } }),
      { workspaceId: "workspace-lain" },
    ),
    (error: unknown) => error instanceof ApiError && error.status === 403,
  );
});

test("identitas Sites dibaca dari header terverifikasi", () => {
  const headers = new Headers({
    "oai-authenticated-user-email": " Owner@Example.com ",
    "oai-authenticated-user-full-name": "Vinn%20Owner",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });
  assert.deepEqual(authenticatedViewerFromHeaders(headers), {
    displayName: "Vinn Owner",
    email: "owner@example.com",
    fullName: "Vinn Owner",
  });
  assert.equal(authenticatedViewerFromHeaders(new Headers()), null);
});

test("worker menambahkan header keamanan dan mencegah cache API", async () => {
  const apiRequest = new Request("https://planner.test/api/finance/bootstrap");
  const response = applySecurityHeaders(apiRequest, Response.json({ ok: true }));

  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.match(response.headers.get("strict-transport-security") ?? "", /max-age=31536000/);
  assert.deepEqual(await response.json(), { ok: true });
});
