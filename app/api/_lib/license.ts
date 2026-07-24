import { getD1 } from "@/db";
import {
  LicenseValidationError,
  entitlementFromToken,
  verifyLicenseToken,
} from "@/lib/license";
import {
  CAPABILITY_MINIMUM_TIER,
  type PlanCapability,
  type PlanEntitlement,
} from "@/lib/plans";
import { ApiError, nowIso } from "./api";

const tokenLimit = 4096;

type LicenseRow = {
  configured: number;
  installationId: string | null;
  licenseToken: string | null;
};

async function licenseRow(workspaceId: string): Promise<LicenseRow> {
  const d1 = getD1();
  let row = await d1.prepare(
    `SELECT configured, installation_id AS installationId, license_token AS licenseToken
     FROM workspaces WHERE id = ? LIMIT 1`,
  ).bind(workspaceId).first<LicenseRow>();
  if (!row || !row.configured) {
    throw new ApiError(409, "WORKSPACE_NOT_CONFIGURED", "Selesaikan setup Financial Planner terlebih dahulu.");
  }
  if (!row.installationId) {
    const installationId = `inst-${crypto.randomUUID()}`;
    await d1.prepare(
      "UPDATE workspaces SET installation_id = ?, updated_at = ? WHERE id = ? AND installation_id IS NULL",
    ).bind(installationId, nowIso(), workspaceId).run();
    row = await d1.prepare(
      `SELECT configured, installation_id AS installationId, license_token AS licenseToken
       FROM workspaces WHERE id = ? LIMIT 1`,
    ).bind(workspaceId).first<LicenseRow>();
  }
  if (!row?.installationId) throw new ApiError(500, "INSTALLATION_ID_FAILED", "ID instalasi tidak dapat dibuat.");
  return row;
}

export async function getEntitlement(workspaceId: string): Promise<PlanEntitlement> {
  const row = await licenseRow(workspaceId);
  return entitlementFromToken(row.licenseToken, row.installationId!);
}

export async function requireCapability(
  workspaceId: string,
  capability: PlanCapability,
): Promise<PlanEntitlement> {
  const entitlement = await getEntitlement(workspaceId);
  if (!entitlement.capabilities[capability]) {
    throw new ApiError(
      403,
      "FEATURE_NOT_INCLUDED",
      `Fitur ini memerlukan paket ${CAPABILITY_MINIMUM_TIER[capability] === "premium" ? "Premium" : "Pro"}.`,
      { capability, requiredTier: CAPABILITY_MINIMUM_TIER[capability], currentTier: entitlement.tier },
    );
  }
  return entitlement;
}

export async function activateLicense(workspaceId: string, token: string): Promise<PlanEntitlement> {
  const normalized = token.trim();
  if (!normalized || normalized.length > tokenLimit) {
    throw new ApiError(400, "LICENSE_MALFORMED", "Kode lisensi tidak valid.");
  }
  const row = await licenseRow(workspaceId);
  try {
    await verifyLicenseToken(normalized, row.installationId!);
  } catch (error) {
    if (error instanceof LicenseValidationError) {
      throw new ApiError(400, error.code, error.message);
    }
    throw error;
  }
  await getD1().prepare(
    "UPDATE workspaces SET license_token = ?, license_activated_at = ?, updated_at = ? WHERE id = ?",
  ).bind(normalized, nowIso(), nowIso(), workspaceId).run();
  return getEntitlement(workspaceId);
}

export async function deactivateLicense(workspaceId: string): Promise<PlanEntitlement> {
  await licenseRow(workspaceId);
  const timestamp = nowIso();
  await getD1().prepare(
    "UPDATE workspaces SET license_token = NULL, license_activated_at = NULL, updated_at = ? WHERE id = ?",
  ).bind(timestamp, workspaceId).run();
  return getEntitlement(workspaceId);
}
