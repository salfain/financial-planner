import { LICENSE_PUBLIC_KEY } from "./license-public-key";
import { PLAN_LABELS, capabilityMap, freeEntitlement, isPlanTier, type PlanEntitlement, type PlanTier } from "./plans";

export const LICENSE_PRODUCT = "financial-planner";
export const LICENSE_TOKEN_VERSION = 1;

export type LicenseClaims = {
  product: typeof LICENSE_PRODUCT;
  version: typeof LICENSE_TOKEN_VERSION;
  licenseId: string;
  tier: Exclude<PlanTier, "free">;
  installationId: string;
  issuedAt: string;
  expiresAt?: string;
};

export class LicenseValidationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "LicenseValidationError";
  }
}

const textEncoder = new TextEncoder();

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new LicenseValidationError("LICENSE_MALFORMED", "Kode lisensi tidak valid.");
  }
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new LicenseValidationError("LICENSE_MALFORMED", "Kode lisensi tidak valid.");
  }
}

function decodePayload(value: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
  } catch (error) {
    if (error instanceof LicenseValidationError) throw error;
    throw new LicenseValidationError("LICENSE_MALFORMED", "Payload lisensi tidak valid.");
  }
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function parseClaims(value: unknown): LicenseClaims {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LicenseValidationError("LICENSE_MALFORMED", "Payload lisensi tidak valid.");
  }
  const claims = value as Record<string, unknown>;
  if (claims.product !== LICENSE_PRODUCT || claims.version !== LICENSE_TOKEN_VERSION) {
    throw new LicenseValidationError("LICENSE_PRODUCT_MISMATCH", "Kode lisensi bukan untuk produk ini.");
  }
  if (!isPlanTier(claims.tier) || claims.tier === "free") {
    throw new LicenseValidationError("LICENSE_TIER_INVALID", "Paket lisensi tidak valid.");
  }
  if (typeof claims.licenseId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{5,79}$/.test(claims.licenseId)) {
    throw new LicenseValidationError("LICENSE_MALFORMED", "ID lisensi tidak valid.");
  }
  if (typeof claims.installationId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/.test(claims.installationId)) {
    throw new LicenseValidationError("LICENSE_MALFORMED", "ID instalasi lisensi tidak valid.");
  }
  if (!validIso(claims.issuedAt) || (claims.expiresAt !== undefined && !validIso(claims.expiresAt))) {
    throw new LicenseValidationError("LICENSE_DATE_INVALID", "Tanggal lisensi tidak valid.");
  }
  return claims as LicenseClaims;
}

export async function verifyLicenseToken(
  token: string,
  installationId: string,
  now = new Date(),
  publicKey: JsonWebKey = LICENSE_PUBLIC_KEY as unknown as JsonWebKey,
): Promise<LicenseClaims> {
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "FP1") {
    throw new LicenseValidationError("LICENSE_MALFORMED", "Format kode lisensi tidak valid.");
  }
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "jwk",
      publicKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    throw new LicenseValidationError("LICENSE_KEY_UNAVAILABLE", "Public key lisensi belum dikonfigurasi.");
  }
  const signature = new Uint8Array(decodeBase64Url(parts[2])).buffer;
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    textEncoder.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new LicenseValidationError("LICENSE_SIGNATURE_INVALID", "Tanda tangan lisensi tidak valid.");
  const claims = parseClaims(decodePayload(parts[1]));
  if (claims.installationId !== installationId) {
    throw new LicenseValidationError("LICENSE_INSTALLATION_MISMATCH", "Kode lisensi dibuat untuk instalasi lain.");
  }
  const nowTime = now.getTime();
  if (Date.parse(claims.issuedAt) > nowTime + 5 * 60_000) {
    throw new LicenseValidationError("LICENSE_NOT_YET_VALID", "Kode lisensi belum berlaku.");
  }
  if (claims.expiresAt && Date.parse(claims.expiresAt) <= nowTime) {
    throw new LicenseValidationError("LICENSE_EXPIRED", "Kode lisensi sudah kedaluwarsa.");
  }
  return claims;
}

export async function entitlementFromToken(
  token: string | null,
  installationId: string,
  now = new Date(),
  publicKey: JsonWebKey = LICENSE_PUBLIC_KEY as unknown as JsonWebKey,
): Promise<PlanEntitlement> {
  if (!token) return freeEntitlement(installationId);
  try {
    const claims = await verifyLicenseToken(token, installationId, now, publicKey);
    return {
      tier: claims.tier,
      label: PLAN_LABELS[claims.tier],
      status: "active",
      capabilities: capabilityMap(claims.tier),
      installationId,
      licenseId: claims.licenseId,
      expiresAt: claims.expiresAt ?? null,
    };
  } catch (error) {
    return freeEntitlement(
      installationId,
      error instanceof LicenseValidationError && error.code === "LICENSE_EXPIRED" ? "expired" : "invalid",
    );
  }
}
