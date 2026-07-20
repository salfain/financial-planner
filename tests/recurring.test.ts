import assert from "node:assert/strict";
import test from "node:test";
import { addRecurringPeriod, buildRecurringOverview, monthlyEquivalent, recurringOccurrences, type RecurringTemplate } from "../lib/recurring";

const template = (patch: Partial<RecurringTemplate> = {}): RecurringTemplate => ({
  id: "rec-1", name: "Internet", type: "expense", amount: 600_000, category: "Tagihan", accountId: "bank",
  frequency: "monthly", startDate: "2026-01-31", nextDueDate: "2026-01-31", isSubscription: true, active: true, ...patch,
});

test("jadwal bulanan mempertahankan tanggal akhir bulan secara aman", () => {
  assert.equal(addRecurringPeriod("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(addRecurringPeriod("2024-01-31", "monthly"), "2024-02-29");
  assert.equal(addRecurringPeriod("2026-11-30", "quarterly"), "2027-02-28");
});

test("ekuivalen bulanan menangani semua frekuensi", () => {
  assert.equal(monthlyEquivalent(120_000, "weekly"), 520_000);
  assert.equal(monthlyEquivalent(900_000, "quarterly"), 300_000);
  assert.equal(monthlyEquivalent(1_200_000, "yearly"), 100_000);
});

test("overview memisahkan pemasukan, komitmen, subscription, dan overdue", () => {
  const result = buildRecurringOverview([
    template(),
    template({ id: "salary", name: "Gaji", type: "income", amount: 12_000_000, isSubscription: false, nextDueDate: "2026-02-25" }),
    template({ id: "paused", active: false, amount: 999_000 }),
  ], "2026-02-01", 30);
  assert.equal(result.monthlyIncome, 12_000_000);
  assert.equal(result.monthlyExpense, 600_000);
  assert.equal(result.annualSubscriptions, 7_200_000);
  assert.equal(result.overdueCount, 1);
  assert.equal(result.upcomingCount, 3);
});

test("jadwal nonaktif tidak menghasilkan occurrence", () => {
  assert.deepEqual(recurringOccurrences(template({ active: false }), "2026-12-31"), []);
});
