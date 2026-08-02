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
import type { RecurringTemplate } from "./recurring";
import type { MonthlyClosing, MonthlyReview } from "./monthly-review";
import type { CategoryRule } from "./category-rules";
import type { SinkingFund, SinkingFundEntry } from "./sinking-funds";
import { normalizeFeaturePreferences, type FeaturePreferences } from "./feature-preferences";
import { callAppsScript, getAppsScriptSessionScope, hasAppsScriptBridge } from "./apps-script-client";
import { freeEntitlement, type PlanCapability, type PlanEntitlement, type PlanTier } from "./plans";
import { demoRequest, demoSecurityStatus, isFinanceDemoMode } from "./demo-finance";
import { installmentAmountAt, normalizeInstallmentPhases } from "./installment-phases";
import { FINANCE_SCHEMA_VERSION } from "./schema-version";

export type FinanceProfile = {
  name: string;
  storeName: string;
  currency: string;
  timezone: string;
};

export type FinanceSecurityStatus = {
  authenticated: boolean;
  displayName: string | null;
  email: string | null;
  provider: string;
  accessMode: "owner_only" | "deployment_managed";
  workspaceIsolation: "server_enforced";
  sessionState: "verified" | "local_preview" | "protected";
  signOutUrl: string | null;
};

export type FinanceSnapshot = {
  schemaVersion: string;
  configured: boolean;
  entitlement: PlanEntitlement;
  profile: FinanceProfile;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  sinkingFunds: SinkingFund[];
  sinkingFundEntries: SinkingFundEntry[];
  bills: Bill[];
  categories: FinanceCategory[];
  categoryRules: CategoryRule[];
  auditLogs: AuditLog[];
  investmentAssets: InvestmentAsset[];
  investmentTransactions: InvestmentTransaction[];
  featurePreferences: FeaturePreferences;
  /** Mode Pasangan aktif untuk sesi ini, sehingga akun dapat ditandai pribadi. */
  coupleMode: boolean;
};

export type FinanceDiagnostics = {
  checkedAt: string;
  durationMs: number;
  backend: string;
  overall: "healthy" | "attention";
  schemaVersion: string;
  expectedSchemaVersion: string;
  structureIssues: string[];
  ledgerStatus: LedgerHealthReport["status"];
  accessState: FinanceSecurityStatus["sessionState"];
  licenseTier: PlanTier;
  licenseStatus: PlanEntitlement["status"];
  counts: { accounts: number; transactions: number; bills: number; goals: number };
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

export type LoanDrawdownInput = {
  requestId: string;
  liabilityAccountId: string;
  destinationAccountId: string;
  cashReceived: number;
  totalObligation: number;
  date: string;
  title: string;
  notes?: string;
};

const jsonHeaders = { "content-type": "application/json" };

export class FinanceApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "FinanceApiError";
  }
}

export class FinanceMutationCommittedError extends Error {
  constructor(public action: string, public requestId: string) {
    super("Perubahan sudah tersimpan; tampilan sedang disinkronkan.");
    this.name = "FinanceMutationCommittedError";
  }
}

export const isFinanceMutationCommittedError = (error: unknown): error is FinanceMutationCommittedError =>
  error instanceof FinanceMutationCommittedError;

export const FINANCE_MUTATION_PROGRESS_EVENT = "financial-planner:mutation-progress";

export type FinanceMutationProgress = {
  phase: "slow" | "complete";
  action: string;
  requestId: string;
  elapsedMs: number;
};

const emitMutationProgress = (detail: FinanceMutationProgress) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<FinanceMutationProgress>(FINANCE_MUTATION_PROGRESS_EVENT, { detail }));
};

class FinanceMutationTimeoutError extends Error {
  constructor() {
    super("Waktu respons Google Apps Script habis.");
    this.name = "FinanceMutationTimeoutError";
  }
}

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number) => new Promise<T>((resolve, reject) => {
  const timer = window.setTimeout(() => reject(new FinanceMutationTimeoutError()), timeoutMs);
  promise.then(
    (value) => { window.clearTimeout(timer); resolve(value); },
    (error) => { window.clearTimeout(timer); reject(error); },
  );
});

async function webRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { ...jsonHeaders, ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as { data?: T; error?: string | { code?: string; message?: string; details?: unknown } } & T;
  if (!response.ok) {
    const error = typeof body.error === "string" ? { message: body.error } : body.error;
    throw new FinanceApiError(
      response.status,
      error?.code ?? "REQUEST_FAILED",
      error?.message || `Permintaan gagal (${response.status}).`,
      error?.details,
    );
  }
  return (body.data ?? body) as T;
}

async function mutation<T>(action: string, path: string, payload: Record<string, unknown>, method = "POST") {
  const requestPayload = { ...payload, requestId: payload.requestId ?? crypto.randomUUID() };
  const requestId = String(requestPayload.requestId);
  const startedAt = Date.now();
  const slowTimer = typeof window === "undefined" ? null : window.setTimeout(() => {
    emitMutationProgress({ phase: "slow", action, requestId, elapsedMs: Date.now() - startedAt });
  }, 4_000);
  try {
    if (isFinanceDemoMode()) return demoRequest<T>(action, requestPayload);
    if (hasAppsScriptBridge()) {
      const pending = callAppsScript<T>(action, requestPayload);
      try {
        return await withTimeout(pending, 15_000);
      } catch (error) {
        if (!(error instanceof FinanceMutationTimeoutError)) throw error;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const status = await withTimeout(
            callAppsScript<{ completed: boolean }>("mutationStatus", { requestId: requestPayload.requestId }),
            8_000,
          ).catch(() => ({ completed: false }));
          if (status.completed) {
            try {
              return await withTimeout(pending, 3_000);
            } catch (pendingError) {
              if (!(pendingError instanceof FinanceMutationTimeoutError)) throw pendingError;
              throw new FinanceMutationCommittedError(action, requestId);
            }
          }
          if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 1_200));
        }
        throw new FinanceApiError(
          504,
          "APPS_SCRIPT_TIMEOUT",
          "Google Apps Script belum memberikan hasil. Coba lagi setelah beberapa saat.",
        );
      }
    }
    return webRequest<T>(path, { method, body: JSON.stringify(requestPayload) });
  } finally {
    if (slowTimer !== null) window.clearTimeout(slowTimer);
    emitMutationProgress({ phase: "complete", action, requestId, elapsedMs: Date.now() - startedAt });
  }
}

const text = (value: unknown, fallback = "") => value === undefined || value === null ? fallback : String(value);
const number = (value: unknown) => Number(value || 0);
const bool = (value: unknown) => value === true || value === 1 || String(value).toLowerCase() === "true";

export function normalizeFinanceDate(value: unknown) {
  const raw = text(value).trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}\s/.test(raw)) return raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw) && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return part("year") && part("month") && part("day")
    ? `${part("year")}-${part("month")}-${part("day")}`
    : "";
}

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
    scope: text(row.scope) === "private" ? "private" : "shared",
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
    date: normalizeFinanceDate(row.date),
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

function normalizeCategoryRule(row: Record<string, unknown>): CategoryRule {
  return {
    id: text(row.id),
    keyword: text(row.keyword),
    category: text(row.category),
    transactionType: text(row.transactionType ?? row.transaction_type, "expense") === "income" ? "income" : "expense",
    matchType: (["contains", "starts_with", "exact"].includes(text(row.matchType ?? row.match_type)) ? text(row.matchType ?? row.match_type) : "contains") as CategoryRule["matchType"],
    priority: number(row.priority ?? 100),
    active: row.active === undefined ? true : bool(row.active),
    createdAt: text(row.createdAt ?? row.created_at) || undefined,
    updatedAt: text(row.updatedAt ?? row.updated_at) || undefined,
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
    deadline: normalizeFinanceDate(row.deadline),
    color: text(row.color, "#126b59"),
    icon: text(row.icon, "target"),
  };
}

function normalizeSinkingFund(row: Record<string, unknown>): SinkingFund {
  return {
    id: text(row.id),
    name: text(row.name, "Pos dana"),
    purpose: text(row.purpose, "Lainnya") as SinkingFund["purpose"],
    targetAmount: number(row.targetAmount ?? row.target_amount),
    currentAmount: number(row.currentAmount ?? row.current_amount),
    monthlyContribution: number(row.monthlyContribution ?? row.monthly_contribution),
    targetDate: normalizeFinanceDate(row.targetDate ?? row.target_date),
    accountId: text(row.accountId ?? row.account_id),
    color: text(row.color, "#16876f"),
    active: row.active === undefined ? true : bool(row.active),
    createdAt: text(row.createdAt ?? row.created_at) || undefined,
    updatedAt: text(row.updatedAt ?? row.updated_at) || undefined,
  };
}

function normalizeSinkingFundEntry(row: Record<string, unknown>): SinkingFundEntry {
  return {
    id: text(row.id),
    fundId: text(row.fundId ?? row.fund_id),
    type: text(row.type, "allocate") === "release" ? "release" : "allocate",
    amount: number(row.amount),
    date: normalizeFinanceDate(row.date),
    note: text(row.note),
    createdAt: text(row.createdAt ?? row.created_at) || undefined,
  };
}

function normalizeBill(row: Record<string, unknown>, month: string): Bill {
  const sourceDue = normalizeFinanceDate(row.dueDate ?? row.due_date);
  const due = sourceDue.slice(0, 7) <= month ? recurringBillDueDate(sourceDue, month, "monthly") : sourceDue;
  const durationValue = number(row.durationMonths ?? row.duration_months);
  const durationMonths = durationValue > 0 ? durationValue : null;
  const paidCount = Math.max(0, number(row.paidCount ?? row.paid_count));
  const currentPeriodPaid = Math.max(0, number(row.currentPeriodPaid ?? row.current_period_paid));
  const totalPaid = Math.max(0, number(row.totalPaid ?? row.total_paid));
  let rawPhases = row.installmentPhases ?? row.installment_phases ?? row.installment_phases_json ?? [];
  if (typeof rawPhases === "string") {
    try { rawPhases = JSON.parse(rawPhases || "[]"); } catch { rawPhases = []; }
  }
  const installmentPhases = normalizeInstallmentPhases(rawPhases);
  const completed = bool(row.completed) || text(row.status).toLowerCase() === "completed" || Boolean(durationMonths && paidCount >= durationMonths);
  const rawReminderDays = row.reminderDays ?? row.reminder_days ?? "7,3,1,0";
  const reminderDays = (Array.isArray(rawReminderDays) ? rawReminderDays : String(rawReminderDays).split(","))
    .map(Number)
    .filter((value) => Number.isSafeInteger(value) && value >= 0 && value <= 30);
  return {
    id: text(row.id),
    name: text(row.name, "Tagihan"),
    amount: installmentAmountAt({ amount: number(row.amount), paidCount, installmentPhases }),
    dueDate: due,
    category: text(row.category, "Tagihan"),
    accountId: text(row.accountId ?? row.account_id),
    paid: completed || bool(row.paid) || text(row.lastPaidPeriod ?? row.last_paid_period) === month,
    frequency: "monthly",
    reminderDays: reminderDays.length ? reminderDays : [7, 3, 1, 0],
    lastPaidPeriod: text(row.lastPaidPeriod ?? row.last_paid_period) || null,
    liabilityAccountId: text(row.liabilityAccountId ?? row.liability_account_id) || null,
    durationMonths,
    paidCount,
    currentPeriodPaid,
    totalPaid,
    remainingMonths: durationMonths === null ? null : Math.max(0, durationMonths - paidCount),
    completed,
    startDueDate: sourceDue,
    installmentPhases,
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
    date: normalizeFinanceDate(row.date),
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

function normalizeEntitlement(raw: unknown): PlanEntitlement {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return freeEntitlement("setup-pending");
  const source = raw as Record<string, unknown>;
  const tier = (["free", "pro", "premium"].includes(text(source.tier)) ? text(source.tier) : "free") as PlanTier;
  const rawCapabilities = source.capabilities && typeof source.capabilities === "object" && !Array.isArray(source.capabilities)
    ? source.capabilities as Record<string, unknown>
    : {};
  const fallback = freeEntitlement(text(source.installationId, "setup-pending"));
  return {
    tier,
    label: text(source.label, tier === "premium" ? "Premium" : tier === "pro" ? "Pro" : "Free"),
    status: (["free", "active", "expired", "invalid"].includes(text(source.status)) ? text(source.status) : "free") as PlanEntitlement["status"],
    capabilities: Object.fromEntries(
      Object.keys(fallback.capabilities).map((capability) => [capability, bool(rawCapabilities[capability])]),
    ) as Record<PlanCapability, boolean>,
    installationId: text(source.installationId, "setup-pending"),
    licenseId: text(source.licenseId) || null,
    expiresAt: text(source.expiresAt) || null,
  };
}

function normalizeSnapshot(raw: unknown, month: string): FinanceSnapshot {
  const source = (raw ?? {}) as Record<string, unknown>;
  const profile = (source.profile ?? {}) as Record<string, unknown>;
  const accounts = ((source.accounts ?? []) as Record<string, unknown>[]).map(normalizeAccount);
  const legacyStoreName = text(profile.storeName ?? profile.store_name, "Financial Planner");
  return {
    schemaVersion: text(source.schemaVersion ?? source.schema_version, "legacy"),
    configured: source.configured === undefined ? accounts.length > 0 : bool(source.configured),
    entitlement: normalizeEntitlement(source.entitlement),
    profile: {
      name: text(profile.name, "Pemilik"),
      storeName: legacyStoreName.toUpperCase() === "VINN STORE" ? "Financial Planner" : legacyStoreName,
      currency: text(profile.currency, "IDR"),
      timezone: text(profile.timezone, "Asia/Jakarta"),
    },
    accounts,
    transactions: ((source.transactions ?? []) as Record<string, unknown>[]).map(normalizeTransaction),
    budgets: ((source.budgets ?? []) as Record<string, unknown>[]).map(normalizeBudget),
    goals: ((source.goals ?? []) as Record<string, unknown>[]).map(normalizeGoal),
    sinkingFunds: ((source.sinkingFunds ?? source.sinking_funds ?? []) as Record<string, unknown>[]).map(normalizeSinkingFund),
    sinkingFundEntries: ((source.sinkingFundEntries ?? source.sinking_fund_entries ?? []) as Record<string, unknown>[]).map(normalizeSinkingFundEntry),
    bills: ((source.bills ?? []) as Record<string, unknown>[]).map((row) => normalizeBill(row, month)),
    categories: ((source.categories ?? []) as Record<string, unknown>[]).map(normalizeCategory),
    categoryRules: ((source.categoryRules ?? source.category_rules ?? []) as Record<string, unknown>[]).map(normalizeCategoryRule),
    auditLogs: ((source.auditLogs ?? source.audit_logs ?? []) as Record<string, unknown>[]).map(normalizeAuditLog),
    investmentAssets: ((source.investmentAssets ?? source.investment_assets ?? source.assets ?? []) as Record<string, unknown>[]).map(normalizeInvestmentAsset),
    investmentTransactions: ((source.investmentTransactions ?? source.investment_transactions ?? []) as Record<string, unknown>[]).map(normalizeInvestmentTransaction),
    featurePreferences: normalizeFeaturePreferences(source.featurePreferences ?? source.feature_preferences),
    coupleMode: bool(((source.coupleMode ?? {}) as Record<string, unknown>).enabled),
  };
}

const snapshotRequests = new Map<string, Promise<FinanceSnapshot>>();
const SNAPSHOT_CACHE_TTL_MS = 15 * 60_000;
// Bootstrap Apps Script membaca beberapa sheet sekaligus. Profil anggota yang
// baru login belum mempunyai cache scoped, sehingga cold start dapat melewati
// 30 detik meski proses server tetap sehat.
const SNAPSHOT_LOAD_TIMEOUT_MS = 90_000;

type SnapshotCacheStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const snapshotScope = () => isFinanceDemoMode() ? "demo" : hasAppsScriptBridge() ? `gas:${getAppsScriptSessionScope()}` : "sites";
const snapshotCacheKey = (month: string) => `financial-planner:snapshot:${FINANCE_SCHEMA_VERSION}:${snapshotScope()}:${month}`;

export function readCachedFinanceSnapshot(month: string, storage?: SnapshotCacheStorage | null) {
  if (!storage) return null;
  const key = snapshotCacheKey(month);
  try {
    const parsed = JSON.parse(storage.getItem(key) || "null") as { cachedAt?: string; snapshot?: unknown } | null;
    const cachedAt = parsed?.cachedAt ? Date.parse(parsed.cachedAt) : NaN;
    if (!parsed?.snapshot || !Number.isFinite(cachedAt) || Date.now() - cachedAt > SNAPSHOT_CACHE_TTL_MS) {
      storage.removeItem(key);
      return null;
    }
    return { cachedAt: new Date(cachedAt).toISOString(), snapshot: normalizeSnapshot(parsed.snapshot, month) };
  } catch {
    try { storage.removeItem(key); } catch { /* Penyimpanan browser dapat dinonaktifkan. */ }
    return null;
  }
}

export function cacheFinanceSnapshot(month: string, snapshot: FinanceSnapshot, storage?: SnapshotCacheStorage | null) {
  if (!storage) return;
  try {
    storage.setItem(snapshotCacheKey(month), JSON.stringify({ cachedAt: new Date().toISOString(), snapshot }));
  } catch {
    // Cache hanya akselerator sementara; kegagalannya tidak boleh mengganggu data utama.
  }
}

export function loadFinanceSnapshot(month: string) {
  const requestKey = `${snapshotScope()}:${month}`;
  const existing = snapshotRequests.get(requestKey);
  if (existing) return existing;
  const request = (async () => {
    const transport = isFinanceDemoMode()
      ? demoRequest<unknown>("bootstrap", { month })
      : hasAppsScriptBridge()
      ? callAppsScript<unknown>("bootstrap", { month })
      : webRequest<unknown>(`/api/finance/bootstrap?month=${encodeURIComponent(month)}`);
    const raw = await withTimeout(transport, SNAPSHOT_LOAD_TIMEOUT_MS);
    return normalizeSnapshot(raw, month);
  })();
  snapshotRequests.set(requestKey, request);
  void request.then(
    () => snapshotRequests.delete(requestKey),
    () => snapshotRequests.delete(requestKey),
  );
  return request;
}

function normalizeMonthlyClosing(value: unknown, period: string): MonthlyClosing {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const closing = source.closing && typeof source.closing === "object" ? source.closing as Record<string, unknown> : source;
  return {
    period: text(closing.period, period),
    status: closing.status === "closed" ? "closed" : "open",
    closedAt: text(closing.closedAt ?? closing.closed_at) || null,
    reopenedAt: text(closing.reopenedAt ?? closing.reopened_at) || null,
    snapshot: closing.snapshot && typeof closing.snapshot === "object" ? closing.snapshot as MonthlyReview : null,
  };
}

export async function loadFinanceMonthlyClosing(period: string) {
  if (isFinanceDemoMode()) return normalizeMonthlyClosing({}, period);
  const raw = hasAppsScriptBridge()
    ? await callAppsScript<unknown>("monthlyClosingStatus", { period })
    : await webRequest<unknown>(`/api/finance/monthly-closing?period=${encodeURIComponent(period)}`);
  return normalizeMonthlyClosing(raw, period);
}

export async function closeFinanceMonthlyBook(period: string, snapshot: MonthlyReview, requestId = `monthly-close:${period}`) {
  const raw = await mutation<unknown>("closeMonthlyBook", "/api/finance/monthly-closing", { period, snapshot, confirmed: true, requestId });
  return normalizeMonthlyClosing(raw, period);
}

export async function reopenFinanceMonthlyBook(period: string, requestId = `monthly-reopen:${period}:${crypto.randomUUID()}`) {
  const raw = await mutation<unknown>("reopenMonthlyBook", "/api/finance/monthly-closing", { period, requestId }, "DELETE");
  return normalizeMonthlyClosing(raw, period);
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

export const updateFinanceFeaturePreferences = (
  preferences: FeaturePreferences,
  requestId = `feature-preferences:${crypto.randomUUID()}`,
) => mutation<{ preferences: FeaturePreferences }>(
  "updateFeaturePreferences",
  "/api/finance/feature-preferences",
  { preferences, requestId },
  "PATCH",
).then((result) => normalizeFeaturePreferences(result.preferences));

export async function loadLicenseStatus(): Promise<PlanEntitlement> {
  const raw = isFinanceDemoMode()
    ? demoRequest<unknown>("licenseStatus", {})
    : hasAppsScriptBridge()
    ? await callAppsScript<unknown>("licenseStatus", {})
    : await webRequest<unknown>("/api/finance/license");
  return normalizeEntitlement(raw);
}

export async function activateFinanceLicense(token: string): Promise<PlanEntitlement> {
  const raw = await mutation<unknown>("activateLicense", "/api/finance/license", { token });
  return normalizeEntitlement(raw);
}

export async function deactivateFinanceLicense(): Promise<PlanEntitlement> {
  const raw = await mutation<unknown>("deactivateLicense", "/api/finance/license", {}, "DELETE");
  return normalizeEntitlement(raw);
}

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
  const raw = isFinanceDemoMode()
    ? demoRequest<unknown>("getRoadmapSettings", {})
    : hasAppsScriptBridge()
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
  const raw = isFinanceDemoMode() ? demoRequest<unknown>("getDebtPlanner", {}) : hasAppsScriptBridge() ? await callAppsScript<unknown>("getDebtPlanner", {}) : await webRequest<unknown>("/api/finance/debts");
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
  const raw = isFinanceDemoMode() ? demoRequest<unknown>("getCashflowForecastSettings", {}) : hasAppsScriptBridge() ? await callAppsScript<unknown>("getCashflowForecastSettings", {}) : await webRequest<unknown>("/api/finance/forecast");
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
  const raw = isFinanceDemoMode() ? demoRequest<unknown>("getEmergencyFundSettings", {}) : hasAppsScriptBridge() ? await callAppsScript<unknown>("getEmergencyFundSettings", {}) : await webRequest<unknown>("/api/finance/emergency-fund");
  return normalizeEmergencyFundSettings(raw);
}
export async function updateFinanceEmergencyFundSettings(settings: EmergencyFundSettings, requestId = `emergency-fund:${crypto.randomUUID()}`) {
  const raw = await mutation<unknown>("updateEmergencyFundSettings", "/api/finance/emergency-fund", { ...settings, requestId }, "PATCH");
  return normalizeEmergencyFundSettings(raw);
}

const normalizeRecurringTemplate = (value: unknown): RecurringTemplate => {
  const row = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    id: text(row.id), name: text(row.name, "Transaksi rutin"), type: text(row.type) === "income" ? "income" : "expense",
    amount: Math.max(0, number(row.amount)), category: text(row.category, "Lainnya"), accountId: text(row.accountId ?? row.account_id),
    frequency: (["weekly", "monthly", "quarterly", "yearly"].includes(text(row.frequency)) ? text(row.frequency) : "monthly") as RecurringTemplate["frequency"],
    startDate: normalizeFinanceDate(row.startDate ?? row.start_date), nextDueDate: normalizeFinanceDate(row.nextDueDate ?? row.next_due_date),
    isSubscription: bool(row.isSubscription ?? row.is_subscription), active: row.active === undefined ? true : bool(row.active),
    lastPostedDate: text(row.lastPostedDate ?? row.last_posted_date) || null, updatedAt: text(row.updatedAt ?? row.updated_at) || undefined,
  };
};

export async function loadFinanceRecurringTemplates() {
  const raw = isFinanceDemoMode() ? demoRequest<unknown>("listRecurring", {}) : hasAppsScriptBridge() ? await callAppsScript<unknown>("listRecurring", {}) : await webRequest<unknown>("/api/finance/recurring");
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rows = Array.isArray(source.templates) ? source.templates : Array.isArray(source.items) ? source.items : [];
  return rows.map(normalizeRecurringTemplate);
}

export async function createFinanceRecurringTemplate(payload: Omit<RecurringTemplate, "id" | "lastPostedDate" | "updatedAt">, requestId = `recurring-create:${crypto.randomUUID()}`) {
  const raw = await mutation<unknown>("createRecurring", "/api/finance/recurring", { ...payload, requestId });
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return normalizeRecurringTemplate(source.template ?? raw);
}

export async function setFinanceRecurringActive(id: string, active: boolean, requestId = `recurring-status:${id}:${active}:${crypto.randomUUID()}`) {
  const raw = await mutation<unknown>("updateRecurring", "/api/finance/recurring", { id, active, requestId }, "PATCH");
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return normalizeRecurringTemplate(source.template ?? raw);
}

export async function confirmFinanceRecurring(id: string, dueDate: string, requestId = `recurring:${id}:${dueDate}`) {
  const raw = await mutation<unknown>("confirmRecurring", `/api/finance/recurring/${encodeURIComponent(id)}/confirm`, { id, dueDate, requestId });
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return normalizeRecurringTemplate(source.template ?? raw);
}

export const createFinanceAccount = (payload: Record<string, unknown>) =>
  mutation("createAccount", "/api/finance/accounts", payload);

export const updateFinanceAccount = (accountId: string, payload: Record<string, unknown>) =>
  mutation("updateAccount", `/api/finance/accounts/${encodeURIComponent(accountId)}`, { ...payload, accountId }, "PATCH");

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

export const createFinanceLoanDrawdown = (payload: LoanDrawdownInput) =>
  mutation<{
    transactionId: string;
    cashReceived: number;
    totalObligation: number;
    financingCost: number;
    duplicate?: boolean;
    replayed?: boolean;
  }>("recordLoanDrawdown", "/api/finance/loan-drawdown", payload);

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
  if (isFinanceDemoMode() || hasAppsScriptBridge()) {
    const raw = isFinanceDemoMode()
      ? demoRequest<{ items?: Record<string, unknown>[]; transactions?: Record<string, unknown>[]; page?: number; pageSize?: number; total?: number; totalPages?: number }>("listTransactions", filters)
      : await callAppsScript<{ items?: Record<string, unknown>[]; transactions?: Record<string, unknown>[]; page?: number; pageSize?: number; total?: number; totalPages?: number }>("listTransactions", filters);
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
  if (isFinanceDemoMode()) return demoRequest("attachTransactionReceipt", { transactionId, filename: file.name, contentType: file.type });
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

export const updateFinanceBudget = (budgetId: string, payload: Record<string, unknown>) =>
  mutation("updateBudget", `/api/finance/budgets/${encodeURIComponent(budgetId)}`, { ...payload, budgetId }, "PATCH");

export const deleteFinanceBudget = (budgetId: string) =>
  mutation("deleteBudget", `/api/finance/budgets/${encodeURIComponent(budgetId)}`, { budgetId }, "DELETE");

export const createFinanceGoal = (payload: Record<string, unknown>) =>
  mutation("createGoal", "/api/finance/goals", payload);

export const updateFinanceGoal = (goalId: string, payload: Record<string, unknown>) =>
  mutation("updateGoal", `/api/finance/goals/${encodeURIComponent(goalId)}`, { ...payload, goalId }, "PATCH");

export const deleteFinanceGoal = (goalId: string) =>
  mutation("deleteGoal", `/api/finance/goals/${encodeURIComponent(goalId)}`, { goalId }, "DELETE");

export const contributeFinanceGoal = (goalId: string, amount: number, mode: "add" | "withdraw" = "add") =>
  mutation("contributeGoal", `/api/finance/goals/${encodeURIComponent(goalId)}/contribute`, { goalId, amount, mode });

export const createFinanceSinkingFund = (payload: Record<string, unknown>) =>
  mutation("createSinkingFund", "/api/finance/sinking-funds", payload);

export const updateFinanceSinkingFund = (fundId: string, payload: Record<string, unknown>) =>
  mutation("updateSinkingFund", `/api/finance/sinking-funds/${encodeURIComponent(fundId)}`, { ...payload, fundId }, "PATCH");

export const archiveFinanceSinkingFund = (fundId: string) =>
  mutation("archiveSinkingFund", `/api/finance/sinking-funds/${encodeURIComponent(fundId)}`, { fundId }, "DELETE");

export const adjustFinanceSinkingFund = (
  fundId: string,
  amount: number,
  type: "allocate" | "release",
  date: string,
  note = "",
) => mutation("adjustSinkingFund", `/api/finance/sinking-funds/${encodeURIComponent(fundId)}/entries`, {
  fundId,
  amount,
  type,
  date,
  note,
  requestId: `fund-entry:${fundId}:${crypto.randomUUID()}`,
});

export const createFinanceBill = (payload: Record<string, unknown>) =>
  mutation("createBill", "/api/finance/bills", payload);

export const createFinanceReceivable = (payload: Record<string, unknown>) =>
  mutation<{ accountId: string; transactionId: string; replayed: boolean }>("createReceivable", "/api/finance/receivables", payload);

export const upgradeFinanceWorkspace = () => mutation<{ schemaVersion: string }>("upgradeWorkspace", "/api/finance/upgrade", {});

export const updateFinanceBill = (billId: string, payload: Record<string, unknown>) =>
  mutation("updateBill", `/api/finance/bills/${encodeURIComponent(billId)}`, { ...payload, billId }, "PATCH");

export const deleteFinanceBill = (billId: string) =>
  mutation("deleteBill", `/api/finance/bills/${encodeURIComponent(billId)}`, { billId }, "DELETE");

export const markFinanceBillPaid = (bill: Bill, period: string, date: string, options?: { amount?: number; fee?: number; settlement?: boolean }) =>
  mutation("markBillPaid", `/api/finance/bills/${encodeURIComponent(bill.id)}/paid`, {
    billId: bill.id,
    period,
    date,
    ...options,
    requestId: options ? `bill-payment:${bill.id}:${crypto.randomUUID()}` : `bill-payment:${bill.id}:${period}`,
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

export const createFinanceCategoryRule = (payload: Omit<CategoryRule, "id" | "createdAt" | "updatedAt">, requestId = `category-rule-create:${crypto.randomUUID()}`) =>
  mutation("createCategoryRule", "/api/finance/category-rules", { ...payload, requestId });

export const updateFinanceCategoryRule = (ruleId: string, payload: Omit<CategoryRule, "id" | "createdAt" | "updatedAt">, requestId = `category-rule-update:${crypto.randomUUID()}`) =>
  mutation("updateCategoryRule", "/api/finance/category-rules", { ...payload, ruleId, requestId }, "PATCH");

export const deleteFinanceCategoryRule = (ruleId: string) =>
  mutation("deleteCategoryRule", "/api/finance/category-rules", {
    ruleId,
    requestId: `category-rule-delete:${ruleId}`,
  }, "DELETE");

export const reconcileFinanceAccount = (accountId: string, actualBalance: number, date: string, note: string, requestId: string) =>
  mutation("reconcileAccount", `/api/finance/accounts/${encodeURIComponent(accountId)}/reconcile`, {
    accountId,
    actualBalance,
    date,
    note,
    notes: note,
    requestId,
  });

export const loadFinanceLedgerHealth = () => isFinanceDemoMode()
  ? Promise.resolve(demoRequest<LedgerHealthReport>("inspectLedger", {}))
  : hasAppsScriptBridge()
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

export const getFinanceAiSettings = () => isFinanceDemoMode()
  ? Promise.resolve(demoRequest<AiSettingsStatus>("aiSettings", {}))
  : hasAppsScriptBridge()
    ? callAppsScript<AiSettingsStatus>("aiSettings", {})
    : webRequest<AiSettingsStatus>("/api/finance/ai/settings");

export const updateFinanceAiSettings = (payload: {
  enabled: boolean;
  consentAccepted: boolean;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  removeApiKey?: boolean;
}) => isFinanceDemoMode()
  ? Promise.resolve(demoRequest<AiSettingsStatus>("updateAiSettings", payload))
  : hasAppsScriptBridge()
    ? callAppsScript<AiSettingsStatus>("updateAiSettings", payload)
    : webRequest<AiSettingsStatus>("/api/finance/ai/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });

export const loadFinanceAiMessages = () => isFinanceDemoMode()
  ? Promise.resolve(demoRequest<{ messages: AiChatMessage[] }>("aiHistory", {}))
  : hasAppsScriptBridge()
    ? callAppsScript<{ messages: AiChatMessage[] }>("aiHistory", {})
    : webRequest<{ messages: AiChatMessage[] }>("/api/finance/ai/assistant");

export const askFinanceAi = (question: string, period: string) =>
  mutation<AiAnswer>("askAi", "/api/finance/ai/assistant", { question, period });

export const clearFinanceAiMessages = () => isFinanceDemoMode()
  ? Promise.resolve(demoRequest<{ cleared: boolean }>("clearAiHistory", {}))
  : hasAppsScriptBridge()
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

export const loadFinanceReports = () => isFinanceDemoMode()
  ? Promise.resolve(demoRequest<{ reports: ExportRecord[] }>("listReports", {}))
  : hasAppsScriptBridge()
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

export const loadFinanceBackups = () => isFinanceDemoMode()
  ? Promise.resolve(demoRequest<BackupOverview>("backupOverview", {}))
  : hasAppsScriptBridge()
    ? callAppsScript<BackupOverview>("backupOverview", {})
    : webRequest<BackupOverview>("/api/finance/backups");

export const createFinanceBackup = () => mutation<ExportRecord>("createBackup", "/api/finance/backups", {});

export const updateFinanceBackupSchedule = (enabled: boolean, frequency: BackupSchedule["frequency"]) => isFinanceDemoMode()
  ? Promise.resolve(demoRequest<BackupOverview>("updateBackupSchedule", { enabled, frequency }))
  : hasAppsScriptBridge()
    ? callAppsScript<BackupOverview>("updateBackupSchedule", { enabled, frequency })
    : webRequest<BackupOverview>("/api/finance/backups", {
      method: "PUT",
      body: JSON.stringify({ enabled, frequency }),
    });

export const loadFinanceMigrations = () => isFinanceDemoMode()
  ? Promise.resolve(demoRequest<{ migrations: MigrationPreview[] }>("migrationHistory", {}))
  : hasAppsScriptBridge()
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

export const loadFinanceNotifications = (period: string) => isFinanceDemoMode()
  ? Promise.resolve(demoRequest<NotificationOverview>("notificationOverview", { period }))
  : hasAppsScriptBridge()
    ? callAppsScript<NotificationOverview>("notificationOverview", { period })
    : webRequest<NotificationOverview>(`/api/finance/notifications?period=${encodeURIComponent(period)}`);

export const updateFinanceNotificationSettings = (settings: NotificationSettings) => isFinanceDemoMode()
  ? Promise.resolve(demoRequest<{ settings: NotificationSettings }>("updateNotificationSettings", settings))
  : hasAppsScriptBridge()
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

export const financeBackendLabel = () => isFinanceDemoMode() ? "Penyimpanan demo lokal" : hasAppsScriptBridge() ? "Google Sheets" : "Cloud database";

export const loadFinanceSecurity = (): Promise<FinanceSecurityStatus> => isFinanceDemoMode()
  ? Promise.resolve(demoSecurityStatus() as FinanceSecurityStatus)
  : hasAppsScriptBridge()
  ? Promise.resolve({
      authenticated: true,
      displayName: "Pemilik Google Apps Script",
      email: null,
      provider: "Google Apps Script",
      accessMode: "deployment_managed",
      workspaceIsolation: "server_enforced",
      sessionState: "verified",
      signOutUrl: null,
    })
  : webRequest<FinanceSecurityStatus>("/api/finance/access-status");

export async function loadFinanceDiagnostics(month: string): Promise<FinanceDiagnostics> {
  const startedAt = Date.now();
  const healthRequest = hasAppsScriptBridge() && !isFinanceDemoMode()
    ? callAppsScript<{ sheets?: Array<{ sheet?: string; status?: string }> }>("health", {})
    : Promise.resolve({ sheets: [] });
  const [snapshot, security, ledger, health] = await Promise.all([
    loadFinanceSnapshot(month),
    loadFinanceSecurity(),
    loadFinanceLedgerHealth(),
    healthRequest,
  ]);
  const structureIssues = (health.sheets ?? [])
    .filter((item) => item.status !== "healthy")
    .map((item) => `${item.sheet || "Struktur data"}: ${item.status || "bermasalah"}`);
  const schemaHealthy = snapshot.schemaVersion === FINANCE_SCHEMA_VERSION;
  const overall = schemaHealthy && !structureIssues.length && ledger.status === "healthy"
    ? "healthy"
    : "attention";
  return {
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    backend: financeBackendLabel(),
    overall,
    schemaVersion: snapshot.schemaVersion,
    expectedSchemaVersion: FINANCE_SCHEMA_VERSION,
    structureIssues,
    ledgerStatus: ledger.status,
    accessState: security.sessionState,
    licenseTier: snapshot.entitlement.tier,
    licenseStatus: snapshot.entitlement.status,
    counts: {
      accounts: snapshot.accounts.length,
      transactions: snapshot.transactions.length,
      bills: snapshot.bills.length,
      goals: snapshot.goals.length,
    },
  };
}
