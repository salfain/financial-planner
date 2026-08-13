import assert from "node:assert/strict";
import test from "node:test";
import { analyzeFinanceDataQuality, findPotentialDuplicate } from "../lib/data-quality";
import type { Account, FinanceCategory, Transaction } from "../lib/finance";

const accounts: Account[] = [{ id: "bank", name: "Bank", type: "Bank", institution: "", balance: 100_000, openingBalance: 0, mask: "", color: "#126b59" }];
const categories: FinanceCategory[] = [{ id: "food", name: "Makanan", type: "expense", color: "#126b59", active: true }];
const base: Transaction = { id: "tx-1", type: "expense", date: "2026-08-01", title: "Makan siang", merchant: "Warung", category: "Makanan", accountId: "bank", amount: 25_000, status: "completed" };

test("mendeteksi transaksi ganda berdasarkan data finansial utama", () => {
  const duplicate = { ...base, id: "tx-2" };
  assert.equal(findPotentialDuplicate(duplicate, [base]), base);
  const report = analyzeFinanceDataQuality({ accounts, transactions: [base, duplicate], budgets: [], categories, period: "2026-08", now: new Date("2026-08-13T00:00:00Z") });
  assert.equal(report.status, "attention");
  assert.equal(report.issues.find((issue) => issue.id === "duplicates")?.count, 1);
});

test("menandai referensi akun putus dan transaksi pending lama", () => {
  const report = analyzeFinanceDataQuality({
    accounts,
    categories,
    budgets: [],
    period: "2026-08",
    now: new Date("2026-08-13T00:00:00Z"),
    transactions: [
      { ...base, id: "orphan", accountId: "missing" },
      { ...base, id: "pending", date: "2026-08-01", status: "pending" },
    ],
  });
  assert.equal(report.status, "critical");
  assert.equal(report.issues.some((issue) => issue.id === "missing-accounts"), true);
  assert.equal(report.issues.some((issue) => issue.id === "stale-pending"), true);
});

test("transaksi identik yang dikonfirmasi sah tidak lagi dianggap masalah", () => {
  const duplicate = { ...base, id: "tx-2" };
  const report = analyzeFinanceDataQuality({
    accounts,
    transactions: [base, duplicate],
    budgets: [],
    categories,
    period: "2026-08",
    ignoredDuplicateFingerprints: ["expense|2026-08-01|warung|bank||25000"],
  });
  assert.equal(report.issues.some((issue) => issue.id === "duplicates"), false);
});
