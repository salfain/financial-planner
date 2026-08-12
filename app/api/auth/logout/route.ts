import { clearOwnerSessionCookie } from "../../../../lib/owner-auth";
import { applySecurityHeaders } from "../../../../lib/security";

export function GET(request: Request) {
  const response = Response.redirect(new URL("/", request.url), 303);
  response.headers.set("Set-Cookie", clearOwnerSessionCookie());
  return applySecurityHeaders(request, response);
}
