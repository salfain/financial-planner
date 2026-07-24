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
import { parseTransaction, TRANSACTION_TYPES } from "../_lib/domain";
import { requireCapability } from "../_lib/license";
import { assertMonthlyPeriodOpen } from "../_lib/monthly-closing";
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
    const pageValue = Number(url.searchParams.get("page") ?? 1);
    const pageSizeValue = Number(url.searchParams.get("pageSize") ?? url.searchParams.get("limit") ?? 25);
    const page = Number.isInteger(pageValue) ? Math.max(1, pageValue) : 1;
    const pageSize = Number.isInteger(pageSizeValue) ? Math.min(100, Math.max(1, pageSizeValue)) : 25;
    const clauses = ["workspace_id = ?", "deleted_at IS NULL"];
    const values: unknown[] = [workspaceId];
    const addEquals = (key: string, column: string, allowed?: readonly string[]) => {
      const value = url.searchParams.get(key)?.trim();
      if (!value || (allowed && !allowed.includes(value))) return;
      clauses.push(`${column} = ?`);
      values.push(value);
    };
    const query = url.searchParams.get("query")?.trim().toLowerCase();
    if (query) {
      clauses.push("(lower(title) LIKE ? OR lower(coalesce(merchant, '')) LIKE ? OR lower(category) LIKE ? OR lower(notes) LIKE ? OR lower(tags_json) LIKE ? OR lower(location) LIKE ? OR account_id IN (SELECT id FROM accounts WHERE workspace_id = ? AND lower(name) LIKE ?))");
      for (let index = 0; index < 6; index += 1) values.push(`%${query}%`);
      values.push(workspaceId, `%${query}%`);
    }
    const type = url.searchParams.get("type")?.trim();
    if (type === "adjustment") clauses.push("type IN ('adjustment_in', 'adjustment_out')");
    else if (type && TRANSACTION_TYPES.includes(type as never)) { clauses.push("type = ?"); values.push(type); }
    const category = url.searchParams.get("category")?.trim();
    if (category) {
      clauses.push("(category = ? OR lower(splits_json) LIKE ?)");
      values.push(category, `%\"category\":\"${category.toLowerCase()}\"%`);
    }
    addEquals("accountId", "account_id");
    addEquals("status", "status", ["completed", "pending"]);
    const dateFrom = url.searchParams.get("dateFrom")?.trim();
    const dateTo = url.searchParams.get("dateTo")?.trim();
    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) { clauses.push("date >= ?"); values.push(dateFrom); }
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) { clauses.push("date <= ?"); values.push(dateTo); }
    const where = clauses.join(" AND ");
    const d1 = getD1();
    const [result, count] = await Promise.all([
      d1.prepare(`${transactionSelect} WHERE ${where} ORDER BY date DESC, time DESC, created_at DESC, id DESC LIMIT ? OFFSET ?`).bind(...values, pageSize, (page - 1) * pageSize).all(),
      d1.prepare(`SELECT COUNT(*) AS total FROM transactions WHERE ${where}`).bind(...values).first<{ total: number }>(),
    ]);
    const total = Number(count?.total ?? 0);
    return Response.json({
      transactions: result.results.map((row: Record<string, unknown>) =>
        serializeTransaction(row as never),
      ),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
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
    await assertMonthlyPeriodOpen(workspaceId, transaction.date);
    if (transaction.tags.length || transaction.location || transaction.splits.length) {
      await requireCapability(workspaceId, "advanced_transactions");
    }
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
             (id, workspace_id, type, date, time, title, merchant, category, notes,
              tags_json, location, splits_json, account_id, destination_account_id,
              transfer_group_id, amount, status, idempotency_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
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
