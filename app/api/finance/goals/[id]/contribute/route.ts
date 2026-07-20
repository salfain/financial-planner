import { ApiError, enumValue, positiveInteger, readJsonObject, resolveWorkspaceId, routeError } from "../../../../_lib/api";
import { jsonRequest } from "../../../../_lib/forward";
import { getGoalRow, requireWorkspace, serializeGoal } from "../../../../_lib/repository";
import { PATCH as updateGoal } from "../../../../goals/[id]/route";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const { id } = await context.params;
    const goal = await getGoalRow(workspaceId, id);
    if (!goal) throw new ApiError(404, "NOT_FOUND", "Target tidak ditemukan.");
    const current = serializeGoal(goal);
    const amount = positiveInteger(payload, "amount");
    const mode = payload.mode === undefined ? "add" : enumValue(payload, "mode", ["add", "withdraw"] as const);
    const nextCurrent = mode === "withdraw" ? current.current - amount : current.current + amount;
    if (nextCurrent > current.target) {
      throw new ApiError(409, "GOAL_OVERFUNDED", "Kontribusi melebihi sisa target.");
    }
    if (nextCurrent < 0) throw new ApiError(409, "GOAL_UNDERFUNDED", "Penarikan melebihi dana yang sudah terkumpul.");
    return updateGoal(
      jsonRequest(
        request,
        "/api/goals/contribute",
        {
          current: nextCurrent,
          ...(payload.requestId === undefined ? {} : { requestId: payload.requestId }),
        },
        "PATCH",
      ),
      context,
    );
  } catch (error) {
    return routeError(error);
  }
}
