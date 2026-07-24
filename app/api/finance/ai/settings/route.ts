import { booleanValue, readJsonObject, resolveWorkspaceId, routeError } from "../../../_lib/api";
import { getAiSettings, updateAiSettings } from "../../../_lib/ai";
import { requireCapability } from "../../../_lib/license";

export async function GET(request: Request) {
  try {
    return Response.json(await getAiSettings(resolveWorkspaceId(request)));
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const apiKey = payload.apiKey;
    if (apiKey !== undefined && typeof apiKey !== "string") {
      return Response.json({ error: { code: "INVALID_FIELD", message: "apiKey harus berupa teks." } }, { status: 400 });
    }
    const baseUrl = payload.baseUrl;
    const model = payload.model;
    if (baseUrl !== undefined && typeof baseUrl !== "string") {
      return Response.json({ error: { code: "INVALID_FIELD", message: "baseUrl harus berupa teks." } }, { status: 400 });
    }
    if (model !== undefined && typeof model !== "string") {
      return Response.json({ error: { code: "INVALID_FIELD", message: "model harus berupa teks." } }, { status: 400 });
    }
    const removeApiKey = payload.removeApiKey === undefined ? false : booleanValue(payload, "removeApiKey");
    const workspaceId = resolveWorkspaceId(request, payload);
    const enabled = booleanValue(payload, "enabled");
    const consentAccepted = booleanValue(payload, "consentAccepted");
    if (enabled || consentAccepted || (typeof apiKey === "string" && apiKey.trim())) {
      await requireCapability(workspaceId, "ai");
    }
    return Response.json(await updateAiSettings(workspaceId, {
      enabled,
      consentAccepted,
      ...(baseUrl === undefined ? {} : { baseUrl }),
      ...(model === undefined ? {} : { model }),
      ...(apiKey === undefined || !apiKey.trim() ? {} : { apiKey }),
      removeApiKey,
    }));
  } catch (error) {
    return routeError(error);
  }
}
