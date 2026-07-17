import { getD1 } from "@/db";
import {
  monthPeriod,
  nowIso,
  readJsonObject,
  resolveWorkspaceId,
  routeError,
} from "../_lib/api";
import { parseBudget } from "../_lib/domain";
import {
  budgetSelect,
  getBudgetRow,
  requireWorkspace,
  serializeBudget,
} from "../_lib/repository";

function defaultPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const rawPeriod = new URL(request.url).searchParams.get("period");
    const period = rawPeriod ? monthPeriod({ period: rawPeriod }) : null;
    const statement = period
      ? getD1()
          .prepare(`${budgetSelect} WHERE workspace_id = ? AND period = ? ORDER BY category, id`)
          .bind(workspaceId, period)
      : getD1()
          .prepare(`${budgetSelect} WHERE workspace_id = ? ORDER BY period DESC, category, id`)
          .bind(workspaceId);
    const result = await statement.all();
    return Response.json({
      budgets: result.results.map((row: Record<string, unknown>) => serializeBudget(row as never)),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const budget = parseBudget({ ...payload, period: payload.period ?? defaultPeriod() });
    const now = nowIso();
    await getD1()
      .prepare(
        `INSERT INTO budgets
           (id, workspace_id, category, amount_limit, period, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        budget.id,
        workspaceId,
        budget.category,
        budget.limit,
        budget.period,
        budget.color,
        now,
        now,
      )
      .run();
    return Response.json(
      { budget: serializeBudget((await getBudgetRow(workspaceId, budget.id))!) },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
