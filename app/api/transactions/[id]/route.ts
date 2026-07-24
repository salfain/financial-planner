import { getD1 } from "@/db";
import {
  auditStatementWhenTransactionVersion,
  getAuditByRequestId,
} from "../../_lib/audit";
import {
  ApiError,
  nowIso,
  optionalString,
  readJsonObject,
  readOptionalJsonObject,
  resolveWorkspaceId,
  routeError,
  validateId,
} from "../../_lib/api";
import {
  balanceUpdateStatementsWhenTransactionVersion,
  loadBalanceAccounts,
  netDeltas,
  validateDeltas,
} from "../../_lib/accounting";
import { mergePayload, parseTransaction } from "../../_lib/domain";
import { requireCapability } from "../../_lib/license";
import { assertMonthlyPeriodOpen } from "../../_lib/monthly-closing";
import {
  getTransactionRow,
  requireWorkspace,
  serializeTransaction,
} from "../../_lib/repository";

type Context = { params: Promise<{ id: string }> };
const routeId = async (context: Context) => validateId((await context.params).id);

function nextVersionTimestamp(previous: string) {
  const candidate = nowIso();
  return candidate === previous
    ? new Date(Date.parse(previous) + 1).toISOString()
    : candidate;
}

export async function GET(request: Request, context: Context) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const transaction = await getTransactionRow(workspaceId, await routeId(context));
    if (!transaction) throw new ApiError(404, "NOT_FOUND", "Transaksi tidak ditemukan.");
    return Response.json({ transaction: serializeTransaction(transaction) });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  let workspaceId: string | null = null;
  let id: string | null = null;
  let requestId: string | null = null;
  try {
    const payload = await readJsonObject(request);
    workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    id = await routeId(context);
    requestId = optionalString(payload, "requestId", 120) ?? null;
    if (requestId) {
      const replayAudit = await getAuditByRequestId(
        workspaceId,
        requestId,
        "transaction.update",
        id,
      );
      if (replayAudit) {
        const replayTransaction = await getTransactionRow(workspaceId, id);
        if (replayTransaction) {
          return Response.json({
            transaction: serializeTransaction(replayTransaction),
            replayed: true,
          });
        }
      }
    }
    const currentRow = await getTransactionRow(workspaceId, id);
    if (!currentRow) throw new ApiError(404, "NOT_FOUND", "Transaksi tidak ditemukan.");
    const expectedUpdatedAt = optionalString(payload, "expectedUpdatedAt", 40);
    if (expectedUpdatedAt && expectedUpdatedAt !== currentRow.updatedAt) {
      throw new ApiError(
        409,
        "STALE_TRANSACTION",
        "Transaksi sudah berubah. Muat ulang data lalu coba lagi.",
        { currentUpdatedAt: currentRow.updatedAt },
      );
    }
    const current = parseTransaction(serializeTransaction(currentRow), id);
    const next = parseTransaction(
      mergePayload(serializeTransaction(currentRow), payload, [
        "type",
        "date",
        "time",
        "title",
        "merchant",
        "category",
        "notes",
        "tags",
        "location",
        "splits",
        "accountId",
        "destinationAccountId",
        "amount",
        "status",
      ]),
      id,
    );
    await assertMonthlyPeriodOpen(workspaceId, current.date);
    await assertMonthlyPeriodOpen(workspaceId, next.date);
    if (
      JSON.stringify(next.tags) !== JSON.stringify(current.tags)
      || next.location !== current.location
      || JSON.stringify(next.splits) !== JSON.stringify(current.splits)
    ) {
      await requireCapability(workspaceId, "advanced_transactions");
    }
    const accounts = await loadBalanceAccounts(workspaceId, [current, next]);
    const deltas = netDeltas(accounts, current, next);
    validateDeltas(accounts, deltas);
    const d1 = getD1();
    const before = serializeTransaction(currentRow);
    const now = nextVersionTimestamp(currentRow.updatedAt);
    const transferGroupId =
      next.type === "transfer" || next.type === "investment_buy" ? id : null;
    const after = {
      ...next,
      transferGroupId,
      updatedAt: now,
    };
    const results = await d1.batch([
      d1
        .prepare(
          `UPDATE transactions
           SET type = ?, date = ?, time = ?, title = ?, merchant = ?, category = ?, notes = ?,
               tags_json = ?, location = ?, splits_json = ?, account_id = ?, destination_account_id = ?,
               transfer_group_id = ?, amount = ?, status = ?,
               updated_at = ?
           WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL AND updated_at = ?`,
        )
        .bind(
          next.type,
          next.date,
          next.time,
          next.title,
          next.merchant,
          next.category,
          next.notes,
          JSON.stringify(next.tags),
          next.location,
          JSON.stringify(next.splits),
          next.accountId,
          next.destinationAccountId,
          transferGroupId,
          next.amount,
          next.status,
          now,
          workspaceId,
          id,
          currentRow.updatedAt,
        ),
      ...balanceUpdateStatementsWhenTransactionVersion(
        workspaceId,
        deltas,
        id,
        now,
        null,
      ),
      auditStatementWhenTransactionVersion(
        d1,
        {
          workspaceId,
          action: "transaction.update",
          entityType: "transaction",
          entityId: id,
          requestId,
          before,
          after,
          createdAt: now,
        },
        id,
        now,
        null,
      ),
    ]);
    if (Number(results[0]?.meta?.changes ?? 0) === 0) {
      throw new ApiError(
        409,
        "STALE_TRANSACTION",
        "Transaksi sudah berubah. Muat ulang data lalu coba lagi.",
      );
    }
    return Response.json({
      transaction: serializeTransaction((await getTransactionRow(workspaceId, id))!),
      replayed: false,
    });
  } catch (error) {
    if (
      workspaceId &&
      id &&
      requestId &&
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      const [replayAudit, replayTransaction] = await Promise.all([
        getAuditByRequestId(workspaceId, requestId, "transaction.update", id),
        getTransactionRow(workspaceId, id),
      ]);
      if (replayAudit && replayTransaction) {
        return Response.json({
          transaction: serializeTransaction(replayTransaction),
          replayed: true,
        });
      }
    }
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  let workspaceId: string | null = null;
  let id: string | null = null;
  let requestId: string | null = null;
  try {
    const payload = await readOptionalJsonObject(request);
    workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    id = await routeId(context);
    requestId = optionalString(payload, "requestId", 120) ?? null;
    if (requestId) {
      const replayAudit = await getAuditByRequestId(
        workspaceId,
        requestId,
        "transaction.delete",
        id,
      );
      if (replayAudit) return Response.json({ deleted: true, id, replayed: true });
    }
    const currentRow = await getTransactionRow(workspaceId, id);
    if (!currentRow) throw new ApiError(404, "NOT_FOUND", "Transaksi tidak ditemukan.");
    const expectedUpdatedAt = optionalString(payload, "expectedUpdatedAt", 40);
    if (expectedUpdatedAt && expectedUpdatedAt !== currentRow.updatedAt) {
      throw new ApiError(
        409,
        "STALE_TRANSACTION",
        "Transaksi sudah berubah. Muat ulang data lalu coba lagi.",
        { currentUpdatedAt: currentRow.updatedAt },
      );
    }
    const current = parseTransaction(serializeTransaction(currentRow), id);
    await assertMonthlyPeriodOpen(workspaceId, current.date);
    const accounts = await loadBalanceAccounts(workspaceId, [current]);
    const deltas = netDeltas(accounts, current, null);
    validateDeltas(accounts, deltas);
    const d1 = getD1();
    const before = serializeTransaction(currentRow);
    const now = nextVersionTimestamp(currentRow.updatedAt);
    const results = await d1.batch([
      d1
        .prepare(
          `UPDATE transactions
           SET deleted_at = ?, updated_at = ?
           WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL AND updated_at = ?`,
        )
        .bind(now, now, workspaceId, id, currentRow.updatedAt),
      ...balanceUpdateStatementsWhenTransactionVersion(
        workspaceId,
        deltas,
        id,
        now,
        now,
      ),
      auditStatementWhenTransactionVersion(
        d1,
        {
          workspaceId,
          action: "transaction.delete",
          entityType: "transaction",
          entityId: id,
          requestId,
          before,
          after: { ...before, deleted: true, updatedAt: now },
          createdAt: now,
        },
        id,
        now,
        now,
      ),
    ]);
    if (Number(results[0]?.meta?.changes ?? 0) === 0) {
      throw new ApiError(
        409,
        "STALE_TRANSACTION",
        "Transaksi sudah berubah. Muat ulang data lalu coba lagi.",
      );
    }
    return Response.json({ deleted: true, id, replayed: false });
  } catch (error) {
    if (
      workspaceId &&
      id &&
      requestId &&
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      const replayAudit = await getAuditByRequestId(
        workspaceId,
        requestId,
        "transaction.delete",
        id,
      );
      if (replayAudit) return Response.json({ deleted: true, id, replayed: true });
    }
    return routeError(error);
  }
}
