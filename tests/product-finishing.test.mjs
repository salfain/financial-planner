import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("finishing produksi menjaga fitur lama sambil menambah pemeriksaan dan bantuan", async () => {
  const [app, styles, dockerfile, sessionRoute] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("Dockerfile", root), "utf8"),
    readFile(new URL("app/api/auth/session/route.ts", root), "utf8"),
  ]);
  assert.match(app, /Pusat pemeriksaan data/);
  assert.match(app, /Kemungkinan duplikat/);
  assert.match(app, /Bantuan Financial Planner/);
  assert.match(app, /Ganti PIN bawaan sekarang/);
  assert.doesNotMatch(app, /PIN bawaan masih aktif/);
  assert.match(app, /Tersinkron/);
  assert.match(app, /useDeferredValue/);
  assert.match(app, /financial-planner-privacy/);
  assert.match(styles, /content-visibility: auto/);
  assert.match(styles, /\.help-guide-grid/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /127\.0\.0\.1:3000\/api\/health/);
  assert.match(sessionRoute, /requiresPinChange/);
});
