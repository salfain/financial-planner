type ProxyRequest = {
  action?: unknown;
  requestId?: unknown;
  payload?: unknown;
};

function jsonError(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const endpoint = String(process.env.APPS_SCRIPT_API_URL || "").trim();
  const accessKey = String(process.env.APPS_SCRIPT_ACCESS_KEY || "").trim();

  if (!endpoint || !accessKey) {
    return jsonError(503, "APPS_SCRIPT_NOT_CONFIGURED", "Backend Apps Script belum dikonfigurasi di environment Coolify.");
  }

  let body: ProxyRequest;
  try {
    body = await request.json() as ProxyRequest;
  } catch {
    return jsonError(400, "INVALID_JSON", "Body request harus berupa JSON yang valid.");
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
    ? body.payload
    : {};

  if (!action || !requestId) {
    return jsonError(400, "INVALID_REQUEST", "Action dan requestId wajib diisi.");
  }

  let target: URL;
  try {
    target = new URL(endpoint);
    if (target.protocol !== "https:" && target.protocol !== "http:") throw new Error("protocol");
  } catch {
    return jsonError(500, "APPS_SCRIPT_URL_INVALID", "URL API Apps Script tidak valid.");
  }

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ action, requestId, accessKey, payload }),
      redirect: "follow",
    });
    const text = await upstream.text();
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      return Response.json(parsed, { status: upstream.ok ? 200 : 502 });
    } catch {
      return jsonError(502, "APPS_SCRIPT_INVALID_RESPONSE", "Apps Script mengembalikan respons non-JSON.");
    }
  } catch {
    return jsonError(502, "APPS_SCRIPT_UNREACHABLE", "Server VPS tidak dapat menghubungi Apps Script.");
  }
}
