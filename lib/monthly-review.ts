import {
  accountSummary,
  budgetSpent,
  monthlySummary,
  type Account,
  type Bill,
  type Budget,
  type Goal,
  type Transaction,
} from "./finance";

export type MonthlyReview = {
  period: string;
  summary: ReturnType<typeof monthlySummary>;
  transactionCount: number;
  pendingCount: number;
  netWorth: number;
  netWorthChange: number;
  liabilities: number;
  liabilityChange: number;
  budgetLimit: number;
  budgetSpent: number;
  budgetRows: Array<{ category: string; limit: number; spent: number; percent: number }>;
  topExpenses: Array<{ label: string; amount: number }>;
  unusualExpenses: Array<{ category: string; amount: number; average: number; reason: string }>;
  goals: Array<{ id: string; name: string; current: number; target: number; percent: number }>;
  billsDue: number;
  unpaidBills: number;
};

export type MonthlyClosing = {
  period: string;
  status: "closed" | "open";
  closedAt: string | null;
  reopenedAt?: string | null;
  snapshot: MonthlyReview | null;
};

const assertPeriod = (period: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new RangeError("Periode harus berformat YYYY-MM.");
  return period;
};

const shiftMonth = (period: string, amount: number) => {
  const [year, month] = assertPeriod(period).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

function balancesAt(accounts: Account[], transactions: Transaction[], period: string) {
  const balances = new Map(accounts.map((account) => [account.id, account.openingBalance ?? account.balance]));
  const liabilities = new Map(accounts.map((account) => [account.id, Boolean(account.liability)]));
  const seenTransfers = new Set<string>();
  transactions
    .filter((transaction) => !transaction.deletedAt && transaction.status === "completed" && transaction.date.slice(0, 7) <= period)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((transaction) => {
      const transferLike = transaction.type === "transfer" || transaction.type === "investment_buy";
      if (transferLike && transaction.transferGroupId) {
        if (seenTransfers.has(transaction.transferGroupId)) return;
        seenTransfers.add(transaction.transferGroupId);
      }
      const sourceLiability = liabilities.get(transaction.accountId) ?? false;
      const source = balances.get(transaction.accountId) ?? 0;
      if (transferLike && transaction.destinationAccountId) {
        balances.set(transaction.accountId, source + (sourceLiability ? transaction.amount : -transaction.amount));
        const destinationLiability = liabilities.get(transaction.destinationAccountId) ?? false;
        const destination = balances.get(transaction.destinationAccountId) ?? 0;
        balances.set(transaction.destinationAccountId, destination + (destinationLiability ? -transaction.amount : transaction.amount));
        return;
      }
      const incoming = transaction.type === "income" || transaction.type === "refund" || transaction.type === "adjustment_in";
      const movement = incoming ? transaction.amount : -transaction.amount;
      balances.set(transaction.accountId, source + (sourceLiability ? -movement : movement));
    });
  return accounts.map((account) => ({ ...account, balance: Math.max(0, Math.round(balances.get(account.id) ?? account.balance)) }));
}

function categoryExpenses(transactions: Transaction[], period: string) {
  return transactions
    .filter((item) => !item.deletedAt && item.status === "completed" && item.date.startsWith(period))
    .reduce<Record<string, number>>((result, item) => {
      const direction = item.type === "expense" ? 1 : item.type === "refund" ? -1 : 0;
      if (!direction) return result;
      const allocations = item.splits?.length ? item.splits : [{ category: item.category, amount: item.amount }];
      allocations.forEach((allocation) => {
        result[allocation.category] = (result[allocation.category] ?? 0) + allocation.amount * direction;
      });
      return result;
    }, {});
}

export function buildMonthlyReview(input: {
  period: string;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  bills: Bill[];
}): MonthlyReview {
  const period = assertPeriod(input.period);
  const monthTransactions = input.transactions.filter((item) => !item.deletedAt && item.date.startsWith(period));
  const completed = monthTransactions.filter((item) => item.status === "completed");
  const currentAccounts = balancesAt(input.accounts, input.transactions, period);
  const previousAccounts = balancesAt(input.accounts, input.transactions, shiftMonth(period, -1));
  const currentTotals = accountSummary(currentAccounts);
  const previousTotals = accountSummary(previousAccounts);
  const budgetRows = input.budgets
    .filter((budget) => !budget.period || budget.period === period)
    .map((budget) => {
      const spent = budgetSpent(input.transactions, budget.category, period);
      return { category: budget.category, limit: budget.limit, spent, percent: budget.limit > 0 ? spent / budget.limit * 100 : 0 };
    })
    .sort((a, b) => b.percent - a.percent);
  const currentCategories = categoryExpenses(input.transactions, period);
  const priorPeriods = [shiftMonth(period, -1), shiftMonth(period, -2), shiftMonth(period, -3)];
  const priorCategories = priorPeriods.map((item) => categoryExpenses(input.transactions, item));
  const unusualExpenses = Object.entries(currentCategories)
    .map(([category, amount]) => {
      const average = priorCategories.reduce((sum, row) => sum + (row[category] ?? 0), 0) / priorPeriods.length;
      return { category, amount, average, reason: average <= 0 ? "Baru muncul bulan ini" : `${Math.round((amount / average - 1) * 100)}% di atas rata-rata 3 bulan` };
    })
    .filter((item) => item.amount > 0 && (item.average === 0 || item.amount >= item.average * 1.5))
    .sort((a, b) => (b.amount - b.average) - (a.amount - a.average))
    .slice(0, 5);
  const merchantTotals = completed.filter((item) => item.type === "expense").reduce<Record<string, number>>((result, item) => {
    const label = item.merchant || item.title || item.category;
    result[label] = (result[label] ?? 0) + item.amount;
    return result;
  }, {});
  const activeBills = input.bills.filter((bill) => !bill.completed);
  return {
    period,
    summary: monthlySummary(input.transactions, period),
    transactionCount: completed.length,
    pendingCount: monthTransactions.filter((item) => item.status === "pending").length,
    netWorth: currentTotals.netWorth,
    netWorthChange: currentTotals.netWorth - previousTotals.netWorth,
    liabilities: currentTotals.liabilities,
    liabilityChange: currentTotals.liabilities - previousTotals.liabilities,
    budgetLimit: budgetRows.reduce((sum, item) => sum + item.limit, 0),
    budgetSpent: budgetRows.reduce((sum, item) => sum + item.spent, 0),
    budgetRows,
    topExpenses: Object.entries(merchantTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, amount]) => ({ label, amount })),
    unusualExpenses,
    goals: input.goals.map((goal) => ({ id: goal.id, name: goal.name, current: goal.current, target: goal.target, percent: goal.target > 0 ? Math.min(100, goal.current / goal.target * 100) : 0 })).sort((a, b) => b.percent - a.percent),
    billsDue: activeBills.reduce((sum, bill) => sum + bill.amount, 0),
    unpaidBills: activeBills.filter((bill) => !bill.paid).length,
  };
}
