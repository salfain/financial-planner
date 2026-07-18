import { ApiError, readJsonObject, requiredString, resolveWorkspaceId, routeError } from "../../../_lib/api";
import { previewMigration } from "../../../_lib/portability";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    if (!payload.backup || typeof payload.backup !== "object" || Array.isArray(payload.backup)) {
      throw new ApiError(400, "INVALID_BACKUP", "backup harus berupa object JSON.");
    }
    return Response.json(await previewMigration(
      workspaceId,
      requiredString(payload, "sourceName", 140),
      payload.backup,
      requiredString(payload, "requestId", 120),
    ), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
