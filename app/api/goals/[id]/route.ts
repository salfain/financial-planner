import { getD1 } from "@/db";
import {
  ApiError,
  nowIso,
  readJsonObject,
  resolveWorkspaceId,
  routeError,
  validateId,
} from "../../_lib/api";
import { mergePayload, parseGoal } from "../../_lib/domain";
import { getGoalRow, requireWorkspace, serializeGoal } from "../../_lib/repository";

type Context = { params: Promise<{ id: string }> };
const routeId = async (context: Context) => validateId((await context.params).id);

export async function GET(request: Request, context: Context) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const goal = await getGoalRow(workspaceId, await routeId(context));
    if (!goal) throw new ApiError(404, "NOT_FOUND", "Target tidak ditemukan.");
    return Response.json({ goal: serializeGoal(goal) });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const id = await routeId(context);
    const current = await getGoalRow(workspaceId, id);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Target tidak ditemukan.");
    const goal = parseGoal(
      mergePayload(current as unknown as Record<string, unknown>, payload, [
        "name",
        "target",
        "current",
        "deadline",
        "color",
        "icon",
      ]),
      id,
    );
    await getD1()
      .prepare(
        `UPDATE goals
         SET name = ?, target = ?, current = ?, deadline = ?, color = ?, icon = ?, updated_at = ?
         WHERE workspace_id = ? AND id = ?`,
      )
      .bind(
        goal.name,
        goal.target,
        goal.current,
        goal.deadline,
        goal.color,
        goal.icon,
        nowIso(),
        workspaceId,
        id,
      )
      .run();
    return Response.json({ goal: serializeGoal((await getGoalRow(workspaceId, id))!) });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const id = await routeId(context);
    if (!(await getGoalRow(workspaceId, id))) {
      throw new ApiError(404, "NOT_FOUND", "Target tidak ditemukan.");
    }
    await getD1().prepare(`DELETE FROM goals WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id).run();
    return Response.json({ deleted: true, id });
  } catch (error) {
    return routeError(error);
  }
}
