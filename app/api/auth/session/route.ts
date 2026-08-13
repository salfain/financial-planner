import { applySecurityHeaders, authenticatedViewerFromHeaders } from "../../../../lib/security";
import {
  createOwnerSession,
  isOwnerRequest,
  ownerPasswordConfigured,
  ownerProfile,
  ownerSessionCookie,
  verifyOwnerPassword,
} from "../../../../lib/owner-auth";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const clientKey = (request: Request) => (request.headers.get("x-forwarded-for") || request.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim();

function response(request: Request, body: unknown, status = 200, headers?: HeadersInit) {
  return applySecurityHeaders(request, Response.json(body, { status, headers }));
}

function blocked(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return current.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const current = attempts.get(key) ?? { count: 0, resetAt: Date.now() + WINDOW_MS };
  attempts.set(key, { ...current, count: current.count + 1 });
}

export async function GET(request: Request) {
  const viewer = authenticatedViewerFromHeaders(request.headers);
  const authenticated = await isOwnerRequest(request);
  if (!authenticated) return response(request, { authenticated: false }, 401);
  const profile = viewer ? { displayName: viewer.displayName, email: viewer.email } : ownerProfile();
  return response(request, {
    authenticated: true,
    ...profile,
    provider: viewer ? "ChatGPT private access" : "PIN pemilik",
    accessMode: "owner_only",
    workspaceIsolation: "server_enforced",
    sessionState: "verified",
    signOutUrl: "/api/auth/logout",
  });
}

export async function POST(request: Request) {
  if (!ownerPasswordConfigured()) return response(request, { ok: false, error: { code: "OWNER_AUTH_NOT_CONFIGURED", message: "Perlindungan pemilik belum dikonfigurasi." } }, 503);
  const key = clientKey(request);
  if (blocked(key)) return response(request, { ok: false, error: { code: "TOO_MANY_ATTEMPTS", message: "Terlalu banyak percobaan. Tunggu 15 menit lalu coba lagi." } }, 429, { "Retry-After": "900" });

  let pin = "";
  try {
    const body = await request.json() as { pin?: unknown };
    pin = typeof body.pin === "string" ? body.pin : "";
  } catch {
    return response(request, { ok: false, error: { code: "INVALID_JSON", message: "Permintaan tidak valid." } }, 400);
  }
  let valid = false;
  try {
    valid = await verifyOwnerPassword(pin);
  } catch {
    return response(request, { ok: false, error: { code: "OWNER_AUTH_UNAVAILABLE", message: "Pemeriksaan kunci sedang tidak tersedia. Coba lagi beberapa saat." } }, 503);
  }
  if (!valid) {
    recordFailure(key);
    return response(request, { ok: false, error: { code: "AUTH_INVALID", message: "PIN tidak cocok." } }, 401);
  }
  attempts.delete(key);
  let session;
  try {
    session = await createOwnerSession();
  } catch {
    return response(request, { ok: false, error: { code: "OWNER_AUTH_UNAVAILABLE", message: "Sesi aman belum dapat dibuat. Coba lagi beberapa saat." } }, 503);
  }
  return response(request, { ok: true, expiresAt: new Date(session.expiresAt * 1000).toISOString() }, 200, { "Set-Cookie": ownerSessionCookie(session.token, session.maxAge) });
}
