import assert from "node:assert/strict";
import test from "node:test";
import type { Account, Bill, Budget, Goal, Transaction } from "../lib/finance";
import { buildMonthlyReview } from "../lib/monthly-review";

const accounts: Account[] = [
  { id: "bank", name: "Rekening utama", type: "Bank", institution: "Bank", balance: 0, openingBalance: 10_000_000, mask: "1234", color: "#126b59" },
  { id: "loan", name: "Pinjaman", type: "Loan", institution: "Bank", balance: 0, openingBalance: 5_000_000, mask: "9876", color: "#9f4439", liability: true },
];

const transaction = (id: string, date: string, amount: number, overrides: Partial<Transaction> = {}): Transaction => ({
  id,
  type: "expense",
  date,
  title: "Belanja",
  merchant: "Warung",
  category: "Makanan",
  accountId: "bank",
  amount,
  status: "completed",
  ...overrides,
});

test("review bulanan merangkum ledger, anggaran, anomali, target, dan tagihan", () => {
  const transactions = [
    transaction("apr", "2026-04-10", 200_000),
    transaction("may", "2026-05-10", 200_000),
    transaction("jun", "2026-06-10", 200_000),
    transaction("income", "2026-07-01", 4_000_000, { type: "income", title: "Gaji", category: "Pendapatan" }),
    transaction("food", "2026-07-12", 1_500_000),
    transaction("pending", "2026-07-20", 200_000, { status: "pending" }),
  ];
  const budgets: Budget[] = [{ id: "budget", category: "Makanan", limit: 2_000_000, color: "#126b59", period: "2026-07" }];
  const goals: Goal[] = [{ id: "goal", name: "Dana liburan", target: 10_000_000, current: 4_000_000, deadline: "2026-12-31", color: "#126b59", icon: "target" }];
  const bills: Bill[] = [
    { id: "bill-open", name: "Internet", amount: 500_000, dueDate: "2026-07-25", category: "Tagihan", accountId: "bank", paid: false },
    { id: "bill-done", name: "Cicilan selesai", amount: 700_000, dueDate: "2026-07-10", category: "Tagihan", accountId: "bank", paid: true, completed: true },
  ];

  const review = buildMonthlyReview({ period: "2026-07", accounts, transactions, budgets, goals, bills });

  assert.equal(review.summary.income, 4_000_000);
  assert.equal(review.summary.expense, 1_500_000);
  assert.equal(review.summary.cashflow, 2_500_000);
  assert.equal(review.summary.savingsRate, 62.5);
  assert.equal(review.transactionCount, 2);
  assert.equal(review.pendingCount, 1);
  assert.equal(review.netWorth, 6_900_000);
  assert.equal(review.netWorthChange, 2_500_000);
  assert.equal(review.liabilities, 5_000_000);
  assert.equal(review.budgetSpent, 1_500_000);
  assert.equal(review.budgetRows[0].percent, 75);
  assert.deepEqual(review.topExpenses[0], { label: "Warung", amount: 1_500_000 });
  assert.equal(review.unusualExpenses[0].category, "Makanan");
  assert.equal(review.goals[0].percent, 40);
  assert.equal(review.billsDue, 500_000);
  assert.equal(review.unpaidBills, 1);
});

test("review menolak periode selain YYYY-MM", () => {
  assert.throws(() => buildMonthlyReview({
    period: "Juli 2026",
    accounts: [],
    transactions: [],
    budgets: [],
    goals: [],
    bills: [],
  }), /YYYY-MM/);
});
