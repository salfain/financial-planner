import { getD1 } from "@/db";
import { auditStatement } from "../../../_lib/audit";
import { ApiError, makeId, nowIso, readJsonObject, requiredString, resolveWorkspaceId, routeError } from "../../../_lib/api";
import { aggregateMutationDeltas, balanceUpdateStatements, loadBalanceAccounts, validateDeltas } from "../../../_lib/accounting";
import { parseTransaction, type TransactionInput } from "../../../_lib/domain";
import { assertMonthlyPeriodOpen } from "../../../_lib/monthly-closing";
import { getTransactionRowIncludingDeleted, requireWorkspace, serializeTransaction } from "../../../_lib/repository";

type UndoableAudit = {
  id: string;
  action: "transaction.create" | "transaction.update" | "transaction.delete" | "transaction.import" | "transaction.loan_drawdown";
  entityId: string | null;
  beforeJson: string | null;
  afterJson: string | null;
};

const parseJson = (value: string | null): unknown => value ? JSON.parse(value) : null;

function restoreStatement(d1: D1Database, workspaceId: string, transaction: TransactionInput, updatedAt: string) {
  return d1.prepare(
    `UPDATE transactions SET type = ?, date = ?, time = ?, title = ?, merchant = ?, category = ?,
       notes = ?, tags_json = ?, location = ?, splits_json = ?, account_id = ?, destination_account_id = ?,
       transfer_group_id = ?, amount = ?, status = ?, deleted_at = NULL, updated_at = ?
     WHERE workspace_id = ? AND id = ?`,
  ).bind(
    transaction.type, transaction.date, transaction.time, transaction.title, transaction.merchant,
    transaction.category, transaction.notes, JSON.stringify(transaction.tags), transaction.location,
    JSON.stringify(transaction.splits), transaction.accountId, transaction.destinationAccountId,
    transaction.type === "transfer" || transaction.type === "investment_buy" ? transaction.id : null,
    transaction.amount, transaction.status, updatedAt, workspaceId, transaction.id,
  );
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const requestId = requiredString(payload, "requestId", 120);
    const d1 = getD1();
    const replay = await d1.prepare(
      `SELECT u.target_audit_id AS targetAuditId, a.action, a.entity_id AS entityId
       FROM transaction_undo_events u JOIN audit_logs a ON a.id = u.target_audit_id
       WHERE u.workspace_id = ? AND u.request_id = ? LIMIT 1`,
    ).bind(workspaceId, requestId).first<{ targetAuditId: string; action: string; entityId: string | null }>();
    if (replay) return Response.json({ undone: true, action: replay.action, transactionId: replay.entityId || "batch", replayed: true });

    const audit = await d1.prepare(
      `SELECT a.id, a.action, a.entity_id AS entityId, a.before_json AS beforeJson, a.after_json AS afterJson
       FROM audit_logs a
       WHERE a.workspace_id = ?
         AND a.action IN ('transaction.create', 'transaction.update', 'transaction.delete', 'transaction.import', 'transaction.loan_drawdown')
         AND NOT EXISTS (SELECT 1 FROM transaction_undo_events u WHERE u.workspace_id = a.workspace_id AND u.target_audit_id = a.id)
       ORDER BY a.created_at DESC, a.id DESC LIMIT 1`,
    ).bind(workspaceId).first<UndoableAudit>();
    if (!audit) throw new ApiError(409, "NOTHING_TO_UNDO", "Belum ada aksi transaksi yang dapat dibatalkan.");

    const previous: TransactionInput[] = [];
    const next: TransactionInput[] = [];
    const statements: D1PreparedStatement[] = [];
    const now = nowIso();
    let targetId = audit.entityId || "batch";
    let auditBefore: unknown = null;
    let auditAfter: unknown = null;

    if (audit.action === "transaction.import" || audit.action === "transaction.loan_drawdown") {
      const imported = parseJson(audit.afterJson);
      if (!Array.isArray(imported) || !imported.length) throw new ApiError(409, "UNDO_STATE_INVALID", "Data impor tidak dapat dipulihkan.");
      for (const value of imported) {
        const record = value as Record<string, unknown>;
        const id = String(record.id || "");
        const row = await getTransactionRowIncludingDeleted(workspaceId, id);
        if (!row || row.deletedAt || (record.updatedAt && row.updatedAt !== String(record.updatedAt))) throw new ApiError(409, "UNDO_CONFLICT", "Sebagian transaksi impor sudah berubah atau dihapus.");
        const current = parseTransaction(serializeTransaction(row), id);
        previous.push(current);
        statements.push(d1.prepare("UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL").bind(now, now, workspaceId, id));
      }
      targetId = `batch:${imported.length}`;
      auditBefore = imported;
      auditAfter = { deleted: imported.map((item) => (item as Record<string, unknown>).id) };
    } else {
      if (!audit.entityId) throw new ApiError(409, "UNDO_STATE_INVALID", "Referensi transaksi untuk undo tidak tersedia.");
      const row = await getTransactionRowIncludingDeleted(workspaceId, audit.entityId);
      if (!row) throw new ApiError(409, "UNDO_CONFLICT", "Transaksi sudah tidak tersedia.");
      const afterValue = parseJson(audit.afterJson) as Record<string, unknown> | null;
      if (afterValue?.updatedAt && row.updatedAt !== String(afterValue.updatedAt)) {
        throw new ApiError(409, "UNDO_CONFLICT", "Transaksi sudah berubah setelah aksi terakhir. Undo dibatalkan agar data tetap aman.");
      }
      if (audit.action === "transaction.create") {
        if (row.deletedAt) throw new ApiError(409, "UNDO_CONFLICT", "Transaksi sudah dihapus.");
        const current = parseTransaction(serializeTransaction(row), row.id);
        previous.push(current);
        statements.push(d1.prepare("UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL").bind(now, now, workspaceId, row.id));
        auditBefore = serializeTransaction(row);
        auditAfter = { ...serializeTransaction(row), deletedAt: now, updatedAt: now };
      } else {
        const beforeValue = parseJson(audit.beforeJson);
        if (!beforeValue || typeof beforeValue !== "object" || Array.isArray(beforeValue)) throw new ApiError(409, "UNDO_STATE_INVALID", "Snapshot transaksi sebelum perubahan tidak tersedia.");
        const restored = parseTransaction(beforeValue as Record<string, unknown>, row.id);
        if (audit.action === "transaction.update") {
          if (row.deletedAt) throw new ApiError(409, "UNDO_CONFLICT", "Transaksi sudah dihapus setelah pembaruan.");
          previous.push(parseTransaction(serializeTransaction(row), row.id));
        }
        next.push(restored);
        statements.push(restoreStatement(d1, workspaceId, restored, now));
        auditBefore = serializeTransaction(row);
        auditAfter = { ...restored, updatedAt: now };
      }
    }

    await Promise.all(
      [...new Set([...previous, ...next].map((transaction) => transaction.date.slice(0, 7)))]
        .map((period) => assertMonthlyPeriodOpen(workspaceId, period)),
    );
    const accounts = await loadBalanceAccounts(workspaceId, [...previous, ...next]);
    const deltas = aggregateMutationDeltas(accounts, previous, next);
    validateDeltas(accounts, deltas);
    await d1.batch([
      ...statements,
      ...balanceUpdateStatements(workspaceId, deltas),
      d1.prepare("INSERT INTO transaction_undo_events (id, workspace_id, target_audit_id, request_id, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(makeId("undo"), workspaceId, audit.id, requestId, now),
      auditStatement(d1, { workspaceId, action: "transaction.undo", entityType: "transaction", entityId: targetId, requestId, before: auditBefore, after: auditAfter, details: { targetAuditId: audit.id, targetAction: audit.action }, createdAt: now }),
    ]);
    return Response.json({ undone: true, action: audit.action, transactionId: targetId, replayed: false });
  } catch (error) {
    return routeError(error);
  }
}
