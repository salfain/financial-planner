import type { Account, Bill, Budget, Goal, Transaction } from "./finance";
import { callAppsScript, hasAppsScriptBridge } from "./apps-script-client";

export type FinanceProfile = {
  name: string;
  storeName: string;
  currency: string;
  timezone: string;
};

export type FinanceSnapshot = {
  configured: boolean;
  profile: FinanceProfile;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  bills: Bill[];
};

export type SetupWorkspaceInput = {
  profileName: string;
  storeName: string;
  currency: string;
  timezone: string;
  accounts: Array<{
    name: string;
    type: string;
    institution?: string;
    mask?: string;
    openingBalance: number;
    color?: string;
  }>;
};

const jsonHeaders = { "content-type": "application/json" };

async function webRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { ...jsonHeaders, ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as { data?: T; error?: string | { message?: string } } & T;
  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : body.error?.message;
    throw new Error(message || `Permintaan gagal (${response.status}).`);
  }
  return (body.data ?? body) as T;
}

async function mutation<T>(action: string, path: string, payload: Record<string, unknown>) {
  if (hasAppsScriptBridge()) return callAppsScript<T>(action, payload);
  return webRequest<T>(path, { method: "POST", body: JSON.stringify(payload) });
}

const text = (value: unknown, fallback = "") => value === undefined || value === null ? fallback : String(value);
const number = (value: unknown) => Number(value || 0);
const bool = (value: unknown) => value === true || value === 1 || String(value).toLowerCase() === "true";

function normalizeAccount(row: Record<string, unknown>): Account {
  const type = text(row.type, "Bank") as Account["type"];
  return {
    id: text(row.id),
    name: text(row.name, "Akun"),
    type,
    institution: text(row.institution),
    balance: number(row.currentBalance ?? row.current_balance ?? row.balance ?? row.opening_balance),
    openingBalance: number(row.openingBalance ?? row.opening_balance),
    mask: text(row.mask),
    color: text(row.color, "#126b59"),
    liability: bool(row.liability ?? row.isLiability ?? row.is_liability),
  };
}

function normalizeTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: text(row.id),
    type: text(row.type, "expense") as Transaction["type"],
    date: text(row.date).slice(0, 10),
    title: text(row.title ?? row.description ?? row.merchant, "Transaksi"),
    merchant: text(row.merchant),
    category: text(row.category, "Lainnya"),
    accountId: text(row.accountId ?? row.account_id),
    destinationAccountId: text(row.destinationAccountId ?? row.destination_account_id) || undefined,
    amount: number(row.amount),
    status: text(row.status, "completed") as Transaction["status"],
    transferGroupId: text(row.transferGroupId ?? row.transfer_group_id) || undefined,
  };
}

function normalizeBudget(row: Record<string, unknown>, index: number): Budget {
  return {
    id: text(row.id, `budget-${index}`),
    category: text(row.category, "Lainnya"),
    limit: number(row.limit ?? row.limitAmount ?? row.limit_amount),
    color: text(row.color, "#126b59"),
  };
}

function normalizeGoal(row: Record<string, unknown>): Goal {
  return {
    id: text(row.id),
    name: text(row.name, "Target"),
    target: number(row.target ?? row.targetAmount ?? row.target_amount),
    current: number(row.current ?? row.currentAmount ?? row.current_amount),
    deadline: text(row.deadline).slice(0, 10),
    color: text(row.color, "#126b59"),
    icon: text(row.icon, "target"),
  };
}

function normalizeBill(row: Record<string, unknown>, month: string): Bill {
  const due = text(row.dueDate ?? row.due_date).slice(0, 10);
  return {
    id: text(row.id),
    name: text(row.name, "Tagihan"),
    amount: number(row.amount),
    dueDate: due,
    category: text(row.category, "Tagihan"),
    accountId: text(row.accountId ?? row.account_id),
    paid: bool(row.paid) || text(row.lastPaidPeriod ?? row.last_paid_period) === month,
  };
}

function normalizeSnapshot(raw: unknown, month: string): FinanceSnapshot {
  const source = (raw ?? {}) as Record<string, unknown>;
  const profile = (source.profile ?? {}) as Record<string, unknown>;
  const accounts = ((source.accounts ?? []) as Record<string, unknown>[]).map(normalizeAccount);
  return {
    configured: source.configured === undefined ? accounts.length > 0 : bool(source.configured),
    profile: {
      name: text(profile.name, "Vinn"),
      storeName: text(profile.storeName ?? profile.store_name, "VINN STORE"),
      currency: text(profile.currency, "IDR"),
      timezone: text(profile.timezone, "Asia/Jakarta"),
    },
    accounts,
    transactions: ((source.transactions ?? []) as Record<string, unknown>[]).map(normalizeTransaction),
    budgets: ((source.budgets ?? []) as Record<string, unknown>[]).map(normalizeBudget),
    goals: ((source.goals ?? []) as Record<string, unknown>[]).map(normalizeGoal),
    bills: ((source.bills ?? []) as Record<string, unknown>[]).map((row) => normalizeBill(row, month)),
  };
}

export async function loadFinanceSnapshot(month: string) {
  const raw = hasAppsScriptBridge()
    ? await callAppsScript<unknown>("bootstrap", { month })
    : await webRequest<unknown>(`/api/finance/bootstrap?month=${encodeURIComponent(month)}`);
  return normalizeSnapshot(raw, month);
}

export async function setupFinanceWorkspace(input: SetupWorkspaceInput, month: string) {
  const raw = await mutation<unknown>("setupWorkspace", "/api/finance/setup", input as unknown as Record<string, unknown>);
  return normalizeSnapshot(raw, month);
}

export const createFinanceAccount = (payload: Record<string, unknown>) =>
  mutation("createAccount", "/api/finance/accounts", payload);

export const archiveFinanceAccount = (accountId: string) =>
  mutation("archiveAccount", `/api/finance/accounts/${encodeURIComponent(accountId)}/archive`, { accountId });

export const createFinanceTransaction = (transaction: Transaction) =>
  mutation("createTransaction", "/api/finance/transactions", {
    requestId: transaction.id,
    type: transaction.type,
    date: transaction.date,
    accountId: transaction.accountId,
    destinationAccountId: transaction.destinationAccountId,
    amount: transaction.amount,
    category: transaction.category,
    merchant: transaction.merchant || transaction.title,
    title: transaction.title,
    status: transaction.status,
  });

export const deleteFinanceTransaction = (transactionId: string) =>
  mutation("deleteTransaction", `/api/finance/transactions/${encodeURIComponent(transactionId)}/delete`, { transactionId, requestId: crypto.randomUUID() });

export const upsertFinanceBudget = (payload: Record<string, unknown>) =>
  mutation("upsertBudget", "/api/finance/budgets", payload);

export const createFinanceGoal = (payload: Record<string, unknown>) =>
  mutation("createGoal", "/api/finance/goals", payload);

export const contributeFinanceGoal = (goalId: string, amount: number) =>
  mutation("contributeGoal", `/api/finance/goals/${encodeURIComponent(goalId)}/contribute`, { goalId, amount });

export const createFinanceBill = (payload: Record<string, unknown>) =>
  mutation("createBill", "/api/finance/bills", payload);

export const markFinanceBillPaid = (bill: Bill, period: string, date: string) =>
  mutation("markBillPaid", `/api/finance/bills/${encodeURIComponent(bill.id)}/paid`, {
    billId: bill.id,
    period,
    date,
    requestId: `bill-payment:${bill.id}:${period}`,
  });

export const financeBackendLabel = () => hasAppsScriptBridge() ? "Google Sheets" : "Cloud database";
