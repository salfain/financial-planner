import { getD1 } from "@/db";
import { DEFAULT_EMERGENCY_FUND_SETTINGS, type EmergencyFundSettings } from "@/lib/emergency-fund";
import { auditStatement } from "../../_lib/audit";
import { ApiError, nowIso, readJsonObject, requiredString, resolveWorkspaceId, routeError } from "../../_lib/api";
import { requireCapability } from "../../_lib/license";
import { requireWorkspace } from "../../_lib/repository";

type Row = Omit<EmergencyFundSettings, "accountIds"> & { accountIdsJson: string };
const selectSql = `SELECT target_months AS targetMonths, monthly_expense_override AS monthlyExpenseOverride,
  monthly_contribution AS monthlyContribution, account_ids_json AS accountIdsJson
  FROM emergency_fund_settings WHERE workspace_id = ? LIMIT 1`;
const parseRow = (row?: Row | null): EmergencyFundSettings => {
  if (!row) return DEFAULT_EMERGENCY_FUND_SETTINGS;
  let accountIds: string[] = [];
  try { const value = JSON.parse(row.accountIdsJson); if (Array.isArray(value)) accountIds = value.map(String); } catch { /* default */ }
  return { targetMonths: row.targetMonths, monthlyExpenseOverride: row.monthlyExpenseOverride, monthlyContribution: row.monthlyContribution, accountIds };
};
const integer = (payload: Record<string, unknown>, field: string, max = 10_000_000_000) => {
  const value = payload[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > max) throw new ApiError(400, "INVALID_FIELD", `${field} tidak valid.`, { field });
  return value;
};
function parseSettings(payload: Record<string, unknown>): EmergencyFundSettings {
  const targetMonths = integer(payload, "targetMonths", 12);
  if (![3, 6, 9, 12].includes(targetMonths)) throw new ApiError(400, "INVALID_FIELD", "Target harus 3, 6, 9, atau 12 bulan.");
  if (!Array.isArray(payload.accountIds) || payload.accountIds.length > 30 || payload.accountIds.some((id) => typeof id !== "string" || !id || id.length > 120)) throw new ApiError(400, "INVALID_FIELD", "Pilihan akun tidak valid.");
  return { targetMonths: targetMonths as EmergencyFundSettings["targetMonths"], monthlyExpenseOverride: integer(payload, "monthlyExpenseOverride"), monthlyContribution: integer(payload, "monthlyContribution"), accountIds: [...new Set(payload.accountIds as string[])] };
}
export async function GET(request: Request) {
  try { const workspaceId = resolveWorkspaceId(request); await requireWorkspace(workspaceId); return Response.json(parseRow(await getD1().prepare(selectSql).bind(workspaceId).first<Row>())); }
  catch (error) { return routeError(error); }
}
export async function PATCH(request: Request) {
  try {
    const payload = await readJsonObject(request); const workspaceId = resolveWorkspaceId(request, payload); await requireWorkspace(workspaceId);
    await requireCapability(workspaceId, "planning");
    const requestId = requiredString(payload, "requestId", 120); const next = parseSettings(payload); const d1 = getD1();
    const replay = await d1.prepare("SELECT action FROM audit_logs WHERE workspace_id = ? AND request_id = ? ORDER BY created_at, id LIMIT 1").bind(workspaceId, requestId).first<{ action: string }>();
    if (replay) { if (replay.action !== "emergency_fund.settings.update") throw new ApiError(409, "REQUEST_ID_REUSED", "requestId sudah digunakan oleh operasi lain."); return Response.json(parseRow(await d1.prepare(selectSql).bind(workspaceId).first<Row>())); }
    const before = parseRow(await d1.prepare(selectSql).bind(workspaceId).first<Row>()); const timestamp = nowIso();
    await d1.batch([
      d1.prepare(`INSERT INTO emergency_fund_settings (workspace_id, target_months, monthly_expense_override, monthly_contribution, account_ids_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workspace_id) DO UPDATE SET target_months = excluded.target_months, monthly_expense_override = excluded.monthly_expense_override, monthly_contribution = excluded.monthly_contribution, account_ids_json = excluded.account_ids_json, updated_at = excluded.updated_at`).bind(workspaceId, next.targetMonths, next.monthlyExpenseOverride, next.monthlyContribution, JSON.stringify(next.accountIds), timestamp, timestamp),
      auditStatement(d1, { workspaceId, action: "emergency_fund.settings.update", entityType: "emergency_fund", entityId: workspaceId, requestId, before, after: next, createdAt: timestamp }),
    ]);
    return Response.json(next);
  } catch (error) { return routeError(error); }
}
