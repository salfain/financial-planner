import test from "node:test";
import assert from "node:assert/strict";
import { addMonthsToPeriod, compareDebtStrategies, simulateDebtPayoff, type DebtPlan } from "../lib/debt";

const plans: DebtPlan[] = [
  { accountId: "card", name: "Kartu", balance: 10_000_000, annualInterestRatePct: 24, minimumPayment: 500_000, dueDay: 10 },
  { accountId: "loan", name: "Pinjaman", balance: 5_000_000, annualInterestRatePct: 10, minimumPayment: 300_000, dueDay: 20 },
];

test("debt payoff reaches zero and records payoff months", () => {
  const result = simulateDebtPayoff(plans, { strategy: "avalanche", extraMonthlyPayment: 700_000 });
  assert.equal(result.nonAmortizing, false);
  assert.equal(result.schedule.at(-1)?.balance, 0);
  assert.ok(result.months > 0 && result.months < 24);
  assert.ok(result.debts.every((debt) => debt.payoffMonth !== null));
  assert.equal(result.monthlyCommitment, 1_500_000);
});

test("avalanche does not cost more interest than snowball for sample debts", () => {
  const comparison = compareDebtStrategies(plans, 200_000);
  assert.ok(comparison.avalanche.totalInterest <= comparison.snowball.totalInterest);
});

test("non-amortizing plan is reported instead of promising a false payoff date", () => {
  const result = simulateDebtPayoff([
    { accountId: "bad", name: "Utang", balance: 10_000_000, annualInterestRatePct: 120, minimumPayment: 100_000, dueDay: 1 },
  ], { strategy: "avalanche", extraMonthlyPayment: 0 }, 24);
  assert.equal(result.nonAmortizing, true);
  assert.equal(result.debts[0].payoffMonth, null);
});

test("adds months across year boundaries", () => {
  assert.equal(addMonthsToPeriod("2026-11", 3), "2027-02");
});
