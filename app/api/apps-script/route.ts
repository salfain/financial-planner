import { isOwnerRequest } from "../../../lib/owner-auth";
import { applySecurityHeaders } from "../../../lib/security";
import { AppsScriptUpstreamError, callAppsScriptUpstream } from "../_lib/apps-script-upstream";

type ProxyRequest = { action?: unknown; requestId?: unknown; payload?: unknown };

const MAX_REQUEST_BYTES = 14 * 1024 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 180;
const requests = new Map<string, { count: number; resetAt: number }>();

function json(request: Request, body: unknown, status = 200, headers?: HeadersInit) {
  return applySecurityHeaders(request, Response.json(body, { status, headers }));
}

function clientKey(request: Request) {
  return (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
}

function consumeRateLimit(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  const current = requests.get(key);
  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= RATE_LIMIT;
}

export async function POST(request: Request) {
  if (!await isOwnerRequest(request)) return json(request, { ok: false, error: { code: "AUTH_REQUIRED", message: "Sesi pemilik diperlukan." } }, 401);
  if (!consumeRateLimit(request)) return json(request, { ok: false, error: { code: "RATE_LIMITED", message: "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi." } }, 429, { "Retry-After": "60" });

  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > MAX_REQUEST_BYTES) return json(request, { ok: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Ukuran permintaan melebihi batas 14 MB." } }, 413);

  let raw = "";
  let body: ProxyRequest;
  try {
    raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_REQUEST_BYTES) return json(request, { ok: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Ukuran permintaan melebihi batas 14 MB." } }, 413);
    body = JSON.parse(raw) as ProxyRequest;
  } catch {
    return json(request, { ok: false, error: { code: "INVALID_JSON", message: "Body request harus berupa JSON yang valid." } }, 400);
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload as Record<string, unknown> : {};
  if (!/^[A-Za-z][A-Za-z0-9]{1,79}$/.test(action) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return json(request, { ok: false, error: { code: "INVALID_REQUEST", message: "Action atau requestId tidak valid." } }, 400);
  }

  try {
    const result = await callAppsScriptUpstream(action, requestId, payload);
    return json(request, result.envelope, 200, {
      "X-Apps-Script-Attempts": String(result.attempts),
      "X-Apps-Script-Duration-Ms": String(result.durationMs),
    });
  } catch (error) {
    if (error instanceof AppsScriptUpstreamError) {
      return json(request, { ok: false, error: { code: error.code, message: error.message } }, error.status, { "X-Apps-Script-Attempts": String(error.attempts) });
    }
    return json(request, { ok: false, error: { code: "APPS_SCRIPT_UNREACHABLE", message: "Server belum dapat menghubungi Google Apps Script." } }, 502);
  }
}
