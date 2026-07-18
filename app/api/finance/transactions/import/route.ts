import { getD1 } from "@/db";
import { auditStatement } from "../../../_lib/audit";
import { ApiError, nowIso, readJsonObject, requiredString, resolveWorkspaceId, routeError } from "../../../_lib/api";
import { aggregateTransactionDeltas, balanceUpdateStatements, loadBalanceAccounts, validateDeltas } from "../../../_lib/accounting";
import { parseTransaction, type TransactionInput } from "../../../_lib/domain";
import { requireWorkspace } from "../../../_lib/repository";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const requestId = requiredString(payload, "requestId", 120);
    const existing = await getD1()
      .prepare("SELECT details FROM audit_logs WHERE workspace_id = ? AND request_id = ? AND action = 'transaction.import' LIMIT 1")
      .bind(workspaceId, requestId)
      .first<{ details: string }>();
    if (existing) {
      const details = JSON.parse(existing.details || "{}") as { imported?: number };
      return Response.json({ imported: Number(details.imported || 0), replayed: true });
    }
    if (!Array.isArray(payload.transactions) || payload.transactions.length < 1 || payload.transactions.length > 100) {
      throw new ApiError(400, "INVALID_IMPORT", "Impor harus berisi 1 sampai 100 transaksi.");
    }
    const transactions = payload.transactions.map((row, index): TransactionInput => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new ApiError(400, "INVALID_IMPORT_ROW", `Baris ${index + 1} tidak valid.`);
      }
      const transaction = parseTransaction(row as Record<string, unknown>);
      if (!["income", "expense", "refund"].includes(transaction.type)) {
        throw new ApiError(400, "IMPORT_TYPE_UNSUPPORTED", `Baris ${index + 1}: impor CSV hanya mendukung pemasukan, pengeluaran, dan refund.`);
      }
      return transaction;
    });
    if (new Set(transactions.map((item) => item.id)).size !== transactions.length) {
      throw new ApiError(400, "DUPLICATE_IMPORT_ID", "File impor memuat ID transaksi yang sama lebih dari sekali.");
    }
    const accounts = await loadBalanceAccounts(workspaceId, transactions);
    const deltas = aggregateTransactionDeltas(accounts, transactions);
    validateDeltas(accounts, deltas);
    const d1 = getD1();
    const now = nowIso();
    const statements = transactions.map((transaction, index) => d1.prepare(
      `INSERT INTO transactions
         (id, workspace_id, type, date, time, title, merchant, category, notes,
          tags_json, location, splits_json, account_id, destination_account_id,
          transfer_group_id, amount, status, idempotency_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      transaction.id, workspaceId, transaction.type, transaction.date, transaction.time,
      transaction.title, transaction.merchant, transaction.category, transaction.notes,
      JSON.stringify(transaction.tags), transaction.location, JSON.stringify(transaction.splits),
      transaction.accountId, transaction.destinationAccountId, null, transaction.amount,
      transaction.status, `${requestId}:${index + 1}`, now, now,
    ));
    await d1.batch([
      ...statements,
      ...balanceUpdateStatements(workspaceId, deltas),
      auditStatement(d1, {
        workspaceId,
        action: "transaction.import",
        entityType: "transaction_batch",
        entityId: requestId,
        requestId,
        after: transactions.map((transaction) => ({ ...transaction, updatedAt: now })),
        details: { imported: transactions.length, transactionIds: transactions.map((item) => item.id) },
        createdAt: now,
      }),
    ]);
    return Response.json({ imported: transactions.length, replayed: false }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
