export type AppsScriptEnvelope = Record<string, unknown> & {
  ok?: boolean;
  error?: { code?: string; message?: string };
};

export class AppsScriptUpstreamError extends Error {
  constructor(public status: number, public code: string, message: string, public attempts = 0) {
    super(message);
    this.name = "AppsScriptUpstreamError";
  }
}

const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 10_000;

const wait = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));

export function appsScriptConfiguration() {
  const endpoint = String(process.env.APPS_SCRIPT_API_URL || "").trim();
  const accessKey = String(process.env.APPS_SCRIPT_ACCESS_KEY || "").trim();
  if (!endpoint || !accessKey) throw new AppsScriptUpstreamError(503, "APPS_SCRIPT_NOT_CONFIGURED", "Backend Apps Script belum dikonfigurasi.");
  let target: URL;
  try { target = new URL(endpoint); }
  catch { throw new AppsScriptUpstreamError(500, "APPS_SCRIPT_URL_INVALID", "URL API Apps Script tidak valid."); }
  if (target.protocol !== "https:") throw new AppsScriptUpstreamError(500, "APPS_SCRIPT_URL_INVALID", "URL API Apps Script wajib menggunakan HTTPS.");
  return { target, accessKey };
}

export async function callAppsScriptUpstream(action: string, requestId: string, payload: Record<string, unknown>) {
  const { target, accessKey } = appsScriptConfiguration();
  const startedAt = Date.now();
  let lastCode = "APPS_SCRIPT_UNREACHABLE";
  let lastMessage = "Server belum dapat menghubungi Google Apps Script.";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const upstream = await fetch(target, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ action, requestId, accessKey, payload }),
        redirect: "follow",
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
      const text = await upstream.text();
      let parsed: AppsScriptEnvelope | null = null;
      try {
        const candidate = JSON.parse(text) as unknown;
        if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) parsed = candidate as AppsScriptEnvelope;
      } catch { parsed = null; }

      if (parsed) {
        if (!upstream.ok && attempt < MAX_ATTEMPTS && (upstream.status === 429 || upstream.status >= 500)) {
          lastCode = "APPS_SCRIPT_UPSTREAM_ERROR";
          lastMessage = "Google Apps Script sedang sibuk.";
        } else {
          return { envelope: parsed, attempts: attempt, durationMs: Date.now() - startedAt };
        }
      } else {
        lastCode = "APPS_SCRIPT_INVALID_RESPONSE";
        lastMessage = "Google Apps Script mengembalikan respons yang belum siap.";
      }
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      lastCode = timedOut ? "APPS_SCRIPT_TIMEOUT" : "APPS_SCRIPT_UNREACHABLE";
      lastMessage = timedOut ? "Google Apps Script membutuhkan waktu terlalu lama." : "Server belum dapat menghubungi Google Apps Script.";
    }

    if (attempt < MAX_ATTEMPTS) await wait(attempt === 1 ? 350 : 900);
  }

  const status = lastCode === "APPS_SCRIPT_TIMEOUT" ? 504 : 502;
  throw new AppsScriptUpstreamError(status, lastCode, `${lastMessage} Coba lagi beberapa saat.`, MAX_ATTEMPTS);
}
