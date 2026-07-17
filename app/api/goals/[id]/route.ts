import { getD1 } from "@/db";
import { auditStatement } from "../../_lib/audit";
import {
  ApiError,
  nowIso,
  optionalString,
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
    const requestId = optionalString(payload, "requestId", 120) ?? null;
    const before = serializeGoal(current);
    const now = nowIso();
    const action = new URL(request.url).pathname.endsWith("/contribute")
      ? "goal.contribute"
      : "goal.update";
    const d1 = getD1();
    await d1.batch([
      d1.prepare(
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
        now,
        workspaceId,
        id,
      ),
      auditStatement(d1, {
        workspaceId,
        action,
        entityType: "goal",
        entityId: id,
        requestId,
        before,
        after: goal,
        details:
          action === "goal.contribute" ? { amount: goal.current - before.current } : undefined,
        createdAt: now,
      }),
    ]);
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
    const current = await getGoalRow(workspaceId, id);
    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Target tidak ditemukan.");
    }
    const d1 = getD1();
    const now = nowIso();
    const before = serializeGoal(current);
    await d1.batch([
      d1.prepare(`DELETE FROM goals WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id),
      auditStatement(d1, {
        workspaceId,
        action: "goal.delete",
        entityType: "goal",
        entityId: id,
        before,
        after: { ...before, deleted: true },
        createdAt: now,
      }),
    ]);
    return Response.json({ deleted: true, id });
  } catch (error) {
    return routeError(error);
  }
}
