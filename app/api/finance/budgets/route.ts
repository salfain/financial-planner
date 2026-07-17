import { getD1 } from "@/db";
import { POST as createBudget, GET as listBudgets } from "../../budgets/route";
import { PATCH as updateBudget } from "../../budgets/[id]/route";
import {
  readJsonObject,
  resolveWorkspaceId,
  routeError,
} from "../../_lib/api";
import { jsonRequest } from "../../_lib/forward";
import { parseBudget } from "../../_lib/domain";
import { requireWorkspace } from "../../_lib/repository";

export const GET = listBudgets;

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const mapped: Record<string, unknown> = {
      ...payload,
      period: payload.period ?? payload.month,
      limit: payload.limit ?? payload.limitAmount,
    };
    const budget = parseBudget(mapped);
    const existing = await getD1()
      .prepare(
        `SELECT id FROM budgets
         WHERE workspace_id = ? AND category = ? AND period = ? LIMIT 1`,
      )
      .bind(workspaceId, budget.category, budget.period)
      .first<{ id: string }>();
    if (existing) {
      return updateBudget(jsonRequest(request, "/api/budgets/update", mapped, "PATCH"), {
        params: Promise.resolve({ id: existing.id }),
      });
    }
    return createBudget(jsonRequest(request, "/api/budgets", mapped));
  } catch (error) {
    return routeError(error);
  }
}
