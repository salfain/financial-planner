import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "apps-script");
const packageDir = join(root, "outputs", "financial-planner-mobile-api");
const appDir = join(packageDir, "apps-script");

await rm(packageDir, { recursive: true, force: true });
await mkdir(appDir, { recursive: true });

const sourceFiles = (await readdir(sourceDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && extname(entry.name) === ".gs" && entry.name !== "Main.gs")
  .map((entry) => entry.name)
  .sort();

if (!sourceFiles.includes("MobileApi.gs") || !sourceFiles.includes("Router.gs")) {
  throw new Error("Source endpoint mobile atau router Apps Script belum lengkap.");
}

for (const filename of sourceFiles) {
  await cp(join(sourceDir, filename), join(appDir, filename));
}

const sourceManifest = JSON.parse(await readFile(join(sourceDir, "appsscript.json"), "utf8"));
const mobileManifest = {
  ...sourceManifest,
  webapp: { executeAs: "USER_DEPLOYING", access: "ANYONE_ANONYMOUS" },
};
await writeFile(join(appDir, "appsscript.json"), `${JSON.stringify(mobileManifest, null, 2)}\n`, "utf8");

await cp(
  join(root, "docs", "PANDUAN-MOBILE-API.md"),
  join(packageDir, "MULAI-DI-SINI.md"),
);
await writeFile(
  join(packageDir, ".clasp.json.example"),
  `${JSON.stringify({ scriptId: "GANTI_DENGAN_SCRIPT_ID_YANG_SAMA_DENGAN_WEB", rootDir: "apps-script" }, null, 2)}\n`,
  "utf8",
);

const packagedFiles = [];
async function collectFiles(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(absolute);
    else packagedFiles.push(absolute);
  }
}
await collectFiles(packageDir);

const checksums = {};
for (const absolute of packagedFiles) {
  const key = relative(packageDir, absolute).replaceAll("\\", "/");
  checksums[key] = createHash("sha256").update(await readFile(absolute)).digest("hex");
}
await writeFile(
  join(packageDir, "PACKAGE-MANIFEST.json"),
  `${JSON.stringify({
    product: "Financial Planner Mobile API",
    edition: "single-owner",
    entrypoint: "doPost",
    containsDoGet: false,
    deploymentAccess: "ANYONE_ANONYMOUS",
    sharedAppsScriptProject: true,
    generatedAt: new Date().toISOString(),
    files: checksums,
  }, null, 2)}\n`,
  "utf8",
);

console.log(`Paket API mobile siap: ${packageDir}`);
console.log(`Source bisnis bersama: ${sourceFiles.length} file; doGet/HTML publik: tidak disertakan.`);
