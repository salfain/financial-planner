type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
  requestId?: string;
};

type GoogleScriptRunner = {
  withSuccessHandler: (handler: (value: unknown) => void) => GoogleScriptRunner;
  withFailureHandler: (handler: (error: Error) => void) => GoogleScriptRunner;
  api: (action: string, payload: unknown) => void;
};

const MEMBER_SESSION_TOKEN_KEY = "financial-planner:member-session-token";
const MEMBER_SESSION_ID_KEY = "financial-planner:member-session-id";

export class AppsScriptApiError extends Error {
  code: string;
  details: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppsScriptApiError";
    this.code = code;
    this.details = details;
  }
}

function localStorageValue(key: string) {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem(key) || ""; }
  catch { return ""; }
}

export const getAppsScriptSessionToken = () => localStorageValue(MEMBER_SESSION_TOKEN_KEY);
export const getAppsScriptSessionScope = () => localStorageValue(MEMBER_SESSION_ID_KEY) || "anonymous";

export function saveAppsScriptMemberSession(sessionToken: string, memberId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MEMBER_SESSION_TOKEN_KEY, sessionToken);
  window.localStorage.setItem(MEMBER_SESSION_ID_KEY, memberId);
}

export function clearAppsScriptMemberSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MEMBER_SESSION_TOKEN_KEY);
    window.localStorage.removeItem(MEMBER_SESSION_ID_KEY);
  } catch {
    // Penyimpanan browser dapat dinonaktifkan; sesi server tetap akan kedaluwarsa.
  }
}

declare global {
  interface Window {
    google?: { script?: { run?: GoogleScriptRunner } };
  }
}

export const hasAppsScriptBridge = () =>
  typeof window !== "undefined" && Boolean(window.google?.script?.run);

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
        else reject(new AppsScriptApiError(
          response.error?.code ?? "REQUEST_FAILED",
          response.error?.message ?? "Permintaan gagal.",
          (response.error as { details?: unknown } | undefined)?.details,
        ));
      })
      .withFailureHandler((error) => reject(error))
      .api(action, {
        ...payload,
        sessionToken: (payload.sessionToken ?? getAppsScriptSessionToken()) || undefined,
        requestId: payload.requestId ?? crypto.randomUUID(),
      });
  });
}
