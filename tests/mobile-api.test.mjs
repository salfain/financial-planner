import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const mobileApiSource = await readFile(new URL("../apps-script/MobileApi.gs", import.meta.url), "utf8");
const VALID_ACCESS_KEY = "vfp_test_0123456789abcdef0123456789abcdef0123456789abcdef";
const VALID_ACCESS_KEY_HASH = createHash("sha256").update(VALID_ACCESS_KEY).digest("hex");

const createHarness = () => {
  const properties = new Map([
    ["VINN_MOBILE_API_ENABLED", "true"],
    ["VINN_MOBILE_ACCESS_KEY_SHA256", VALID_ACCESS_KEY_HASH],
  ]);
  const cache = new Map();
  const audits = [];
  const routed = [];

  const context = vm.createContext({
    VINN_CONFIG: { SHEETS: { AUDIT_LOG: "AuditLog" } },
    console: { error() {} },
    createError_(code, message, details) {
      const error = new Error(message);
      error.code = code;
      error.details = details || null;
      return error;
    },
    nowIso_: () => new Date().toISOString(),
    ok_: (data, requestId) => ({ ok: true, data, requestId: requestId || null, timestamp: new Date().toISOString() }),
    fail_: (error, requestId) => ({
      ok: false,
      error: { code: error.code || "INTERNAL_ERROR", message: error.message, details: error.details || null },
      requestId: requestId || null,
      timestamp: new Date().toISOString(),
    }),
    parseJsonObject_(value) {
      if (!value) return {};
      return typeof value === "object" ? value : JSON.parse(String(value));
    },
    rowsAsObjects_: () => audits.map((row, index) => ({ ...row, _row: index + 2 })),
    recentAuditRows_: (limit) => audits.slice(-limit).map((row, index) => ({ ...row, _row: index + 2 })),
    audit_(action, module, entityId, requestId, details) {
      audits.push({
        action, module, entity_id: entityId, request_id: requestId,
        details_json: JSON.stringify(details || {}), created_at: new Date().toISOString(),
      });
    },
    withDocumentLock_: (callback) => callback(),
    api(action, payload) {
      routed.push({ action, payload: { ...payload } });
      return { ok: true, data: { action, accepted: true }, requestId: payload.requestId, timestamp: new Date().toISOString() };
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (key) => properties.get(key) ?? null }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => cache.get(key) ?? null,
        put: (key, value) => cache.set(key, value),
      }),
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: "SHA_256" },
      Charset: { UTF_8: "UTF_8" },
      computeDigest: (_algorithm, value) => [...createHash("sha256").update(String(value)).digest()],
      newBlob: (value) => ({ getBytes: () => [...Buffer.from(String(value))] }),
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(content) {
        return {
          content,
          mimeType: "text/plain",
          setMimeType(value) { this.mimeType = value; return this; },
        };
      },
    },
  });

  new vm.Script(mobileApiSource, { filename: "MobileApi.gs" }).runInContext(context);
  return {
    context,
    properties,
    cache,
    audits,
    routed,
  };
};

const ids = {
  read: "9dcbf4b0-3425-4b31-90f0-440cb6274001",
  mutation: "9dcbf4b0-3425-4b31-90f0-440cb6274002",
  invalid: "9dcbf4b0-3425-4b31-90f0-440cb6274003",
};

const invoke = (harness, body, overrides = {}) => {
  const contents = typeof body === "string" ? body : JSON.stringify(body);
  const output = harness.context.doPost({
    postData: { contents, length: Buffer.byteLength(contents), ...overrides },
  });
  assert.equal(output.mimeType, "application/json");
  return JSON.parse(output.content);
};

test("doPost memverifikasi access key lalu meneruskan envelope tanpa secret", () => {
  const harness = createHarness();
  const response = invoke(harness, {
    action: "bootstrap",
    requestId: ids.read,
    accessKey: VALID_ACCESS_KEY,
    payload: {
      month: "2026-07",
      accessKey: "nested-access-key-must-be-removed",
      idToken: "legacy-token-must-be-removed",
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.requestId, ids.read);
  assert.equal(harness.routed.length, 1);
  assert.deepEqual(harness.routed[0], {
    action: "bootstrap",
    payload: { month: "2026-07", requestId: ids.read },
  });
  assert.equal(JSON.stringify(harness.routed).includes(VALID_ACCESS_KEY), false);
});

test("doPost menolak access key kosong, pendek, atau salah sebelum router", () => {
  const harness = createHarness();
  const missing = invoke(harness, { action: "bootstrap", requestId: ids.read, payload: {} });
  const short = invoke(harness, { action: "bootstrap", requestId: ids.invalid, accessKey: "terlalu-pendek", payload: {} });
  const wrong = invoke(harness, {
    action: "bootstrap",
    requestId: "9dcbf4b0-3425-4b31-90f0-440cb6274004",
    accessKey: "vfp_wrong_0123456789abcdef0123456789abcdef0123456789abcdef",
    payload: {},
  });
  assert.equal(missing.error.code, "AUTH_REQUIRED");
  assert.equal(short.error.code, "AUTH_INVALID");
  assert.equal(wrong.error.code, "AUTH_INVALID");
  assert.equal(harness.routed.length, 0);
});

test("doPost fail-closed saat konfigurasi mobile belum lengkap", () => {
  const harness = createHarness();
  harness.properties.delete("VINN_MOBILE_ACCESS_KEY_SHA256");
  const response = invoke(harness, {
    action: "bootstrap", requestId: ids.invalid, accessKey: VALID_ACCESS_KEY, payload: {},
  });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "MOBILE_API_NOT_CONFIGURED");
  assert.equal(harness.routed.length, 0);
});

test("kill switch menolak semua request meski access key benar", () => {
  const harness = createHarness();
  harness.properties.set("VINN_MOBILE_API_ENABLED", "false");
  const response = invoke(harness, {
    action: "bootstrap", requestId: ids.invalid, accessKey: VALID_ACCESS_KEY, payload: {},
  });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "MOBILE_API_DISABLED");
  assert.equal(harness.routed.length, 0);
});

test("doPost memvalidasi JSON, action, UUID v4, payload, dan batas ukuran", () => {
  const harness = createHarness();
  assert.equal(invoke(harness, "{").error.code, "INVALID_JSON");
  assert.equal(invoke(harness, {
    action: "notARoute", requestId: ids.invalid, accessKey: VALID_ACCESS_KEY, payload: {},
  }).error.code, "ACTION_NOT_ALLOWED");
  assert.equal(invoke(harness, {
    action: "bootstrap", requestId: "not-a-uuid", accessKey: VALID_ACCESS_KEY, payload: {},
  }).error.code, "INVALID_REQUEST_ID");
  assert.equal(invoke(harness, {
    action: "bootstrap", requestId: ids.invalid, accessKey: VALID_ACCESS_KEY, payload: [],
  }).error.code, "INVALID_PAYLOAD");
  assert.equal(invoke(harness, {
    action: "bootstrap", requestId: ids.invalid, accessKey: VALID_ACCESS_KEY, payload: {},
  }, { length: 13 * 1024 * 1024 + 1 }).error.code, "PAYLOAD_TOO_LARGE");
});

test("mutation mobile single-flight dan replay requestId tidak menjalankan router dua kali", () => {
  const harness = createHarness();
  const request = {
    action: "createAccount",
    requestId: ids.mutation,
    accessKey: VALID_ACCESS_KEY,
    payload: { name: "Kas", type: "Cash", openingBalance: 0 },
  };
  const first = invoke(harness, request);
  const replay = invoke(harness, request);

  assert.equal(first.ok, true);
  assert.deepEqual(replay, first);
  assert.equal(harness.routed.length, 1);
  assert.equal(harness.audits.filter((row) => row.action === "MOBILE_API_COMMIT").length, 1);
});

test("requestId mutation tidak boleh dipakai ulang untuk action lain", () => {
  const harness = createHarness();
  invoke(harness, {
    action: "createAccount", requestId: ids.mutation, accessKey: VALID_ACCESS_KEY,
    payload: { name: "Kas", type: "Cash" },
  });
  const response = invoke(harness, {
    action: "createGoal", requestId: ids.mutation, accessKey: VALID_ACCESS_KEY,
    payload: { name: "Dana darurat", targetAmount: 1000000 },
  });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "REQUEST_ID_REUSED");
  assert.equal(harness.routed.length, 1);
});
