import { getD1 } from "@/db";
import { auditStatement } from "../_lib/audit";
import {
  ApiError,
  nowIso,
  optionalString,
  readJsonObject,
  resolveWorkspaceId,
  routeError,
} from "../_lib/api";
import {
  balanceUpdateStatements,
  loadBalanceAccounts,
  netDeltas,
  validateDeltas,
} from "../_lib/accounting";
import { parseTransaction } from "../_lib/domain";
import {
  getTransactionRow,
  requireWorkspace,
  serializeTransaction,
  transactionSelect,
} from "../_lib/repository";

async function findByIdempotency(workspaceId: string, key: string) {
  return getD1()
    .prepare(
      `${transactionSelect}
       WHERE workspace_id = ? AND idempotency_key = ? AND deleted_at IS NULL LIMIT 1`,
    )
    .bind(workspaceId, key)
    .first();
}

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const url = new URL(request.url);
    const limitValue = Number(url.searchParams.get("limit") ?? 200);
    const limit = Number.isInteger(limitValue) ? Math.min(500, Math.max(1, limitValue)) : 200;
    const result = await getD1()
      .prepare(
        `${transactionSelect}
         WHERE workspace_id = ? AND deleted_at IS NULL
         ORDER BY date DESC, created_at DESC, id DESC LIMIT ?`,
      )
      .bind(workspaceId, limit)
      .all();
    return Response.json({
      transactions: result.results.map((row: Record<string, unknown>) =>
        serializeTransaction(row as never),
      ),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  let workspaceId: string | null = null;
  let idempotencyKey: string | null = null;
  try {
    const payload = await readJsonObject(request);
    workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const hadClientId = payload.id !== undefined;
    const transaction = parseTransaction(payload);
    const explicitKey =
      request.headers.get("Idempotency-Key") ?? optionalString(payload, "idempotencyKey", 200);
    if (
      (transaction.type === "transfer" || transaction.type === "investment_buy") &&
      !explicitKey &&
      !hadClientId
    ) {
      throw new ApiError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Transfer wajib menyertakan header Idempotency-Key atau id transaksi dari client.",
      );
    }
    idempotencyKey = explicitKey?.trim() || transaction.id;
    if (idempotencyKey.length > 200) {
      throw new ApiError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key maksimal 200 karakter.");
    }
    const replay = await findByIdempotency(workspaceId, idempotencyKey);
    if (replay) {
      return Response.json({ transaction: serializeTransaction(replay as never), replayed: true });
    }

    const accounts = await loadBalanceAccounts(workspaceId, [transaction]);
    const deltas = netDeltas(accounts, null, transaction);
    validateDeltas(accounts, deltas);
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1
        .prepare(
          `INSERT INTO transactions
             (id, workspace_id, type, date, title, merchant, category, account_id,
              destination_account_id, transfer_group_id, amount, status, idempotency_key,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          transaction.id,
          workspaceId,
          transaction.type,
          transaction.date,
          transaction.title,
          transaction.merchant,
          transaction.category,
          transaction.accountId,
          transaction.destinationAccountId,
          transaction.type === "transfer" || transaction.type === "investment_buy"
            ? transaction.id
            : null,
          transaction.amount,
          transaction.status,
          idempotencyKey,
          now,
          now,
        ),
      ...balanceUpdateStatements(workspaceId, deltas),
      auditStatement(d1, {
        workspaceId,
        action: "transaction.create",
        entityType: "transaction",
        entityId: transaction.id,
        requestId: idempotencyKey,
        after: {
          ...transaction,
          transferGroupId:
            transaction.type === "transfer" || transaction.type === "investment_buy"
              ? transaction.id
              : null,
          updatedAt: now,
        },
        details: { idempotencyKey },
        createdAt: now,
      }),
    ]);
    return Response.json(
      {
        transaction: serializeTransaction((await getTransactionRow(workspaceId, transaction.id))!),
        replayed: false,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      workspaceId &&
      idempotencyKey &&
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      const replay = await findByIdempotency(workspaceId, idempotencyKey);
      if (replay) {
        return Response.json({ transaction: serializeTransaction(replay as never), replayed: true });
      }
    }
    return routeError(error);
  }
}
