import { getD1 } from "@/db";
import {
  auditStatementWhenRequestUnused,
  auditStatementWhenTransactionExists,
  getAuditByRequest,
  getAuditByRequestId,
} from "../../../../_lib/audit";
import {
  ApiError,
  isoDate,
  nonnegativeInteger,
  nowIso,
  optionalString,
  readJsonObject,
  requiredString,
  resolveWorkspaceId,
  routeError,
  validateId,
} from "../../../../_lib/api";
import { loadBalanceAccounts, netDeltas, validateDeltas } from "../../../../_lib/accounting";
import { parseTransaction } from "../../../../_lib/domain";
import { assertMonthlyPeriodOpen } from "../../../../_lib/monthly-closing";
import {
  getAccountRow,
  getTransactionRow,
  requireWorkspace,
  serializeAccount,
  serializeTransaction,
  transactionSelect,
} from "../../../../_lib/repository";

type Context = { params: Promise<{ id: string }> };

async function transactionByIdempotency(workspaceId: string, key: string) {
  return getD1()
    .prepare(
      `${transactionSelect}
       WHERE workspace_id = ? AND idempotency_key = ? AND deleted_at IS NULL LIMIT 1`,
    )
    .bind(workspaceId, key)
    .first<Record<string, unknown>>();
}

function reconciliationDirection(liability: boolean, delta: number) {
  if (delta === 0) return "none" as const;
  if (liability) return delta > 0 ? "adjustment_out" as const : "adjustment_in" as const;
  return delta > 0 ? "adjustment_in" as const : "adjustment_out" as const;
}

export async function POST(request: Request, context: Context) {
  let workspaceId: string | null = null;
  let accountId: string | null = null;
  let idempotencyKey: string | null = null;

  try {
    const payload = await readJsonObject(request);
    workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    accountId = validateId((await context.params).id);
    const actualBalance = nonnegativeInteger(payload, "actualBalance");
    const date = isoDate(payload, "date");
    await assertMonthlyPeriodOpen(workspaceId, date);
    const note = optionalString(payload, "note", 300) ?? null;
    const requestId = requiredString(payload, "requestId", 120);
    idempotencyKey = `reconcile:${requestId}`;

    const accountRow = await getAccountRow(workspaceId, accountId);
    if (!accountRow) throw new ApiError(404, "NOT_FOUND", "Akun tidak ditemukan.");
    const account = serializeAccount(accountRow);

    const [replayTransaction, anyReplayAudit] = await Promise.all([
      transactionByIdempotency(workspaceId, idempotencyKey),
      getAuditByRequest(workspaceId, idempotencyKey, "account.reconcile"),
    ]);
    if (anyReplayAudit && anyReplayAudit.entityId !== accountId) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "requestId sudah digunakan untuk rekonsiliasi akun lain.",
      );
    }
    const replayAudit = anyReplayAudit;
    if (replayTransaction) {
      if (
        replayTransaction.accountId !== accountId ||
        !["adjustment_in", "adjustment_out"].includes(String(replayTransaction.type))
      ) {
        throw new ApiError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "requestId sudah digunakan untuk rekonsiliasi lain.",
        );
      }
      const details = (replayAudit?.details ?? {}) as Record<string, unknown>;
      const signedDelta = Number(details.delta ?? 0);
      return Response.json({
        account,
        transaction: serializeTransaction(replayTransaction as never),
        reconciliation: {
          beforeBalance: Number(details.beforeBalance ?? account.balance - signedDelta),
          actualBalance: Number(details.actualBalance ?? account.balance),
          delta: signedDelta,
          direction: replayTransaction.type,
        },
        replayed: true,
        noChange: false,
      });
    }
    if (replayAudit) {
      const details = replayAudit.details as Record<string, unknown>;
      return Response.json({
        account,
        transaction: null,
        reconciliation: {
          beforeBalance: Number(details.beforeBalance ?? account.balance),
          actualBalance: Number(details.actualBalance ?? account.balance),
          delta: 0,
          direction: "none",
        },
        replayed: true,
        noChange: true,
      });
    }

    const delta = actualBalance - account.balance;
    const direction = reconciliationDirection(account.liability, delta);
    const now = nowIso();
    const d1 = getD1();
    const details = {
      beforeBalance: account.balance,
      actualBalance,
      delta,
      direction,
      date,
      note,
    };

    if (delta === 0) {
      const results = await d1.batch([
        auditStatementWhenRequestUnused(d1, {
          workspaceId,
          action: "account.reconcile",
          entityType: "account",
          entityId: accountId,
          requestId: idempotencyKey,
          before: account,
          after: account,
          details,
          createdAt: now,
        }),
      ]);
      if (Number(results[0]?.meta?.changes ?? 0) === 0) {
        const concurrentAudit = await getAuditByRequest(
          workspaceId,
          idempotencyKey,
          "account.reconcile",
        );
        if (concurrentAudit?.entityId !== accountId) {
          throw new ApiError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "requestId sudah digunakan untuk rekonsiliasi akun lain.",
          );
        }
        return Response.json({
          account,
          transaction: null,
          reconciliation: {
            beforeBalance: account.balance,
            actualBalance,
            delta: 0,
            direction: "none",
          },
          replayed: true,
          noChange: true,
        });
      }
      return Response.json({
        account,
        transaction: null,
        reconciliation: {
          beforeBalance: account.balance,
          actualBalance,
          delta: 0,
          direction: "none",
        },
        replayed: false,
        noChange: true,
      });
    }

    const transaction = parseTransaction({
      type: direction,
      date,
      title: `Rekonsiliasi ${account.name}`,
      merchant: note ?? "Penyesuaian saldo aktual",
      category: "Penyesuaian Saldo",
      accountId,
      amount: Math.abs(delta),
      status: "completed",
    });
    const accounts = await loadBalanceAccounts(workspaceId, [transaction]);
    const deltas = netDeltas(accounts, null, transaction);
    validateDeltas(accounts, deltas);

    const accountDelta = deltas.get(accountId);
    if (accountDelta === undefined) {
      throw new ApiError(500, "RECONCILIATION_FAILED", "Delta akun tidak dapat dihitung.");
    }

    const batchResults = await d1.batch([
      d1
        .prepare(
          `INSERT INTO transactions
             (id, workspace_id, type, date, title, merchant, category, account_id,
              destination_account_id, amount, status, idempotency_key, created_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
           FROM accounts
           WHERE workspace_id = ? AND id = ? AND active = 1 AND balance = ?`,
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
          transaction.amount,
          transaction.status,
          idempotencyKey,
          now,
          now,
          workspaceId,
          accountId,
          account.balance,
        ),
      d1
        .prepare(
          `UPDATE accounts
           SET balance = balance + ?, updated_at = ?
           WHERE workspace_id = ? AND id = ? AND active = 1 AND balance = ?
             AND EXISTS (
               SELECT 1 FROM transactions
               WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL
             )`,
        )
        .bind(
          accountDelta,
          now,
          workspaceId,
          accountId,
          account.balance,
          workspaceId,
          transaction.id,
        ),
      auditStatementWhenTransactionExists(
        d1,
        {
          workspaceId,
          action: "account.reconcile",
          entityType: "account",
          entityId: accountId,
          requestId: idempotencyKey,
          before: account,
          after: { ...account, balance: actualBalance },
          details: { ...details, transactionId: transaction.id },
          createdAt: now,
        },
        transaction.id,
      ),
    ]);

    if (Number(batchResults[0]?.meta?.changes ?? 0) === 0) {
      const [concurrentTransaction, concurrentAudit, currentAccount] = await Promise.all([
        transactionByIdempotency(workspaceId, idempotencyKey),
        getAuditByRequestId(
          workspaceId,
          idempotencyKey,
          "account.reconcile",
          accountId,
        ),
        getAccountRow(workspaceId, accountId),
      ]);
      if (concurrentTransaction && currentAccount) {
        const concurrentDetails = (concurrentAudit?.details ?? {}) as Record<
          string,
          unknown
        >;
        const concurrentDelta = Number(concurrentDetails.delta ?? 0);
        const serializedAccount = serializeAccount(currentAccount);
        return Response.json({
          account: serializedAccount,
          transaction: serializeTransaction(concurrentTransaction as never),
          reconciliation: {
            beforeBalance: Number(
              concurrentDetails.beforeBalance ?? serializedAccount.balance - concurrentDelta,
            ),
            actualBalance: Number(
              concurrentDetails.actualBalance ?? serializedAccount.balance,
            ),
            delta: concurrentDelta,
            direction: concurrentTransaction.type,
          },
          replayed: true,
          noChange: false,
        });
      }

      throw new ApiError(
        409,
        "STALE_ACCOUNT_BALANCE",
        "Saldo akun berubah saat rekonsiliasi. Muat ulang data lalu coba lagi.",
        currentAccount ? { currentBalance: serializeAccount(currentAccount).balance } : undefined,
      );
    }

    return Response.json(
      {
        account: serializeAccount((await getAccountRow(workspaceId, accountId))!),
        transaction: serializeTransaction(
          (await getTransactionRow(workspaceId, transaction.id))!,
        ),
        reconciliation: {
          beforeBalance: account.balance,
          actualBalance,
          delta,
          direction,
        },
        replayed: false,
        noChange: false,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      workspaceId &&
      accountId &&
      idempotencyKey &&
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      const [transaction, audit, account] = await Promise.all([
        transactionByIdempotency(workspaceId, idempotencyKey),
        getAuditByRequestId(
          workspaceId,
          idempotencyKey,
          "account.reconcile",
          accountId,
        ),
        getAccountRow(workspaceId, accountId),
      ]);
      if (account && (transaction || audit)) {
        const serializedAccount = serializeAccount(account);
        const details = (audit?.details ?? {}) as Record<string, unknown>;
        const delta = Number(details.delta ?? 0);
        return Response.json({
          account: serializedAccount,
          transaction: transaction ? serializeTransaction(transaction as never) : null,
          reconciliation: {
            beforeBalance: Number(details.beforeBalance ?? serializedAccount.balance - delta),
            actualBalance: Number(details.actualBalance ?? serializedAccount.balance),
            delta,
            direction: transaction?.type ?? "none",
          },
          replayed: true,
          noChange: !transaction,
        });
      }
    }
    return routeError(error);
  }
}
