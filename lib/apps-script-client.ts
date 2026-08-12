type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
  requestId?: string;
};

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function publicBackendMode() {
  if (typeof window === "undefined") return "";
  // Vite replaces this exact expression at build time. Keeping a runtime
  // `typeof process` guard prevents the inlined value from being used in the
  // browser, where Node's `process` global does not exist.
  return String(process.env.NEXT_PUBLIC_FINANCE_BACKEND || "").trim().toLowerCase();
}

type GoogleScriptRunner = {
  withSuccessHandler: (handler: (value: unknown) => void) => GoogleScriptRunner;
  withFailureHandler: (handler: (error: Error) => void) => GoogleScriptRunner;
  api: (action: string, payload: unknown) => void;
};

declare global {
  interface Window {
    google?: { script?: { run?: GoogleScriptRunner } };
  }
}

export const hasAppsScriptBridge = () =>
  typeof window !== "undefined" && Boolean(window.google?.script?.run);

/**
 * VPS mode uses a same-origin server route as a proxy. The access key never
 * reaches the browser bundle; it is attached by app/api/apps-script/route.ts.
 */
export const hasAppsScriptHttp = () =>
  typeof window !== "undefined" && publicBackendMode() === "apps-script";

export function callAppsScript<T>(action: string, payload: Record<string, unknown> = {}) {
  return new Promise<T>((resolve, reject) => {
    const runner = window.google?.script?.run;
    if (!runner) {
      reject(new Error("Google Apps Script bridge belum tersedia."));
      return;
    }
    runner
      .withSuccessHandler((raw) => {
        const response = raw as ApiResponse<T>;
        if (response.ok && response.data !== undefined) resolve(response.data);
        else reject(new Error(response.error?.message ?? "Permintaan gagal."));
      })
      .withFailureHandler((error) => reject(error))
      .api(action, { ...payload, requestId: payload.requestId ?? crypto.randomUUID() });
  });
}

export async function callAppsScriptHttp<T>(action: string, payload: Record<string, unknown> = {}) {
  const requestId = typeof payload.__mobileRequestId === "string" && UUID_V4_PATTERN.test(payload.__mobileRequestId)
    ? payload.__mobileRequestId
    : UUID_V4_PATTERN.test(String(payload.requestId || ""))
    ? String(payload.requestId)
    : crypto.randomUUID();

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("/api/apps-script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, requestId, payload }),
      });
      let raw: unknown;
      try { raw = await response.json(); }
      catch { throw new Error(`Proxy Apps Script mengembalikan respons yang tidak valid (${response.status}).`); }
      const envelope = raw as ApiResponse<T>;
      if (response.ok && envelope.ok && envelope.data !== undefined) return envelope.data;
      const retryable = response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504;
      const reason = new Error(envelope.error?.message ?? `Permintaan Apps Script gagal (${response.status}).`);
      if (!retryable || attempt === 3) throw reason;
      lastError = reason;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Koneksi Apps Script terputus.");
      if (attempt === 3) throw lastError;
    }
    await new Promise((resolve) => window.setTimeout(resolve, attempt === 1 ? 450 : 1_100));
  }
  throw lastError ?? new Error("Permintaan Apps Script gagal.");
}
