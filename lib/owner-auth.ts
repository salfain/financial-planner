import { authenticatedViewerFromHeaders } from "./security";

export const OWNER_SESSION_COOKIE = "finance_owner_session";
const SESSION_VERSION = "v1";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

const env = (name: string) => String(process.env[name] || "").trim();

const toHex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes))
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");

const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
};

async function hmac(value: string) {
  const secret = env("FINANCE_SESSION_SECRET");
  if (secret.length < 32) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export function ownerPasswordConfigured() {
  return /^[0-9a-f]{64}$/i.test(env("FINANCE_OWNER_PASSWORD_SHA256")) && env("FINANCE_SESSION_SECRET").length >= 32;
}

export async function verifyOwnerPassword(password: string) {
  const expected = env("FINANCE_OWNER_PASSWORD_SHA256").toLowerCase();
  if (!ownerPasswordConfigured() || !password || password.length > 256) return false;
  const actual = toHex(await crypto.subtle.digest("SHA-256", encoder.encode(password))).toLowerCase();
  return constantTimeEqual(actual, expected);
}

export async function createOwnerSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload = `${SESSION_VERSION}.${expiresAt}`;
  const signature = await hmac(payload);
  if (!signature) throw new Error("OWNER_AUTH_NOT_CONFIGURED");
  return { token: `${payload}.${signature}`, expiresAt, maxAge: SESSION_DURATION_SECONDS };
}

export async function verifyOwnerSession(token: string | null | undefined) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== SESSION_VERSION || !/^\d{10}$/.test(parts[1])) return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  const expected = await hmac(`${parts[0]}.${parts[1]}`);
  return Boolean(expected) && constantTimeEqual(parts[2].toLowerCase(), expected.toLowerCase());
}

export function cookieValue(request: Pick<Request, "headers">, name = OWNER_SESSION_COOKIE) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function isOwnerRequest(request: Pick<Request, "headers">) {
  const viewer = authenticatedViewerFromHeaders(request.headers);
  if (viewer) {
    const allowedEmail = env("FINANCE_OWNER_EMAIL").toLowerCase();
    return !allowedEmail || viewer.email === allowedEmail;
  }
  return verifyOwnerSession(cookieValue(request));
}

export function ownerSessionCookie(token: string, maxAge = SESSION_DURATION_SECONDS) {
  return `${OWNER_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearOwnerSessionCookie() {
  return `${OWNER_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function ownerProfile() {
  const email = env("FINANCE_OWNER_EMAIL") || null;
  return {
    displayName: env("FINANCE_OWNER_DISPLAY_NAME") || email || "Pemilik Financial Planner",
    email,
  };
}
