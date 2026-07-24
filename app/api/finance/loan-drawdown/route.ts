import { getD1 } from "@/db";
import { auditStatement } from "../../_lib/audit";
import {
  ApiError,
  isoDate,
  makeId,
  nowIso,
  optionalString,
  positiveInteger,
  readJsonObject,
  requiredString,
  resolveWorkspaceId,
  routeError,
  validateId,
} from "../../_lib/api";
import {
  aggregateTransactionDeltas,
  balanceUpdateStatements,
  loadBalanceAccounts,
  validateDeltas,
} from "../../_lib/accounting";
import { parseTransaction, type TransactionInput } from "../../_lib/domain";
import { assertMonthlyPeriodOpen } from "../../_lib/monthly-closing";
import { requireWorkspace } from "../../_lib/repository";

type AccountRow = {
  id: string;
  name: string;
  liability: number;
};

function insertTransaction(
  d1: D1Database,
  workspaceId: string,
  transaction: TransactionInput,
  idempotencyKey: string,
  now: string,
) {
  return d1.prepare(
    `INSERT INTO transactions
       (id, workspace_id, type, date, time, title, merchant, category, notes,
        tags_json, location, splits_json, account_id, destination_account_id,
        transfer_group_id, amount, status, idempotency_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    transaction.id,
    workspaceId,
    transaction.type,
    transaction.date,
    transaction.time,
    transaction.title,
    transaction.merchant,
    transaction.category,
    transaction.notes,
    JSON.stringify(transaction.tags),
    transaction.location,
    JSON.stringify(transaction.splits),
    transaction.accountId,
    transaction.destinationAccountId,
    transaction.type === "transfer" ? transaction.id : null,
    transaction.amount,
    transaction.status,
    idempotencyKey,
    now,
    now,
  );
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);

    const requestId = requiredString(payload, "requestId", 120);
    const liabilityAccountId = validateId(payload.liabilityAccountId, "liabilityAccountId");
    const destinationAccountId = validateId(payload.destinationAccountId, "destinationAccountId");
    if (liabilityAccountId === destinationAccountId) {
      throw new ApiError(400, "SAME_ACCOUNT", "Akun utang dan rekening penerima harus berbeda.");
    }
    const cashReceived = positiveInteger(payload, "cashReceived");
    const totalObligation = positiveInteger(payload, "totalObligation");
    if (totalObligation < cashReceived) {
      throw new ApiError(
        400,
        "INVALID_OBLIGATION",
        "Total kewajiban tidak boleh lebih kecil daripada uang yang diterima.",
      );
    }
    const financingCost = totalObligation - cashReceived;
    const date = isoDate(payload, "date");
    const title = requiredString(payload, "title", 160);
    const userNotes = optionalString(payload, "notes", 700) ?? "";
    await assertMonthlyPeriodOpen(workspaceId, date);

    const d1 = getD1();
    const replay = await d1.prepare(
      `SELECT id FROM transactions
       WHERE workspace_id = ? AND idempotency_key = ? AND deleted_at IS NULL LIMIT 1`,
    ).bind(workspaceId, requestId).first<{ id: string }>();
    if (replay) {
      return Response.json({
        transactionId: replay.id,
        cashReceived,
        totalObligation,
        financingCost,
        replayed: true,
      });
    }

    const accountResults = await d1.batch([
      d1.prepare("SELECT id, name, liability FROM accounts WHERE workspace_id = ? AND id = ? AND active = 1 LIMIT 1")
        .bind(workspaceId, liabilityAccountId),
      d1.prepare("SELECT id, name, liability FROM accounts WHERE workspace_id = ? AND id = ? AND active = 1 LIMIT 1")
        .bind(workspaceId, destinationAccountId),
    ]);
    const liabilityAccount = accountResults[0].results[0] as AccountRow | undefined;
    const destinationAccount = accountResults[1].results[0] as AccountRow | undefined;
    if (!liabilityAccount || !destinationAccount) {
      throw new ApiError(400, "ACCOUNT_NOT_FOUND", "Akun utang atau rekening penerima tidak ditemukan.");
    }
    if (!liabilityAccount.liability) {
      throw new ApiError(400, "LIABILITY_REQUIRED", "Sumber pencairan harus berupa akun kewajiban.");
    }
    if (destinationAccount.liability) {
      throw new ApiError(400, "CASH_ACCOUNT_REQUIRED", "Rekening penerima tidak boleh berupa akun kewajiban.");
    }

    const transactionId = makeId("loan");
    const costTransactionId = makeId("loan-cost");
    const summary = [
      userNotes,
      `Dana bersih ${cashReceived}; total kewajiban ${totalObligation}; biaya pembiayaan ${financingCost}.`,
      `Referensi pencairan ${transactionId}.`,
    ].filter(Boolean).join(" ");
    const transfer = parseTransaction({
      id: transactionId,
      type: "transfer",
      date,
      title,
      merchant: liabilityAccount.name,
      category: "Transfer",
      notes: summary,
      accountId: liabilityAccountId,
      destinationAccountId,
      amount: cashReceived,
      status: "completed",
    });
    const transactions: TransactionInput[] = [transfer];
    if (financingCost > 0) {
      transactions.push(parseTransaction({
        id: costTransactionId,
        type: "adjustment_out",
        date,
        title: `Biaya pembiayaan - ${liabilityAccount.name}`,
        merchant: liabilityAccount.name,
        category: "Penyesuaian Saldo",
        notes: `Tambahan kewajiban kontraktual dari ${title}. Tidak mengurangi kas dan tidak dihitung sebagai pengeluaran bulanan. Referensi pencairan ${transactionId}.`,
        accountId: liabilityAccountId,
        amount: financingCost,
        status: "completed",
      }));
    }

    const accounts = await loadBalanceAccounts(workspaceId, transactions);
    const deltas = aggregateTransactionDeltas(accounts, transactions);
    validateDeltas(accounts, deltas);
    const now = nowIso();
    const after = transactions.map((transaction) => ({ ...transaction, updatedAt: now }));
    await d1.batch([
      insertTransaction(d1, workspaceId, transfer, requestId, now),
      ...(transactions.length > 1
        ? [insertTransaction(d1, workspaceId, transactions[1], `${requestId}-financing-cost`, now)]
        : []),
      ...balanceUpdateStatements(workspaceId, deltas),
      auditStatement(d1, {
        workspaceId,
        action: "transaction.loan_drawdown",
        entityType: "transaction",
        entityId: transactionId,
        requestId,
        after,
        details: {
          liabilityAccountId,
          destinationAccountId,
          cashReceived,
          totalObligation,
          financingCost,
        },
        createdAt: now,
      }),
    ]);

    return Response.json({
      transactionId,
      cashReceived,
      totalObligation,
      financingCost,
      replayed: false,
    }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
