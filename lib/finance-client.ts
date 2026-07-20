import type { Account, AuditLog, Bill, Budget, FinanceCategory, Goal, InvestmentAsset, InvestmentTransaction, Transaction } from "./finance";
import type { AiAnswer, AiChatMessage, AiSettingsStatus, OcrReceipt } from "./ai";
import type { BackupOverview, BackupSchedule, ExportRecord, MigrationPreview } from "./portability";
import { recurringBillDueDate, type NotificationOverview, type NotificationSettings } from "./notifications";
import type { LedgerHealthReport } from "./ledger";
import type { AccountImportItem } from "./account-import";
import { DEFAULT_ROADMAP_SETTINGS, type RoadmapSettings } from "./roadmap";
import { DEFAULT_DEBT_SETTINGS, type DebtPlan, type DebtPlannerSettings } from "./debt";
import { DEFAULT_CASHFLOW_FORECAST_SETTINGS, type CashflowForecastSettings } from "./cashflow-forecast";
import { DEFAULT_EMERGENCY_FUND_SETTINGS, type EmergencyFundSettings } from "./emergency-fund";
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
  categories: FinanceCategory[];
  auditLogs: AuditLog[];
  investmentAssets: InvestmentAsset[];
  investmentTransactions: InvestmentTransaction[];
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

async function mutation<T>(action: string, path: string, payload: Record<string, unknown>, method = "POST") {
  const requestPayload = { ...payload, requestId: payload.requestId ?? crypto.randomUUID() };
  if (hasAppsScriptBridge()) return callAppsScript<T>(action, requestPayload);
  return webRequest<T>(path, { method, body: JSON.stringify(requestPayload) });
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
  const rawTags = row.tags ?? row.tags_json ?? [];
  const rawSplits = row.splits ?? row.splits_json ?? [];
  const parseArray = (value: unknown) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value) return [];
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return value.split(",").map((item) => item.trim()).filter(Boolean); }
  };
  const receipt = (row.receipt ?? null) as Record<string, unknown> | null;
  return {
    id: text(row.id),
    type: text(row.type, "expense") as Transaction["type"],
    date: text(row.date).slice(0, 10),
    time: text(row.time),
    title: text(row.title ?? row.description ?? row.merchant, "Transaksi"),
    merchant: text(row.merchant),
    category: text(row.category, "Lainnya"),
    notes: text(row.notes),
    tags: parseArray(rawTags).map(String),
    location: text(row.location),
    splits: parseArray(rawSplits).map((split, index) => {
      const value = split as Record<string, unknown>;
      return { id: text(value.id, `split-${index}`), category: text(value.category), amount: number(value.amount), note: text(value.note) || undefined };
    }),
    accountId: text(row.accountId ?? row.account_id),
    destinationAccountId: text(row.destinationAccountId ?? row.destination_account_id) || undefined,
    amount: number(row.amount),
    status: text(row.status, "completed") as Transaction["status"],
    transferGroupId: text(row.transferGroupId ?? row.transfer_group_id) || undefined,
    updatedAt: text(row.updatedAt ?? row.updated_at) || undefined,
    deletedAt: text(row.deletedAt ?? row.deleted_at) || undefined,
    receipt: receipt ? {
      id: text(receipt.id),
      filename: text(receipt.filename, "lampiran-struk"),
      contentType: text(receipt.contentType ?? receipt.content_type, "application/octet-stream"),
      sizeBytes: number(receipt.sizeBytes ?? receipt.size_bytes),
      url: text(receipt.url) || undefined,
    } : undefined,
  };
}

function normalizeCategory(row: Record<string, unknown>): FinanceCategory {
  const activeValue = row.active ?? row.isActive ?? row.is_active;
  const archived = bool(row.archived) || (activeValue !== undefined && !bool(activeValue));
  return {
    id: text(row.id),
    name: text(row.name, "Lainnya"),
    type: text(row.type, "expense") as FinanceCategory["type"],
    color: text(row.color, "#126b59"),
    active: !archived,
    archived,
    isDefault: bool(row.isDefault ?? row.is_default),
    icon: text(row.icon) || undefined,
  };
}

function normalizeAuditLog(row: Record<string, unknown>): AuditLog {
  let details = row.details ?? row.detailsJson ?? row.details_json;
  if (typeof details === "string") {
    try { details = JSON.parse(details) as Record<string, unknown>; } catch { /* keep readable legacy text */ }
  }
  return {
    id: text(row.id),
    action: text(row.action, "UPDATE"),
    module: text(row.module ?? row.entityType ?? row.entity_type, "system"),
    entityId: text(row.entityId ?? row.entity_id) || undefined,
    details: details as AuditLog["details"],
    actor: text(row.actor ?? row.actorEmail ?? row.actor_email) || undefined,
    createdAt: text(row.createdAt ?? row.created_at),
  };
}

function normalizeBudget(row: Record<string, unknown>, index: number): Budget {
  return {
    id: text(row.id, `budget-${index}`),
    category: text(row.category, "Lainnya"),
    limit: number(row.limit ?? row.limitAmount ?? row.limit_amount),
    color: text(row.color, "#126b59"),
    period: text(row.period ?? row.month) || undefined,
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
  const sourceDue = text(row.dueDate ?? row.due_date).slice(0, 10);
  const due = sourceDue.slice(0, 7) <= month ? recurringBillDueDate(sourceDue, month, "monthly") : sourceDue;
  const rawReminderDays = row.reminderDays ?? row.reminder_days ?? "7,3,1,0";
  const reminderDays = (Array.isArray(rawReminderDays) ? rawReminderDays : String(rawReminderDays).split(","))
    .map(Number)
    .filter((value) => Number.isSafeInteger(value) && value >= 0 && value <= 30);
  return {
    id: text(row.id),
    name: text(row.name, "Tagihan"),
    amount: number(row.amount),
    dueDate: due,
    category: text(row.category, "Tagihan"),
    accountId: text(row.accountId ?? row.account_id),
    paid: bool(row.paid) || text(row.lastPaidPeriod ?? row.last_paid_period) === month,
    frequency: "monthly",
    reminderDays: reminderDays.length ? reminderDays : [7, 3, 1, 0],
    lastPaidPeriod: text(row.lastPaidPeriod ?? row.last_paid_period) || null,
  };
}

function normalizeInvestmentAsset(row: Record<string, unknown>): InvestmentAsset {
  return {
    id: text(row.id),
    accountId: text(row.accountId ?? row.account_id),
    ticker: text(row.ticker).toUpperCase(),
    name: text(row.name, "Aset investasi"),
    assetClass: text(row.assetClass ?? row.asset_class, "Custom") as InvestmentAsset["assetClass"],
    exchange: text(row.exchange),
    currency: text(row.currency, "IDR"),
    units: number(row.units),
    costBasis: number(row.costBasis ?? row.cost_basis),
    averageCost: number(row.averageCost ?? row.average_cost),
    marketPrice: number(row.marketPrice ?? row.market_price ?? row.latestPriceCache ?? row.latest_price_cache),
    marketValue: number(row.marketValue ?? row.market_value),
    unrealizedPl: number(row.unrealizedPl ?? row.unrealized_pl),
    realizedPl: number(row.realizedPl ?? row.realized_pl),
    priceSource: text(row.priceSource ?? row.price_source, "unavailable") as InvestmentAsset["priceSource"],
    priceStatus: text(row.priceStatus ?? row.price_status, "unavailable") as InvestmentAsset["priceStatus"],
    priceUpdatedAt: text(row.priceUpdatedAt ?? row.price_updated_at) || undefined,
    active: row.active === undefined ? true : bool(row.active),
    updatedAt: text(row.updatedAt ?? row.updated_at) || undefined,
  };
}

function normalizeInvestmentTransaction(row: Record<string, unknown>): InvestmentTransaction {
  return {
    id: text(row.id),
    assetId: text(row.assetId ?? row.asset_id),
    accountId: text(row.accountId ?? row.account_id),
    date: text(row.date).slice(0, 10),
    type: text(row.type, "buy") as InvestmentTransaction["type"],
    units: number(row.units),
    pricePerUnit: number(row.pricePerUnit ?? row.price_per_unit ?? row.price),
    grossAmount: number(row.grossAmount ?? row.gross_amount),
    fee: number(row.fee),
    tax: number(row.tax),
    netAmount: number(row.netAmount ?? row.net_amount ?? row.totalAmount ?? row.total_amount),
    averageCostAfter: number(row.averageCostAfter ?? row.average_cost_after),
    remainingUnitsAfter: number(row.remainingUnitsAfter ?? row.remaining_units_after),
    realizedPl: number(row.realizedPl ?? row.realized_pl),
    note: text(row.note ?? row.notes) || undefined,
    createdAt: text(row.createdAt ?? row.created_at) || undefined,
  };
}

function normalizeSnapshot(raw: unknown, month: string): FinanceSnapshot {
  const source = (raw ?? {}) as Record<string, unknown>;
  const profile = (source.profile ?? {}) as Record<string, unknown>;
  const accounts = ((source.accounts ?? []) as Record<string, unknown>[]).map(normalizeAccount);
  const legacyStoreName = text(profile.storeName ?? profile.store_name, "Financial Planner");
  return {
    configured: source.configured === undefined ? accounts.length > 0 : bool(source.configured),
    profile: {
      name: text(profile.name, "Vinn"),
      storeName: legacyStoreName.toUpperCase() === "VINN STORE" ? "Financial Planner" : legacyStoreName,
      currency: text(profile.currency, "IDR"),
      timezone: text(profile.timezone, "Asia/Jakarta"),
    },
    accounts,
    transactions: ((source.transactions ?? []) as Record<string, unknown>[]).map(normalizeTransaction),
    budgets: ((source.budgets ?? []) as Record<string, unknown>[]).map(normalizeBudget),
    goals: ((source.goals ?? []) as Record<string, unknown>[]).map(normalizeGoal),
    bills: ((source.bills ?? []) as Record<string, unknown>[]).map((row) => normalizeBill(row, month)),
    categories: ((source.categories ?? []) as Record<string, unknown>[]).map(normalizeCategory),
    auditLogs: ((source.auditLogs ?? source.audit_logs ?? []) as Record<string, unknown>[]).map(normalizeAuditLog),
    investmentAssets: ((source.investmentAssets ?? source.investment_assets ?? source.assets ?? []) as Record<string, unknown>[]).map(normalizeInvestmentAsset),
    investmentTransactions: ((source.investmentTransactions ?? source.investment_transactions ?? []) as Record<string, unknown>[]).map(normalizeInvestmentTransaction),
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

export const updateFinanceProfile = (
  name: string,
  requestId = `profile-update:${crypto.randomUUID()}`,
) => mutation<{ profileName: string; replayed?: boolean; duplicate?: boolean }>(
  "updateProfile",
  "/api/finance/profile",
  { name, requestId },
  "PATCH",
);

const normalizeRoadmapSettings = (value: unknown): RoadmapSettings => {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const horizon = number(source.horizonMonths ?? source.horizon_months);
  return {
    horizonMonths: ([12, 24, 36, 60].includes(horizon) ? horizon : DEFAULT_ROADMAP_SETTINGS.horizonMonths) as RoadmapSettings["horizonMonths"],
    incomeAdjustmentPct: number(source.incomeAdjustmentPct ?? source.income_adjustment_pct ?? DEFAULT_ROADMAP_SETTINGS.incomeAdjustmentPct),
    expenseAdjustmentPct: number(source.expenseAdjustmentPct ?? source.expense_adjustment_pct ?? DEFAULT_ROADMAP_SETTINGS.expenseAdjustmentPct),
    annualInvestmentReturnPct: number(source.annualInvestmentReturnPct ?? source.annual_investment_return_pct ?? DEFAULT_ROADMAP_SETTINGS.annualInvestmentReturnPct),
    annualInflationPct: number(source.annualInflationPct ?? source.annual_inflation_pct ?? DEFAULT_ROADMAP_SETTINGS.annualInflationPct),
    monthlyInvestment: number(source.monthlyInvestment ?? source.monthly_investment ?? DEFAULT_ROADMAP_SETTINGS.monthlyInvestment),
  };
};

export async function loadFinanceRoadmapSettings() {
  const raw = hasAppsScriptBridge()
    ? await callAppsScript<unknown>("getRoadmapSettings", {})
    : await webRequest<unknown>("/api/finance/roadmap");
  return normalizeRoadmapSettings(raw);
}

export async function updateFinanceRoadmapSettings(
  settings: RoadmapSettings,
  requestId = `roadmap-update:${crypto.randomUUID()}`,
) {
  const raw = await mutation<unknown>("updateRoadmapSettings", "/api/finance/roadmap", { ...settings, requestId }, "PATCH");
  return normalizeRoadmapSettings(raw);
}

export type FinanceDebtPlanner = { settings: DebtPlannerSettings; debts: DebtPlan[] };

const normalizeDebtPlanner = (value: unknown): FinanceDebtPlanner => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const rawSettings = source.settings && typeof source.settings === "object" ? source.settings as Record<string, unknown> : {};
  return {
    settings: {
      strategy: rawSettings.strategy === "snowball" ? "snowball" : DEFAULT_DEBT_SETTINGS.strategy,
      extraMonthlyPayment: Math.max(0, number(rawSettings.extraMonthlyPayment ?? rawSettings.extra_monthly_payment)),
    },
    debts: Array.isArray(source.debts) ? source.debts.map((item) => {
      const debt = item as Record<string, unknown>;
      return {
        accountId: text(debt.accountId ?? debt.account_id), name: text(debt.name, "Utang"), balance: number(debt.balance),
        annualInterestRatePct: number(debt.annualInterestRatePct ?? debt.annual_interest_rate_pct),
        minimumPayment: number(debt.minimumPayment ?? debt.minimum_payment), dueDay: number(debt.dueDay ?? debt.due_day) || 1,
      };
    }) : [],
  };
};

export async function loadFinanceDebtPlanner() {
  const raw = hasAppsScriptBridge() ? await callAppsScript<unknown>("getDebtPlanner", {}) : await webRequest<unknown>("/api/finance/debts");
  return normalizeDebtPlanner(raw);
}

export async function updateFinanceDebtPlannerSettings(settings: DebtPlannerSettings, requestId = `debt-settings:${crypto.randomUUID()}`) {
  const raw = await mutation<unknown>("updateDebtPlanner", "/api/finance/debts", { mode: "settings", ...settings, requestId }, "PATCH");
  return normalizeDebtPlanner(raw);
}

export async function upsertFinanceDebtPlan(plan: Omit<DebtPlan, "name" | "balance">, requestId = `debt-plan:${crypto.randomUUID()}`) {
  const raw = await mutation<unknown>("updateDebtPlanner", "/api/finance/debts", { mode: "debt", ...plan, requestId }, "PATCH");
  return normalizeDebtPlanner(raw);
}

const normalizeCashflowForecastSettings = (value: unknown): CashflowForecastSettings => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const horizon = number(source.horizonDays ?? source.horizon_days);
  return {
    horizonDays: ([30, 60, 90].includes(horizon) ? horizon : DEFAULT_CASHFLOW_FORECAST_SETTINGS.horizonDays) as CashflowForecastSettings["horizonDays"],
    monthlyIncomeOverride: Math.max(0, number(source.monthlyIncomeOverride ?? source.monthly_income_override)),
    incomeDay: Math.max(1, Math.min(28, number(source.incomeDay ?? source.income_day) || DEFAULT_CASHFLOW_FORECAST_SETTINGS.incomeDay)),
    minimumCashBuffer: Math.max(0, number(source.minimumCashBuffer ?? source.minimum_cash_buffer ?? DEFAULT_CASHFLOW_FORECAST_SETTINGS.minimumCashBuffer)),
  };
};

export async function loadFinanceCashflowForecastSettings() {
  const raw = hasAppsScriptBridge() ? await callAppsScript<unknown>("getCashflowForecastSettings", {}) : await webRequest<unknown>("/api/finance/forecast");
  return normalizeCashflowForecastSettings(raw);
}

export async function updateFinanceCashflowForecastSettings(settings: CashflowForecastSettings, requestId = `forecast-update:${crypto.randomUUID()}`) {
  const raw = await mutation<unknown>("updateCashflowForecastSettings", "/api/finance/forecast", { ...settings, requestId }, "PATCH");
  return normalizeCashflowForecastSettings(raw);
}

const normalizeEmergencyFundSettings = (value: unknown): EmergencyFundSettings => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const target = number(source.targetMonths ?? source.target_months);
  return { targetMonths: ([3,6,9,12].includes(target) ? target : DEFAULT_EMERGENCY_FUND_SETTINGS.targetMonths) as EmergencyFundSettings["targetMonths"], monthlyExpenseOverride: Math.max(0, number(source.monthlyExpenseOverride ?? source.monthly_expense_override)), monthlyContribution: Math.max(0, number(source.monthlyContribution ?? source.monthly_contribution)), accountIds: Array.isArray(source.accountIds) ? source.accountIds.map(String) : [] };
};
export async function loadFinanceEmergencyFundSettings() {
  const raw = hasAppsScriptBridge() ? await callAppsScript<unknown>("getEmergencyFundSettings", {}) : await webRequest<unknown>("/api/finance/emergency-fund");
  return normalizeEmergencyFundSettings(raw);
}
export async function updateFinanceEmergencyFundSettings(settings: EmergencyFundSettings, requestId = `emergency-fund:${crypto.randomUUID()}`) {
  const raw = await mutation<unknown>("updateEmergencyFundSettings", "/api/finance/emergency-fund", { ...settings, requestId }, "PATCH");
  return normalizeEmergencyFundSettings(raw);
}

export const createFinanceAccount = (payload: Record<string, unknown>) =>
  mutation("createAccount", "/api/finance/accounts", payload);

export const importFinanceAccounts = (accounts: AccountImportItem[], requestId = `account-import:${crypto.randomUUID()}`) =>
  mutation<{ imported: number }>("importAccounts", "/api/finance/accounts/import", { accounts, requestId });

export const archiveFinanceAccount = (accountId: string) =>
  mutation("archiveAccount", `/api/finance/accounts/${encodeURIComponent(accountId)}/archive`, { accountId, requestId: `account-archive:${accountId}` });

export const createFinanceTransaction = (transaction: Transaction) =>
  mutation("createTransaction", "/api/finance/transactions", {
    requestId: transaction.id,
    type: transaction.type,
    date: transaction.date,
    time: transaction.time,
    accountId: transaction.accountId,
    destinationAccountId: transaction.destinationAccountId,
    amount: transaction.amount,
    category: transaction.category,
    notes: transaction.notes,
    tags: transaction.tags,
    location: transaction.location,
    splits: transaction.splits,
    merchant: transaction.merchant || transaction.title,
    title: transaction.title,
    status: transaction.status,
  });

export const updateFinanceTransaction = (transaction: Transaction, requestId = `transaction-update:${crypto.randomUUID()}`) =>
  mutation("updateTransaction", `/api/finance/transactions/${encodeURIComponent(transaction.id)}`, {
    requestId,
    transactionId: transaction.id,
    type: transaction.type,
    date: transaction.date,
    time: transaction.time,
    accountId: transaction.accountId,
    destinationAccountId: transaction.destinationAccountId,
    amount: transaction.amount,
    category: transaction.category,
    notes: transaction.notes,
    tags: transaction.tags,
    location: transaction.location,
    splits: transaction.splits,
    merchant: transaction.merchant || transaction.title,
    title: transaction.title,
    status: transaction.status,
    expectedUpdatedAt: transaction.updatedAt,
  }, "PATCH");

export const deleteFinanceTransaction = (transactionId: string, expectedUpdatedAt?: string) =>
  mutation("deleteTransaction", `/api/finance/transactions/${encodeURIComponent(transactionId)}/delete`, { transactionId, expectedUpdatedAt, requestId: `transaction-delete:${transactionId}` });

export type TransactionListFilters = {
  page?: number;
  pageSize?: number;
  query?: string;
  type?: string;
  category?: string;
  accountId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type TransactionListResult = {
  transactions: Transaction[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function loadFinanceTransactions(filters: TransactionListFilters): Promise<TransactionListResult> {
  if (hasAppsScriptBridge()) {
    const raw = await callAppsScript<{ items?: Record<string, unknown>[]; transactions?: Record<string, unknown>[]; page?: number; pageSize?: number; total?: number; totalPages?: number }>("listTransactions", filters);
    const rows = raw.items ?? raw.transactions ?? [];
    const pageSize = number(raw.pageSize) || filters.pageSize || 25;
    const total = number(raw.total) || rows.length;
    return { transactions: rows.map(normalizeTransaction), page: number(raw.page) || 1, pageSize, total, totalPages: number(raw.totalPages) || Math.max(1, Math.ceil(total / pageSize)) };
  }
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value !== undefined && value !== "" && params.set(key, String(value)));
  const raw = await webRequest<{ transactions: Record<string, unknown>[]; page: number; pageSize: number; total: number; totalPages: number }>(`/api/finance/transactions?${params}`);
  return { ...raw, transactions: raw.transactions.map(normalizeTransaction) };
}

export const importFinanceTransactions = (transactions: Transaction[], requestId = `transaction-import:${crypto.randomUUID()}`) =>
  mutation<{ imported: number }>("importTransactions", "/api/finance/transactions/import", { transactions, requestId });

export const undoLastFinanceTransactionAction = (requestId = `transaction-undo:${crypto.randomUUID()}`) =>
  mutation<{ undone: boolean; action: string; transactionId: string }>("undoTransaction", "/api/finance/transactions/undo", { requestId });

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
  reader.onerror = () => reject(new Error("Lampiran tidak dapat dibaca."));
  reader.readAsDataURL(file);
});

export async function uploadFinanceTransactionReceipt(transactionId: string, file: File) {
  if (hasAppsScriptBridge()) {
    return callAppsScript("attachTransactionReceipt", { transactionId, filename: file.name, contentType: file.type, contentBase64: await fileToBase64(file) });
  }
  const form = new FormData();
  form.set("file", file);
  const response = await fetch(`/api/finance/transactions/${encodeURIComponent(transactionId)}/attachments`, { method: "POST", body: form });
  const body = await response.json() as { error?: string | { message?: string } };
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : body.error?.message || "Lampiran tidak dapat disimpan.");
  return body;
}

export const deleteFinanceTransactionReceipt = (transactionId: string, receiptId: string) =>
  mutation("deleteTransactionReceipt", `/api/finance/transactions/${encodeURIComponent(transactionId)}/attachments/${encodeURIComponent(receiptId)}`, { transactionId, receiptId }, "DELETE");

export const financeTransactionReceiptUrl = (transactionId: string, receiptId: string, directUrl?: string) =>
  directUrl || `/api/finance/transactions/${encodeURIComponent(transactionId)}/attachments/${encodeURIComponent(receiptId)}`;

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

export const createFinanceCategory = (payload: { name: string; type: "income" | "expense"; color: string; icon?: string }, requestId = `category-create:${crypto.randomUUID()}`) =>
  mutation("createCategory", "/api/finance/categories", {
    ...payload,
    requestId,
  });

export const updateFinanceCategory = (categoryId: string, payload: { name: string; type: "income" | "expense"; color: string; icon?: string }, requestId = `category-update:${crypto.randomUUID()}`) =>
  mutation("updateCategory", `/api/finance/categories/${encodeURIComponent(categoryId)}`, {
    ...payload,
    categoryId,
    requestId,
  }, "PATCH");

export const archiveFinanceCategory = (categoryId: string) =>
  mutation("archiveCategory", `/api/finance/categories/${encodeURIComponent(categoryId)}/archive`, {
    categoryId,
    requestId: `category-archive:${categoryId}`,
  });

export const reconcileFinanceAccount = (accountId: string, actualBalance: number, date: string, note: string, requestId: string) =>
  mutation("reconcileAccount", `/api/finance/accounts/${encodeURIComponent(accountId)}/reconcile`, {
    accountId,
    actualBalance,
    date,
    note,
    notes: note,
    requestId,
  });

export const loadFinanceLedgerHealth = () => hasAppsScriptBridge()
  ? callAppsScript<LedgerHealthReport>("inspectLedger", {})
  : webRequest<LedgerHealthReport>("/api/finance/ledger");

export const repairFinanceLedger = (expectedRevision: string, requestId = `ledger-repair:${crypto.randomUUID()}`) =>
  mutation<LedgerHealthReport>("repairLedger", "/api/finance/ledger", { expectedRevision, requestId });

export const createFinanceInvestmentAsset = (payload: Record<string, unknown>, requestId = `investment-asset-create:${crypto.randomUUID()}`) =>
  mutation("createInvestmentAsset", "/api/finance/investments/assets", { ...payload, requestId });

export const updateFinanceInvestmentAsset = (assetId: string, payload: Record<string, unknown>, requestId = `investment-asset-update:${crypto.randomUUID()}`) =>
  mutation("updateInvestmentAsset", `/api/finance/investments/assets/${encodeURIComponent(assetId)}`, { ...payload, assetId, requestId }, "PATCH");

export const createFinanceInvestmentTrade = (payload: Record<string, unknown>, requestId = `investment-trade:${crypto.randomUUID()}`) =>
  mutation("createInvestmentTrade", "/api/finance/investments/transactions", { ...payload, requestId });

export const getFinanceAiSettings = () => hasAppsScriptBridge()
  ? callAppsScript<AiSettingsStatus>("aiSettings", {})
  : webRequest<AiSettingsStatus>("/api/finance/ai/settings");

export const updateFinanceAiSettings = (payload: {
  enabled: boolean;
  consentAccepted: boolean;
  apiKey?: string;
  removeApiKey?: boolean;
}) => hasAppsScriptBridge()
  ? callAppsScript<AiSettingsStatus>("updateAiSettings", payload)
  : webRequest<AiSettingsStatus>("/api/finance/ai/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });

export const loadFinanceAiMessages = () => hasAppsScriptBridge()
  ? callAppsScript<{ messages: AiChatMessage[] }>("aiHistory", {})
  : webRequest<{ messages: AiChatMessage[] }>("/api/finance/ai/assistant");

export const askFinanceAi = (question: string, period: string) =>
  mutation<AiAnswer>("askAi", "/api/finance/ai/assistant", { question, period });

export const clearFinanceAiMessages = () => hasAppsScriptBridge()
  ? callAppsScript<{ cleared: boolean }>("clearAiHistory", {})
  : webRequest<{ cleared: boolean }>("/api/finance/ai/assistant", { method: "DELETE" });

export const scanFinanceReceipt = (payload: {
  imageBase64: string;
  mimeType: string;
  fileName?: string;
}) => mutation<{ receipt: OcrReceipt; model: string; imageStored: false }>(
  "ocrReceipt",
  "/api/finance/ai/ocr",
  payload,
);

export const loadFinanceReports = () => hasAppsScriptBridge()
  ? callAppsScript<{ reports: ExportRecord[] }>("listReports", {})
  : webRequest<{ reports: ExportRecord[] }>("/api/finance/reports");

export const saveFinanceReport = (payload: {
  filename: string;
  contentBase64: string;
  period: string;
  sections: string[];
  privacy: boolean;
  pageCount: number;
}) => mutation<ExportRecord>("saveReportPdf", "/api/finance/reports", payload);

export const loadFinanceBackups = () => hasAppsScriptBridge()
  ? callAppsScript<BackupOverview>("backupOverview", {})
  : webRequest<BackupOverview>("/api/finance/backups");

export const createFinanceBackup = () => mutation<ExportRecord>("createBackup", "/api/finance/backups", {});

export const updateFinanceBackupSchedule = (enabled: boolean, frequency: BackupSchedule["frequency"]) => hasAppsScriptBridge()
  ? callAppsScript<BackupOverview>("updateBackupSchedule", { enabled, frequency })
  : webRequest<BackupOverview>("/api/finance/backups", {
      method: "PUT",
      body: JSON.stringify({ enabled, frequency }),
    });

export const loadFinanceMigrations = () => hasAppsScriptBridge()
  ? callAppsScript<{ migrations: MigrationPreview[] }>("migrationHistory", {})
  : webRequest<{ migrations: MigrationPreview[] }>("/api/finance/migrations");

export const previewFinanceMigration = (sourceName: string, backup: Record<string, unknown>) => mutation<MigrationPreview>(
  "previewMigration",
  "/api/finance/migrations/preview",
  { sourceName, backup },
);

export const applyFinanceMigration = (migrationId: string) => mutation<MigrationPreview>(
  "applyMigration",
  `/api/finance/migrations/${encodeURIComponent(migrationId)}/apply`,
  { migrationId },
);

export const cancelFinanceMigration = (migrationId: string) => mutation<MigrationPreview>(
  "cancelMigration",
  `/api/finance/migrations/${encodeURIComponent(migrationId)}/cancel`,
  { migrationId },
);

export const loadFinanceNotifications = (period: string) => hasAppsScriptBridge()
  ? callAppsScript<NotificationOverview>("notificationOverview", { period })
  : webRequest<NotificationOverview>(`/api/finance/notifications?period=${encodeURIComponent(period)}`);

export const updateFinanceNotificationSettings = (settings: NotificationSettings) => hasAppsScriptBridge()
  ? callAppsScript<{ settings: NotificationSettings }>("updateNotificationSettings", settings)
  : webRequest<{ settings: NotificationSettings }>("/api/finance/notifications", {
      method: "PUT",
      body: JSON.stringify(settings),
    });

export const updateFinanceNotificationStates = (notificationIds: string[], action: "read" | "unread" | "dismiss" | "restore") => mutation<{ updated: number; action: string }>(
  "updateNotificationState",
  "/api/finance/notifications",
  { notificationIds, action },
);

export const financeBackendLabel = () => hasAppsScriptBridge() ? "Google Sheets" : "Cloud database";
