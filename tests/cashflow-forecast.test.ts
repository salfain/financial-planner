import test from "node:test";
import assert from "node:assert/strict";
import { buildCashflowForecast, DEFAULT_CASHFLOW_FORECAST_SETTINGS, type CashflowForecastSettings } from "../lib/cashflow-forecast";
import type { Account, Bill, Transaction } from "../lib/finance";

const accounts: Account[] = [{ id: "cash", name: "Bank", type: "Bank", institution: "", balance: 5_000_000, mask: "", color: "#000", liability: false }];
const transactions: Transaction[] = [
  { id: "i1", type: "income", date: "2026-06-25", title: "Gaji", category: "Pendapatan", accountId: "cash", amount: 10_000_000, status: "completed" },
  { id: "e1", type: "expense", date: "2026-06-10", title: "Hidup", category: "Lainnya", accountId: "cash", amount: 4_000_000, status: "completed" },
];
const bills: Bill[] = [{ id: "bill", name: "Sewa", amount: 1_000_000, dueDate: "2026-06-05", category: "Tagihan", accountId: "cash", paid: false }];

test("forecast schedules income, bills, and daily living expense", () => {
  const result = buildCashflowForecast({ accounts, transactions, bills, settings: { ...DEFAULT_CASHFLOW_FORECAST_SETTINGS, horizonDays: 30 }, asOfDate: "2026-07-01" });
  assert.equal(result.startingBalance, 5_000_000);
  assert.equal(result.projectedIncome, 10_000_000);
  assert.equal(result.projectedBills, 1_000_000);
  assert.ok(result.endingBalance > result.startingBalance);
  assert.equal(result.observedMonths, 1);
});

test("forecast memakai nominal fase cicilan yang sesuai bulan", () => {
  const result = buildCashflowForecast({
    accounts,
    transactions: [],
    bills: [{
      id: "kredivo",
      name: "Pinjaman Kredivo",
      amount: 450_000,
      dueDate: "2026-07-05",
      category: "Tagihan",
      accountId: "cash",
      paid: false,
      durationMonths: 12,
      paidCount: 5,
      remainingMonths: 7,
      installmentPhases: [
        { label: "0% bunga", durationMonths: 6, amount: 450_000 },
        { label: "Dengan bunga", durationMonths: 6, amount: 567_520 },
      ],
    }],
    settings: { ...DEFAULT_CASHFLOW_FORECAST_SETTINGS, horizonDays: 60 },
    asOfDate: "2026-07-01",
  });
  const scheduled = result.points.filter((point) => point.bills > 0).map((point) => point.bills);
  assert.deepEqual(scheduled.slice(0, 2), [450_000, 567_520]);
});

test("forecast reports first negative date and minimum buffer breach", () => {
  const result = buildCashflowForecast({ accounts: [{ ...accounts[0], balance: 500_000 }], transactions: [], bills, settings: { ...DEFAULT_CASHFLOW_FORECAST_SETTINGS, horizonDays: 30, minimumCashBuffer: 400_000 }, asOfDate: "2026-07-01" });
  assert.ok(result.firstNegativeDate);
  assert.ok(result.firstBelowBufferDate);
  assert.ok(result.lowestBalance < 0);
});

test("manual monthly income overrides historical average", () => {
  const result = buildCashflowForecast({ accounts, transactions, bills: [], settings: { ...DEFAULT_CASHFLOW_FORECAST_SETTINGS, horizonDays: 30, monthlyIncomeOverride: 7_000_000 }, asOfDate: "2026-07-01" });
  assert.equal(result.monthlyIncome, 7_000_000);
  assert.equal(result.projectedIncome, 7_000_000);
});

test("forecast stops a Paylater installment after its configured duration", () => {
  const result = buildCashflowForecast({
    accounts,
    transactions: [],
    bills: [{
      id: "installment",
      name: "Cicilan laptop",
      amount: 1_000_000,
      dueDate: "2026-07-05",
      startDueDate: "2026-07-05",
      category: "Tagihan",
      accountId: "cash",
      liabilityAccountId: "card",
      durationMonths: 2,
      paidCount: 0,
      paid: false,
    }],
    settings: { ...DEFAULT_CASHFLOW_FORECAST_SETTINGS, horizonDays: 90 },
    asOfDate: "2026-07-01",
  });
  assert.equal(result.projectedBills, 2_000_000);
});

test("forecast only projects the remaining months of a historical installment", () => {
  const result = buildCashflowForecast({
    accounts: [{ id: "cash", name: "Kas", type: "Bank", institution: "", mask: "", balance: 20_000_000, color: "#126b59", liability: false }],
    transactions: [],
    bills: [{
      id: "historical-installment",
      name: "Cicilan 2 dari 9",
      amount: 1_000_000,
      dueDate: "2026-07-05",
      startDueDate: "2026-07-05",
      category: "Tagihan",
      accountId: "cash",
      liabilityAccountId: "card",
      durationMonths: 9,
      paidCount: 2,
      remainingMonths: 7,
      paid: false,
    }],
    // Horizon sengaja melewati pilihan UI (30/60/90) agar batas sisa cicilan benar-benar teruji.
    settings: { ...DEFAULT_CASHFLOW_FORECAST_SETTINGS, horizonDays: 365 as CashflowForecastSettings["horizonDays"] },
    asOfDate: "2026-07-01",
  });
  assert.equal(result.projectedBills, 7_000_000);
});
