import { getD1 } from "@/db";
import {
  ApiError,
  nowIso,
  readJsonObject,
  resolveWorkspaceId,
  routeError,
  validateId,
} from "../../_lib/api";
import {
  balanceUpdateStatements,
  loadBalanceAccounts,
  netDeltas,
  validateDeltas,
} from "../../_lib/accounting";
import { mergePayload, parseTransaction } from "../../_lib/domain";
import {
  getTransactionRow,
  requireWorkspace,
  serializeTransaction,
} from "../../_lib/repository";

type Context = { params: Promise<{ id: string }> };
const routeId = async (context: Context) => validateId((await context.params).id);

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
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const id = await routeId(context);
    const currentRow = await getTransactionRow(workspaceId, id);
    if (!currentRow) throw new ApiError(404, "NOT_FOUND", "Transaksi tidak ditemukan.");
    const current = parseTransaction(serializeTransaction(currentRow), id);
    const next = parseTransaction(
      mergePayload(serializeTransaction(currentRow), payload, [
        "type",
        "date",
        "title",
        "merchant",
        "category",
        "accountId",
        "destinationAccountId",
        "amount",
        "status",
      ]),
      id,
    );
    const accounts = await loadBalanceAccounts(workspaceId, [current, next]);
    const deltas = netDeltas(accounts, current, next);
    validateDeltas(accounts, deltas);
    const d1 = getD1();
    await d1.batch([
      d1
        .prepare(
          `UPDATE transactions
           SET type = ?, date = ?, title = ?, merchant = ?, category = ?, account_id = ?,
               destination_account_id = ?, amount = ?, status = ?, updated_at = ?
           WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL`,
        )
        .bind(
          next.type,
          next.date,
          next.title,
          next.merchant,
          next.category,
          next.accountId,
          next.destinationAccountId,
          next.amount,
          next.status,
          nowIso(),
          workspaceId,
          id,
        ),
      ...balanceUpdateStatements(workspaceId, deltas),
    ]);
    return Response.json({
      transaction: serializeTransaction((await getTransactionRow(workspaceId, id))!),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const id = await routeId(context);
    const currentRow = await getTransactionRow(workspaceId, id);
    if (!currentRow) throw new ApiError(404, "NOT_FOUND", "Transaksi tidak ditemukan.");
    const current = parseTransaction(serializeTransaction(currentRow), id);
    const accounts = await loadBalanceAccounts(workspaceId, [current]);
    const deltas = netDeltas(accounts, current, null);
    validateDeltas(accounts, deltas);
    const d1 = getD1();
    await d1.batch([
      d1
        .prepare(
          `UPDATE transactions
           SET deleted_at = ?, updated_at = ?
           WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL`,
        )
        .bind(nowIso(), nowIso(), workspaceId, id),
      ...balanceUpdateStatements(workspaceId, deltas),
    ]);
    return Response.json({ deleted: true, id });
  } catch (error) {
    return routeError(error);
  }
}
