import { applySecurityHeaders } from "../../../../lib/security";
import {
  createOwnerSession,
  hashOwnerPassword,
  isOwnerRequest,
  ownerSessionCookie,
  verifyOwnerPassword,
} from "../../../../lib/owner-auth";
import { rotateStoredOwnerPassword } from "../../../../lib/owner-auth-store";
import { AppsScriptUpstreamError } from "../../_lib/apps-script-upstream";

const MAX_BODY_BYTES = 4096;
const PIN_PATTERN = /^\d{6}$/;
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const clientKey = (request: Request) => (request.headers.get("x-forwarded-for") || request.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim();
const response = (request: Request, body: unknown, status = 200, headers?: HeadersInit) => applySecurityHeaders(request, Response.json(body, { status, headers }));

export async function POST(request: Request) {
  if (!await isOwnerRequest(request)) return response(request, { ok: false, error: { code: "AUTH_REQUIRED", message: "Sesi pemilik diperlukan." } }, 401);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return response(request, { ok: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Permintaan terlalu besar." } }, 413);

  const key = clientKey(request);
  const now = Date.now();
  const currentAttempt = attempts.get(key);
  if (currentAttempt && currentAttempt.resetAt > now && currentAttempt.count >= MAX_ATTEMPTS) {
    return response(request, { ok: false, error: { code: "TOO_MANY_ATTEMPTS", message: "Terlalu banyak percobaan. Tunggu 15 menit lalu coba lagi." } }, 429, { "Retry-After": "900" });
  }
  if (!currentAttempt || currentAttempt.resetAt <= now) attempts.set(key, { count: 0, resetAt: now + WINDOW_MS });

  let body: { currentPin?: unknown; newPin?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return response(request, { ok: false, error: { code: "INVALID_JSON", message: "Permintaan tidak valid." } }, 400); }

  const currentPin = typeof body.currentPin === "string" ? body.currentPin : "";
  const newPin = typeof body.newPin === "string" ? body.newPin : "";
  if (!PIN_PATTERN.test(newPin)) {
    return response(request, { ok: false, error: { code: "PIN_INVALID", message: "PIN baru harus terdiri dari tepat 6 angka." } }, 400);
  }
  if (newPin === currentPin) return response(request, { ok: false, error: { code: "PIN_UNCHANGED", message: "PIN baru harus berbeda dari PIN saat ini." } }, 400);

  try {
    if (!await verifyOwnerPassword(currentPin)) {
      const record = attempts.get(key) ?? { count: 0, resetAt: now + WINDOW_MS };
      attempts.set(key, { ...record, count: record.count + 1 });
      return response(request, { ok: false, error: { code: "AUTH_INVALID", message: "PIN saat ini tidak cocok." } }, 401);
    }
    const passwordHash = await hashOwnerPassword(newPin);
    await rotateStoredOwnerPassword(passwordHash);
    attempts.delete(key);
    const session = await createOwnerSession();
    return response(request, {
      ok: true,
      message: "PIN akses berhasil diganti. Sesi perangkat lain telah dicabut.",
      expiresAt: new Date(session.expiresAt * 1000).toISOString(),
    }, 200, { "Set-Cookie": ownerSessionCookie(session.token, session.maxAge) });
  } catch (error) {
    if (error instanceof AppsScriptUpstreamError) {
      return response(request, { ok: false, error: { code: error.code, message: error.message } }, error.status >= 400 && error.status < 600 ? error.status : 503);
    }
    return response(request, { ok: false, error: { code: "OWNER_AUTH_UNAVAILABLE", message: "PIN belum dapat diganti. Coba lagi beberapa saat." } }, 503);
  }
}
