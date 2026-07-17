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
