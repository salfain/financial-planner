import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("manifest Apps Script menjaga deployment single-owner", async () => {
  const manifest = JSON.parse(await readFile(new URL("apps-script/appsscript.json", root), "utf8"));
  assert.equal(manifest.webapp.executeAs, "USER_DEPLOYING");
  assert.equal(manifest.webapp.access, "MYSELF");
});

test("setup pelanggan memakai identitas netral dan installation id", async () => {
  const setup = await readFile(new URL("apps-script/SetupService.gs", root), "utf8");
  const domain = await readFile(new URL("apps-script/DomainService.gs", root), "utf8");
  assert.match(setup, /function setupFinancialPlanner\(\)/);
  assert.match(setup, /FINANCIAL_PLANNER_INSTALLATION_ID/);
  assert.match(setup, /edition: 'single-owner'/);
  assert.match(domain, /payload\.profileName \|\| 'Pemilik'/);
});

test("pembuat paket hanya menyalin source dan panduan instalasi", async () => {
  const [builder, verifier, packageJson] = await Promise.all([
    readFile(new URL("scripts/build-customer-package.mjs", root), "utf8"),
    readFile(new URL("scripts/verify-customer-package.mjs", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.match(builder, /containsCustomerData: false/);
  assert.match(builder, /allowedExtensions/);
  assert.doesNotMatch(builder, /\.openai|\.wrangler|\.clasp\.json["']/);
  assert.match(verifier, /BEGIN \(\?:RSA \)\?PRIVATE KEY/);
  assert.match(verifier, /Checksum/);
  assert.match(packageJson, /verify-customer-package\.mjs/);
});

test("paket demo publik memakai runtime minimal read-only", async () => {
  const [manifestText, main, builder] = await Promise.all([
    readFile(new URL("apps-script-demo/appsscript.json", root), "utf8"),
    readFile(new URL("apps-script-demo/Main.gs", root), "utf8"),
    readFile(new URL("scripts/build-demo-package.mjs", root), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.webapp.access, "ANYONE_ANONYMOUS");
  assert.deepEqual(manifest.oauthScopes, ["https://www.googleapis.com/auth/script.storage"]);
  assert.match(main, /DEMO_READ_ONLY/);
  assert.match(main, /wa\\\.me\|api\\\.whatsapp\\\.com/);
  assert.doesNotMatch(builder, /Router\.gs|SetupService\.gs|\.clasp\.json/);
  assert.match(builder, /containsCustomerData: false/);
});
