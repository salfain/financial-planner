import type { Account, Transaction } from "./finance";

export type EmergencyFundSettings = {
  targetMonths: 3 | 6 | 9 | 12;
  monthlyExpenseOverride: number;
  monthlyContribution: number;
  accountIds: string[];
};

export type EmergencyFundResult = {
  monthlyExpense: number;
  monthlyIncome: number;
  observedMonths: number;
  currentFund: number;
  targetAmount: number;
  gap: number;
  coverageMonths: number;
  progressPct: number;
  monthsToGoal: number | null;
  projectedMonth: string | null;
  safetyScore: number;
  status: "critical" | "building" | "ready";
  accountIds: string[];
};

export const DEFAULT_EMERGENCY_FUND_SETTINGS: EmergencyFundSettings = {
  targetMonths: 6,
  monthlyExpenseOverride: 0,
  monthlyContribution: 0,
  accountIds: [],
};

function monthlyAverage(transactions: Transaction[], type: "income" | "expense") {
  const totals = new Map<string, number>();
  transactions.filter((item) => item.type === type && item.status === "completed" && !item.deletedAt)
    .forEach((item) => totals.set(item.date.slice(0, 7), (totals.get(item.date.slice(0, 7)) ?? 0) + item.amount));
  const values = [...totals.values()];
  return { average: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0, months: values.length };
}

function addMonths(period: string, months: number) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildEmergencyFundPlan(input: { accounts: Account[]; transactions: Transaction[]; settings: EmergencyFundSettings; asOfMonth: string }): EmergencyFundResult {
  const expenseHistory = monthlyAverage(input.transactions, "expense");
  const incomeHistory = monthlyAverage(input.transactions, "income");
  const monthlyExpense = input.settings.monthlyExpenseOverride > 0 ? input.settings.monthlyExpenseOverride : expenseHistory.average;
  const eligible = input.accounts.filter((account) => !account.liability && account.type !== "Investment");
  const selectedIds = input.settings.accountIds.filter((id) => eligible.some((account) => account.id === id));
  const effectiveIds = selectedIds.length ? selectedIds : eligible.map((account) => account.id);
  const currentFund = eligible.filter((account) => effectiveIds.includes(account.id)).reduce((sum, account) => sum + account.balance, 0);
  const targetAmount = monthlyExpense * input.settings.targetMonths;
  const gap = Math.max(0, targetAmount - currentFund);
  const coverageMonths = monthlyExpense > 0 ? currentFund / monthlyExpense : 0;
  const progressPct = targetAmount > 0 ? Math.min(100, currentFund / targetAmount * 100) : 0;
  const monthsToGoal = gap === 0 ? 0 : input.settings.monthlyContribution > 0 ? Math.ceil(gap / input.settings.monthlyContribution) : null;
  const projectedMonth = monthsToGoal === null ? null : addMonths(input.asOfMonth, monthsToGoal);
  const coverageScore = targetAmount > 0 ? Math.min(60, currentFund / targetAmount * 60) : 0;
  const contributionScore = gap === 0 ? 20 : input.settings.monthlyContribution > 0 && monthlyExpense > 0 ? Math.min(20, input.settings.monthlyContribution / (monthlyExpense * .1) * 20) : 0;
  const cashflowScore = incomeHistory.average > 0 ? Math.max(0, Math.min(20, (incomeHistory.average - monthlyExpense) / incomeHistory.average * 100)) : 0;
  const safetyScore = Math.round(Math.max(0, Math.min(100, coverageScore + contributionScore + cashflowScore)));
  const status = targetAmount > 0 && currentFund >= targetAmount ? "ready" : coverageMonths >= 1 ? "building" : "critical";
  return { monthlyExpense, monthlyIncome: incomeHistory.average, observedMonths: Math.max(expenseHistory.months, incomeHistory.months), currentFund, targetAmount, gap, coverageMonths, progressPct, monthsToGoal, projectedMonth, safetyScore, status, accountIds: effectiveIds };
}
