import { authenticatedViewerFromHeaders } from "../../../../lib/security";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const viewer = authenticatedViewerFromHeaders(request.headers);
  const hostname = new URL(request.url).hostname;
  const localPreview = hostname === "localhost" || hostname === "127.0.0.1";

  return Response.json({
    authenticated: Boolean(viewer),
    displayName: viewer?.displayName ?? null,
    email: viewer?.email ?? null,
    provider: viewer ? "ChatGPT" : localPreview ? "Preview lokal" : "Sites private access",
    accessMode: "owner_only",
    workspaceIsolation: "server_enforced",
    sessionState: viewer ? "verified" : localPreview ? "local_preview" : "protected",
    signOutUrl: viewer ? "/signout-with-chatgpt?return_to=/" : null,
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
