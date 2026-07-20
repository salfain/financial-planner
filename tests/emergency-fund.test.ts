import test from "node:test";
import assert from "node:assert/strict";
import { buildEmergencyFundPlan, DEFAULT_EMERGENCY_FUND_SETTINGS } from "../lib/emergency-fund";
import type { Account, Transaction } from "../lib/finance";

const accounts: Account[] = [
  { id: "bank", name: "Bank", type: "Bank", institution: "", balance: 12_000_000, mask: "", color: "#000" },
  { id: "invest", name: "Investasi", type: "Investment", institution: "", balance: 50_000_000, mask: "", color: "#000" },
];
const transactions: Transaction[] = [
  { id: "i", type: "income", date: "2026-06-01", title: "Gaji", category: "Pendapatan", accountId: "bank", amount: 10_000_000, status: "completed" },
  { id: "e", type: "expense", date: "2026-06-02", title: "Biaya hidup", category: "Kebutuhan", accountId: "bank", amount: 4_000_000, status: "completed" },
];

test("emergency fund excludes investment accounts and calculates coverage", () => {
  const result = buildEmergencyFundPlan({ accounts, transactions, settings: DEFAULT_EMERGENCY_FUND_SETTINGS, asOfMonth: "2026-07" });
  assert.equal(result.currentFund, 12_000_000);
  assert.equal(result.targetAmount, 24_000_000);
  assert.equal(result.coverageMonths, 3);
  assert.equal(result.status, "building");
});

test("contribution produces a projected completion month", () => {
  const result = buildEmergencyFundPlan({ accounts, transactions, settings: { ...DEFAULT_EMERGENCY_FUND_SETTINGS, monthlyContribution: 2_000_000 }, asOfMonth: "2026-07" });
  assert.equal(result.monthsToGoal, 6);
  assert.equal(result.projectedMonth, "2027-01");
  assert.ok(result.safetyScore > 30);
});

test("selected accounts and expense override are respected", () => {
  const result = buildEmergencyFundPlan({ accounts, transactions, settings: { ...DEFAULT_EMERGENCY_FUND_SETTINGS, targetMonths: 3, monthlyExpenseOverride: 6_000_000, accountIds: ["bank"] }, asOfMonth: "2026-07" });
  assert.equal(result.targetAmount, 18_000_000);
  assert.deepEqual(result.accountIds, ["bank"]);
});
