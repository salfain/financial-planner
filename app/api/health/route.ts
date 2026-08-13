import { applySecurityHeaders } from "../../../lib/security";
import { AppsScriptUpstreamError, callAppsScriptUpstream } from "../_lib/apps-script-upstream";

type HealthSnapshot = { body: Record<string, unknown>; status: number; expiresAt: number };
let cached: HealthSnapshot | null = null;

function healthResponse(request: Request, body: Record<string, unknown>, status: number) {
  return applySecurityHeaders(request, Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  }));
}

export async function GET(request: Request) {
  const now = Date.now();
  const checkedAt = new Date().toISOString();
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  if (!deep) {
    return healthResponse(request, {
      status: "ok",
      service: "financial-planner",
      storage: "google-sheets",
      check: "liveness",
      checkedAt,
    }, 200);
  }
  if (cached && cached.expiresAt > now) return healthResponse(request, cached.body, cached.status);
  try {
    const requestId = crypto.randomUUID();
    const result = await callAppsScriptUpstream("health", requestId, {});
    if (result.envelope.ok !== true) throw new AppsScriptUpstreamError(503, "APPS_SCRIPT_UNHEALTHY", "Penyimpanan utama melaporkan gangguan.", result.attempts);
    const body = {
      status: "ok",
      service: "financial-planner",
      storage: "google-sheets",
      checkedAt,
      latencyMs: result.durationMs,
      attempts: result.attempts,
    };
    cached = { body, status: 200, expiresAt: now + 5 * 60_000 };
    return healthResponse(request, body, 200);
  } catch (error) {
    const code = error instanceof AppsScriptUpstreamError ? error.code : "HEALTH_CHECK_FAILED";
    const body = {
      status: "degraded",
      service: "financial-planner",
      storage: "google-sheets",
      checkedAt,
      code,
    };
    cached = { body, status: 503, expiresAt: now + 8_000 };
    return healthResponse(request, body, 503);
  }
}
