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
        else reject(new Error(response.error?.message ?? "Permintaan gagal."));
      })
      .withFailureHandler((error) => reject(error))
      .api(action, { ...payload, requestId: payload.requestId ?? crypto.randomUUID() });
  });
}
