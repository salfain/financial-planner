import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  profileName: text("profile_name").notNull().default("Vinn"),
  storeName: text("store_name").notNull().default("VINN STORE"),
  currency: text("currency").notNull().default("IDR"),
  timezone: text("timezone").notNull().default("Asia/Jakarta"),
  configured: integer("configured", { mode: "boolean" }).notNull().default(false),
  configuredAt: text("configured_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    date: text("date").notNull(),
    title: text("title").notNull(),
    merchant: text("merchant"),
    category: text("category").notNull(),
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
    paid: integer("paid", { mode: "boolean" }).notNull().default(false),
    paidAt: text("paid_at"),
    lastPaidPeriod: text("last_paid_period"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("bills_workspace_due_idx").on(table.workspaceId, table.dueDate),
    index("bills_workspace_account_idx").on(table.workspaceId, table.accountId),
    check("bills_amount_positive", sql`${table.amount} > 0`),
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
  provider: text("provider").notNull().default("gemini"),
  model: text("model").notNull().default("gemini-3.5-flash"),
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
