import { DEFAULT_FEATURE_PREFERENCES, PLAN_CAPABILITIES } from './constants';
import type {
  Account,
  AuditLog,
  Bill,
  Budget,
  Category,
  FinanceSnapshot,
  Goal,
  InvestmentAsset,
  PlanCapability,
  PlanEntitlement,
  RecurringTemplate,
  SinkingFund,
  Transaction,
} from './types';

type UnknownRecord = Record<string, unknown>;

const record = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown, fallback = '') => value === null || value === undefined || value === ''
  ? fallback
  : String(value);
const number = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const bool = (value: unknown) => value === true || value === 1 || String(value).toLowerCase() === 'true';

const parseArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
};

export const normalizeDate = (value: unknown) => {
  const raw = text(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const normalizeAccount = (value: unknown): Account => {
  const row = record(value);
  return {
    id: text(row.id),
    name: text(row.name, 'Akun'),
    type: text(row.type, 'Bank') as Account['type'],
    institution: text(row.institution),
    balance: number(row.currentBalance ?? row.current_balance ?? row.balance ?? row.opening_balance),
    openingBalance: number(row.openingBalance ?? row.opening_balance),
    mask: text(row.mask),
    color: text(row.color, '#126b59'),
    liability: bool(row.liability ?? row.isLiability ?? row.is_liability),
    updatedAt: text(row.updatedAt ?? row.updated_at) || undefined,
  };
};

export const normalizeTransaction = (value: unknown): Transaction => {
  const row = record(value);
  const receipt = record(row.receipt);
  return {
    id: text(row.id),
    type: text(row.type, 'expense') as Transaction['type'],
    date: normalizeDate(row.date),
    time: text(row.time) || undefined,
    title: text(row.title ?? row.description ?? row.merchant, 'Transaksi'),
    merchant: text(row.merchant) || undefined,
    category: text(row.category, 'Lainnya').trim().replace(/\s+/g, ' '),
    notes: text(row.notes) || undefined,
    tags: parseArray(row.tags ?? row.tags_json).map(String),
    location: text(row.location) || undefined,
    splits: parseArray(row.splits ?? row.splits_json).map((item, index) => {
      const split = record(item);
      return {
        id: text(split.id, `split-${index}`),
        category: text(split.category).trim().replace(/\s+/g, ' '),
        amount: number(split.amount),
        note: text(split.note) || undefined,
      };
    }),
    accountId: text(row.accountId ?? row.account_id),
    destinationAccountId: text(row.destinationAccountId ?? row.destination_account_id) || undefined,
    transferGroupId: text(row.transferGroupId ?? row.transfer_group_id) || undefined,
    amount: number(row.amount),
    status: text(row.status, 'completed') === 'pending' ? 'pending' : 'completed',
    updatedAt: text(row.updatedAt ?? row.updated_at) || undefined,
    deletedAt: text(row.deletedAt ?? row.deleted_at) || undefined,
    receipt: Object.keys(receipt).length ? {
      id: text(receipt.id),
      filename: text(receipt.filename, 'lampiran'),
      contentType: text(receipt.contentType ?? receipt.content_type, 'application/octet-stream'),
      sizeBytes: number(receipt.sizeBytes ?? receipt.size_bytes),
      url: text(receipt.url) || undefined,
    } : undefined,
  };
};

const normalizeCategory = (value: unknown): Category => {
  const row = record(value);
  const activeValue = row.active ?? row.isActive ?? row.is_active;
  const archived = bool(row.archived) || (activeValue !== undefined && !bool(activeValue));
  return {
    id: text(row.id), name: text(row.name, 'Lainnya').trim().replace(/\s+/g, ' '),
    type: text(row.type) === 'income' ? 'income' : 'expense',
    color: text(row.color, '#126b59'), active: !archived, archived,
    isDefault: bool(row.isDefault ?? row.is_default), icon: text(row.icon) || undefined,
    updatedAt: text(row.updatedAt ?? row.updated_at) || undefined,
  };
};

const normalizeBudget = (value: unknown, index: number): Budget => {
  const row = record(value);
  return {
    id: text(row.id, `budget-${index}`), category: text(row.category, 'Lainnya').trim().replace(/\s+/g, ' '),
    limit: number(row.limit ?? row.limitAmount ?? row.limit_amount),
    color: text(row.color, '#126b59'), period: text(row.period ?? row.month) || undefined,
    rollover: bool(row.rollover),
  };
};

const normalizeGoal = (value: unknown): Goal => {
  const row = record(value);
  return {
    id: text(row.id), name: text(row.name, 'Target'),
    target: number(row.target ?? row.targetAmount ?? row.target_amount),
    current: number(row.current ?? row.currentAmount ?? row.current_amount),
    deadline: normalizeDate(row.deadline), accountId: text(row.accountId ?? row.account_id) || undefined,
    color: text(row.color, '#126b59'), icon: text(row.icon, 'target'),
  };
};

const normalizeBill = (value: unknown): Bill => {
  const row = record(value);
  const duration = number(row.durationMonths ?? row.duration_months);
  const paidCount = Math.max(0, number(row.paidCount ?? row.paid_count));
  const status = text(row.status, 'active');
  return {
    id: text(row.id), name: text(row.name, 'Tagihan'), amount: number(row.amount),
    dueDate: normalizeDate(row.dueDate ?? row.due_date), category: text(row.category, 'Tagihan'),
    accountId: text(row.accountId ?? row.account_id),
    liabilityAccountId: text(row.liabilityAccountId ?? row.liability_account_id) || null,
    paid: bool(row.paid) || Boolean(row.lastPaidPeriod ?? row.last_paid_period),
    completed: bool(row.completed) || status === 'completed' || Boolean(duration && paidCount >= duration),
    lastPaidPeriod: text(row.lastPaidPeriod ?? row.last_paid_period) || null,
    paidCount, durationMonths: duration > 0 ? duration : null,
    reminderDays: parseArray(row.reminderDays ?? row.reminder_days ?? '7,3,1,0').map(Number).filter(Number.isFinite),
    installmentPhases: parseArray(row.installmentPhases ?? row.installment_phases ?? row.installment_phases_json).map((item) => {
      const phase = record(item);
      return { label: text(phase.label, 'Fase'), durationMonths: number(phase.durationMonths ?? phase.duration_months), amount: number(phase.amount) };
    }).filter((phase) => phase.durationMonths > 0 && phase.amount > 0),
    status,
  };
};

const normalizeSinkingFund = (value: unknown): SinkingFund => {
  const row = record(value);
  return {
    id: text(row.id), name: text(row.name, 'Pos dana'), purpose: text(row.purpose, 'Lainnya'),
    targetAmount: number(row.targetAmount ?? row.target_amount),
    currentAmount: number(row.currentAmount ?? row.current_amount),
    monthlyContribution: number(row.monthlyContribution ?? row.monthly_contribution),
    targetDate: normalizeDate(row.targetDate ?? row.target_date),
    accountId: text(row.accountId ?? row.account_id), color: text(row.color, '#16876f'),
    active: row.active === undefined ? true : bool(row.active),
    updatedAt: text(row.updatedAt ?? row.updated_at) || undefined,
  };
};

export const normalizeRecurring = (value: unknown): RecurringTemplate => {
  const row = record(value);
  const frequency = text(row.frequency, 'monthly');
  return {
    id: text(row.id), name: text(row.name, 'Transaksi rutin'),
    type: text(row.type) === 'income' ? 'income' : 'expense', amount: number(row.amount),
    category: text(row.category, 'Lainnya'), accountId: text(row.accountId ?? row.account_id),
    frequency: (['weekly', 'monthly', 'quarterly', 'yearly'].includes(frequency) ? frequency : 'monthly') as RecurringTemplate['frequency'],
    nextDueDate: normalizeDate(row.nextDueDate ?? row.next_due_date),
    isSubscription: bool(row.isSubscription ?? row.is_subscription),
    active: row.active === undefined ? bool(row.is_active ?? true) : bool(row.active),
    lastPostedDate: text(row.lastPostedDate ?? row.last_posted_date) || null,
    updatedAt: text(row.updatedAt ?? row.updated_at) || undefined,
  };
};

const normalizeInvestmentAsset = (value: unknown): InvestmentAsset => {
  const row = record(value);
  return {
    id: text(row.id), accountId: text(row.accountId ?? row.account_id),
    ticker: text(row.ticker).toUpperCase(), name: text(row.name, 'Aset investasi'),
    assetClass: text(row.assetClass ?? row.asset_class, 'Custom'), exchange: text(row.exchange),
    currency: text(row.currency, 'IDR'), units: number(row.units),
    costBasis: number(row.costBasis ?? row.cost_basis), averageCost: number(row.averageCost ?? row.average_cost),
    marketPrice: number(row.marketPrice ?? row.market_price), marketValue: number(row.marketValue ?? row.market_value),
    unrealizedPl: number(row.unrealizedPl ?? row.unrealized_pl), realizedPl: number(row.realizedPl ?? row.realized_pl),
    priceSource: text(row.priceSource ?? row.price_source, 'unavailable'),
    priceStatus: text(row.priceStatus ?? row.price_status, 'unavailable'),
    priceUpdatedAt: text(row.priceUpdatedAt ?? row.price_updated_at) || undefined,
    updatedAt: text(row.updatedAt ?? row.updated_at) || undefined,
    active: row.active === undefined ? true : bool(row.active),
  };
};

const normalizeAudit = (value: unknown): AuditLog => {
  const row = record(value);
  let details = row.details ?? row.detailsJson ?? row.details_json;
  if (typeof details === 'string') {
    try { details = JSON.parse(details); } catch { /* retain readable text */ }
  }
  return {
    id: text(row.id), action: text(row.action, 'UPDATE'), module: text(row.module, 'system'),
    entityId: text(row.entityId ?? row.entity_id) || undefined, details,
    actor: text(row.actor ?? row.actor_email) || undefined,
    createdAt: text(row.createdAt ?? row.created_at),
  };
};

const normalizeEntitlement = (value: unknown): PlanEntitlement => {
  const row = record(value);
  const tier = (['free', 'pro', 'premium'].includes(text(row.tier)) ? text(row.tier) : 'free') as PlanEntitlement['tier'];
  const rawCapabilities = record(row.capabilities);
  return {
    tier, label: text(row.label, tier === 'premium' ? 'Premium' : tier === 'pro' ? 'Pro' : 'Free'),
    status: (['free', 'active', 'expired', 'invalid'].includes(text(row.status)) ? text(row.status) : 'free') as PlanEntitlement['status'],
    capabilities: Object.fromEntries(PLAN_CAPABILITIES.map((item) => [item, bool(rawCapabilities[item])])) as Record<PlanCapability, boolean>,
    installationId: text(row.installationId ?? row.installation_id, 'setup-pending'),
    licenseId: text(row.licenseId ?? row.license_id) || null,
    expiresAt: text(row.expiresAt ?? row.expires_at) || null,
  };
};

export function normalizeSnapshot(value: unknown): FinanceSnapshot {
  const source = record(value);
  const profile = record(source.profile);
  const summary = record(source.summary);
  const rawPreferences = record(source.featurePreferences ?? source.feature_preferences);
  const featurePreferences = Object.fromEntries(
    Object.keys(DEFAULT_FEATURE_PREFERENCES).map((key) => [
      key,
      rawPreferences[key] === undefined ? true : bool(rawPreferences[key]),
    ]),
  ) as FinanceSnapshot['featurePreferences'];
  const accounts = array(source.accounts).map(normalizeAccount);
  return {
    configured: source.configured === undefined ? accounts.length > 0 : bool(source.configured),
    schemaVersion: text(source.schemaVersion ?? source.schema_version) || undefined,
    profile: {
      name: text(profile.name, 'Pemilik'),
      storeName: text(profile.storeName ?? profile.store_name, 'Financial Planner'),
      currency: text(profile.currency, 'IDR'), timezone: text(profile.timezone, 'Asia/Jakarta'),
    },
    entitlement: normalizeEntitlement(source.entitlement),
    summary: {
      income: number(summary.income), expense: number(summary.expense),
      cashflow: number(summary.cashflow), savingsRate: number(summary.savingsRate ?? summary.savings_rate),
    },
    featurePreferences,
    accounts,
    transactions: array(source.transactions).map(normalizeTransaction),
    budgets: array(source.budgets).map(normalizeBudget), goals: array(source.goals).map(normalizeGoal),
    bills: array(source.bills).map(normalizeBill),
    sinkingFunds: array(source.sinkingFunds ?? source.sinking_funds).map(normalizeSinkingFund),
    recurring: array(source.recurring).map(normalizeRecurring), categories: array(source.categories).map(normalizeCategory),
    investmentAssets: array(source.investmentAssets ?? source.investment_assets ?? source.assets).map(normalizeInvestmentAsset),
    auditLogs: array(source.auditLogs ?? source.audit_logs).map(normalizeAudit),
  };
}

export const normalizeTransactionList = (value: unknown) => {
  const source = record(value);
  const rows = array(source.items ?? source.transactions).map(normalizeTransaction);
  const pageSize = Math.max(1, number(source.pageSize, 25));
  const total = Math.max(rows.length, number(source.total, rows.length));
  return {
    transactions: rows,
    page: Math.max(1, number(source.page, 1)),
    pageSize,
    total,
    totalPages: Math.max(1, number(source.totalPages, Math.ceil(total / pageSize))),
  };
};
