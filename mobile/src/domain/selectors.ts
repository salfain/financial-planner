import type { Account, Budget, FinanceSnapshot, Transaction } from './types';

export const activeTransactions = (transactions: Transaction[]) =>
  transactions.filter((item) => !item.deletedAt && item.status === 'completed');

export const categoryKey = (category: string) =>
  String(category || '').trim().replace(/\s+/g, ' ').toLowerCase();

export const accountTotals = (accounts: Account[]) => {
  const assets = accounts.filter((item) => !item.liability).reduce((sum, item) => sum + item.balance, 0);
  const liabilities = accounts.filter((item) => item.liability).reduce((sum, item) => sum + Math.abs(item.balance), 0);
  return { assets, liabilities, netWorth: assets - liabilities };
};

export const accountTotalsAtDate = (accounts: Account[], transactions: Transaction[], endDate: string) => {
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const balances = new Map(accounts.map((account) => [account.id, account.openingBalance ?? account.balance]));
  const addEconomicDelta = (accountId: string, economicDelta: number) => {
    const account = accountMap.get(accountId);
    if (!account) return;
    const storedDelta = account.liability ? -economicDelta : economicDelta;
    balances.set(accountId, (balances.get(accountId) ?? 0) + storedDelta);
  };

  activeTransactions(transactions).forEach((transaction) => {
    if (transaction.date > endDate || !accountMap.has(transaction.accountId)) return;
    if (transaction.type === 'transfer' || transaction.type === 'investment_buy') {
      if (!transaction.destinationAccountId || !accountMap.has(transaction.destinationAccountId)) return;
      addEconomicDelta(transaction.accountId, -transaction.amount);
      addEconomicDelta(transaction.destinationAccountId, transaction.amount);
      return;
    }
    addEconomicDelta(
      transaction.accountId,
      transaction.type === 'expense' || transaction.type === 'adjustment_out' ? -transaction.amount : transaction.amount,
    );
  });

  return accountTotals(accounts.map((account) => ({ ...account, balance: balances.get(account.id) ?? account.balance })));
};

export const expenseByCategory = (snapshot: FinanceSnapshot, period?: string) => {
  const totals = new Map<string, { category: string; amount: number }>();
  const add = (category: string, amount: number) => {
    const normalizedCategory = String(category || 'Lainnya').trim().replace(/\s+/g, ' ');
    const key = categoryKey(normalizedCategory);
    const current = totals.get(key);
    totals.set(key, { category: current?.category ?? normalizedCategory, amount: (current?.amount ?? 0) + amount });
  };
  activeTransactions(snapshot.transactions).filter((transaction) => !period || transaction.date.startsWith(period)).forEach((transaction) => {
    if (transaction.type === 'expense') {
      if (transaction.splits.length) {
        transaction.splits.forEach((split) => add(split.category, split.amount));
      } else {
        add(transaction.category, transaction.amount);
      }
    }
    if (transaction.type === 'refund') {
      if (transaction.splits.length) {
        transaction.splits.forEach((split) => add(split.category, -split.amount));
      } else {
        add(transaction.category, -transaction.amount);
      }
    }
  });
  return [...totals.values()]
    .map(({ category, amount }) => ({ category, amount: Math.max(0, amount) }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
};

export const budgetActual = (budget: Budget, snapshot: FinanceSnapshot, period = budget.period) =>
  expenseByCategory(snapshot, period).find((item) => categoryKey(item.category) === categoryKey(budget.category))?.amount ?? 0;

export const budgetTransactionCount = (budget: Budget, snapshot: FinanceSnapshot, period = budget.period) => {
  const key = categoryKey(budget.category);
  return activeTransactions(snapshot.transactions)
    .filter((transaction) => !period || transaction.date.startsWith(period))
    .filter((transaction) => {
      if (transaction.type !== 'expense' && transaction.type !== 'refund') return false;
      return transaction.splits.length
        ? transaction.splits.some((split) => categoryKey(split.category) === key && split.amount !== 0)
        : categoryKey(transaction.category) === key && transaction.amount !== 0;
    }).length;
};

export const upcomingBills = (snapshot: FinanceSnapshot) => snapshot.bills
  .filter((item) => !item.paid && !item.completed)
  .slice()
  .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

export const recentTransactions = (snapshot: FinanceSnapshot, limit = 5, period?: string) => snapshot.transactions
  .filter((item) => !item.deletedAt && (!period || item.date.startsWith(period)))
  .slice()
  .sort((a, b) => `${b.date}${b.time ?? ''}`.localeCompare(`${a.date}${a.time ?? ''}`))
  .slice(0, limit);
