import type { Account, AuditLog, Bill, Budget, FinanceCategory, Goal, InvestmentAsset, InvestmentTransaction, Transaction } from "./finance";
import type { AiAnswer, AiChatMessage, AiSettingsStatus, OcrReceipt } from "./ai";
import type { BackupOverview, BackupSchedule, ExportRecord, MigrationPreview } from "./portability";
import { recurringBillDueDate, type NotificationOverview, type NotificationSettings } from "./notifications";
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
    updatedAt: text(row.updatedAt ?? row.updated_at) || undefined,
    deletedAt: text(row.deletedAt ?? row.deleted_at) || undefined,
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

export const createFinanceAccount = (payload: Record<string, unknown>) =>
  mutation("createAccount", "/api/finance/accounts", payload);

export const archiveFinanceAccount = (accountId: string) =>
  mutation("archiveAccount", `/api/finance/accounts/${encodeURIComponent(accountId)}/archive`, { accountId, requestId: `account-archive:${accountId}` });

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

export const updateFinanceTransaction = (transaction: Transaction, requestId = `transaction-update:${crypto.randomUUID()}`) =>
  mutation("updateTransaction", `/api/finance/transactions/${encodeURIComponent(transaction.id)}`, {
    requestId,
    transactionId: transaction.id,
    type: transaction.type,
    date: transaction.date,
    accountId: transaction.accountId,
    destinationAccountId: transaction.destinationAccountId,
    amount: transaction.amount,
    category: transaction.category,
    merchant: transaction.merchant || transaction.title,
    title: transaction.title,
    status: transaction.status,
    expectedUpdatedAt: transaction.updatedAt,
  }, "PATCH");

export const deleteFinanceTransaction = (transactionId: string, expectedUpdatedAt?: string) =>
  mutation("deleteTransaction", `/api/finance/transactions/${encodeURIComponent(transactionId)}/delete`, { transactionId, expectedUpdatedAt, requestId: `transaction-delete:${transactionId}` });

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
