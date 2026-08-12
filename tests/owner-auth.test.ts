import assert from "node:assert/strict";
import test from "node:test";
import {
  createOwnerSession,
  isOwnerRequest,
  ownerPasswordConfigured,
  ownerSessionCookie,
  verifyOwnerPassword,
  verifyOwnerSession,
} from "../lib/owner-auth";

const password = "uji-kunci-pemilik-yang-kuat";
const passwordHash = "9f6ef1dbdb0d4167e8cfe37e91efd821c3e749da435f5188e011ceb024509d7b";

test("owner auth menolak konfigurasi kosong dan menerima sesi bertanda tangan", async () => {
  const beforeHash = process.env.FINANCE_OWNER_PASSWORD_SHA256;
  const beforeSecret = process.env.FINANCE_SESSION_SECRET;
  process.env.FINANCE_OWNER_PASSWORD_SHA256 = passwordHash;
  process.env.FINANCE_SESSION_SECRET = "secret-session-owner-0123456789-abcdefghijklmnopqrstuvwxyz";
  try {
    assert.equal(ownerPasswordConfigured(), true);
    assert.equal(await verifyOwnerPassword(password), true);
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
