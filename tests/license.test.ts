import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { entitlementFromToken, LicenseValidationError, verifyLicenseToken } from "../lib/license";
import { capabilityMap, freeEntitlement, planIncludes } from "../lib/plans";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
const installationId = "inst-test-123456";

const issue = (overrides: Record<string, unknown> = {}) => {
  const claims = {
    product: "financial-planner",
    version: 1,
    licenseId: "lic-test-123456",
    tier: "pro",
    installationId,
    issuedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const input = `FP1.${payload}`;
  const signature = sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url");
  return `${input}.${signature}`;
};

test("aturan paket membedakan Free, Pro, dan Premium", () => {
  assert.equal(planIncludes("free", "planning"), false);
  assert.equal(planIncludes("pro", "planning"), true);
  assert.equal(planIncludes("pro", "investments"), false);
  assert.equal(planIncludes("premium", "investments"), true);
  assert.equal(capabilityMap("premium").ocr, true);
  assert.equal(freeEntitlement(installationId).tier, "free");
});

test("lisensi sah hanya berlaku untuk instalasi dan paket yang ditandatangani", async () => {
  const token = issue();
  const claims = await verifyLicenseToken(token, installationId, new Date("2026-07-21T00:00:00.000Z"), publicJwk);
  assert.equal(claims.tier, "pro");
  const entitlement = await entitlementFromToken(token, installationId, new Date("2026-07-21T00:00:00.000Z"), publicJwk);
  assert.equal(entitlement.status, "active");
  assert.equal(entitlement.capabilities.planning, true);
  assert.equal(entitlement.capabilities.investments, false);
});

test("lisensi instalasi lain dan token yang diubah ditolak", async () => {
  await assert.rejects(
    verifyLicenseToken(issue(), "inst-other-123456", new Date("2026-07-21T00:00:00.000Z"), publicJwk),
    (error: unknown) => error instanceof LicenseValidationError && error.code === "LICENSE_INSTALLATION_MISMATCH",
  );
  const token = issue();
  const [header, payload, signature] = token.split(".");
  const tamperedSignature = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
  await assert.rejects(
    verifyLicenseToken(`${header}.${payload}.${tamperedSignature}`, installationId, new Date("2026-07-21T00:00:00.000Z"), publicJwk),
    (error: unknown) => error instanceof LicenseValidationError && error.code === "LICENSE_SIGNATURE_INVALID",
  );
});

test("lisensi kedaluwarsa kembali ke Free tanpa membuka fitur berbayar", async () => {
  const entitlement = await entitlementFromToken(
    issue({ expiresAt: "2026-07-20T12:00:00.000Z" }),
    installationId,
    new Date("2026-07-21T00:00:00.000Z"),
    publicJwk,
  );
  assert.equal(entitlement.tier, "free");
  assert.equal(entitlement.status, "expired");
  assert.equal(entitlement.capabilities.planning, false);
});
