import { getD1 } from "@/db";
import { DEFAULT_CASHFLOW_FORECAST_SETTINGS, type CashflowForecastSettings } from "@/lib/cashflow-forecast";
import { auditStatement } from "../../_lib/audit";
import { ApiError, nowIso, readJsonObject, requiredString, resolveWorkspaceId, routeError } from "../../_lib/api";
import { requireWorkspace } from "../../_lib/repository";

type ForecastRow = CashflowForecastSettings;
const selectForecast = `SELECT horizon_days AS horizonDays, monthly_income_override AS monthlyIncomeOverride,
  income_day AS incomeDay, minimum_cash_buffer AS minimumCashBuffer
  FROM cashflow_forecast_settings WHERE workspace_id = ? LIMIT 1`;

const integer = (payload: Record<string, unknown>, field: keyof CashflowForecastSettings, min: number, max: number) => {
  const value = payload[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new ApiError(400, "INVALID_FIELD", `${field} harus berupa angka bulat antara ${min} dan ${max}.`, { field });
  }
  return value;
};

function parseSettings(payload: Record<string, unknown>): CashflowForecastSettings {
  const horizonDays = integer(payload, "horizonDays", 30, 90);
  if (![30, 60, 90].includes(horizonDays)) throw new ApiError(400, "INVALID_FIELD", "Horizon harus 30, 60, atau 90 hari.");
  return {
    horizonDays: horizonDays as CashflowForecastSettings["horizonDays"],
    monthlyIncomeOverride: integer(payload, "monthlyIncomeOverride", 0, 10_000_000_000),
    incomeDay: integer(payload, "incomeDay", 1, 28),
    minimumCashBuffer: integer(payload, "minimumCashBuffer", 0, 10_000_000_000),
  };
}

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    return Response.json(await getD1().prepare(selectForecast).bind(workspaceId).first<ForecastRow>() ?? DEFAULT_CASHFLOW_FORECAST_SETTINGS);
  } catch (error) { return routeError(error); }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const requestId = requiredString(payload, "requestId", 120);
    const next = parseSettings(payload);
    const d1 = getD1();
    const replay = await d1.prepare("SELECT action FROM audit_logs WHERE workspace_id = ? AND request_id = ? ORDER BY created_at, id LIMIT 1")
      .bind(workspaceId, requestId).first<{ action: string }>();
    if (replay) {
      if (replay.action !== "forecast.settings.update") throw new ApiError(409, "REQUEST_ID_REUSED", "requestId sudah digunakan oleh operasi lain.");
      return Response.json(await d1.prepare(selectForecast).bind(workspaceId).first<ForecastRow>() ?? DEFAULT_CASHFLOW_FORECAST_SETTINGS);
    }
    const before = await d1.prepare(selectForecast).bind(workspaceId).first<ForecastRow>();
    const timestamp = nowIso();
    await d1.batch([
      d1.prepare(`INSERT INTO cashflow_forecast_settings
        (workspace_id, horizon_days, monthly_income_override, income_day, minimum_cash_buffer, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workspace_id) DO UPDATE SET horizon_days = excluded.horizon_days,
        monthly_income_override = excluded.monthly_income_override, income_day = excluded.income_day,
        minimum_cash_buffer = excluded.minimum_cash_buffer, updated_at = excluded.updated_at`)
        .bind(workspaceId, next.horizonDays, next.monthlyIncomeOverride, next.incomeDay, next.minimumCashBuffer, timestamp, timestamp),
      auditStatement(d1, { workspaceId, action: "forecast.settings.update", entityType: "cashflow_forecast", entityId: workspaceId, requestId, before: before ?? DEFAULT_CASHFLOW_FORECAST_SETTINGS, after: next, createdAt: timestamp }),
    ]);
    return Response.json(next);
  } catch (error) { return routeError(error); }
}
