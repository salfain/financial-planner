import assert from "node:assert/strict";
import test from "node:test";
import {
  createOwnerSession,
  hashOwnerPassword,
  isOwnerRequest,
  ownerPasswordConfigured,
  ownerPinNeedsRotation,
  ownerSessionCookie,
  verifyOwnerPassword,
  verifyOwnerSession,
} from "../lib/owner-auth";
import { clearOwnerAuthStateCache } from "../lib/owner-auth-store";

const password = "253246";
const passwordHash = "f8c94f689e2eecbfea9ffa0e5328688980dac5436bb39b1cac228a9045c338c0";

test("owner auth menolak konfigurasi kosong dan menerima sesi bertanda tangan", async () => {
  const beforeHash = process.env.FINANCE_OWNER_PASSWORD_SHA256;
  const beforeSecret = process.env.FINANCE_SESSION_SECRET;
  process.env.FINANCE_OWNER_PASSWORD_SHA256 = passwordHash;
  process.env.FINANCE_SESSION_SECRET = "secret-session-owner-0123456789-abcdefghijklmnopqrstuvwxyz";
  try {
    assert.equal(ownerPasswordConfigured(), true);
    assert.equal(await verifyOwnerPassword(password), true);
    assert.equal(await ownerPinNeedsRotation(), true);
    assert.equal(await verifyOwnerPassword("salah"), false);
    const session = await createOwnerSession();
    assert.equal(await verifyOwnerSession(session.token), true);
    assert.equal(await verifyOwnerSession(`${session.token}rusak`), false);

    const cookie = ownerSessionCookie(session.token);
    const request = new Request("https://financial.example", { headers: { cookie } });
    assert.equal(await isOwnerRequest(request), true);
  } finally {
    if (beforeHash === undefined) delete process.env.FINANCE_OWNER_PASSWORD_SHA256;
    else process.env.FINANCE_OWNER_PASSWORD_SHA256 = beforeHash;
    if (beforeSecret === undefined) delete process.env.FINANCE_SESSION_SECRET;
    else process.env.FINANCE_SESSION_SECRET = beforeSecret;
  }
});

test("rotasi kunci mencabut sesi lama dan menerima sesi baru", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.APPS_SCRIPT_API_URL;
  const originalKey = process.env.APPS_SCRIPT_ACCESS_KEY;
  const originalHash = process.env.FINANCE_OWNER_PASSWORD_SHA256;
  const originalSecret = process.env.FINANCE_SESSION_SECRET;
  const newPassword = "654321";
  const newHash = await hashOwnerPassword(newPassword);
  let storedState = { configured: false, passwordHash: null as string | null, revision: "environment" };

  process.env.APPS_SCRIPT_API_URL = "https://script.google.test/exec";
  process.env.APPS_SCRIPT_ACCESS_KEY = "test-access-key-0123456789-abcdefghijklmnopqrstuvwxyz";
  process.env.FINANCE_OWNER_PASSWORD_SHA256 = passwordHash;
  process.env.FINANCE_SESSION_SECRET = "secret-session-owner-0123456789-abcdefghijklmnopqrstuvwxyz";
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body || "{}")) as { action?: string };
    assert.equal(request.action, "ownerAuthState");
    return Response.json({ ok: true, data: storedState });
  };

  try {
    clearOwnerAuthStateCache();
    const oldSession = await createOwnerSession();
    assert.equal(await verifyOwnerSession(oldSession.token), true);

    storedState = { configured: true, passwordHash: newHash, revision: "revision-baru" };
    clearOwnerAuthStateCache();
    assert.equal(await verifyOwnerSession(oldSession.token), false);
    assert.equal(await verifyOwnerPassword(password), false);
    assert.equal(await verifyOwnerPassword(newPassword), true);
    const newSession = await createOwnerSession();
    assert.equal(await verifyOwnerSession(newSession.token), true);
  } finally {
    globalThis.fetch = originalFetch;
    clearOwnerAuthStateCache();
    if (originalUrl === undefined) delete process.env.APPS_SCRIPT_API_URL; else process.env.APPS_SCRIPT_API_URL = originalUrl;
    if (originalKey === undefined) delete process.env.APPS_SCRIPT_ACCESS_KEY; else process.env.APPS_SCRIPT_ACCESS_KEY = originalKey;
    if (originalHash === undefined) delete process.env.FINANCE_OWNER_PASSWORD_SHA256; else process.env.FINANCE_OWNER_PASSWORD_SHA256 = originalHash;
    if (originalSecret === undefined) delete process.env.FINANCE_SESSION_SECRET; else process.env.FINANCE_SESSION_SECRET = originalSecret;
  }
});
