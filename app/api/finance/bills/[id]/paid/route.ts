import { getD1 } from "@/db";
import {
  ApiError,
  isoDate,
  monthPeriod,
  nowIso,
  readJsonObject,
  requiredString,
  resolveWorkspaceId,
  routeError,
  validateId,
} from "../../../../_lib/api";
import {
  loadBalanceAccounts,
  netDeltas,
  validateDeltas,
} from "../../../../_lib/accounting";
import { parseTransaction } from "../../../../_lib/domain";
import {
  getBillRow,
  getTransactionRow,
  requireWorkspace,
  serializeBill,
  serializeTransaction,
  transactionSelect,
} from "../../../../_lib/repository";

type Context = { params: Promise<{ id: string }> };

async function deterministicPaymentTransactionId(
  workspaceId: string,
  billId: string,
  period: string,
) {
  const input = new TextEncoder().encode(`${workspaceId}\u0000${billId}\u0000${period}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  const hash = [...new Uint8Array(digest)]
    .slice(0, 20)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `billpay-${hash}`;
}

async function transactionByIdempotency(workspaceId: string, key: string) {
  return getD1()
    .prepare(
      `${transactionSelect}
       WHERE workspace_id = ? AND idempotency_key = ? AND deleted_at IS NULL LIMIT 1`,
    )
    .bind(workspaceId, key)
    .first<Record<string, unknown>>();
}

export async function POST(request: Request, context: Context) {
  let workspaceId: string | null = null;
  let transactionId: string | null = null;
  let idempotencyKey: string | null = null;
  let paymentPeriod: string | null = null;

  try {
    const payload = await readJsonObject(request);
    workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const billId = validateId((await context.params).id);
    const period = monthPeriod(payload);
    paymentPeriod = period;
    const date = isoDate(payload, "date");
    const requestId = requiredString(payload, "requestId", 120);
    idempotencyKey = `bill-payment:${requestId}`;

    const bill = await getBillRow(workspaceId, billId);
    if (!bill) throw new ApiError(404, "NOT_FOUND", "Tagihan tidak ditemukan.");
    if (bill.category === "Kewajiban") {
      throw new ApiError(
        422,
        "DEBT_PAYMENT_REQUIRES_TRANSFER",
        "Pembayaran kartu kredit harus dicatat sebagai transfer ke akun kewajiban agar tidak menjadi pengeluaran ganda.",
      );
    }

    transactionId = await deterministicPaymentTransactionId(workspaceId, billId, period);
    const requestReplay = await transactionByIdempotency(workspaceId, idempotencyKey);
    if (requestReplay) {
      if (requestReplay.id !== transactionId) {
        throw new ApiError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "requestId sudah digunakan untuk pembayaran lain.",
        );
      }
      return Response.json({
        bill: serializeBill(bill, period),
        transaction: serializeTransaction(requestReplay as never),
        period,
        replayed: true,
        alreadyPaid: true,
      });
    }

    const existingPayment = await getTransactionRow(workspaceId, transactionId);
    if (existingPayment || bill.lastPaidPeriod === period) {
      return Response.json({
        bill: serializeBill(bill, period),
        transaction: existingPayment ? serializeTransaction(existingPayment) : null,
        period,
        replayed: true,
        alreadyPaid: true,
      });
    }

    const transaction = parseTransaction(
      {
        type: "expense",
        date,
        title: `Bayar ${bill.name}`,
        merchant: bill.name,
        category: bill.category === "Kewajiban" ? "Tagihan" : bill.category,
        accountId: bill.accountId,
        amount: bill.amount,
        status: "completed",
      },
      transactionId,
    );
    const accounts = await loadBalanceAccounts(workspaceId, [transaction]);
    const deltas = netDeltas(accounts, null, transaction);
    validateDeltas(accounts, deltas);

    const d1 = getD1();
    const now = nowIso();
    const balanceStatements = [...deltas].map(([accountId, delta]) =>
      d1
        .prepare(
          `UPDATE accounts
           SET balance = balance + ?, updated_at = ?
           WHERE workspace_id = ? AND id = ? AND active = 1
             AND EXISTS (
               SELECT 1 FROM bills
               WHERE workspace_id = ? AND id = ?
                 AND COALESCE(last_paid_period, '') <> ?
             )`,
        )
        .bind(delta, now, workspaceId, accountId, workspaceId, billId, period),
    );

    const batchResults = await d1.batch([
      d1
        .prepare(
          `INSERT INTO transactions
             (id, workspace_id, type, date, title, merchant, category, account_id,
              destination_account_id, amount, status, idempotency_key, created_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
           FROM bills
           WHERE workspace_id = ? AND id = ?
             AND COALESCE(last_paid_period, '') <> ?`,
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
          billId,
          period,
        ),
      ...balanceStatements,
      d1
        .prepare(
          `UPDATE bills
           SET paid = 1, paid_at = ?, last_paid_period = ?, updated_at = ?
           WHERE workspace_id = ? AND id = ?
             AND COALESCE(last_paid_period, '') <> ?`,
        )
        .bind(now, period, now, workspaceId, billId, period),
    ]);
    const insertedTransaction = Number(batchResults[0].meta.changes ?? 0) > 0;

    const [paidBill, createdTransaction] = await Promise.all([
      getBillRow(workspaceId, billId),
      getTransactionRow(workspaceId, transactionId),
    ]);
    if (!paidBill) throw new ApiError(404, "NOT_FOUND", "Tagihan tidak ditemukan.");
    if (!createdTransaction || !insertedTransaction) {
      return Response.json({
        bill: serializeBill(paidBill, period),
        transaction: createdTransaction ? serializeTransaction(createdTransaction) : null,
        period,
        replayed: true,
        alreadyPaid: paidBill.lastPaidPeriod === period,
      });
    }

    return Response.json(
      {
        bill: serializeBill(paidBill, period),
        transaction: serializeTransaction(createdTransaction),
        period,
        replayed: false,
        alreadyPaid: false,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      workspaceId &&
      transactionId &&
      idempotencyKey &&
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      const [requestReplay, existingPayment] = await Promise.all([
        transactionByIdempotency(workspaceId, idempotencyKey),
        getTransactionRow(workspaceId, transactionId),
      ]);
      if (requestReplay && requestReplay.id !== transactionId) {
        return routeError(
          new ApiError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "requestId sudah digunakan untuk pembayaran lain.",
          ),
        );
      }
      const replay = requestReplay ?? existingPayment;
      if (replay) {
        const billId = validateId((await context.params).id);
        const bill = await getBillRow(workspaceId, billId);
        if (bill) {
          return Response.json({
            bill: serializeBill(bill, paymentPeriod ?? undefined),
            transaction: serializeTransaction(replay as never),
            period: paymentPeriod,
            replayed: true,
            alreadyPaid: true,
          });
        }
      }
    }
    return routeError(error);
  }
}
