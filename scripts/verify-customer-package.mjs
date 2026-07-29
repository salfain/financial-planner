import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = join(root, "outputs", "financial-planner-customer");
const manifestPath = join(packageDir, "PACKAGE-MANIFEST.json");
const files = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) await collect(absolute);
    else files.push(absolute);
  }
}

await collect(packageDir);
const names = files.map((file) => relative(packageDir, file).replaceAll("\\", "/")).sort();
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

assert.equal(manifest.product, "Financial Planner");
assert.equal(manifest.edition, "single-owner");
assert.equal(manifest.containsCustomerData, false);
assert.equal(manifest.deploymentAccess, "MYSELF");
assert.ok(names.includes("MULAI-DI-SINI.md"));
assert.ok(names.includes("apps-script/appsscript.json"));
assert.ok(names.includes("apps-script/Frontend.html"));
assert.equal(names.some((name) => name.endsWith("/.clasp.json") || name === ".clasp.json"), false);
assert.equal(names.some((name) => /\.(sqlite|db|log|pem|key|tar|gz)$/i.test(name)), false);

for (const [name, checksum] of Object.entries(manifest.files)) {
  const body = await readFile(join(packageDir, name));
  assert.equal(createHash("sha256").update(body).digest("hex"), checksum, `Checksum ${name} berubah.`);
}

const inspectable = files.filter((file) => /\.(?:gs|html|json|md)$/i.test(file));
const combined = (await Promise.all(inspectable.map((file) => readFile(file, "utf8")))).join("\n");
assert.doesNotMatch(combined, /-----BEGIN (?:RSA )?PRIVATE KEY-----/);
assert.doesNotMatch(combined, /\bvfp_[A-Za-z0-9_-]{20,}\b/);
assert.doesNotMatch(combined, /"scriptId"\s*:\s*"[A-Za-z0-9_-]{20,}"/);

console.log(`Paket pelanggan terverifikasi bersih: ${names.length} file, checksum cocok, tanpa data maupun credential penjual.`);
