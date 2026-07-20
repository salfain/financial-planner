export type AuthenticatedViewer = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";

export function authenticatedViewerFromHeaders(headers: Pick<Headers, "get">): AuthenticatedViewer | null {
  const email = headers.get(USER_EMAIL_HEADER)?.trim().toLowerCase();
  if (!email) return null;

  const encodedFullName = headers.get(USER_FULL_NAME_HEADER);
  const fullName = encodedFullName &&
    headers.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
    ? safeDecodeURIComponent(encodedFullName)
    : null;

  return {
    displayName: fullName || email,
    email,
    fullName,
  };
}

export function applySecurityHeaders(request: Request, response: Response): Response {
  const secured = new Response(response.body, response);
  const url = new URL(request.url);

  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("X-Frame-Options", "DENY");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  secured.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  secured.headers.set("Content-Security-Policy", "base-uri 'self'; frame-ancestors 'none'; object-src 'none'");

  if (url.protocol === "https:") {
    secured.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  if (url.pathname.startsWith("/api/")) {
    secured.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  return secured;
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return null;
  }
}
