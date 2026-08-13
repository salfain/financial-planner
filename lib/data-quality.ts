import { financeCategoryKey, type Account, type Budget, type FinanceCategory, type Transaction } from "./finance";

export type DataQualityTarget = "transactions" | "accounts" | "budgets";
export type DataQualitySeverity = "critical" | "warning" | "info";

export type DataQualityIssue = {
  id: string;
  severity: DataQualitySeverity;
  title: string;
  description: string;
  count: number;
  target: DataQualityTarget;
};

export type DataQualityReport = {
  status: "healthy" | "attention" | "critical";
  score: number;
  issueCount: number;
  issues: DataQualityIssue[];
  duplicateGroups: Transaction[][];
};

const normalizedText = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const activeTransactions = (transactions: Transaction[]) => transactions.filter((item) => !item.deletedAt);

export function transactionFingerprint(transaction: Pick<Transaction, "type" | "date" | "title" | "merchant" | "accountId" | "destinationAccountId" | "amount">) {
  return [
    transaction.type,
    transaction.date,
    normalizedText(transaction.merchant || transaction.title),
    transaction.accountId,
    transaction.destinationAccountId || "",
    Math.round(Number(transaction.amount) || 0),
  ].join("|");
}

export function findPotentialDuplicate(transaction: Transaction, transactions: Transaction[], excludedId?: string) {
  const fingerprint = transactionFingerprint(transaction);
  return activeTransactions(transactions).find((candidate) => candidate.id !== excludedId && transactionFingerprint(candidate) === fingerprint) ?? null;
}

export function findDuplicateTransactionGroups(transactions: Transaction[]) {
  const groups = new Map<string, Transaction[]>();
  activeTransactions(transactions).forEach((transaction) => {
    const fingerprint = transactionFingerprint(transaction);
    const current = groups.get(fingerprint) ?? [];
    current.push(transaction);
    groups.set(fingerprint, current);
  });
  return [...groups.values()].filter((group) => group.length > 1);
}

export function analyzeFinanceDataQuality(input: {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  categories: FinanceCategory[];
  period: string;
  now?: Date;
}): DataQualityReport {
  const { accounts, transactions, budgets, categories, period } = input;
  const now = input.now ?? new Date();
  const active = activeTransactions(transactions);
  const accountIds = new Set(accounts.map((account) => account.id));
  const activeCategoryKeys = new Set(categories.filter((category) => category.active).map((category) => financeCategoryKey(category.name)));
  const duplicateGroups = findDuplicateTransactionGroups(active);
  const missingAccounts = active.filter((transaction) => !accountIds.has(transaction.accountId)
    || ((transaction.type === "transfer" || transaction.type === "investment_buy") && (!transaction.destinationAccountId || !accountIds.has(transaction.destinationAccountId))));
  const invalidTransactions = active.filter((transaction) => !/^\d{4}-\d{2}-\d{2}$/.test(transaction.date) || !Number.isFinite(transaction.amount) || transaction.amount <= 0);
  const uncategorized = active.filter((transaction) => ["income", "expense", "refund"].includes(transaction.type)
    && (!financeCategoryKey(transaction.category) || financeCategoryKey(transaction.category) === "lainnya"));
  const stalePending = active.filter((transaction) => {
    if (transaction.status !== "pending" || !/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)) return false;
    const ageDays = (now.getTime() - new Date(`${transaction.date}T12:00:00+07:00`).getTime()) / 86_400_000;
    return ageDays > 7;
  });
  const invalidAccounts = accounts.filter((account) => !account.id || !account.name.trim() || !Number.isFinite(account.balance));
  const periodBudgets = budgets.filter((budget) => !budget.period || budget.period === period);
  const budgetGroups = new Map<string, Budget[]>();
  periodBudgets.forEach((budget) => {
    const key = `${budget.period || "legacy"}|${financeCategoryKey(budget.category)}`;
    budgetGroups.set(key, [...(budgetGroups.get(key) ?? []), budget]);
  });
  const duplicateBudgets = [...budgetGroups.values()].filter((group) => group.length > 1);
  const missingBudgetCategories = periodBudgets.filter((budget) => !activeCategoryKeys.has(financeCategoryKey(budget.category)));

  const issues: DataQualityIssue[] = [];
  if (missingAccounts.length) issues.push({ id: "missing-accounts", severity: "critical", title: "Referensi akun terputus", description: "Transaksi mengarah ke akun yang tidak tersedia. Perbaiki sebelum melakukan rekonsiliasi.", count: missingAccounts.length, target: "transactions" });
  if (invalidTransactions.length) issues.push({ id: "invalid-transactions", severity: "critical", title: "Transaksi tidak valid", description: "Tanggal atau nominal transaksi perlu diperbaiki agar perhitungan tetap akurat.", count: invalidTransactions.length, target: "transactions" });
  if (invalidAccounts.length) issues.push({ id: "invalid-accounts", severity: "critical", title: "Data akun tidak lengkap", description: "Nama, ID, atau saldo akun tidak dapat dipakai untuk menghitung ledger.", count: invalidAccounts.length, target: "accounts" });
  if (duplicateGroups.length) issues.push({ id: "duplicates", severity: "warning", title: "Kemungkinan transaksi ganda", description: "Tanggal, merchant, akun, dan nominalnya sama. Tinjau sebelum menghapus salah satunya.", count: duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0), target: "transactions" });
  if (stalePending.length) issues.push({ id: "stale-pending", severity: "warning", title: "Transaksi pending terlalu lama", description: "Transaksi sudah menunggu lebih dari tujuh hari dan belum masuk perhitungan utama.", count: stalePending.length, target: "transactions" });
  if (uncategorized.length) issues.push({ id: "uncategorized", severity: "info", title: "Kategori masih umum", description: "Lengkapi kategori agar anggaran dan insight bulanan lebih tepat.", count: uncategorized.length, target: "transactions" });
  if (duplicateBudgets.length) issues.push({ id: "duplicate-budgets", severity: "warning", title: "Anggaran kategori ganda", description: "Lebih dari satu batas ditemukan untuk kategori dan periode yang sama.", count: duplicateBudgets.reduce((sum, group) => sum + group.length - 1, 0), target: "budgets" });
  if (missingBudgetCategories.length) issues.push({ id: "budget-categories", severity: "info", title: "Kategori anggaran tidak aktif", description: "Anggaran menggunakan kategori yang sudah tidak tersedia pada form transaksi.", count: missingBudgetCategories.length, target: "budgets" });

  const criticalCount = issues.filter((issue) => issue.severity === "critical").reduce((sum, issue) => sum + issue.count, 0);
  const warningCount = issues.filter((issue) => issue.severity === "warning").reduce((sum, issue) => sum + issue.count, 0);
  const infoCount = issues.filter((issue) => issue.severity === "info").reduce((sum, issue) => sum + issue.count, 0);
  const score = Math.max(0, Math.round(100 - criticalCount * 15 - warningCount * 7 - infoCount * 2));
  return {
    status: criticalCount ? "critical" : issues.length ? "attention" : "healthy",
    score,
    issueCount: issues.reduce((sum, issue) => sum + issue.count, 0),
    issues,
    duplicateGroups,
  };
}
