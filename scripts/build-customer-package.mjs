import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "apps-script");
const outputRoot = join(root, "outputs");
const packageDir = join(outputRoot, "financial-planner-customer");
const archivePath = join(outputRoot, "Financial-Planner-Pelanggan.zip");
const appDir = join(packageDir, "apps-script");
const guideSource = join(root, "docs", "PANDUAN-JUAL-PUTUS.md");
const allowedExtensions = new Set([".gs", ".html", ".json"]);

const extensionOf = (name) => name.slice(name.lastIndexOf("."));

await rm(packageDir, { recursive: true, force: true });
await mkdir(appDir, { recursive: true });

const sourceFiles = (await readdir(sourceDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && allowedExtensions.has(extensionOf(entry.name)))
  .map((entry) => entry.name)
  .sort();

if (!sourceFiles.includes("appsscript.json") || !sourceFiles.includes("Frontend.html")) {
  throw new Error("Bundle Apps Script belum lengkap. Jalankan build:gas terlebih dahulu.");
}

for (const filename of sourceFiles) {
  await cp(join(sourceDir, filename), join(appDir, filename));
}

await cp(guideSource, join(packageDir, "MULAI-DI-SINI.md"));
await cp(join(root, ".clasp.json.example"), join(packageDir, ".clasp.json.example"));

const packageFiles = [];
async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(absolute);
    else packageFiles.push(absolute);
  }
}

await collectFiles(packageDir);
const checksums = {};
for (const absolute of packageFiles) {
  const key = relative(packageDir, absolute).replaceAll("\\", "/");
  checksums[key] = createHash("sha256").update(await readFile(absolute)).digest("hex");
}

const manifest = {
  product: "Financial Planner",
  edition: "single-owner",
  storage: "Google Sheets milik pembeli",
  containsCustomerData: false,
  deploymentAccess: "MYSELF",
  generatedAt: new Date().toISOString(),
  files: checksums,
};

await writeFile(
  join(packageDir, "PACKAGE-MANIFEST.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

await rm(archivePath, { force: true });
if (process.platform === "win32") {
  const quote = (value) => `'${value.replaceAll("'", "''")}'`;
  const archived = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path ${quote(join(packageDir, "*"))} -DestinationPath ${quote(archivePath)} -Force`,
    ],
    { encoding: "utf8" },
  );
  if (archived.status !== 0) {
    throw new Error(archived.stderr || "Paket ZIP pelanggan tidak dapat dibuat.");
  }
}

console.log(`Paket pelanggan siap: ${packageDir}`);
if (process.platform === "win32") console.log(`Arsip siap dikirim: ${archivePath}`);
console.log(`File Apps Script: ${sourceFiles.length}; data pelanggan: tidak disertakan.`);
