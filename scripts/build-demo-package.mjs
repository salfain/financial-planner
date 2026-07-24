import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(root, "outputs");
const packageDir = join(outputRoot, "financial-planner-demo");
const appDir = join(packageDir, "apps-script");
const archivePath = join(outputRoot, "Financial-Planner-Demo.zip");
const files = [
  ["apps-script-demo/Main.gs", "Main.gs"],
  ["apps-script-demo/Index.html", "Index.html"],
  ["apps-script-demo/appsscript.json", "appsscript.json"],
  ["apps-script/Frontend.html", "Frontend.html"],
  ["apps-script/Styles.html", "Styles.html"],
  ["docs/PANDUAN-DEMO.md", "MULAI-DI-SINI.md"],
];

await rm(packageDir, { recursive: true, force: true });
await mkdir(appDir, { recursive: true });

for (const [source, target] of files) {
  const destination = target === "MULAI-DI-SINI.md" ? join(packageDir, target) : join(appDir, target);
  await cp(join(root, source), destination);
}

const checksums = {};
for (const [, target] of files) {
  const absolute = target === "MULAI-DI-SINI.md" ? join(packageDir, target) : join(appDir, target);
  checksums[relative(packageDir, absolute).replaceAll("\\", "/")] = createHash("sha256")
    .update(await readFile(absolute))
    .digest("hex");
}

await writeFile(join(packageDir, "PACKAGE-MANIFEST.json"), `${JSON.stringify({
  product: "Financial Planner Demo",
  edition: "public-read-only",
  storage: "static browser fixture",
  containsCustomerData: false,
  deploymentAccess: "ANYONE_ANONYMOUS",
  generatedAt: new Date().toISOString(),
  files: checksums,
}, null, 2)}\n`);

await rm(archivePath, { force: true });
if (process.platform === "win32") {
  const quote = (value) => `'${value.replaceAll("'", "''")}'`;
  const archived = spawnSync("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path ${quote(join(packageDir, "*"))} -DestinationPath ${quote(archivePath)} -Force`], { encoding: "utf8" });
  if (archived.status !== 0) throw new Error(archived.stderr || "Paket ZIP demo tidak dapat dibuat.");
}

console.log(`Paket demo siap: ${packageDir}`);
if (process.platform === "win32") console.log(`Arsip demo siap: ${archivePath}`);
