import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { POST } from "../app/api/auth/change-password/route";
import { createOwnerSession, ownerSessionCookie, verifyOwnerSession } from "../lib/owner-auth";
import { clearOwnerAuthStateCache } from "../lib/owner-auth-store";

test("endpoint pengaturan mengganti kunci dan mencabut sesi lama", async () => {
  const oldPassword = "kunci-pemilik-lama-yang-kuat";
  const newPassword = "kunci-pemilik-baru-yang-kuat";
  const oldHash = createHash("sha256").update(oldPassword).digest("hex");
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  let stored = { configured: false, passwordHash: null as string | null, revision: "environment" };

  process.env.APPS_SCRIPT_API_URL = "https://script.google.test/exec";
  process.env.APPS_SCRIPT_ACCESS_KEY = "test-access-key-0123456789-abcdefghijklmnopqrstuvwxyz";
  process.env.FINANCE_OWNER_PASSWORD_SHA256 = oldHash;
  process.env.FINANCE_SESSION_SECRET = "secret-session-owner-0123456789-abcdefghijklmnopqrstuvwxyz";
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body || "{}")) as { action: string; payload?: { passwordHash?: string } };
    if (request.action === "rotateOwnerPassword") {
      stored = { configured: true, passwordHash: String(request.payload?.passwordHash || ""), revision: "rotated-revision" };
      return Response.json({ ok: true, data: { revision: stored.revision, updatedAt: new Date().toISOString(), sessionsRevoked: true } });
    }
    assert.equal(request.action, "ownerAuthState");
    return Response.json({ ok: true, data: stored });
  };

  try {
    clearOwnerAuthStateCache();
    const oldSession = await createOwnerSession();
    const request = new Request("https://financial.example/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerSessionCookie(oldSession.token) },
      body: JSON.stringify({ currentPassword: oldPassword, newPassword }),
    });
    const response = await POST(request);
    const body = await response.json() as { ok?: boolean; message?: string };
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.match(body.message || "", /berhasil diganti/);
    assert.match(response.headers.get("set-cookie") || "", /finance_owner_session=/);
    assert.equal(await verifyOwnerSession(oldSession.token), false);
  } finally {
    globalThis.fetch = originalFetch;
    clearOwnerAuthStateCache();
    for (const key of ["APPS_SCRIPT_API_URL", "APPS_SCRIPT_ACCESS_KEY", "FINANCE_OWNER_PASSWORD_SHA256", "FINANCE_SESSION_SECRET"]) {
      if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
    }
  }
});
