import { getD1 } from "@/db";
import { auditStatementWhenTransactionExists } from "../../../../_lib/audit";
import {
  ApiError,
  isoDate,
  monthPeriod,
  nonnegativeInteger,
  nowIso,
  readJsonObject,
  requiredString,
  resolveWorkspaceId,
  routeError,
  validateId,
} from "../../../../_lib/api";
import {
  aggregateTransactionDeltas,
  loadBalanceAccounts,
  validateDeltas,
} from "../../../../_lib/accounting";
import { parseTransaction } from "../../../../_lib/domain";
import { installmentAmountAt, remainingInstallmentTotal } from "@/lib/installment-phases";
import { addCalendarMonths } from "@/lib/financial-calendar";
import { assertMonthlyPeriodOpen } from "../../../../_lib/monthly-closing";
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
    await assertMonthlyPeriodOpen(workspaceId, date);
    const requestId = requiredString(payload, "requestId", 120);
    idempotencyKey = `bill-payment:${requestId}`;

    const bill = await getBillRow(workspaceId, billId);
    if (!bill) throw new ApiError(404, "NOT_FOUND", "Tagihan tidak ditemukan.");
    if (bill.completed) {
      return Response.json({
        bill: serializeBill(bill, period),
        transaction: null,
        period,
        replayed: true,
        alreadyPaid: true,
      });
    }
    if (bill.category === "Kewajiban" && !bill.liabilityAccountId) {
      throw new ApiError(
        422,
        "DEBT_PAYMENT_REQUIRES_TRANSFER",
        "Pembayaran kartu kredit harus dicatat sebagai transfer ke akun kewajiban agar tidak menjadi pengeluaran ganda.",
      );
    }

    const flexiblePayment = payload.amount !== undefined || payload.fee !== undefined || payload.settlement === true;
    transactionId = await deterministicPaymentTransactionId(workspaceId, billId, requestId);
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
    if (existingPayment || (!flexiblePayment && bill.lastPaidPeriod === period)) {
      return Response.json({
        bill: serializeBill(bill, period),
        transaction: existingPayment ? serializeTransaction(existingPayment) : null,
        period,
        replayed: true,
        alreadyPaid: true,
      });
    }

    const paymentAccountId = payload.accountId === undefined
      ? bill.accountId
      : validateId(payload.accountId, "accountId");
    if (bill.liabilityAccountId && paymentAccountId === bill.liabilityAccountId) {
      throw new ApiError(
        422,
        "SAME_ACCOUNT",
        "Akun pembayaran dan akun utang tujuan harus berbeda.",
      );
    }

    const serialized = serializeBill(bill, period);
    const scheduledRemaining = remainingInstallmentTotal(serialized);
    const currentPeriodPaid = Number(bill.currentPeriodPaid || 0);
    const settlement = payload.settlement === true;
    const defaultAmount = Math.max(1, serialized.amount - currentPeriodPaid);
    const principal = settlement
      ? Number(scheduledRemaining ?? defaultAmount)
      : payload.amount === undefined ? defaultAmount : nonnegativeInteger(payload, "amount");
    const fee = payload.fee === undefined ? 0 : nonnegativeInteger(payload, "fee");
    if (principal < 1) throw new ApiError(400, "INVALID_PAYMENT_AMOUNT", "Nominal pembayaran harus lebih dari nol.");
    if (scheduledRemaining !== null && principal > scheduledRemaining) {
      throw new ApiError(400, "PAYMENT_EXCEEDS_REMAINING", "Nominal pembayaran melebihi sisa seluruh cicilan.");
    }

    const previousPaidCount = Number(bill.paidCount || 0);
    let nextPaidCount = previousPaidCount;
    let paymentCredit = currentPeriodPaid + principal;
    while (bill.durationMonths === null || nextPaidCount < bill.durationMonths) {
      const due = installmentAmountAt({
        amount: Number(bill.amount),
        paidCount: nextPaidCount,
        durationMonths: bill.durationMonths,
        installmentPhases: serialized.installmentPhases,
      });
      if (paymentCredit < due) break;
      paymentCredit -= due;
      nextPaidCount += 1;
      if (bill.durationMonths === null) break;
    }
    const completed = bill.durationMonths !== null && nextPaidCount >= bill.durationMonths;
    if (completed) paymentCredit = 0;
    const installmentsAdvanced = Math.max(0, nextPaidCount - previousPaidCount);
    const installmentCompleted = installmentsAdvanced > 0;
    const nextDueDate = !completed && installmentsAdvanced > 0
      ? addCalendarMonths(bill.dueDate, installmentsAdvanced)
      : bill.dueDate;

    const transaction = parseTransaction(
      {
        type: bill.liabilityAccountId ? "transfer" : "expense",
        date,
        title: `Bayar ${bill.name}`,
        merchant: bill.name,
        category: bill.liabilityAccountId ? "Transfer" : bill.category,
        accountId: paymentAccountId,
        destinationAccountId: bill.liabilityAccountId,
        amount: principal,
        status: "completed",
      },
      transactionId,
    );
    const feeTransaction = fee > 0 ? parseTransaction({
      type: "expense",
      date,
      title: `Biaya pembayaran ${bill.name}`,
      merchant: bill.name,
      category: "Biaya Keuangan",
      accountId: paymentAccountId,
      amount: fee,
      status: "completed",
    }, `${transactionId}-fee`) : null;
    const paymentTransactions = feeTransaction ? [transaction, feeTransaction] : [transaction];
    const accounts = await loadBalanceAccounts(workspaceId, paymentTransactions);
    const deltas = aggregateTransactionDeltas(accounts, paymentTransactions);
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
                  AND EXISTS (SELECT 1 FROM transactions WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL)
              )`,
        )
        .bind(delta, now, workspaceId, accountId, workspaceId, billId, workspaceId, transaction.id),
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
             AND NOT EXISTS (SELECT 1 FROM transactions WHERE workspace_id = ? AND idempotency_key = ?)`,
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
          workspaceId,
          idempotencyKey,
        ),
      ...(feeTransaction ? [d1.prepare(
        `INSERT INTO transactions
           (id, workspace_id, type, date, title, merchant, category, account_id,
            destination_account_id, amount, status, idempotency_key, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM transactions WHERE workspace_id = ? AND id = ?)
           AND NOT EXISTS (SELECT 1 FROM transactions WHERE workspace_id = ? AND idempotency_key = ?)`,
      ).bind(
        feeTransaction.id, workspaceId, feeTransaction.type, feeTransaction.date, feeTransaction.title,
        feeTransaction.merchant, feeTransaction.category, feeTransaction.accountId,
        feeTransaction.destinationAccountId, feeTransaction.amount, feeTransaction.status,
        `bill-payment-fee:${requestId}`, now, now, workspaceId, transaction.id,
        workspaceId, `bill-payment-fee:${requestId}`,
      )] : []),
      ...balanceStatements,
      d1
        .prepare(
          `UPDATE bills
           SET paid = ?, paid_at = ?, last_paid_period = ?, due_date = ?,
               paid_count = ?, current_period_paid = ?, total_paid = total_paid + ?,
               completed = ?,
               updated_at = ?
           WHERE workspace_id = ? AND id = ?
             AND EXISTS (SELECT 1 FROM transactions WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL)`,
        )
        .bind(
          completed ? 1 : 0,
          now,
          installmentCompleted || completed ? period : bill.lastPaidPeriod,
          nextDueDate,
          nextPaidCount,
          paymentCredit,
          principal,
          completed ? 1 : 0,
          now,
          workspaceId,
          billId,
          workspaceId,
          transaction.id,
        ),
      auditStatementWhenTransactionExists(
        d1,
        {
          workspaceId,
          action: "transaction.create",
          entityType: "transaction",
          entityId: transaction.id,
          requestId: idempotencyKey,
          after: { ...transaction, transferGroupId: bill.liabilityAccountId ? transaction.id : null, updatedAt: now },
          details: { source: "bill.payment", billId, period, liabilityAccountId: bill.liabilityAccountId },
          createdAt: now,
        },
        transaction.id,
      ),
      auditStatementWhenTransactionExists(
        d1,
        {
          workspaceId,
          action: "bill.mark_paid",
          entityType: "bill",
          entityId: billId,
          requestId: idempotencyKey,
          before: serializeBill(bill, period),
          after: {
            ...serializeBill(bill, period),
            paid: installmentCompleted || completed,
            lastPaidPeriod: installmentCompleted || completed ? period : bill.lastPaidPeriod,
            paidCount: nextPaidCount,
            currentPeriodPaid: paymentCredit,
            totalPaid: Number(bill.totalPaid || 0) + principal,
            completed,
            dueDate: nextDueDate,
          },
          details: { transactionId: transaction.id, period, principal, fee, settlement, installmentCompleted, paymentAccountId },
          createdAt: now,
        },
        transaction.id,
      ),
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
