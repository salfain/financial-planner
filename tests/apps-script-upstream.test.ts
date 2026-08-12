import assert from "node:assert/strict";
import test from "node:test";
import { AppsScriptUpstreamError, callAppsScriptUpstream } from "../app/api/_lib/apps-script-upstream";

test("proxy Apps Script mencoba ulang respons HTML lalu menerima JSON", async () => {
  const beforeUrl = process.env.APPS_SCRIPT_API_URL;
  const beforeKey = process.env.APPS_SCRIPT_ACCESS_KEY;
  const originalFetch = globalThis.fetch;
  process.env.APPS_SCRIPT_API_URL = "https://script.google.test/exec";
  process.env.APPS_SCRIPT_ACCESS_KEY = "a".repeat(48);
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return calls === 1
      ? new Response("<html>temporary</html>", { status: 200, headers: { "content-type": "text/html" } })
      : Response.json({ ok: true, data: { healthy: true } });
  }) as typeof fetch;
  try {
    const result = await callAppsScriptUpstream("health", "68e4ec52-bd4d-4e80-a79f-91e24a0ce6af", {});
    assert.equal(calls, 2);
    assert.equal(result.attempts, 2);
    assert.deepEqual(result.envelope, { ok: true, data: { healthy: true } });
  } finally {
    globalThis.fetch = originalFetch;
    if (beforeUrl === undefined) delete process.env.APPS_SCRIPT_API_URL; else process.env.APPS_SCRIPT_API_URL = beforeUrl;
    if (beforeKey === undefined) delete process.env.APPS_SCRIPT_ACCESS_KEY; else process.env.APPS_SCRIPT_ACCESS_KEY = beforeKey;
  }
});

test("proxy Apps Script menolak endpoint selain HTTPS", async () => {
  const beforeUrl = process.env.APPS_SCRIPT_API_URL;
  const beforeKey = process.env.APPS_SCRIPT_ACCESS_KEY;
  process.env.APPS_SCRIPT_API_URL = "http://script.google.test/exec";
  process.env.APPS_SCRIPT_ACCESS_KEY = "b".repeat(48);
  try {
    await assert.rejects(
      () => callAppsScriptUpstream("health", "68e4ec52-bd4d-4e80-a79f-91e24a0ce6af", {}),
      (error: unknown) => error instanceof AppsScriptUpstreamError && error.code === "APPS_SCRIPT_URL_INVALID",
    );
  } finally {
    if (beforeUrl === undefined) delete process.env.APPS_SCRIPT_API_URL; else process.env.APPS_SCRIPT_API_URL = beforeUrl;
    if (beforeKey === undefined) delete process.env.APPS_SCRIPT_ACCESS_KEY; else process.env.APPS_SCRIPT_ACCESS_KEY = beforeKey;
  }
});
