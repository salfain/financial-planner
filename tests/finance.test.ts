import assert from "node:assert/strict";
import test from "node:test";
import {
  Account,
  Budget,
  LedgerError,
  Transaction,
  accountSummary,
  applyTransaction,
  budgetSpent,
  calculateHealthScore,
  formatMonthLabel,
  getCurrentMonth,
  monthlySummary,
  recomputeAccountBalances,
  reverseTransaction,
  softDeleteTransaction,
  weightedAverageCost,
} from "../lib/finance";
import {
  calculateInvestmentBuy,
  calculateInvestmentSell,
  toUnitMicro,
} from "../lib/investment";

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
  ], "2026-07");
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
  ], "Makanan", "2026-07");
  assert.equal(spent, 500_000);
});

test("penyesuaian saldo mengikuti arah ekonomi aset dan kewajiban", () => {
  const assetIn = tx({ id: "asset-in", type: "adjustment_in", amount: 500_000 });
  const assetOut = tx({ id: "asset-out", type: "adjustment_out", amount: 300_000 });
  const debtDown = tx({ id: "debt-down", type: "adjustment_in", accountId: "card", amount: 200_000 });
  const debtUp = tx({ id: "debt-up", type: "adjustment_out", accountId: "card", amount: 400_000 });

  assert.equal(applyTransaction(accounts, assetIn).find((item) => item.id === "bank")?.balance, 10_500_000);
  assert.equal(applyTransaction(accounts, assetOut).find((item) => item.id === "bank")?.balance, 9_700_000);
  assert.equal(applyTransaction(accounts, debtDown).find((item) => item.id === "card")?.balance, 800_000);
  assert.equal(applyTransaction(accounts, debtUp).find((item) => item.id === "card")?.balance, 1_400_000);

  const adjusted = [assetIn, debtDown].reduce(applyTransaction, accounts);
  assert.equal(accountSummary(adjusted).netWorth, accountSummary(accounts).netWorth + 700_000);
  assert.deepEqual(reverseTransaction(applyTransaction(accounts, debtUp), debtUp), accounts);
});

test("penyesuaian mengubah ledger tetapi tidak masuk cashflow atau anggaran", () => {
  const transactions = [
    tx({ id: "income", type: "income", amount: 2_000_000 }),
    tx({ id: "expense", type: "expense", amount: 600_000 }),
    tx({ id: "adjust-in", type: "adjustment_in", amount: 900_000 }),
    tx({ id: "adjust-out", type: "adjustment_out", amount: 450_000 }),
  ];
  const summary = monthlySummary(transactions, "2026-07");
  assert.deepEqual(
    { income: summary.income, expense: summary.expense, cashflow: summary.cashflow },
    { income: 2_000_000, expense: 600_000, cashflow: 1_400_000 },
  );
  assert.equal(budgetSpent(transactions, "Makanan", "2026-07"), 600_000);
});

test("soft delete penyesuaian mengembalikan saldo tepat satu kali", () => {
  const adjustment = tx({ id: "reconcile", type: "adjustment_out", accountId: "card", amount: 250_000 });
  const posted = applyTransaction(accounts, adjustment);
  assert.equal(posted.find((item) => item.id === "card")?.balance, 1_250_000);
  const deleted = softDeleteTransaction(posted, [adjustment], adjustment.id);
  assert.deepEqual(deleted.accounts, accounts);
  assert.equal(deleted.changed, true);
  assert.equal(softDeleteTransaction(deleted.accounts, deleted.transactions, adjustment.id).changed, false);
});

test("weighted average cost memasukkan fee", () => {
  const average = weightedAverageCost(10, 1_000, 5, 1_300, 150);
  assert.equal(average, 1_110);
});

test("investment buy menambah unit dan cost basis termasuk fee serta pajak", () => {
  const result = calculateInvestmentBuy(
    { unitsMicro: toUnitMicro(10), costBasis: 10_000, realizedPl: 0 },
    { units: 5, pricePerUnit: 1_300, fee: 100, tax: 50 },
  );
  assert.equal(result.grossAmount, 6_500);
  assert.equal(result.netAmount, 6_650);
  assert.equal(result.remainingUnitsMicro, toUnitMicro(15));
  assert.equal(result.costBasis, 16_650);
  assert.equal(result.averageCostAfter, 1_110);
});

test("investment sell memakai weighted average dan memisahkan realized P/L", () => {
  const result = calculateInvestmentSell(
    { unitsMicro: toUnitMicro(15), costBasis: 16_650, realizedPl: 400 },
    { units: 6, pricePerUnit: 1_500, fee: 100, tax: 50 },
  );
  assert.equal(result.netAmount, 8_850);
  assert.equal(result.costBasisSold, 6_660);
  assert.equal(result.realizedPl, 2_190);
  assert.equal(result.realizedPlTotal, 2_590);
  assert.equal(result.remainingUnitsMicro, toUnitMicro(9));
  assert.equal(result.costBasis, 9_990);
});

test("investment sell menolak oversell dan sell all menutup cost basis", () => {
  assert.throws(
    () => calculateInvestmentSell(
      { unitsMicro: toUnitMicro(2.5), costBasis: 5_000, realizedPl: 0 },
      { units: 3, pricePerUnit: 2_500 },
    ),
    /melebihi unit tersedia/,
  );
  const closed = calculateInvestmentSell(
    { unitsMicro: toUnitMicro(2.5), costBasis: 5_000, realizedPl: 0 },
    { units: 2.5, pricePerUnit: 2_200 },
  );
  assert.equal(closed.remainingUnitsMicro, 0);
  assert.equal(closed.costBasis, 0);
  assert.equal(closed.realizedPl, 500);
});

test("bulan berjalan memakai zona waktu Jakarta dan label Indonesia", () => {
  const utcJuneJakartaJuly = new Date("2026-06-30T17:30:00.000Z");
  assert.equal(getCurrentMonth(utcJuneJakartaJuly), "2026-07");
  assert.equal(getCurrentMonth(utcJuneJakartaJuly, "UTC"), "2026-06");
  assert.match(formatMonthLabel("2026-07").toLocaleLowerCase("id-ID"), /juli 2026/);
});

test("ringkasan bulanan dapat dipilih dan mengabaikan pending serta Trash", () => {
  const transactions = [
    tx({ id: "jul-income", type: "income", amount: 2_000_000 }),
    tx({ id: "jul-expense", type: "expense", amount: 500_000 }),
    tx({ id: "jul-refund", type: "refund", amount: 100_000 }),
    tx({ id: "pending", type: "expense", amount: 900_000, status: "pending" }),
    tx({ id: "deleted", type: "expense", amount: 700_000, deletedAt: "2026-07-18T00:00:00.000Z" }),
    tx({ id: "aug-expense", type: "expense", date: "2026-08-01", amount: 250_000 }),
  ];

  const july = monthlySummary(transactions, { month: "2026-07" });
  assert.deepEqual(
    { month: july.month, income: july.income, gross: july.grossExpense, refund: july.refund, expense: july.expense, cashflow: july.cashflow },
    { month: "2026-07", income: 2_000_000, gross: 500_000, refund: 100_000, expense: 400_000, cashflow: 1_600_000 },
  );
  assert.equal(monthlySummary(transactions, "2026-08").expense, 250_000);
  assert.equal(monthlySummary(transactions, { month: "2026-07", includePending: true }).expense, 1_300_000);
  assert.throws(() => monthlySummary(transactions, "2026-13"), RangeError);
});

test("transaksi pending tidak mengubah saldo", () => {
  const pending = tx({ status: "pending", amount: 500_000 });
  assert.equal(applyTransaction(accounts, pending), accounts);
});

test("transfer divalidasi sebelum kedua saldo diubah", () => {
  const snapshot = structuredClone(accounts);
  const assertLedgerCode = (code: LedgerError["code"]) => (error: unknown) =>
    error instanceof LedgerError && error.code === code;

  assert.throws(
    () => applyTransaction(accounts, tx({ type: "transfer", destinationAccountId: undefined })),
    assertLedgerCode("TRANSFER_DESTINATION_REQUIRED"),
  );
  assert.throws(
    () => applyTransaction(accounts, tx({ type: "transfer", destinationAccountId: "bank" })),
    assertLedgerCode("TRANSFER_SAME_ACCOUNT"),
  );
  assert.throws(
    () => applyTransaction(accounts, tx({ type: "transfer", destinationAccountId: "missing" })),
    assertLedgerCode("ACCOUNT_NOT_FOUND"),
  );
  assert.throws(
    () => applyTransaction(accounts, tx({ type: "transfer", amount: 0, destinationAccountId: "wallet" })),
    assertLedgerCode("INVALID_AMOUNT"),
  );
  assert.deepEqual(accounts, snapshot);
});

test("transfer ke kartu kredit membayar kewajiban tanpa mengubah kekayaan bersih", () => {
  const before = accountSummary(accounts).netWorth;
  const updated = applyTransaction(accounts, tx({
    type: "transfer",
    amount: 400_000,
    destinationAccountId: "card",
  }));
  assert.equal(updated.find((item) => item.id === "bank")?.balance, 9_600_000);
  assert.equal(updated.find((item) => item.id === "card")?.balance, 600_000);
  assert.equal(accountSummary(updated).netWorth, before);
});

test("inverse transaksi mengembalikan saldo secara tepat", () => {
  const transfer = tx({ type: "transfer", amount: 750_000, destinationAccountId: "card" });
  const applied = applyTransaction(accounts, transfer);
  assert.deepEqual(reverseTransaction(applied, transfer), accounts);

  const refundBeyondLiability = tx({ type: "refund", accountId: "card", amount: 1_500_000 });
  const refunded = applyTransaction(accounts, refundBeyondLiability);
  assert.equal(refunded.find((item) => item.id === "card")?.balance, -500_000);
  assert.deepEqual(reverseTransaction(refunded, refundBeyondLiability), accounts);
});

test("saldo dapat direkonstruksi dari opening balance dan ledger aktif", () => {
  const ledgerAccounts: Account[] = accounts.map((account) => ({
    ...account,
    openingBalance: account.balance,
    balance: 999,
  }));
  const ledger = [
    tx({ id: "income", type: "income", amount: 1_000_000 }),
    tx({ id: "transfer", type: "transfer", amount: 2_000_000, destinationAccountId: "wallet" }),
    tx({ id: "pending", type: "expense", amount: 500_000, status: "pending" }),
    tx({ id: "trash", type: "expense", amount: 600_000, deletedAt: "2026-07-18T00:00:00.000Z" }),
  ];
  const recomputed = recomputeAccountBalances(ledgerAccounts, ledger);
  assert.equal(recomputed.find((item) => item.id === "bank")?.balance, 9_000_000);
  assert.equal(recomputed.find((item) => item.id === "wallet")?.balance, 4_000_000);

  assert.throws(
    () => recomputeAccountBalances(ledgerAccounts, [ledger[0], { ...ledger[0] }]),
    (error: unknown) => error instanceof LedgerError && error.code === "DUPLICATE_TRANSACTION",
  );
});

test("soft delete membalik transfer satu kali dan menyimpannya di Trash", () => {
  const transfer = tx({ id: "delete-me", type: "transfer", amount: 2_000_000, destinationAccountId: "wallet" });
  const posted = applyTransaction(accounts, transfer);
  const deleted = softDeleteTransaction(posted, [transfer], transfer.id, "2026-07-18T00:00:00.000Z");

  assert.equal(deleted.changed, true);
  assert.deepEqual(deleted.accounts, accounts);
  assert.equal(deleted.transactions[0].deletedAt, "2026-07-18T00:00:00.000Z");
  assert.equal(monthlySummary(deleted.transactions, "2026-07").income, 0);

  const deletedAgain = softDeleteTransaction(deleted.accounts, deleted.transactions, transfer.id);
  assert.equal(deletedAgain.changed, false);
  assert.equal(deletedAgain.accounts, deleted.accounts);
});

test("health score menggunakan bulan yang dipilih", () => {
  const budgets: Budget[] = [{ id: "food", category: "Makanan", limit: 2_000_000, color: "#000" }];
  const transactions = [
    tx({ id: "jul-income", type: "income", amount: 10_000_000 }),
    tx({ id: "jul-expense", type: "expense", amount: 500_000 }),
    tx({ id: "aug-income", type: "income", date: "2026-08-01", amount: 2_000_000 }),
    tx({ id: "aug-expense", type: "expense", date: "2026-08-02", amount: 3_000_000 }),
  ];
  const july = calculateHealthScore(transactions, accounts, budgets, "2026-07");
  const august = calculateHealthScore(transactions, accounts, budgets, { month: "2026-08" });
  assert.ok(july > august, `Skor Juli (${july}) seharusnya lebih tinggi dari Agustus (${august}).`);
});
