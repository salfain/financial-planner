import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("PWA dapat dipasang tanpa menyimpan respons API finansial", async () => {
  const root = new URL("../", import.meta.url);
  const [manifestText, worker, offline, layout, financeApp, deviceNotifications] = await Promise.all([
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
    readFile(new URL("public/offline.html", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("lib/device-notifications.ts", root), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/?source=pwa");
  assert.ok(manifest.icons.length > 0);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.doesNotMatch(worker, /cache\.put\([^\n]*api/i);
  assert.match(offline, /data keuangan dan respons API tidak disimpan/i);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(worker, /addEventListener\("push"/);
  assert.match(worker, /addEventListener\("periodicsync"/);
  assert.match(financeApp, /Notifikasi perangkat/);
  assert.match(deviceNotifications, /Notification\.requestPermission\(\)/);
  assert.match(deviceNotifications, /item\.severity !== "info"/);
});
