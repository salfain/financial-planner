import { ApiError, positiveInteger, readJsonObject, resolveWorkspaceId, routeError } from "../../../../_lib/api";
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
    if (current.current + amount > current.target) {
      throw new ApiError(409, "GOAL_OVERFUNDED", "Kontribusi melebihi sisa target.");
    }
    return updateGoal(
      jsonRequest(
        request,
        "/api/goals/contribute",
        {
          current: current.current + amount,
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
