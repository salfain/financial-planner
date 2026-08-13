import { AppsScriptUpstreamError, appsScriptConfiguration, callAppsScriptUpstream } from "../app/api/_lib/apps-script-upstream";

export type OwnerAuthState = {
  passwordHash: string;
  revision: string;
  source: "environment" | "apps-script";
};

type OwnerAuthEnvelope = {
  ok?: boolean;
  data?: { configured?: boolean; passwordHash?: unknown; revision?: unknown; updatedAt?: unknown; sessionsRevoked?: unknown };
  error?: { code?: string; message?: string };
};

const CACHE_MS = 15_000;
let cached: { state: OwnerAuthState; expiresAt: number } | null = null;

const environmentState = (): OwnerAuthState => ({
  passwordHash: String(process.env.FINANCE_OWNER_PASSWORD_SHA256 || "").trim().toLowerCase(),
  revision: "environment",
  source: "environment",
});

function parseStoredState(envelope: OwnerAuthEnvelope) {
  if (!envelope.ok) throw new AppsScriptUpstreamError(502, String(envelope.error?.code || "OWNER_AUTH_STORE_ERROR"), String(envelope.error?.message || "Penyimpanan keamanan pemilik tidak tersedia."));
  const passwordHash = String(envelope.data?.passwordHash || "").trim().toLowerCase();
  const revision = String(envelope.data?.revision || "").trim();
  if (!envelope.data?.configured || !/^[0-9a-f]{64}$/.test(passwordHash) || !revision) return null;
  return { passwordHash, revision, source: "apps-script" as const };
}

export function clearOwnerAuthStateCache() {
  cached = null;
}

export async function getOwnerAuthState(options: { refresh?: boolean } = {}): Promise<OwnerAuthState> {
  if (!options.refresh && cached && cached.expiresAt > Date.now()) return cached.state;

  try {
    appsScriptConfiguration();
  } catch (error) {
    if (error instanceof AppsScriptUpstreamError && error.code === "APPS_SCRIPT_NOT_CONFIGURED") return environmentState();
    throw error;
  }

  try {
    const result = await callAppsScriptUpstream("ownerAuthState", crypto.randomUUID(), {});
    const stored = parseStoredState(result.envelope as OwnerAuthEnvelope);
    const state = stored ?? environmentState();
    cached = { state, expiresAt: Date.now() + CACHE_MS };
    return state;
  } catch (error) {
    if (cached) return cached.state;
    throw error;
  }
}

export async function rotateStoredOwnerPassword(passwordHash: string) {
  const result = await callAppsScriptUpstream("rotateOwnerPassword", crypto.randomUUID(), { passwordHash });
  const envelope = result.envelope as OwnerAuthEnvelope;
  if (!envelope.ok) throw new AppsScriptUpstreamError(502, String(envelope.error?.code || "OWNER_PIN_ROTATION_FAILED"), String(envelope.error?.message || "PIN pemilik belum dapat diganti."));
  const revision = String(envelope.data?.revision || "").trim();
  if (!revision) {
    clearOwnerAuthStateCache();
    const confirmed = await getOwnerAuthState({ refresh: true });
    if (confirmed.source !== "apps-script" || confirmed.passwordHash !== passwordHash.toLowerCase()) {
      throw new AppsScriptUpstreamError(502, "OWNER_AUTH_REVISION_MISSING", "Perubahan kunci belum dapat dikonfirmasi.");
    }
    return { state: confirmed, updatedAt: "", sessionsRevoked: true };
  }
  const state: OwnerAuthState = { passwordHash: passwordHash.toLowerCase(), revision, source: "apps-script" };
  cached = { state, expiresAt: Date.now() + CACHE_MS };
  return { state, updatedAt: String(envelope.data?.updatedAt || ""), sessionsRevoked: envelope.data?.sessionsRevoked === true };
}
