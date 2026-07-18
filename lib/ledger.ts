export type LedgerStorageMode = "cached" | "calculated";

export type LedgerAccountSource = {
  id: string;
  name: string;
  openingBalance: number;
  storedBalance: number;
  liability: boolean;
  active: boolean;
  updatedAt?: string;
};

export type LedgerTransactionSource = {
  id: string;
  type: string;
  amount: number;
  status: string;
  accountId: string;
  destinationAccountId?: string | null;
  deletedAt?: string | null;
  updatedAt?: string;
};

export type LedgerIssue = {
  code: "INVALID_ACCOUNT_BALANCE" | "INVALID_TRANSACTION" | "MISSING_ACCOUNT" | "MISSING_DESTINATION" | "NEGATIVE_EXPECTED_BALANCE";
  message: string;
  accountId?: string;
  transactionId?: string;
};

export type LedgerAccountCheck = {
  id: string;
  name: string;
  liability: boolean;
  active: boolean;
  openingBalance: number;
  storedBalance: number;
  expectedBalance: number;
  difference: number;
  valid: boolean;
  updatedAt?: string;
};

export type LedgerHealthSummary = {
  accountCount: number;
  transactionCount: number;
  completedTransactionCount: number;
  driftCount: number;
  totalAbsoluteDifference: number;
  issueCount: number;
};

export type LedgerHealthReport = {
  status: "healthy" | "needs_repair" | "blocked";
  storageMode: LedgerStorageMode;
  revision: string;
  checkedAt: string;
  canRepair: boolean;
  accounts: LedgerAccountCheck[];
  issues: LedgerIssue[];
  summary: LedgerHealthSummary;
  replayed?: boolean;
  noChange?: boolean;
  repairedAccounts?: number;
};

const ONE_SIDED_TYPES = new Set(["income", "expense", "refund", "adjustment_in", "adjustment_out"]);
const TWO_SIDED_TYPES = new Set(["transfer", "investment_buy"]);

function economicMovement(type: string, amount: number) {
  return type === "income" || type === "refund" || type === "adjustment_in" ? amount : -amount;
}

function accountEffect(account: LedgerAccountSource, movement: number) {
  return account.liability ? -movement : movement;
}

export function calculateLedgerHealth(
  accounts: LedgerAccountSource[],
  transactions: LedgerTransactionSource[],
  storageMode: LedgerStorageMode = "cached",
) {
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const expected = new Map<string, number>();
  const issues: LedgerIssue[] = [];

  for (const account of accounts) {
    if (!Number.isSafeInteger(account.openingBalance) || account.openingBalance < 0 || !Number.isSafeInteger(account.storedBalance) || account.storedBalance < 0) {
      issues.push({
        code: "INVALID_ACCOUNT_BALANCE",
        accountId: account.id,
        message: `Saldo akun ${account.name} tidak valid.`,
      });
    }
    expected.set(account.id, account.openingBalance);
  }

  let completedTransactionCount = 0;
  for (const transaction of transactions) {
    if (transaction.deletedAt || transaction.status !== "completed") continue;
    completedTransactionCount += 1;
    if (!Number.isSafeInteger(transaction.amount) || transaction.amount <= 0 || (!ONE_SIDED_TYPES.has(transaction.type) && !TWO_SIDED_TYPES.has(transaction.type))) {
      issues.push({
        code: "INVALID_TRANSACTION",
        transactionId: transaction.id,
        message: `Transaksi ${transaction.id} memiliki jenis atau nominal yang tidak valid.`,
      });
      continue;
    }
    const source = accountMap.get(transaction.accountId);
    if (!source) {
      issues.push({
        code: "MISSING_ACCOUNT",
        transactionId: transaction.id,
        accountId: transaction.accountId,
        message: `Akun sumber transaksi ${transaction.id} tidak ditemukan.`,
      });
      continue;
    }

    if (TWO_SIDED_TYPES.has(transaction.type)) {
      const destinationId = transaction.destinationAccountId ?? "";
      const destination = accountMap.get(destinationId);
      if (!destination || destination.id === source.id) {
        issues.push({
          code: "MISSING_DESTINATION",
          transactionId: transaction.id,
          accountId: destinationId || undefined,
          message: `Akun tujuan transaksi ${transaction.id} tidak ditemukan atau tidak valid.`,
        });
        continue;
      }
      expected.set(source.id, (expected.get(source.id) ?? 0) + accountEffect(source, -transaction.amount));
      expected.set(destination.id, (expected.get(destination.id) ?? 0) + accountEffect(destination, transaction.amount));
      continue;
    }

    expected.set(source.id, (expected.get(source.id) ?? 0) + accountEffect(source, economicMovement(transaction.type, transaction.amount)));
  }

  const checks = accounts.map((account): LedgerAccountCheck => {
    const expectedBalance = expected.get(account.id) ?? account.openingBalance;
    const valid = Number.isSafeInteger(expectedBalance) && expectedBalance >= 0;
    if (!valid) {
      issues.push({
        code: "NEGATIVE_EXPECTED_BALANCE",
        accountId: account.id,
        message: `Ledger akun ${account.name} menghasilkan saldo yang tidak valid.`,
      });
    }
    return {
      ...account,
      expectedBalance,
      difference: expectedBalance - account.storedBalance,
      valid,
    };
  });
  const drifted = checks.filter((account) => account.valid && account.difference !== 0);
  const status = issues.length ? "blocked" : drifted.length ? "needs_repair" : "healthy";

  return {
    status,
    storageMode,
    canRepair: status === "needs_repair" || (storageMode === "calculated" && status === "healthy"),
    accounts: checks,
    issues,
    summary: {
      accountCount: accounts.length,
      transactionCount: transactions.length,
      completedTransactionCount,
      driftCount: drifted.length,
      totalAbsoluteDifference: drifted.reduce((sum, account) => sum + Math.abs(account.difference), 0),
      issueCount: issues.length,
    },
  } as const;
}
