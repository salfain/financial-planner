import { ApiError, readJsonObject, resolveWorkspaceId, routeError } from "../../../_lib/api";
import { scanReceipt } from "../../../_lib/ai";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    if (typeof payload.imageBase64 !== "string" || !payload.imageBase64) {
      throw new ApiError(400, "INVALID_FIELD", "imageBase64 wajib diisi.");
    }
    if (typeof payload.mimeType !== "string" || !payload.mimeType) {
      throw new ApiError(400, "INVALID_FIELD", "mimeType wajib diisi.");
    }
    if (payload.fileName !== undefined && typeof payload.fileName !== "string") {
      throw new ApiError(400, "INVALID_FIELD", "fileName harus berupa teks.");
    }
    return Response.json(await scanReceipt(resolveWorkspaceId(request, payload), {
      imageBase64: payload.imageBase64,
      mimeType: payload.mimeType,
      fileName: payload.fileName,
    }));
  } catch (error) {
    return routeError(error);
  }
}
