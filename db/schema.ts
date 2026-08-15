import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    profileName: text("profile_name").notNull().default("Pemilik"),
    storeName: text("store_name").notNull().default("Financial Planner"),
    currency: text("currency").notNull().default("IDR"),
    timezone: text("timezone").notNull().default("Asia/Jakarta"),
    configured: integer("configured", { mode: "boolean" }).notNull().default(false),
    configuredAt: text("configured_at"),
    installationId: text("installation_id"),
    licenseToken: text("license_token"),
    licenseActivatedAt: text("license_activated_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("workspaces_installation_uidx").on(table.installationId)],
);

export const featurePreferences = sqliteTable("feature_preferences", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  preferencesJson: text("preferences_json").notNull().default("{}"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    institution: text("institution").notNull().default(""),
    balance: integer("balance").notNull().default(0),
    openingBalance: integer("opening_balance").notNull().default(0),
    mask: text("mask").notNull().default(""),
    color: text("color").notNull().default("#16876f"),
    liability: integer("liability", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("accounts_workspace_idx").on(table.workspaceId),
    check("accounts_balance_nonnegative", sql`${table.balance} >= 0`),
  ],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    color: text("color").notNull().default("#16876f"),
    icon: text("icon").notNull().default("circle-dollar-sign"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("categories_workspace_name_uidx").on(
      table.workspaceId,
      sql`lower(${table.name})`,
    ),
    index("categories_workspace_archived_idx").on(table.workspaceId, table.archived),
  ],
);

export const categoryRules = sqliteTable(
  "category_rules",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    category: text("category").notNull(),
    transactionType: text("transaction_type").notNull().default("expense"),
    matchType: text("match_type").notNull().default("contains"),
    priority: integer("priority").notNull().default(100),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("category_rules_workspace_keyword_type_uidx").on(
      table.workspaceId,
      sql`lower(${table.keyword})`,
      table.transactionType,
    ),
    index("category_rules_workspace_active_idx").on(table.workspaceId, table.active),
    check("category_rules_transaction_type_check", sql`${table.transactionType} IN ('expense', 'income')`),
    check("category_rules_match_type_check", sql`${table.matchType} IN ('contains', 'starts_with', 'exact')`),
    check("category_rules_priority_check", sql`${table.priority} BETWEEN 0 AND 1000`),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    date: text("date").notNull(),
    time: text("time").notNull().default(""),
    title: text("title").notNull(),
    merchant: text("merchant"),
    category: text("category").notNull(),
    notes: text("notes").notNull().default(""),
    tagsJson: text("tags_json").notNull().default("[]"),
    location: text("location").notNull().default(""),
    splitsJson: text("splits_json").notNull().default("[]"),
    accountId: text("account_id").notNull(),
    destinationAccountId: text("destination_account_id"),
    transferGroupId: text("transfer_group_id"),
    amount: integer("amount").notNull(),
    status: text("status").notNull().default("completed"),
    idempotencyKey: text("idempotency_key").notNull(),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("transactions_workspace_date_idx").on(table.workspaceId, table.date),
    index("transactions_account_idx").on(table.workspaceId, table.accountId),
    uniqueIndex("transactions_workspace_idempotency_uidx").on(
      table.workspaceId,
      table.idempotencyKey,
    ),
    check("transactions_amount_positive", sql`${table.amount} > 0`),
  ],
);

export const transactionAttachments = sqliteTable(
  "transaction_attachments",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    objectKey: text("object_key").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("transaction_attachments_object_key_uidx").on(table.objectKey),
    index("transaction_attachments_transaction_idx").on(table.workspaceId, table.transactionId),
    check("transaction_attachments_size_positive", sql`${table.sizeBytes} > 0`),
  ],
);

export const budgets = sqliteTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    amountLimit: integer("amount_limit").notNull(),
    period: text("period").notNull(),
    color: text("color").notNull().default("#16876f"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("budgets_workspace_category_period_uidx").on(
      table.workspaceId,
      table.category,
      table.period,
    ),
    index("budgets_workspace_period_idx").on(table.workspaceId, table.period),
    check("budgets_limit_positive", sql`${table.amountLimit} > 0`),
  ],
);

export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    target: integer("target").notNull(),
    current: integer("current").notNull().default(0),
    deadline: text("deadline").notNull(),
    color: text("color").notNull().default("#16876f"),
    icon: text("icon").notNull().default("target"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("goals_workspace_deadline_idx").on(table.workspaceId, table.deadline),
    check("goals_target_positive", sql`${table.target} > 0`),
    check("goals_current_nonnegative", sql`${table.current} >= 0`),
  ],
);

export const sinkingFunds = sqliteTable(
  "sinking_funds",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    purpose: text("purpose").notNull().default("Lainnya"),
    targetAmount: integer("target_amount").notNull(),
    currentAmount: integer("current_amount").notNull().default(0),
    monthlyContribution: integer("monthly_contribution").notNull().default(0),
    targetDate: text("target_date").notNull(),
    accountId: text("account_id").notNull().references(() => accounts.id),
    color: text("color").notNull().default("#16876f"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("sinking_funds_workspace_target_idx").on(table.workspaceId, table.active, table.targetDate),
    index("sinking_funds_workspace_account_idx").on(table.workspaceId, table.accountId),
    check("sinking_funds_target_positive", sql`${table.targetAmount} > 0`),
    check("sinking_funds_current_nonnegative", sql`${table.currentAmount} >= 0`),
    check("sinking_funds_current_within_target", sql`${table.currentAmount} <= ${table.targetAmount}`),
    check("sinking_funds_monthly_nonnegative", sql`${table.monthlyContribution} >= 0`),
  ],
);

export const sinkingFundEntries = sqliteTable(
  "sinking_fund_entries",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    fundId: text("fund_id")
      .notNull()
      .references(() => sinkingFunds.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    amount: integer("amount").notNull(),
    date: text("date").notNull(),
    note: text("note").notNull().default(""),
    requestId: text("request_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("sinking_fund_entries_workspace_request_uidx").on(table.workspaceId, table.requestId),
    index("sinking_fund_entries_fund_date_idx").on(table.workspaceId, table.fundId, table.date),
    check("sinking_fund_entries_type_check", sql`${table.type} IN ('allocate', 'release')`),
    check("sinking_fund_entries_amount_positive", sql`${table.amount} > 0`),
  ],
);

export const bills = sqliteTable(
  "bills",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount: integer("amount").notNull(),
    dueDate: text("due_date").notNull(),
    category: text("category").notNull(),
    accountId: text("account_id").notNull(),
    frequency: text("frequency").notNull().default("monthly"),
    reminderDays: text("reminder_days").notNull().default("7,3,1,0"),
    paid: integer("paid", { mode: "boolean" }).notNull().default(false),
    paidAt: text("paid_at"),
    lastPaidPeriod: text("last_paid_period"),
    liabilityAccountId: text("liability_account_id"),
    durationMonths: integer("duration_months"),
    paidCount: integer("paid_count").notNull().default(0),
    currentPeriodPaid: integer("current_period_paid").notNull().default(0),
    totalPaid: integer("total_paid").notNull().default(0),
    installmentPhasesJson: text("installment_phases_json").notNull().default("[]"),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("bills_workspace_due_idx").on(table.workspaceId, table.dueDate),
    index("bills_workspace_account_idx").on(table.workspaceId, table.accountId),
    index("bills_workspace_liability_idx").on(table.workspaceId, table.liabilityAccountId),
    check("bills_amount_positive", sql`${table.amount} > 0`),
    check("bills_frequency_check", sql`${table.frequency} IN ('monthly')`),
    check("bills_duration_check", sql`${table.durationMonths} IS NULL OR (${table.durationMonths} >= 1 AND ${table.durationMonths} <= 120)`),
    check("bills_paid_count_nonnegative", sql`${table.paidCount} >= 0`),
    check("bills_current_period_paid_nonnegative", sql`${table.currentPeriodPaid} >= 0`),
    check("bills_total_paid_nonnegative", sql`${table.totalPaid} >= 0`),
  ],
);

export const recurringTemplates = sqliteTable(
  "recurring_templates",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    amount: integer("amount").notNull(),
    category: text("category").notNull(),
    accountId: text("account_id").notNull().references(() => accounts.id),
    frequency: text("frequency").notNull(),
    startDate: text("start_date").notNull(),
    nextDueDate: text("next_due_date").notNull(),
    isSubscription: integer("is_subscription", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    lastPostedDate: text("last_posted_date"),
    requestId: text("request_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("recurring_templates_workspace_request_uidx").on(table.workspaceId, table.requestId),
    index("recurring_templates_workspace_due_idx").on(table.workspaceId, table.active, table.nextDueDate),
    check("recurring_templates_type_check", sql`${table.type} IN ('income', 'expense')`),
    check("recurring_templates_amount_positive", sql`${table.amount} > 0`),
    check("recurring_templates_frequency_check", sql`${table.frequency} IN ('weekly', 'monthly', 'quarterly', 'yearly')`),
  ],
);

export const investmentAssets = sqliteTable(
  "investment_assets",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    ticker: text("ticker").notNull(),
    name: text("name").notNull(),
    assetClass: text("asset_class").notNull(),
    exchange: text("exchange").notNull().default(""),
    currency: text("currency").notNull().default("IDR"),
    manualPrice: integer("manual_price"),
    latestPriceCache: integer("latest_price_cache").notNull().default(0),
    priceSource: text("price_source").notNull().default("unavailable"),
    priceStatus: text("price_status").notNull().default("unavailable"),
    priceUpdatedAt: text("price_updated_at"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    requestId: text("request_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("investment_assets_workspace_symbol_uidx").on(
      table.workspaceId,
      sql`lower(${table.ticker})`,
      sql`lower(${table.exchange})`,
    ),
    uniqueIndex("investment_assets_workspace_request_uidx").on(table.workspaceId, table.requestId),
    index("investment_assets_workspace_active_idx").on(table.workspaceId, table.active),
    check("investment_assets_manual_price_nonnegative", sql`${table.manualPrice} IS NULL OR ${table.manualPrice} >= 0`),
    check("investment_assets_latest_price_nonnegative", sql`${table.latestPriceCache} >= 0`),
  ],
);

export const investmentPositions = sqliteTable(
  "investment_positions",
  {
    assetId: text("asset_id")
      .primaryKey()
      .references(() => investmentAssets.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    unitsMicro: integer("units_micro").notNull().default(0),
    costBasis: integer("cost_basis").notNull().default(0),
    realizedPl: integer("realized_pl").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("investment_positions_workspace_idx").on(table.workspaceId),
    check("investment_positions_units_nonnegative", sql`${table.unitsMicro} >= 0`),
    check("investment_positions_cost_nonnegative", sql`${table.costBasis} >= 0`),
  ],
);

export const investmentTransactions = sqliteTable(
  "investment_transactions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => investmentAssets.id),
    accountId: text("account_id").notNull(),
    date: text("date").notNull(),
    type: text("type").notNull(),
    unitsMicro: integer("units_micro").notNull(),
    pricePerUnit: integer("price_per_unit").notNull(),
    grossAmount: integer("gross_amount").notNull(),
    fee: integer("fee").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    netAmount: integer("net_amount").notNull(),
    averageCostAfter: integer("average_cost_after").notNull(),
    remainingUnitsMicro: integer("remaining_units_micro").notNull(),
    realizedPl: integer("realized_pl").notNull().default(0),
    linkedCashTransactionId: text("linked_cash_transaction_id").notNull(),
    linkedAdjustmentTransactionId: text("linked_adjustment_transaction_id"),
    note: text("note"),
    requestId: text("request_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("investment_transactions_workspace_request_uidx").on(table.workspaceId, table.requestId),
    index("investment_transactions_workspace_date_idx").on(table.workspaceId, table.date),
    index("investment_transactions_asset_idx").on(table.workspaceId, table.assetId),
    check("investment_transactions_units_positive", sql`${table.unitsMicro} > 0`),
    check("investment_transactions_price_positive", sql`${table.pricePerUnit} > 0`),
    check("investment_transactions_gross_positive", sql`${table.grossAmount} > 0`),
    check("investment_transactions_fee_nonnegative", sql`${table.fee} >= 0`),
    check("investment_transactions_tax_nonnegative", sql`${table.tax} >= 0`),
    check("investment_transactions_net_positive", sql`${table.netAmount} > 0`),
    check("investment_transactions_remaining_nonnegative", sql`${table.remainingUnitsMicro} >= 0`),
  ],
);

export const aiSettings = sqliteTable("ai_settings", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("openai-compatible"),
  baseUrl: text("base_url").notNull().default(""),
  model: text("model").notNull().default("default"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  consentAccepted: integer("consent_accepted", { mode: "boolean" }).notNull().default(false),
  encryptedApiKey: text("encrypted_api_key"),
  apiKeyIv: text("api_key_iv"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const aiChatMessages = sqliteTable(
  "ai_chat_messages",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    period: text("period").notNull(),
    contextManifest: text("context_manifest").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("ai_chat_messages_workspace_created_idx").on(table.workspaceId, table.createdAt),
    check("ai_chat_messages_role_check", sql`${table.role} IN ('user', 'assistant')`),
  ],
);

export const dataExports = sqliteTable(
  "data_exports",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    objectKey: text("object_key").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    status: text("status").notNull().default("ready"),
    period: text("period"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("data_exports_object_key_uidx").on(table.objectKey),
    index("data_exports_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("data_exports_workspace_kind_idx").on(table.workspaceId, table.kind),
    check("data_exports_kind_check", sql`${table.kind} IN ('backup', 'report', 'migration_report')`),
    check("data_exports_status_check", sql`${table.status} IN ('ready', 'failed')`),
    check("data_exports_size_nonnegative", sql`${table.sizeBytes} >= 0`),
  ],
);

export const backupSettings = sqliteTable("backup_settings", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  frequency: text("frequency").notNull().default("weekly"),
  lastBackupAt: text("last_backup_at"),
  nextBackupAt: text("next_backup_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const migrationJobs = sqliteTable(
  "migration_jobs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sourceName: text("source_name").notNull(),
    sourceSchemaVersion: text("source_schema_version").notNull(),
    status: text("status").notNull().default("preview"),
    objectKey: text("object_key").notNull(),
    countsJson: text("counts_json").notNull().default("{}"),
    warningsJson: text("warnings_json").notNull().default("[]"),
    errorsJson: text("errors_json").notNull().default("[]"),
    balanceDifference: integer("balance_difference").notNull().default(0),
    requestId: text("request_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    appliedAt: text("applied_at"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("migration_jobs_workspace_request_uidx").on(table.workspaceId, table.requestId),
    uniqueIndex("migration_jobs_object_key_uidx").on(table.objectKey),
    index("migration_jobs_workspace_created_idx").on(table.workspaceId, table.createdAt),
    check("migration_jobs_status_check", sql`${table.status} IN ('preview', 'applied', 'cancelled', 'failed')`),
  ],
);

export const notificationSettings = sqliteTable("notification_settings", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  billReminderDays: text("bill_reminder_days").notNull().default("[7,3,1,0]"),
  budgetWarningPercent: integer("budget_warning_percent").notNull().default(75),
  backupWarningDays: integer("backup_warning_days").notNull().default(7),
  goalWarningDays: integer("goal_warning_days").notNull().default(30),
  emailEnabled: integer("email_enabled", { mode: "boolean" }).notNull().default(false),
  emailAddress: text("email_address").notNull().default(""),
  weeklyDigest: integer("weekly_digest", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const roadmapSettings = sqliteTable(
  "roadmap_settings",
  {
    workspaceId: text("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    horizonMonths: integer("horizon_months").notNull().default(24),
    incomeAdjustmentPct: integer("income_adjustment_pct").notNull().default(0),
    expenseAdjustmentPct: integer("expense_adjustment_pct").notNull().default(0),
    annualInvestmentReturnPct: integer("annual_investment_return_pct").notNull().default(6),
    annualInflationPct: integer("annual_inflation_pct").notNull().default(3),
    monthlyInvestment: integer("monthly_investment").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("roadmap_horizon_check", sql`${table.horizonMonths} IN (12, 24, 36, 60)`),
    check("roadmap_income_adjustment_check", sql`${table.incomeAdjustmentPct} BETWEEN -50 AND 100`),
    check("roadmap_expense_adjustment_check", sql`${table.expenseAdjustmentPct} BETWEEN -50 AND 100`),
    check("roadmap_return_check", sql`${table.annualInvestmentReturnPct} BETWEEN 0 AND 30`),
    check("roadmap_inflation_check", sql`${table.annualInflationPct} BETWEEN 0 AND 30`),
    check("roadmap_monthly_investment_nonnegative", sql`${table.monthlyInvestment} >= 0`),
  ],
);

export const debtPayoffSettings = sqliteTable(
  "debt_payoff_settings",
  {
    workspaceId: text("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    strategy: text("strategy").notNull().default("avalanche"),
    extraMonthlyPayment: integer("extra_monthly_payment").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("debt_payoff_strategy_check", sql`${table.strategy} IN ('avalanche', 'snowball')`),
    check("debt_payoff_extra_nonnegative", sql`${table.extraMonthlyPayment} >= 0`),
  ],
);

export const debtAccounts = sqliteTable(
  "debt_accounts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    annualRateBps: integer("annual_rate_bps").notNull().default(0),
    minimumPayment: integer("minimum_payment").notNull().default(0),
    dueDay: integer("due_day").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("debt_accounts_workspace_account_uidx").on(table.workspaceId, table.accountId),
    index("debt_accounts_workspace_idx").on(table.workspaceId),
    check("debt_accounts_rate_check", sql`${table.annualRateBps} BETWEEN 0 AND 10000`),
    check("debt_accounts_minimum_nonnegative", sql`${table.minimumPayment} >= 0`),
    check("debt_accounts_due_day_check", sql`${table.dueDay} BETWEEN 1 AND 31`),
  ],
);

export const cashflowForecastSettings = sqliteTable(
  "cashflow_forecast_settings",
  {
    workspaceId: text("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    horizonDays: integer("horizon_days").notNull().default(60),
    monthlyIncomeOverride: integer("monthly_income_override").notNull().default(0),
    incomeDay: integer("income_day").notNull().default(25),
    minimumCashBuffer: integer("minimum_cash_buffer").notNull().default(2000000),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("cashflow_forecast_horizon_check", sql`${table.horizonDays} IN (30, 60, 90)`),
    check("cashflow_forecast_income_nonnegative", sql`${table.monthlyIncomeOverride} >= 0`),
    check("cashflow_forecast_income_day_check", sql`${table.incomeDay} BETWEEN 1 AND 28`),
    check("cashflow_forecast_buffer_nonnegative", sql`${table.minimumCashBuffer} >= 0`),
  ],
);

export const emergencyFundSettings = sqliteTable(
  "emergency_fund_settings",
  {
    workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
    targetMonths: integer("target_months").notNull().default(6),
    monthlyExpenseOverride: integer("monthly_expense_override").notNull().default(0),
    monthlyContribution: integer("monthly_contribution").notNull().default(0),
    accountIdsJson: text("account_ids_json").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("emergency_fund_target_check", sql`${table.targetMonths} IN (3, 6, 9, 12)`),
    check("emergency_fund_expense_nonnegative", sql`${table.monthlyExpenseOverride} >= 0`),
    check("emergency_fund_contribution_nonnegative", sql`${table.monthlyContribution} >= 0`),
  ],
);

export const zakatSettings = sqliteTable(
  "zakat_settings",
  {
    workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
    goldPricePerGram: integer("gold_price_per_gram").notNull().default(0),
    nisabGrams: integer("nisab_grams").notNull().default(85),
    haulStartDate: text("haul_start_date").notNull().default(""),
    includeInvestments: integer("include_investments", { mode: "boolean" }).notNull().default(true),
    excludedAccountIdsJson: text("excluded_account_ids_json").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("zakat_gold_price_nonnegative", sql`${table.goldPricePerGram} >= 0`),
    check("zakat_nisab_grams_positive", sql`${table.nisabGrams} > 0`),
  ],
);

export const monthlyClosings = sqliteTable(
  "monthly_closings",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    status: text("status").notNull().default("closed"),
    snapshotJson: text("snapshot_json").notNull().default("{}"),
    closedAt: text("closed_at"),
    reopenedAt: text("reopened_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("monthly_closings_workspace_period_uidx").on(table.workspaceId, table.period),
    index("monthly_closings_workspace_status_idx").on(table.workspaceId, table.status),
    check("monthly_closings_period_check", sql`${table.period} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'`),
    check("monthly_closings_status_check", sql`${table.status} IN ('closed', 'open')`),
  ],
);

export const notificationStates = sqliteTable(
  "notification_states",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    notificationKey: text("notification_key").notNull(),
    readAt: text("read_at"),
    dismissedAt: text("dismissed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("notification_states_workspace_key_uidx").on(table.workspaceId, table.notificationKey),
    index("notification_states_workspace_updated_idx").on(table.workspaceId, table.updatedAt),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    actor: text("actor").notNull().default("system"),
    requestId: text("request_id"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    details: text("details").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("audit_logs_workspace_created_idx").on(table.workspaceId, table.createdAt),
    uniqueIndex("audit_logs_workspace_request_action_entity_uidx").on(
      table.workspaceId,
      table.requestId,
      table.action,
      table.entityId,
    ),
  ],
);

export const transactionUndoEvents = sqliteTable(
  "transaction_undo_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    targetAuditId: text("target_audit_id")
      .notNull()
      .references(() => auditLogs.id, { onDelete: "cascade" }),
    requestId: text("request_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("transaction_undo_events_target_uidx").on(table.workspaceId, table.targetAuditId),
    uniqueIndex("transaction_undo_events_request_uidx").on(table.workspaceId, table.requestId),
    index("transaction_undo_events_workspace_created_idx").on(table.workspaceId, table.createdAt),
  ],
);
