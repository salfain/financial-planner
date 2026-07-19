import { getD1 } from "@/db";
import { DEFAULT_DEBT_SETTINGS, type DebtStrategy } from "@/lib/debt";
import { auditStatement } from "../../_lib/audit";
import { ApiError, nowIso, readJsonObject, requiredString, resolveWorkspaceId, routeError } from "../../_lib/api";
import { requireWorkspace } from "../../_lib/repository";

type SettingsRow = { strategy: DebtStrategy; extraMonthlyPayment: number };
type DebtRow = { accountId: string; name: string; balance: number; annualRateBps: number; minimumPayment: number; dueDay: number };

const selectSettings = "SELECT strategy, extra_monthly_payment AS extraMonthlyPayment FROM debt_payoff_settings WHERE workspace_id = ? LIMIT 1";
const selectDebts = `SELECT a.id AS accountId, a.name, a.balance, d.annual_rate_bps AS annualRateBps,
  d.minimum_payment AS minimumPayment, d.due_day AS dueDay
  FROM debt_accounts d JOIN accounts a ON a.id = d.account_id AND a.workspace_id = d.workspace_id
  WHERE d.workspace_id = ? AND a.active = 1 AND a.liability = 1 ORDER BY a.name, a.id`;

async function current(workspaceId: string) {
  const d1 = getD1();
  const [settings, debts] = await Promise.all([
    d1.prepare(selectSettings).bind(workspaceId).first<SettingsRow>(),
    d1.prepare(selectDebts).bind(workspaceId).all<DebtRow>(),
  ]);
  return {
    settings: settings ?? DEFAULT_DEBT_SETTINGS,
    debts: debts.results.map((debt) => ({
      accountId: debt.accountId,
      name: debt.name,
      balance: debt.balance,
      annualInterestRatePct: debt.annualRateBps / 100,
      minimumPayment: debt.minimumPayment,
      dueDay: debt.dueDay,
    })),
  };
}

const integer = (payload: Record<string, unknown>, field: string, min: number, max: number) => {
  const value = payload[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new ApiError(400, "INVALID_FIELD", `${field} harus berupa angka bulat antara ${min} dan ${max}.`, { field });
  }
  return value;
};

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    return Response.json(await current(workspaceId));
  } catch (error) { return routeError(error); }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const requestId = requiredString(payload, "requestId", 120);
    const mode = requiredString(payload, "mode", 20);
    if (!new Set(["settings", "debt"]).has(mode)) throw new ApiError(400, "INVALID_MODE", "Mode perubahan tidak valid.");
    const action = mode === "settings" ? "debt.settings.update" : "debt.plan.upsert";
    const d1 = getD1();
    const replay = await d1.prepare("SELECT action FROM audit_logs WHERE workspace_id = ? AND request_id = ? ORDER BY created_at, id LIMIT 1")
      .bind(workspaceId, requestId).first<{ action: string }>();
    if (replay) {
      if (replay.action !== action) throw new ApiError(409, "REQUEST_ID_REUSED", "requestId sudah digunakan oleh operasi lain.");
      return Response.json(await current(workspaceId));
    }
    const timestamp = nowIso();
    if (mode === "settings") {
      const strategy = payload.strategy;
      if (strategy !== "avalanche" && strategy !== "snowball") throw new ApiError(400, "INVALID_FIELD", "Strategi harus avalanche atau snowball.");
      const extraMonthlyPayment = integer(payload, "extraMonthlyPayment", 0, 1_000_000_000);
      const before = await d1.prepare(selectSettings).bind(workspaceId).first<SettingsRow>();
      await d1.batch([
        d1.prepare(`INSERT INTO debt_payoff_settings (workspace_id, strategy, extra_monthly_payment, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?) ON CONFLICT(workspace_id) DO UPDATE SET strategy = excluded.strategy,
          extra_monthly_payment = excluded.extra_monthly_payment, updated_at = excluded.updated_at`)
          .bind(workspaceId, strategy, extraMonthlyPayment, timestamp, timestamp),
        auditStatement(d1, { workspaceId, action, entityType: "debt_planner", entityId: workspaceId, requestId, before: before ?? DEFAULT_DEBT_SETTINGS, after: { strategy, extraMonthlyPayment }, createdAt: timestamp }),
      ]);
    } else {
      const accountId = requiredString(payload, "accountId", 120);
      const account = await d1.prepare("SELECT id, name, liability FROM accounts WHERE workspace_id = ? AND id = ? AND active = 1 LIMIT 1")
        .bind(workspaceId, accountId).first<{ id: string; name: string; liability: number }>();
      if (!account || !account.liability) throw new ApiError(400, "INVALID_DEBT_ACCOUNT", "Pilih akun kewajiban yang aktif.");
      const rate = payload.annualInterestRatePct;
      if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > 100) throw new ApiError(400, "INVALID_FIELD", "Bunga tahunan harus antara 0 dan 100 persen.");
      const annualRateBps = Math.round(rate * 100);
      const minimumPayment = integer(payload, "minimumPayment", 0, 1_000_000_000);
      const dueDay = integer(payload, "dueDay", 1, 31);
      const before = await d1.prepare("SELECT annual_rate_bps AS annualRateBps, minimum_payment AS minimumPayment, due_day AS dueDay FROM debt_accounts WHERE workspace_id = ? AND account_id = ? LIMIT 1")
        .bind(workspaceId, accountId).first();
      await d1.batch([
        d1.prepare(`INSERT INTO debt_accounts (id, workspace_id, account_id, annual_rate_bps, minimum_payment, due_day, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workspace_id, account_id) DO UPDATE SET
          annual_rate_bps = excluded.annual_rate_bps, minimum_payment = excluded.minimum_payment,
          due_day = excluded.due_day, updated_at = excluded.updated_at`)
          .bind(`debt-${accountId}`, workspaceId, accountId, annualRateBps, minimumPayment, dueDay, timestamp, timestamp),
        auditStatement(d1, { workspaceId, action, entityType: "debt_account", entityId: accountId, requestId, before, after: { accountId, annualInterestRatePct: rate, minimumPayment, dueDay }, createdAt: timestamp }),
      ]);
    }
    return Response.json(await current(workspaceId));
  } catch (error) { return routeError(error); }
}
