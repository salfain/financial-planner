import type { Account, Budget, FinanceSnapshot, Transaction } from './types';

export const activeTransactions = (transactions: Transaction[]) =>
  transactions.filter((item) => !item.deletedAt && item.status === 'completed');

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

export const expenseByCategory = (snapshot: FinanceSnapshot) => {
  const totals = new Map<string, number>();
  activeTransactions(snapshot.transactions).forEach((transaction) => {
    if (transaction.type === 'expense') {
      if (transaction.splits.length) {
        transaction.splits.forEach((split) => totals.set(split.category, (totals.get(split.category) ?? 0) + split.amount));
      } else {
        totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + transaction.amount);
      }
    }
    if (transaction.type === 'refund') {
      totals.set(transaction.category, Math.max(0, (totals.get(transaction.category) ?? 0) - transaction.amount));
    }
  });
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
};

export const budgetActual = (budget: Budget, snapshot: FinanceSnapshot) =>
  expenseByCategory(snapshot).find((item) => item.category === budget.category)?.amount ?? 0;

export const upcomingBills = (snapshot: FinanceSnapshot) => snapshot.bills
  .filter((item) => !item.paid && !item.completed)
  .slice()
  .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

export const recentTransactions = (snapshot: FinanceSnapshot, limit = 5) => snapshot.transactions
  .filter((item) => !item.deletedAt)
  .slice()
  .sort((a, b) => `${b.date}${b.time ?? ''}`.localeCompare(`${a.date}${a.time ?? ''}`))
  .slice(0, limit);
