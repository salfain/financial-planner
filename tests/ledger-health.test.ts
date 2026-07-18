import assert from "node:assert/strict";
import test from "node:test";
import { calculateLedgerHealth, type LedgerAccountSource, type LedgerTransactionSource } from "../lib/ledger";

const accounts: LedgerAccountSource[] = [
  { id: "cash", name: "Kas", openingBalance: 1_000_000, storedBalance: 1_200_000, liability: false, active: true },
  { id: "card", name: "Kartu", openingBalance: 0, storedBalance: 200_000, liability: true, active: true },
];

const transaction = (input: Partial<LedgerTransactionSource> & Pick<LedgerTransactionSource, "id" | "type" | "amount" | "accountId">): LedgerTransactionSource => ({
  status: "completed",
  destinationAccountId: null,
  deletedAt: null,
  ...input,
});

test("pemeriksaan ledger merekonstruksi aset, kewajiban, dan transfer", () => {
  const report = calculateLedgerHealth(accounts.map((account) => account.id === "card" ? { ...account, storedBalance: 0 } : account), [
    transaction({ id: "income", type: "income", amount: 500_000, accountId: "cash" }),
    transaction({ id: "expense", type: "expense", amount: 100_000, accountId: "cash" }),
    transaction({ id: "card-expense", type: "expense", amount: 200_000, accountId: "card" }),
    transaction({ id: "card-payment", type: "transfer", amount: 200_000, accountId: "cash", destinationAccountId: "card" }),
  ]);
  assert.equal(report.status, "healthy");
  assert.equal(report.accounts.find((item) => item.id === "cash")?.expectedBalance, 1_200_000);
  assert.equal(report.accounts.find((item) => item.id === "card")?.expectedBalance, 0);
});

test("pemeriksaan ledger mengabaikan pending dan Trash serta menemukan drift", () => {
  const report = calculateLedgerHealth([
    { ...accounts[0], storedBalance: 1_000_000 },
  ], [
    transaction({ id: "valid", type: "income", amount: 250_000, accountId: "cash" }),
    transaction({ id: "pending", type: "expense", amount: 500_000, accountId: "cash", status: "pending" }),
    transaction({ id: "deleted", type: "expense", amount: 500_000, accountId: "cash", deletedAt: "2026-01-01" }),
  ]);
  assert.equal(report.status, "needs_repair");
  assert.equal(report.summary.driftCount, 1);
  assert.equal(report.accounts[0].expectedBalance, 1_250_000);
  assert.equal(report.accounts[0].difference, 250_000);
});

test("referensi akun rusak memblokir repair", () => {
  const report = calculateLedgerHealth(accounts, [
    transaction({ id: "broken", type: "transfer", amount: 50_000, accountId: "cash", destinationAccountId: "missing" }),
  ]);
  assert.equal(report.status, "blocked");
  assert.equal(report.canRepair, false);
  assert.equal(report.issues[0].code, "MISSING_DESTINATION");
});
