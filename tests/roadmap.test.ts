import assert from "node:assert/strict";
import test from "node:test";
import type { Account, Goal, Transaction } from "../lib/finance";
import { buildFinancialRoadmap, DEFAULT_ROADMAP_SETTINGS } from "../lib/roadmap";

const accounts: Account[] = [
  { id: "cash", name: "Kas", type: "Bank", institution: "", balance: 20_000_000, mask: "", color: "#126b59" },
  { id: "invest", name: "Investasi", type: "Investment", institution: "", balance: 5_000_000, mask: "", color: "#5574b8" },
];

const transaction = (id: string, date: string, type: Transaction["type"], amount: number): Transaction => ({
  id, date, type, amount, accountId: "cash", title: id, category: type === "income" ? "Pendapatan" : "Makanan", status: "completed",
});

test("roadmap memproyeksikan tiga skenario dari rata-rata arus kas", () => {
  const transactions = [
    transaction("income-1", "2026-06-01", "income", 10_000_000),
    transaction("expense-1", "2026-06-02", "expense", 6_000_000),
    transaction("income-2", "2026-07-01", "income", 10_000_000),
    transaction("expense-2", "2026-07-02", "expense", 6_000_000),
    transaction("transfer", "2026-07-03", "transfer", 4_000_000),
  ];
  const result = buildFinancialRoadmap({
    transactions,
    accounts,
    goals: [],
    investmentMarketValue: 5_000_000,
    settings: { ...DEFAULT_ROADMAP_SETTINGS, horizonMonths: 12, annualInflationPct: 0, annualInvestmentReturnPct: 0 },
    asOfMonth: "2026-07",
  });
  assert.equal(result.observedMonths, 2);
  assert.equal(result.baseline.monthlyIncome, 10_000_000);
  assert.equal(result.baseline.monthlyExpense, 6_000_000);
  assert.equal(result.baseline.startingNetWorth, 25_000_000);
  assert.equal(result.scenarios.length, 3);
  assert.equal(result.scenarios.find((scenario) => scenario.key === "base")?.finalNetWorth, 73_000_000);
});

test("roadmap menandai defisit dan menilai keterjangkauan target", () => {
  const goals: Goal[] = [
    { id: "goal-fast", name: "Dana darurat", target: 12_000_000, current: 0, deadline: "2026-10-31", color: "#126b59", icon: "target" },
    { id: "goal-large", name: "Rumah", target: 500_000_000, current: 0, deadline: "2027-07-31", color: "#5574b8", icon: "home" },
  ];
  const result = buildFinancialRoadmap({
    transactions: [transaction("income", "2026-07-01", "income", 10_000_000), transaction("expense", "2026-07-02", "expense", 12_000_000)],
    accounts,
    goals,
    investmentMarketValue: 5_000_000,
    settings: { ...DEFAULT_ROADMAP_SETTINGS, horizonMonths: 12 },
    asOfMonth: "2026-07",
  });
  assert.equal(result.scenarios.find((scenario) => scenario.key === "base")?.deficitMonths, 12);
  assert.equal(result.goalForecasts[0].onTrack, false);
  assert.equal(result.goalForecasts[0].projectedMonth, undefined);
});
