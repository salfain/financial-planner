import { getD1 } from "@/db";
import { DEFAULT_ROADMAP_SETTINGS, type RoadmapSettings } from "@/lib/roadmap";
import { auditStatement } from "../../_lib/audit";
import { ApiError, nowIso, readJsonObject, requiredString, resolveWorkspaceId, routeError } from "../../_lib/api";
import { requireWorkspace } from "../../_lib/repository";

type RoadmapRow = {
  horizonMonths: number;
  incomeAdjustmentPct: number;
  expenseAdjustmentPct: number;
  annualInvestmentReturnPct: number;
  annualInflationPct: number;
  monthlyInvestment: number;
};

const selectRoadmap = `SELECT horizon_months AS horizonMonths,
  income_adjustment_pct AS incomeAdjustmentPct,
  expense_adjustment_pct AS expenseAdjustmentPct,
  annual_investment_return_pct AS annualInvestmentReturnPct,
  annual_inflation_pct AS annualInflationPct,
  monthly_investment AS monthlyInvestment
  FROM roadmap_settings WHERE workspace_id = ? LIMIT 1`;

const parseInteger = (payload: Record<string, unknown>, field: keyof RoadmapSettings, min: number, max: number) => {
  const value = payload[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new ApiError(400, "INVALID_FIELD", `${field} harus berupa angka bulat antara ${min} dan ${max}.`, { field });
  }
  return value;
};

const parseSettings = (payload: Record<string, unknown>): RoadmapSettings => {
  const horizonMonths = parseInteger(payload, "horizonMonths", 12, 60);
  if (![12, 24, 36, 60].includes(horizonMonths)) {
    throw new ApiError(400, "INVALID_FIELD", "horizonMonths harus 12, 24, 36, atau 60.", { field: "horizonMonths" });
  }
  return {
    horizonMonths: horizonMonths as RoadmapSettings["horizonMonths"],
    incomeAdjustmentPct: parseInteger(payload, "incomeAdjustmentPct", -50, 100),
    expenseAdjustmentPct: parseInteger(payload, "expenseAdjustmentPct", -50, 100),
    annualInvestmentReturnPct: parseInteger(payload, "annualInvestmentReturnPct", 0, 30),
    annualInflationPct: parseInteger(payload, "annualInflationPct", 0, 30),
    monthlyInvestment: parseInteger(payload, "monthlyInvestment", 0, 1_000_000_000),
  };
};

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const row = await getD1().prepare(selectRoadmap).bind(workspaceId).first<RoadmapRow>();
    return Response.json(row ?? DEFAULT_ROADMAP_SETTINGS);
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const requestId = requiredString(payload, "requestId", 120);
    const next = parseSettings(payload);
    const d1 = getD1();
    const replay = await d1.prepare(
      "SELECT action FROM audit_logs WHERE workspace_id = ? AND request_id = ? ORDER BY created_at, id LIMIT 1",
    ).bind(workspaceId, requestId).first<{ action: string }>();
    if (replay) {
      if (replay.action !== "roadmap.update") throw new ApiError(409, "REQUEST_ID_REUSED", "requestId sudah digunakan oleh operasi lain.");
      const current = await d1.prepare(selectRoadmap).bind(workspaceId).first<RoadmapRow>();
      return Response.json(current ?? DEFAULT_ROADMAP_SETTINGS);
    }
    const before = await d1.prepare(selectRoadmap).bind(workspaceId).first<RoadmapRow>();
    const timestamp = nowIso();
    await d1.batch([
      d1.prepare(
        `INSERT INTO roadmap_settings
          (workspace_id, horizon_months, income_adjustment_pct, expense_adjustment_pct,
           annual_investment_return_pct, annual_inflation_pct, monthly_investment, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id) DO UPDATE SET
           horizon_months = excluded.horizon_months,
           income_adjustment_pct = excluded.income_adjustment_pct,
           expense_adjustment_pct = excluded.expense_adjustment_pct,
           annual_investment_return_pct = excluded.annual_investment_return_pct,
           annual_inflation_pct = excluded.annual_inflation_pct,
           monthly_investment = excluded.monthly_investment,
           updated_at = excluded.updated_at`,
      ).bind(
        workspaceId, next.horizonMonths, next.incomeAdjustmentPct, next.expenseAdjustmentPct,
        next.annualInvestmentReturnPct, next.annualInflationPct, next.monthlyInvestment, timestamp, timestamp,
      ),
      auditStatement(d1, {
        workspaceId,
        action: "roadmap.update",
        entityType: "roadmap",
        entityId: workspaceId,
        requestId,
        before: before ?? DEFAULT_ROADMAP_SETTINGS,
        after: next,
        details: { horizonMonths: next.horizonMonths },
        createdAt: timestamp,
      }),
    ]);
    return Response.json(next);
  } catch (error) {
    return routeError(error);
  }
}
