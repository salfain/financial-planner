import { getD1 } from "@/db";
import { auditStatement } from "../../_lib/audit";
import { ApiError, isoDate, makeId, nowIso, positiveInteger, readJsonObject, requiredString, resolveWorkspaceId, routeError, validateId } from "../../_lib/api";
import { assertMonthlyPeriodOpen } from "../../_lib/monthly-closing";
import { requireWorkspace } from "../../_lib/repository";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const requestId = requiredString(payload, "requestId", 120);
    const borrower = requiredString(payload, "borrower", 100);
    const name = requiredString(payload, "name", 100);
    const sourceAccountId = validateId(payload.sourceAccountId, "sourceAccountId");
    const amount = positiveInteger(payload, "amount");
    const dueDate = isoDate(payload, "dueDate");
    const date = isoDate(payload, "date");
    await assertMonthlyPeriodOpen(workspaceId, date);
    const d1 = getD1();
    const replay = await d1.prepare("SELECT destination_account_id AS accountId FROM transactions WHERE workspace_id = ? AND idempotency_key = ? AND deleted_at IS NULL LIMIT 1").bind(workspaceId, requestId).first<{ accountId: string }>();
    if (replay) return Response.json({ accountId: replay.accountId, replayed: true });
    const source = await d1.prepare("SELECT id, balance, liability FROM accounts WHERE workspace_id = ? AND id = ? AND active = 1 LIMIT 1").bind(workspaceId, sourceAccountId).first<{ id: string; balance: number; liability: number }>();
    if (!source || source.liability) throw new ApiError(400, "CASH_ACCOUNT_REQUIRED", "Pilih rekening atau kas sebagai sumber dana.");
    if (source.balance < amount) throw new ApiError(409, "INSUFFICIENT_BALANCE", "Saldo sumber tidak cukup untuk mencatat piutang.");
    const accountId = makeId("receivable");
    const transactionId = makeId("receivable-transfer");
    const now = nowIso();
    await d1.batch([
      d1.prepare(`INSERT INTO accounts (id, workspace_id, name, type, institution, balance, opening_balance, mask, color, liability, active, created_at, updated_at) VALUES (?, ?, ?, 'Receivable', ?, ?, 0, ?, '#4e79c7', 0, 1, ?, ?)`).bind(accountId, workspaceId, name, borrower, amount, `JT ${dueDate}`, now, now),
      d1.prepare(`INSERT INTO transactions (id, workspace_id, type, date, title, merchant, category, notes, account_id, destination_account_id, transfer_group_id, amount, status, idempotency_key, created_at, updated_at) VALUES (?, ?, 'transfer', ?, ?, ?, 'Transfer', ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`).bind(transactionId, workspaceId, date, `Berikan piutang - ${name}`, borrower, `Jatuh tempo ${dueDate}`, sourceAccountId, accountId, transactionId, amount, requestId, now, now),
      d1.prepare("UPDATE accounts SET balance = balance - ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND balance >= ?").bind(amount, now, workspaceId, sourceAccountId, amount),
      auditStatement(d1, { workspaceId, action: "receivable.create", entityType: "account", entityId: accountId, requestId, after: { name, borrower, amount, dueDate, sourceAccountId }, createdAt: now }),
    ]);
    return Response.json({ accountId, transactionId, replayed: false }, { status: 201 });
  } catch (error) { return routeError(error); }
}
