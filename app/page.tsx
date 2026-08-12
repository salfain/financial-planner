import { FinanceApp } from "./FinanceApp";
import { cookies, headers } from "next/headers";
import { authenticatedViewerFromHeaders } from "../lib/security";
import { ownerPasswordConfigured, OWNER_SESSION_COOKIE, verifyOwnerSession } from "../lib/owner-auth";
import { OwnerLogin } from "./OwnerLogin";
import { PwaRuntime } from "./PwaRuntime";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const viewer = authenticatedViewerFromHeaders(requestHeaders);
  const ownerCookie = (await cookies()).get(OWNER_SESSION_COOKIE)?.value;
  const authenticated = Boolean(viewer) || await verifyOwnerSession(ownerCookie);
  if (!authenticated) return <OwnerLogin configured={ownerPasswordConfigured()} />;
  return <>
    <script
      dangerouslySetInnerHTML={{
        __html: `if (typeof crypto !== "undefined" && typeof crypto.randomUUID !== "function") {
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: function () {
      var bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      var hex = Array.from(bytes, function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
      return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
    }
  });
}
if (new URLSearchParams(location.search).get("demo") === "1") { window.__FINANCE_DEMO__ = true; }`,
      }}
    />
    <FinanceApp />
    <PwaRuntime />
  </>;
}
