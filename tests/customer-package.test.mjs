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
  const builder = await readFile(new URL("scripts/build-customer-package.mjs", root), "utf8");
  assert.match(builder, /containsCustomerData: false/);
  assert.match(builder, /allowedExtensions/);
  assert.doesNotMatch(builder, /\.openai|\.wrangler|\.clasp\.json["']/);
});
