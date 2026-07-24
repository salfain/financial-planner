import { createPrivateKey, randomUUID, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? null : args[index + 1];
};
const tier = option("tier");
const installationId = option("installation");
const privateKeyPath = option("private-key") || join(homedir(), ".financial-planner-license", "private.pem");
const expiresAt = option("expires");
if (tier !== "pro" && tier !== "premium") throw new Error("--tier wajib pro atau premium.");
if (!installationId || !/^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/.test(installationId)) throw new Error("--installation tidak valid.");
if (expiresAt && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(expiresAt) || !Number.isFinite(Date.parse(expiresAt)))) {
  throw new Error("--expires wajib timestamp ISO UTC, contoh 2027-07-20T00:00:00Z.");
}
const claims = {
  product: "financial-planner",
  version: 1,
  licenseId: `lic-${randomUUID()}`,
  tier,
  installationId,
  issuedAt: new Date().toISOString(),
  ...(expiresAt ? { expiresAt } : {}),
};
const base64url = (value) => Buffer.from(value).toString("base64url");
const signingInput = `FP1.${base64url(JSON.stringify(claims))}`;
const privateKey = createPrivateKey(await readFile(privateKeyPath, "utf8"));
const signature = sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
console.log(`${signingInput}.${signature}`);
