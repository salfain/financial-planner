import { getD1 } from "@/db";
import {
  ApiError,
  nowIso,
  readJsonObject,
  resolveWorkspaceId,
  routeError,
  validateId,
} from "../../_lib/api";
import { mergePayload, parseBudget } from "../../_lib/domain";
import {
  getBudgetRow,
  requireWorkspace,
  serializeBudget,
} from "../../_lib/repository";

type Context = { params: Promise<{ id: string }> };
const routeId = async (context: Context) => validateId((await context.params).id);

export async function GET(request: Request, context: Context) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const budget = await getBudgetRow(workspaceId, await routeId(context));
    if (!budget) throw new ApiError(404, "NOT_FOUND", "Anggaran tidak ditemukan.");
    return Response.json({ budget: serializeBudget(budget) });
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
    const current = await getBudgetRow(workspaceId, id);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Anggaran tidak ditemukan.");
    const budget = parseBudget(
      mergePayload(serializeBudget(current), payload, ["category", "limit", "period", "color"]),
      id,
    );
    await getD1()
      .prepare(
        `UPDATE budgets
         SET category = ?, amount_limit = ?, period = ?, color = ?, updated_at = ?
         WHERE workspace_id = ? AND id = ?`,
      )
      .bind(
        budget.category,
        budget.limit,
        budget.period,
        budget.color,
        nowIso(),
        workspaceId,
        id,
      )
      .run();
    return Response.json({ budget: serializeBudget((await getBudgetRow(workspaceId, id))!) });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const id = await routeId(context);
    if (!(await getBudgetRow(workspaceId, id))) {
      throw new ApiError(404, "NOT_FOUND", "Anggaran tidak ditemukan.");
    }
    await getD1().prepare(`DELETE FROM budgets WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id).run();
    return Response.json({ deleted: true, id });
  } catch (error) {
    return routeError(error);
  }
}
