import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../apps-script/OwnerAuthService.gs", import.meta.url), "utf8");

const createHarness = () => {
  const properties = new Map();
  const audits = [];
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key) => properties.get(key) ?? null,
      setProperties: (values) => Object.entries(values).forEach(([key, value]) => properties.set(key, value)),
    }) },
    Utilities: { getUuid: () => "auth-revision-2026" },
    nowIso_: () => "2026-08-12T15:00:00.000Z",
    ok_: (data, requestId) => ({ ok: true, data, requestId: requestId || null }),
    createError_: (code, message) => Object.assign(new Error(message), { code }),
    audit_: (action, module, entityId, requestId, details) => audits.push({ action, module, entityId, requestId, details }),
  });
  new vm.Script(source, { filename: "OwnerAuthService.gs" }).runInContext(context);
  return { context, properties, audits };
};

test("Apps Script menyimpan hash kunci dan revisi tanpa plaintext", () => {
  const harness = createHarness();
  assert.equal(harness.context.apiOwnerAuthState().data.configured, false);
  assert.throws(() => harness.context.apiRotateOwnerPassword({ passwordHash: "bukan-hash" }), /Hash kunci/);

  const passwordHash = "a".repeat(64);
  const rotated = harness.context.apiRotateOwnerPassword({ passwordHash, requestId: "request-1" });
  assert.equal(rotated.ok, true);
  assert.equal(rotated.data.sessionsRevoked, true);
  assert.equal(harness.context.apiOwnerAuthState().data.passwordHash, passwordHash);
  assert.equal(harness.context.apiOwnerAuthState().data.revision, "auth-revision-2026");
  assert.equal(JSON.stringify(harness.audits).includes(passwordHash), false);
});
