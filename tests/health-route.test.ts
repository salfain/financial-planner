import assert from "node:assert/strict";
import test from "node:test";

test("health check hanya mengekspos status aman tanpa isi spreadsheet", async () => {
  const beforeUrl = process.env.APPS_SCRIPT_API_URL;
  const beforeKey = process.env.APPS_SCRIPT_ACCESS_KEY;
  const originalFetch = globalThis.fetch;
  process.env.APPS_SCRIPT_API_URL = "https://script.google.test/exec";
  process.env.APPS_SCRIPT_ACCESS_KEY = "c".repeat(48);
  globalThis.fetch = (async () => Response.json({ ok: true, data: { sheets: [{ name: "Transactions", rows: 999 }] } })) as typeof fetch;
  try {
    const { GET } = await import(`../app/api/health/route?test=${Date.now()}`);
    const response = await GET(new Request("https://financial.example/api/health?deep=1"));
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.storage, "google-sheets");
    assert.equal("data" in body, false);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  } finally {
    globalThis.fetch = originalFetch;
    if (beforeUrl === undefined) delete process.env.APPS_SCRIPT_API_URL; else process.env.APPS_SCRIPT_API_URL = beforeUrl;
    if (beforeKey === undefined) delete process.env.APPS_SCRIPT_ACCESS_KEY; else process.env.APPS_SCRIPT_ACCESS_KEY = beforeKey;
  }
});

test("health check liveness tidak menunggu Apps Script", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; throw new Error("upstream unavailable"); }) as typeof fetch;
  try {
    const { GET } = await import(`../app/api/health/route?liveness=${Date.now()}`);
    const response = await GET(new Request("https://financial.example/api/health"));
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.equal(body.check, "liveness");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
