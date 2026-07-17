import assert from "node:assert/strict";
import test from "node:test";
import {
  Account,
  Transaction,
  accountSummary,
  applyTransaction,
  budgetSpent,
  monthlySummary,
  weightedAverageCost,
} from "../lib/finance";

const accounts: Account[] = [
  { id: "bank", name: "Bank", type: "Bank", institution: "Bank", balance: 10_000_000, mask: "01", color: "#000" },
  { id: "wallet", name: "Wallet", type: "E-Wallet", institution: "Wallet", balance: 2_000_000, mask: "02", color: "#000" },
  { id: "card", name: "Card", type: "Credit Card", institution: "Card", balance: 1_000_000, mask: "03", color: "#000", liability: true },
];

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: "tx",
  type: "expense",
  date: "2026-07-17",
  title: "Test",
  category: "Makanan",
  accountId: "bank",
  amount: 100_000,
  status: "completed",
  ...overrides,
});

test("transfer tidak dihitung sebagai income atau expense", () => {
  const result = monthlySummary([
    tx({ type: "income", amount: 5_000_000 }),
    tx({ type: "expense", amount: 1_250_000 }),
    tx({ type: "transfer", amount: 3_000_000, destinationAccountId: "wallet" }),
    tx({ type: "investment_buy", amount: 500_000, destinationAccountId: "wallet" }),
  ]);
  assert.equal(result.income, 5_000_000);
  assert.equal(result.expense, 1_250_000);
  assert.equal(result.cashflow, 3_750_000);
  assert.equal(result.savingsRate, 75);
});

test("transfer memperbarui dua sisi dan tidak mengubah kekayaan bersih", () => {
  const before = accountSummary(accounts).netWorth;
  const updated = applyTransaction(accounts, tx({ type: "transfer", amount: 2_000_000, destinationAccountId: "wallet" }));
  assert.equal(updated.find((item) => item.id === "bank")?.balance, 8_000_000);
  assert.equal(updated.find((item) => item.id === "wallet")?.balance, 4_000_000);
  assert.equal(accountSummary(updated).netWorth, before);
});

test("pembelian dengan kartu kredit menambah kewajiban", () => {
  const updated = applyTransaction(accounts, tx({ type: "expense", accountId: "card", amount: 250_000 }));
  assert.equal(updated.find((item) => item.id === "card")?.balance, 1_250_000);
});

test("refund mengurangi realisasi anggaran", () => {
  const spent = budgetSpent([
    tx({ type: "expense", amount: 600_000 }),
    tx({ id: "refund", type: "refund", amount: 100_000 }),
    tx({ id: "transfer", type: "transfer", amount: 1_000_000 }),
  ], "Makanan");
  assert.equal(spent, 500_000);
});

test("weighted average cost memasukkan fee", () => {
  const average = weightedAverageCost(10, 1_000, 5, 1_300, 150);
  assert.equal(average, 1_110);
});
