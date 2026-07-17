export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "refund"
  | "investment_buy"
  | "adjustment_in"
  | "adjustment_out";

export type AccountType =
  | "Bank"
  | "E-Wallet"
  | "Cash"
  | "Investment"
  | "Credit Card";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: string;
  balance: number;
  /** Sumber kebenaran untuk menghitung ulang saldo dari ledger. */
  openingBalance?: number;
  mask: string;
  color: string;
  liability?: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  title: string;
  merchant?: string;
  category: string;
  accountId: string;
  destinationAccountId?: string;
  transferGroupId?: string;
  amount: number;
  status: "completed" | "pending";
  /** Versi optimistik dari backend untuk mencegah edit stale lintas tab. */
  updatedAt?: string;
  /** Soft-delete marker. Transaksi di Trash tidak ikut perhitungan ledger. */
  deletedAt?: string;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  color: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  color: string;
  icon: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  category: string;
  accountId: string;
  paid: boolean;
}

export interface FinanceCategory {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer" | "investment" | "system";
  color: string;
  active: boolean;
  archived?: boolean;
  isDefault?: boolean;
  icon?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  module: string;
  entityId?: string;
  details?: string | Record<string, unknown>;
  actor?: string;
  createdAt: string;
}

export interface Investment {
  id: string;
  ticker: string;
  name: string;
  className: string;
  units: number;
  avgPrice: number;
  marketPrice: number;
  color: string;
}

export const INDONESIAN_LOCALE = "id-ID";
export const INDONESIAN_TIME_ZONE = "Asia/Jakarta";

export type MonthSelector = string | Date | MonthlySummaryOptions;

export interface MonthlySummaryOptions {
  /** Format YYYY-MM. Date dikonversi memakai timeZone yang dipilih. */
  month?: string | Date;
  timeZone?: string;
  includePending?: boolean;
}

interface ResolvedMonthlySummaryOptions {
  month: string;
  timeZone: string;
  includePending: boolean;
}

const assertValidDate = (date: Date) => {
  if (Number.isNaN(date.getTime())) throw new RangeError("Tanggal tidak valid.");
};

const assertMonthKey = (month: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new RangeError(`Bulan harus berformat YYYY-MM, diterima: ${month}`);
  }
  return month;
};

/** Menghasilkan bulan berjalan berdasarkan zona waktu Indonesia, bukan zona UTC runtime. */
export const getCurrentMonth = (
  date = new Date(),
  timeZone = INDONESIAN_TIME_ZONE,
) => {
  assertValidDate(date);
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    timeZone,
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new RangeError(`Zona waktu tidak dapat diproses: ${timeZone}`);
  return `${year}-${month}`;
};

const resolveMonthOptions = (selector?: MonthSelector): ResolvedMonthlySummaryOptions => {
  const options: MonthlySummaryOptions = typeof selector === "string" || selector instanceof Date
    ? { month: selector }
    : selector ?? {};
  const timeZone = options.timeZone ?? INDONESIAN_TIME_ZONE;
  const rawMonth = options.month ?? new Date();
  const month = rawMonth instanceof Date
    ? getCurrentMonth(rawMonth, timeZone)
    : assertMonthKey(rawMonth);
  return { month, timeZone, includePending: options.includePending ?? false };
};

export const formatMonthLabel = (
  selector?: MonthSelector,
  locale = INDONESIAN_LOCALE,
) => {
  const { month, timeZone } = resolveMonthOptions(selector);
  const date = new Date(`${month}-15T12:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone,
  }).format(date);
};

export const formatIDR = (value: number, compact = false) =>
  new Intl.NumberFormat(INDONESIAN_LOCALE, {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(value);

const isActiveTransaction = (transaction: Transaction, includePending = false) =>
  !transaction.deletedAt && (includePending || transaction.status === "completed");

/**
 * Ringkasan arus kas satu bulan. Transfer dan pembelian investasi dikecualikan
 * karena hanya memindahkan nilai antar-akun.
 */
export const monthlySummary = (transactions: Transaction[], selector?: MonthSelector) => {
  const { month, includePending } = resolveMonthOptions(selector);
  const filtered = transactions.filter((item) =>
    item.date.startsWith(month) && isActiveTransaction(item, includePending));
  const income = filtered
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const grossExpense = filtered
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
  const refund = filtered
    .filter((item) => item.type === "refund")
    .reduce((sum, item) => sum + item.amount, 0);
  const expense = grossExpense - refund;
  const cashflow = income - expense;
  return {
    month,
    income,
    grossExpense,
    refund,
    expense,
    cashflow,
    savingsRate: income > 0 ? (cashflow / income) * 100 : 0,
  };
};

export const accountSummary = (accounts: Account[]) => {
  const assets = accounts.filter((account) => !account.liability).reduce((sum, account) => sum + account.balance, 0);
  const liabilities = accounts.filter((account) => account.liability).reduce((sum, account) => sum + account.balance, 0);
  const liquid = accounts
    .filter((account) => ["Bank", "E-Wallet", "Cash"].includes(account.type))
    .reduce((sum, account) => sum + account.balance, 0);
  const investment = accounts.filter((account) => account.type === "Investment").reduce((sum, account) => sum + account.balance, 0);
  return { assets, liabilities, liquid, investment, netWorth: assets - liabilities };
};

export const budgetSpent = (
  transactions: Transaction[],
  category: string,
  selector?: MonthSelector,
) => {
  const { month, includePending } = resolveMonthOptions(selector);
  return transactions
    .filter((item) =>
      item.date.startsWith(month)
      && item.category === category
      && isActiveTransaction(item, includePending))
    .reduce((sum, item) => {
      if (item.type === "expense") return sum + item.amount;
      if (item.type === "refund") return sum - item.amount;
      return sum;
    }, 0);
};

export const investmentValue = (investment: Investment) => investment.units * investment.marketPrice;
export const investmentCost = (investment: Investment) => investment.units * investment.avgPrice;

export const weightedAverageCost = (
  currentUnits: number,
  currentAverage: number,
  newUnits: number,
  newPrice: number,
  fee = 0,
) => {
  const totalUnits = currentUnits + newUnits;
  if (totalUnits <= 0) return 0;
  return (currentUnits * currentAverage + newUnits * newPrice + fee) / totalUnits;
};

export const calculateHealthScore = (
  transactions: Transaction[],
  accounts: Account[],
  budgets: Budget[],
  selector?: MonthSelector,
) => {
  const monthly = monthlySummary(transactions, selector);
  const account = accountSummary(accounts);
  const savingsPoints = Math.min(25, Math.max(0, (monthly.savingsRate / 30) * 25));
  const emergencyMonths = monthly.expense > 0 ? account.liquid / monthly.expense : 6;
  const emergencyPoints = Math.min(20, (emergencyMonths / 6) * 20);
  const debtRatio = account.assets > 0 ? account.liabilities / account.assets : 0;
  const debtPoints = Math.max(0, 20 * (1 - debtRatio * 2));
  const budgetAverage = budgets.reduce((sum, budget) => {
    const ratio = budget.limit > 0
      ? budgetSpent(transactions, budget.category, selector) / budget.limit
      : 0;
    return sum + Math.min(ratio, 1.5);
  }, 0) / Math.max(budgets.length, 1);
  const budgetPoints = Math.max(0, 15 * (1 - Math.max(0, budgetAverage - 0.75)));
  return Math.round(Math.min(100, savingsPoints + emergencyPoints + debtPoints + budgetPoints + 18));
};

export type LedgerErrorCode =
  | "INVALID_AMOUNT"
  | "ACCOUNT_NOT_FOUND"
  | "DUPLICATE_ACCOUNT"
  | "TRANSFER_DESTINATION_REQUIRED"
  | "TRANSFER_SAME_ACCOUNT"
  | "TRANSACTION_NOT_FOUND"
  | "DUPLICATE_TRANSACTION";

export class LedgerError extends Error {
  constructor(public readonly code: LedgerErrorCode, message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

const accountIndex = (accounts: Account[]) => {
  const index = new Map<string, Account>();
  accounts.forEach((account) => {
    if (index.has(account.id)) {
      throw new LedgerError("DUPLICATE_ACCOUNT", `ID akun duplikat: ${account.id}`);
    }
    index.set(account.id, account);
  });
  return index;
};

/** Delta positif berarti nilai ekonomi akun bertambah; kewajiban memakai tanda terbalik. */
const transactionDeltas = (accounts: Account[], transaction: Transaction) => {
  if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) {
    throw new LedgerError("INVALID_AMOUNT", "Nominal transaksi harus lebih besar dari nol.");
  }

  const index = accountIndex(accounts);
  const source = index.get(transaction.accountId);
  if (!source) {
    throw new LedgerError("ACCOUNT_NOT_FOUND", `Akun sumber tidak ditemukan: ${transaction.accountId}`);
  }

  const deltas = new Map<string, number>();
  const addDelta = (account: Account, economicDelta: number) => {
    const storedDelta = account.liability ? -economicDelta : economicDelta;
    deltas.set(account.id, (deltas.get(account.id) ?? 0) + storedDelta);
  };

  if (transaction.type === "transfer" || transaction.type === "investment_buy") {
    if (!transaction.destinationAccountId) {
      throw new LedgerError(
        "TRANSFER_DESTINATION_REQUIRED",
        "Transfer harus memiliki akun tujuan.",
      );
    }
    if (transaction.destinationAccountId === transaction.accountId) {
      throw new LedgerError(
        "TRANSFER_SAME_ACCOUNT",
        "Akun sumber dan tujuan transfer tidak boleh sama.",
      );
    }
    const destination = index.get(transaction.destinationAccountId);
    if (!destination) {
      throw new LedgerError(
        "ACCOUNT_NOT_FOUND",
        `Akun tujuan tidak ditemukan: ${transaction.destinationAccountId}`,
      );
    }
    // Validasi kedua sisi selesai sebelum satu pun saldo diubah (atomik).
    addDelta(source, -transaction.amount);
    addDelta(destination, transaction.amount);
    return deltas;
  }

  if (transaction.type === "expense" || transaction.type === "adjustment_out") {
    addDelta(source, -transaction.amount);
  } else {
    addDelta(source, transaction.amount); // income, refund, dan adjustment_in
  }
  return deltas;
};

const applyTransactionDirection = (
  accounts: Account[],
  transaction: Transaction,
  direction: 1 | -1,
) => {
  if (!isActiveTransaction(transaction)) return accounts;
  const deltas = transactionDeltas(accounts, transaction);
  return accounts.map((account) => {
    const delta = deltas.get(account.id);
    return delta === undefined
      ? account
      : { ...account, balance: account.balance + delta * direction };
  });
};

/** Menerapkan transaksi completed sebagai satu operasi immutable. */
export const applyTransaction = (accounts: Account[], transaction: Transaction) =>
  applyTransactionDirection(accounts, transaction, 1);

/** Invers tepat untuk undo/delete; tidak melakukan clamp yang dapat menimbulkan selisih. */
export const reverseTransaction = (accounts: Account[], transaction: Transaction) =>
  applyTransactionDirection(accounts, transaction, -1);

/**
 * Merekonstruksi cache saldo dari openingBalance + seluruh ledger aktif.
 * Untuk data lama tanpa openingBalance, balance saat ini dipakai sebagai fallback.
 */
export const recomputeAccountBalances = (
  accounts: Account[],
  transactions: Transaction[],
) => {
  const seen = new Set<string>();
  transactions.forEach((transaction) => {
    if (seen.has(transaction.id)) {
      throw new LedgerError(
        "DUPLICATE_TRANSACTION",
        `ID transaksi duplikat: ${transaction.id}`,
      );
    }
    seen.add(transaction.id);
  });

  const openingAccounts = accounts.map((account) => ({
    ...account,
    balance: account.openingBalance ?? account.balance,
  }));
  return transactions.reduce(applyTransaction, openingAccounts);
};

export interface SoftDeleteResult {
  accounts: Account[];
  transactions: Transaction[];
  deletedTransaction: Transaction;
  changed: boolean;
}

/** Soft-delete dan pembalikan saldo dilakukan bersama agar tidak ada saldo setengah berubah. */
export const softDeleteTransaction = (
  accounts: Account[],
  transactions: Transaction[],
  transactionId: string,
  deletedAt = new Date().toISOString(),
): SoftDeleteResult => {
  const matches = transactions.filter((transaction) => transaction.id === transactionId);
  if (matches.length === 0) {
    throw new LedgerError("TRANSACTION_NOT_FOUND", `Transaksi tidak ditemukan: ${transactionId}`);
  }
  if (matches.length > 1) {
    throw new LedgerError("DUPLICATE_TRANSACTION", `ID transaksi duplikat: ${transactionId}`);
  }

  const deletedTransaction = matches[0];
  if (deletedTransaction.deletedAt) {
    return { accounts, transactions, deletedTransaction, changed: false };
  }

  const nextAccounts = reverseTransaction(accounts, deletedTransaction);
  const nextTransactions = transactions.map((transaction) =>
    transaction.id === transactionId ? { ...transaction, deletedAt } : transaction);
  return {
    accounts: nextAccounts,
    transactions: nextTransactions,
    deletedTransaction: { ...deletedTransaction, deletedAt },
    changed: true,
  };
};
