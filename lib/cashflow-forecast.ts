import type { Account, Bill, Transaction } from "./finance";

export type CashflowForecastSettings = {
  horizonDays: 30 | 60 | 90;
  monthlyIncomeOverride: number;
  incomeDay: number;
  minimumCashBuffer: number;
};

export type CashflowForecastPoint = {
  date: string;
  balance: number;
  income: number;
  bills: number;
  dailyExpense: number;
};

export type CashflowForecastResult = {
  startingBalance: number;
  endingBalance: number;
  projectedIncome: number;
  projectedBills: number;
  projectedLivingExpense: number;
  monthlyIncome: number;
  monthlyExpense: number;
  observedMonths: number;
  lowestBalance: number;
  lowestBalanceDate: string;
  firstBelowBufferDate: string | null;
  firstNegativeDate: string | null;
  points: CashflowForecastPoint[];
};

export const DEFAULT_CASHFLOW_FORECAST_SETTINGS: CashflowForecastSettings = {
  horizonDays: 60,
  monthlyIncomeOverride: 0,
  incomeDay: 25,
  minimumCashBuffer: 2_000_000,
};

const dateValue = (value: string) => new Date(`${value}T00:00:00Z`);
const dateKey = (value: Date) => value.toISOString().slice(0, 10);
const monthKey = (value: string) => value.slice(0, 7);

function monthAverage(transactions: Transaction[], type: "income" | "expense") {
  const totals = new Map<string, number>();
  transactions.filter((item) => item.type === type && item.status === "completed" && !item.deletedAt)
    .forEach((item) => totals.set(monthKey(item.date), (totals.get(monthKey(item.date)) ?? 0) + item.amount));
  const months = [...totals.values()];
  return { average: months.length ? Math.round(months.reduce((sum, value) => sum + value, 0) / months.length) : 0, months: months.length };
}

function billAmountForDate(bills: Bill[], date: Date) {
  const day = date.getUTCDate();
  const period = dateKey(date).slice(0, 7);
  return bills.filter((bill) => (period !== bill.dueDate.slice(0, 7) || !bill.paid) && Math.min(28, Number(bill.dueDate.slice(8, 10)) || 1) === Math.min(28, day))
    .reduce((sum, bill) => sum + bill.amount, 0);
}

export function buildCashflowForecast(input: {
  accounts: Account[];
  transactions: Transaction[];
  bills: Bill[];
  settings: CashflowForecastSettings;
  asOfDate: string;
}): CashflowForecastResult {
  const { accounts, transactions, bills, settings } = input;
  const startingBalance = accounts.filter((account) => !account.liability && account.type !== "Investment").reduce((sum, account) => sum + account.balance, 0);
  const incomeHistory = monthAverage(transactions, "income");
  const expenseHistory = monthAverage(transactions, "expense");
  const monthlyIncome = settings.monthlyIncomeOverride > 0 ? settings.monthlyIncomeOverride : incomeHistory.average;
  const monthlyBills = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const monthlyLivingExpense = Math.max(0, expenseHistory.average - monthlyBills);
  const dailyExpense = Math.round(monthlyLivingExpense / 30.4375);
  const points: CashflowForecastPoint[] = [{ date: input.asOfDate, balance: startingBalance, income: 0, bills: 0, dailyExpense: 0 }];
  let balance = startingBalance;
  let projectedIncome = 0;
  let projectedBills = 0;
  let projectedLivingExpense = 0;
  let lowestBalance = balance;
  let lowestBalanceDate = input.asOfDate;
  let firstBelowBufferDate: string | null = balance < settings.minimumCashBuffer ? input.asOfDate : null;
  let firstNegativeDate: string | null = balance < 0 ? input.asOfDate : null;
  const date = dateValue(input.asOfDate);

  for (let day = 1; day <= settings.horizonDays; day += 1) {
    date.setUTCDate(date.getUTCDate() + 1);
    const income = date.getUTCDate() === Math.min(28, settings.incomeDay) ? monthlyIncome : 0;
    const dueBills = billAmountForDate(bills, date);
    balance += income - dueBills - dailyExpense;
    projectedIncome += income;
    projectedBills += dueBills;
    projectedLivingExpense += dailyExpense;
    const dateString = dateKey(date);
    if (balance < lowestBalance) { lowestBalance = balance; lowestBalanceDate = dateString; }
    if (!firstBelowBufferDate && balance < settings.minimumCashBuffer) firstBelowBufferDate = dateString;
    if (!firstNegativeDate && balance < 0) firstNegativeDate = dateString;
    points.push({ date: dateString, balance: Math.round(balance), income, bills: dueBills, dailyExpense });
  }

  return {
    startingBalance, endingBalance: Math.round(balance), projectedIncome, projectedBills, projectedLivingExpense,
    monthlyIncome, monthlyExpense: expenseHistory.average, observedMonths: Math.max(incomeHistory.months, expenseHistory.months),
    lowestBalance: Math.round(lowestBalance), lowestBalanceDate, firstBelowBufferDate, firstNegativeDate, points,
  };
}
