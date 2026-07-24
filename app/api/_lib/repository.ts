import { getD1 } from "@/db";
import { fromUnitMicro, INVESTMENT_UNIT_SCALE } from "@/lib/investment";
import { freeEntitlement } from "@/lib/plans";
import { normalizeFeaturePreferences } from "@/lib/feature-preferences";
import { installmentAmountAt, normalizeInstallmentPhases } from "@/lib/installment-phases";
import { ApiError } from "./api";
import { getEntitlement } from "./license";

type WorkspaceRow = {
  id: string;
  name: string;
  storeName: string;
  currency: string;
  timezone: string;
  configured: number;
  configuredAt: string | null;
  installationId: string | null;
  licenseToken: string | null;
  createdAt: string;
  updatedAt: string;
};

type AccountRow = {
  id: string;
  name: string;
  type: string;
  institution: string;
  balance: number;
  openingBalance: number;
  mask: string;
  color: string;
  liability: number;
};

type TransactionRow = {
  id: string;
  type: string;
  date: string;
  time: string;
  title: string;
  merchant: string | null;
  category: string;
  notes: string;
  tagsJson: string;
  location: string;
  splitsJson: string;
  accountId: string;
  destinationAccountId: string | null;
  transferGroupId: string | null;
  amount: number;
  status: string;
  idempotencyKey?: string;
  updatedAt: string;
  deletedAt: string | null;
  receiptId: string | null;
  receiptFilename: string | null;
  receiptContentType: string | null;
  receiptSizeBytes: number | null;
};

type BudgetRow = {
  id: string;
  category: string;
  amountLimit: number;
  period: string;
  color: string;
};

type GoalRow = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  color: string;
  icon: string;
};

export type SinkingFundRow = {
  id: string;
  name: string;
  purpose: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  targetDate: string;
  accountId: string;
  color: string;
  active: number;
  createdAt: string;
  updatedAt: string;
};

export type SinkingFundEntryRow = {
  id: string;
  fundId: string;
  type: "allocate" | "release";
  amount: number;
  date: string;
  note: string;
  createdAt: string;
};

type BillRow = {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  category: string;
  accountId: string;
  frequency: "monthly";
  reminderDays: string;
  paid: number;
  lastPaidPeriod: string | null;
  liabilityAccountId: string | null;
  durationMonths: number | null;
  paidCount: number;
  installmentPhasesJson: string;
  completed: number;
};

export type CategoryRow = {
  id: string;
  name: string;
  type: string;
  color: string;
  icon: string;
  archived: number;
  isDefault: number;
};

export type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: string;
  requestId: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  details: string;
  createdAt: string;
};

export type InvestmentAssetRow = {
  id: string;
  accountId: string;
  ticker: string;
  name: string;
  assetClass: string;
  exchange: string;
  currency: string;
  manualPrice: number | null;
  latestPriceCache: number;
  priceSource: string;
  priceStatus: string;
  priceUpdatedAt: string | null;
  active: number;
  requestId: string;
  updatedAt: string;
  unitsMicro: number;
  costBasis: number;
  realizedPl: number;
  positionUpdatedAt: string;
};

export type InvestmentTransactionRow = {
  id: string;
  assetId: string;
  accountId: string;
  date: string;
  type: string;
  unitsMicro: number;
  pricePerUnit: number;
  grossAmount: number;
  fee: number;
  tax: number;
  netAmount: number;
  averageCostAfter: number;
  remainingUnitsMicro: number;
  realizedPl: number;
  linkedCashTransactionId: string;
  linkedAdjustmentTransactionId: string | null;
  note: string | null;
  requestId: string;
  createdAt: string;
  updatedAt: string;
};

export const accountSelect = `
  SELECT id, name, type, institution, balance, opening_balance AS openingBalance,
         mask, color, liability
  FROM accounts
`;
export const transactionSelect = `
  SELECT id, type, date, time, title, merchant, category, notes,
         tags_json AS tagsJson, location, splits_json AS splitsJson,
         account_id AS accountId,
         destination_account_id AS destinationAccountId,
         transfer_group_id AS transferGroupId, amount, status,
         idempotency_key AS idempotencyKey, updated_at AS updatedAt,
         deleted_at AS deletedAt,
         (SELECT a.id FROM transaction_attachments a WHERE a.workspace_id = t.workspace_id AND a.transaction_id = t.id ORDER BY a.created_at DESC LIMIT 1) AS receiptId,
         (SELECT a.filename FROM transaction_attachments a WHERE a.workspace_id = t.workspace_id AND a.transaction_id = t.id ORDER BY a.created_at DESC LIMIT 1) AS receiptFilename,
         (SELECT a.content_type FROM transaction_attachments a WHERE a.workspace_id = t.workspace_id AND a.transaction_id = t.id ORDER BY a.created_at DESC LIMIT 1) AS receiptContentType,
         (SELECT a.size_bytes FROM transaction_attachments a WHERE a.workspace_id = t.workspace_id AND a.transaction_id = t.id ORDER BY a.created_at DESC LIMIT 1) AS receiptSizeBytes
  FROM transactions t
`;
export const budgetSelect = `
  SELECT id, category, amount_limit AS amountLimit, period, color
  FROM budgets
`;
export const goalSelect = `
  SELECT id, name, target, current, deadline, color, icon
  FROM goals
`;
export const sinkingFundSelect = `
  SELECT id, name, purpose, target_amount AS targetAmount,
         current_amount AS currentAmount, monthly_contribution AS monthlyContribution,
         target_date AS targetDate, account_id AS accountId, color, active,
         created_at AS createdAt, updated_at AS updatedAt
  FROM sinking_funds
`;
export const sinkingFundEntrySelect = `
  SELECT id, fund_id AS fundId, type, amount, date, note, created_at AS createdAt
  FROM sinking_fund_entries
`;
export const billSelect = `
  SELECT id, name, amount, due_date AS dueDate, category, account_id AS accountId,
         frequency, reminder_days AS reminderDays, paid,
         last_paid_period AS lastPaidPeriod,
         liability_account_id AS liabilityAccountId,
         duration_months AS durationMonths, paid_count AS paidCount,
         installment_phases_json AS installmentPhasesJson, completed
  FROM bills
`;
export const categorySelect = `
  SELECT id, name, type, color, icon, archived, is_default AS isDefault
  FROM categories
`;
export const auditLogSelect = `
  SELECT id, action, entity_type AS entityType, entity_id AS entityId,
         actor, request_id AS requestId, before_json AS beforeJson,
         after_json AS afterJson, details, created_at AS createdAt
  FROM audit_logs
`;
export const investmentAssetSelect = `
  SELECT a.id, a.account_id AS accountId, a.ticker, a.name,
         a.asset_class AS assetClass, a.exchange, a.currency,
         a.manual_price AS manualPrice, a.latest_price_cache AS latestPriceCache,
         a.price_source AS priceSource, a.price_status AS priceStatus,
         a.price_updated_at AS priceUpdatedAt, a.active, a.request_id AS requestId,
         a.updated_at AS updatedAt, p.units_micro AS unitsMicro,
         p.cost_basis AS costBasis, p.realized_pl AS realizedPl,
         p.updated_at AS positionUpdatedAt
  FROM investment_assets a
  JOIN investment_positions p ON p.asset_id = a.id AND p.workspace_id = a.workspace_id
`;
export const investmentTransactionSelect = `
  SELECT id, asset_id AS assetId, account_id AS accountId, date, type,
         units_micro AS unitsMicro, price_per_unit AS pricePerUnit,
         gross_amount AS grossAmount, fee, tax, net_amount AS netAmount,
         average_cost_after AS averageCostAfter,
         remaining_units_micro AS remainingUnitsMicro, realized_pl AS realizedPl,
         linked_cash_transaction_id AS linkedCashTransactionId,
         linked_adjustment_transaction_id AS linkedAdjustmentTransactionId,
         note, request_id AS requestId, created_at AS createdAt, updated_at AS updatedAt
  FROM investment_transactions
`;

export function serializeWorkspace(row: WorkspaceRow | null, workspaceId: string) {
  if (!row) {
    return {
      id: workspaceId,
      name: "Pemilik",
      storeName: "Financial Planner",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      configured: false,
      configuredAt: null,
      createdAt: null,
      updatedAt: null,
    };
  }
  return {
    ...row,
    storeName: row.storeName.toUpperCase() === "VINN STORE" ? "Financial Planner" : row.storeName,
    configured: Boolean(row.configured),
  };
}

export const serializeAccount = (row: AccountRow) => ({
  ...row,
  liability: Boolean(row.liability),
});
export const serializeTransaction = (row: TransactionRow) => {
  const parseArray = <T>(value: string, fallback: T[]): T[] => {
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) ? parsed as T[] : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    time: row.time || "",
    title: row.title,
    merchant: row.merchant,
    category: row.category,
    notes: row.notes || "",
    tags: parseArray<string>(row.tagsJson, []),
    location: row.location || "",
    splits: parseArray<{ id: string; category: string; amount: number; note?: string }>(row.splitsJson, []),
    accountId: row.accountId,
    destinationAccountId: row.destinationAccountId,
    transferGroupId: row.transferGroupId,
    amount: row.amount,
    status: row.status,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? undefined,
    receipt: row.receiptId ? {
      id: row.receiptId,
      filename: row.receiptFilename || "lampiran-struk",
      contentType: row.receiptContentType || "application/octet-stream",
      sizeBytes: Number(row.receiptSizeBytes || 0),
    } : undefined,
  };
};
export const serializeBudget = (row: BudgetRow) => ({
  id: row.id,
  category: row.category,
  limit: row.amountLimit,
  period: row.period,
  color: row.color,
});
export const serializeGoal = (row: GoalRow) => row;
export const serializeSinkingFund = (row: SinkingFundRow) => ({ ...row, active: Boolean(row.active) });
export const serializeSinkingFundEntry = (row: SinkingFundEntryRow) => row;
export const serializeBill = (row: BillRow, period?: string) => {
  let rawPhases: unknown = [];
  try { rawPhases = JSON.parse(row.installmentPhasesJson || "[]"); } catch { rawPhases = []; }
  const installmentPhases = normalizeInstallmentPhases(rawPhases);
  const paidCount = Number(row.paidCount || 0);
  const amount = installmentAmountAt({ amount: row.amount, paidCount, installmentPhases });
  return {
    id: row.id,
    name: row.name,
    amount,
    dueDate: row.dueDate,
    category: row.category,
    accountId: row.accountId,
    frequency: row.frequency,
    reminderDays: String(row.reminderDays || "7,3,1,0").split(",").map(Number).filter((value) => Number.isSafeInteger(value) && value >= 0),
    paid: Boolean(row.completed) || (period ? row.lastPaidPeriod === period : Boolean(row.paid)),
    lastPaidPeriod: row.lastPaidPeriod,
    liabilityAccountId: row.liabilityAccountId,
    durationMonths: row.durationMonths,
    paidCount,
    remainingMonths: row.durationMonths === null ? null : Math.max(0, row.durationMonths - paidCount),
    completed: Boolean(row.completed),
    installmentPhases,
  };
};
export const serializeCategory = (row: CategoryRow) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  color: row.color,
  icon: row.icon,
  archived: Boolean(row.archived),
  isDefault: Boolean(row.isDefault),
});
export const serializeAuditLog = (row: AuditLogRow) => {
  const parseJson = (value: string | null, fallback: unknown) => {
    if (value === null) return null;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actor: row.actor,
    requestId: row.requestId,
    before: parseJson(row.beforeJson, { raw: row.beforeJson }),
    after: parseJson(row.afterJson, { raw: row.afterJson }),
    details: parseJson(row.details, { raw: row.details }),
    createdAt: row.createdAt,
  };
};

export const serializeInvestmentAsset = (row: InvestmentAssetRow) => {
  const units = fromUnitMicro(row.unitsMicro);
  const marketValue = Math.round((row.unitsMicro * row.latestPriceCache) / INVESTMENT_UNIT_SCALE);
  return {
    id: row.id,
    accountId: row.accountId,
    ticker: row.ticker,
    name: row.name,
    assetClass: row.assetClass,
    exchange: row.exchange,
    currency: row.currency,
    units,
    costBasis: row.costBasis,
    averageCost: row.unitsMicro > 0
      ? Math.round((row.costBasis * INVESTMENT_UNIT_SCALE) / row.unitsMicro)
      : 0,
    marketPrice: row.latestPriceCache,
    marketValue,
    unrealizedPl: marketValue - row.costBasis,
    realizedPl: row.realizedPl,
    priceSource: row.priceSource,
    priceStatus: row.priceStatus,
    priceUpdatedAt: row.priceUpdatedAt,
    active: Boolean(row.active),
    updatedAt: row.updatedAt,
  };
};

export const serializeInvestmentTransaction = (row: InvestmentTransactionRow) => ({
  id: row.id,
  assetId: row.assetId,
  accountId: row.accountId,
  date: row.date,
  type: row.type,
  units: fromUnitMicro(row.unitsMicro),
  pricePerUnit: row.pricePerUnit,
  grossAmount: row.grossAmount,
  fee: row.fee,
  tax: row.tax,
  netAmount: row.netAmount,
  averageCostAfter: row.averageCostAfter,
  remainingUnitsAfter: fromUnitMicro(row.remainingUnitsMicro),
  realizedPl: row.realizedPl,
  linkedCashTransactionId: row.linkedCashTransactionId,
  linkedAdjustmentTransactionId: row.linkedAdjustmentTransactionId,
  note: row.note,
  requestId: row.requestId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export async function getWorkspace(workspaceId: string): Promise<WorkspaceRow | null> {
  const row = await getD1()
    .prepare(
      `SELECT id, profile_name AS name, store_name AS storeName, currency, timezone, configured,
              configured_at AS configuredAt, installation_id AS installationId,
              license_token AS licenseToken, created_at AS createdAt, updated_at AS updatedAt
       FROM workspaces WHERE id = ? LIMIT 1`,
    )
    .bind(workspaceId)
    .first<WorkspaceRow>();
  return row ? {
    ...row,
    storeName: row.storeName.toUpperCase() === "VINN STORE" ? "Financial Planner" : row.storeName,
  } : null;
}

export async function requireWorkspace(workspaceId: string): Promise<WorkspaceRow> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace || !workspace.configured) {
    throw new ApiError(
      409,
      "WORKSPACE_NOT_CONFIGURED",
      "Selesaikan setup Financial Planner sebelum menyimpan data.",
    );
  }
  return workspace;
}

export async function getBootstrap(workspaceId: string, period?: string) {
  const d1 = getD1();
  const budgetsStatement = period
    ? d1
        .prepare(`${budgetSelect} WHERE workspace_id = ? AND period = ? ORDER BY category, id`)
        .bind(workspaceId, period)
    : d1
        .prepare(`${budgetSelect} WHERE workspace_id = ? ORDER BY period DESC, category, id`)
        .bind(workspaceId);
  const categoriesStatement = d1
    .prepare(`${categorySelect} WHERE workspace_id = ? AND archived = 0 ORDER BY type, name, id`)
    .bind(workspaceId);
  const auditLogsStatement = d1
    .prepare(`${auditLogSelect} WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT 20`)
    .bind(workspaceId);
  const investmentAssetsStatement = d1
    .prepare(`${investmentAssetSelect} WHERE a.workspace_id = ? AND a.active = 1 ORDER BY a.name, a.id`)
    .bind(workspaceId);
  const investmentTransactionsStatement = d1
    .prepare(`${investmentTransactionSelect} WHERE workspace_id = ? ORDER BY date DESC, created_at DESC, id DESC LIMIT 200`)
    .bind(workspaceId);
  const categoryRulesStatement = d1
    .prepare(`SELECT id, keyword, category, transaction_type AS transactionType,
      match_type AS matchType, priority, active, created_at AS createdAt, updated_at AS updatedAt
      FROM category_rules WHERE workspace_id = ? ORDER BY active DESC, priority DESC, keyword, id`)
    .bind(workspaceId);
  const sinkingFundsStatement = d1
    .prepare(`${sinkingFundSelect} WHERE workspace_id = ? AND active = 1 ORDER BY target_date, created_at, id`)
    .bind(workspaceId);
  const sinkingFundEntriesStatement = d1
    .prepare(`${sinkingFundEntrySelect} WHERE workspace_id = ? ORDER BY date DESC, created_at DESC, id DESC LIMIT 200`)
    .bind(workspaceId);
  const featurePreferencesStatement = d1
    .prepare("SELECT preferences_json AS preferencesJson FROM feature_preferences WHERE workspace_id = ? LIMIT 1")
    .bind(workspaceId);
  const results = await d1.batch([
    d1
      .prepare(
        `SELECT id, profile_name AS name, store_name AS storeName, currency, timezone, configured,
                configured_at AS configuredAt, installation_id AS installationId,
                license_token AS licenseToken, created_at AS createdAt, updated_at AS updatedAt
         FROM workspaces WHERE id = ? LIMIT 1`,
      )
      .bind(workspaceId),
    d1.prepare(`${accountSelect} WHERE workspace_id = ? AND active = 1 ORDER BY created_at, id`).bind(workspaceId),
    d1
      .prepare(
        `${transactionSelect} WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC, id DESC`,
      )
      .bind(workspaceId),
    budgetsStatement,
    d1.prepare(`${goalSelect} WHERE workspace_id = ? ORDER BY deadline, created_at, id`).bind(workspaceId),
    d1.prepare(`${billSelect} WHERE workspace_id = ? ORDER BY due_date, created_at, id`).bind(workspaceId),
    categoriesStatement,
    auditLogsStatement,
    investmentAssetsStatement,
    investmentTransactionsStatement,
    categoryRulesStatement,
    sinkingFundsStatement,
    sinkingFundEntriesStatement,
    featurePreferencesStatement,
  ]);

  const workspace = (results[0].results[0] as WorkspaceRow | undefined) ?? null;
  const entitlement = workspace?.configured
    ? await getEntitlement(workspaceId)
    : freeEntitlement(workspace?.installationId ?? "setup-pending");
  return {
    configured: Boolean(workspace?.configured),
    entitlement,
    profile: serializeWorkspace(workspace, workspaceId),
    accounts: (results[1].results as AccountRow[]).map(serializeAccount),
    transactions: (results[2].results as TransactionRow[]).map(serializeTransaction),
    budgets: (results[3].results as BudgetRow[]).map(serializeBudget),
    goals: (results[4].results as GoalRow[]).map(serializeGoal),
    bills: (results[5].results as BillRow[]).map((bill) => serializeBill(bill, period)),
    categories: (results[6].results as CategoryRow[]).map(serializeCategory),
    auditLogs: (results[7].results as AuditLogRow[]).map(serializeAuditLog),
    investmentAssets: (results[8].results as InvestmentAssetRow[]).map(serializeInvestmentAsset),
    investmentTransactions: (results[9].results as InvestmentTransactionRow[]).map(serializeInvestmentTransaction),
    categoryRules: (results[10].results as Array<Record<string, unknown>>).map((rule) => ({ ...rule, active: Boolean(rule.active) })),
    sinkingFunds: (results[11].results as SinkingFundRow[]).map(serializeSinkingFund),
    sinkingFundEntries: (results[12].results as SinkingFundEntryRow[]).map(serializeSinkingFundEntry),
    featurePreferences: normalizeFeaturePreferences(
      (results[13].results[0] as { preferencesJson?: string } | undefined)?.preferencesJson,
    ),
  };
}

export async function getAccountRow(
  workspaceId: string,
  id: string,
): Promise<AccountRow | null> {
  return getD1()
    .prepare(`${accountSelect} WHERE workspace_id = ? AND id = ? AND active = 1 LIMIT 1`)
    .bind(workspaceId, id)
    .first<AccountRow>();
}

export async function getTransactionRow(
  workspaceId: string,
  id: string,
): Promise<TransactionRow | null> {
  return getD1()
    .prepare(`${transactionSelect} WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL LIMIT 1`)
    .bind(workspaceId, id)
    .first<TransactionRow>();
}

export async function getTransactionRowIncludingDeleted(
  workspaceId: string,
  id: string,
): Promise<TransactionRow | null> {
  return getD1()
    .prepare(`${transactionSelect} WHERE workspace_id = ? AND id = ? LIMIT 1`)
    .bind(workspaceId, id)
    .first<TransactionRow>();
}

export async function getBudgetRow(workspaceId: string, id: string): Promise<BudgetRow | null> {
  return getD1()
    .prepare(`${budgetSelect} WHERE workspace_id = ? AND id = ? LIMIT 1`)
    .bind(workspaceId, id)
    .first<BudgetRow>();
}

export async function getGoalRow(workspaceId: string, id: string): Promise<GoalRow | null> {
  return getD1()
    .prepare(`${goalSelect} WHERE workspace_id = ? AND id = ? LIMIT 1`)
    .bind(workspaceId, id)
    .first<GoalRow>();
}

export async function getSinkingFundRow(workspaceId: string, id: string): Promise<SinkingFundRow | null> {
  return getD1()
    .prepare(`${sinkingFundSelect} WHERE workspace_id = ? AND id = ? LIMIT 1`)
    .bind(workspaceId, id)
    .first<SinkingFundRow>();
}

export async function getBillRow(workspaceId: string, id: string): Promise<BillRow | null> {
  return getD1()
    .prepare(`${billSelect} WHERE workspace_id = ? AND id = ? LIMIT 1`)
    .bind(workspaceId, id)
    .first<BillRow>();
}

export async function getCategoryRow(
  workspaceId: string,
  id: string,
): Promise<CategoryRow | null> {
  return getD1()
    .prepare(`${categorySelect} WHERE workspace_id = ? AND id = ? LIMIT 1`)
    .bind(workspaceId, id)
    .first<CategoryRow>();
}

export async function getInvestmentAssetRow(
  workspaceId: string,
  id: string,
): Promise<InvestmentAssetRow | null> {
  return getD1()
    .prepare(`${investmentAssetSelect} WHERE a.workspace_id = ? AND a.id = ? LIMIT 1`)
    .bind(workspaceId, id)
    .first<InvestmentAssetRow>();
}

export async function getInvestmentAssetByRequest(
  workspaceId: string,
  requestId: string,
): Promise<InvestmentAssetRow | null> {
  return getD1()
    .prepare(`${investmentAssetSelect} WHERE a.workspace_id = ? AND a.request_id = ? LIMIT 1`)
    .bind(workspaceId, requestId)
    .first<InvestmentAssetRow>();
}

export async function getInvestmentTransactionByRequest(
  workspaceId: string,
  requestId: string,
): Promise<InvestmentTransactionRow | null> {
  return getD1()
    .prepare(`${investmentTransactionSelect} WHERE workspace_id = ? AND request_id = ? LIMIT 1`)
    .bind(workspaceId, requestId)
    .first<InvestmentTransactionRow>();
}
