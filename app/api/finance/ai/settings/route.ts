import { booleanValue, readJsonObject, resolveWorkspaceId, routeError } from "../../../_lib/api";
import { getAiSettings, updateAiSettings } from "../../../_lib/ai";

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
    const removeApiKey = payload.removeApiKey === undefined ? false : booleanValue(payload, "removeApiKey");
    return Response.json(await updateAiSettings(resolveWorkspaceId(request, payload), {
      enabled: booleanValue(payload, "enabled"),
      consentAccepted: booleanValue(payload, "consentAccepted"),
      ...(apiKey === undefined || !apiKey.trim() ? {} : { apiKey }),
      removeApiKey,
    }));
  } catch (error) {
    return routeError(error);
  }
}
