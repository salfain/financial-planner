import { getD1 } from "@/db";
import type { Bill, Budget, Goal, InvestmentAsset, Transaction } from "@/lib/finance";
import {
  buildFinanceNotifications,
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationOverview,
  type NotificationSettings,
} from "@/lib/notifications";
import { ApiError, makeId, nowIso } from "./api";
import { auditStatement } from "./audit";
import { requireWorkspace } from "./repository";

type NotificationSettingsRow = {
  enabled: number;
  billReminderDays: string;
  budgetWarningPercent: number;
  backupWarningDays: number;
  goalWarningDays: number;
};

type NotificationStateRow = {
  notificationKey: string;
  readAt: string | null;
  dismissedAt: string | null;
};

export type NotificationStateAction = "read" | "unread" | "dismiss" | "restore";

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function reminderDays(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_NOTIFICATION_SETTINGS.billReminderDays;
    const days = [...new Set(parsed.map(Number))].filter((day) => Number.isSafeInteger(day) && day >= 0 && day <= 30).sort((a, b) => b - a);
    return days.length ? days : DEFAULT_NOTIFICATION_SETTINGS.billReminderDays;
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS.billReminderDays;
  }
}

function settingsRecord(row: NotificationSettingsRow): NotificationSettings {
  return {
    enabled: Boolean(row.enabled),
    billReminderDays: reminderDays(row.billReminderDays),
    budgetWarningPercent: row.budgetWarningPercent,
    backupWarningDays: row.backupWarningDays,
    goalWarningDays: row.goalWarningDays,
  };
}

async function ensureNotificationSettings(workspaceId: string) {
  const now = nowIso();
  await getD1().prepare(
    `INSERT INTO notification_settings
       (workspace_id, enabled, bill_reminder_days, budget_warning_percent, backup_warning_days, goal_warning_days, created_at, updated_at)
     VALUES (?, 1, '[7,3,1,0]', 75, 7, 30, ?, ?)
     ON CONFLICT(workspace_id) DO NOTHING`,
  ).bind(workspaceId, now, now).run();
}

async function getSettings(workspaceId: string) {
  await ensureNotificationSettings(workspaceId);
  const row = await getD1().prepare(
    `SELECT enabled, bill_reminder_days AS billReminderDays,
            budget_warning_percent AS budgetWarningPercent,
            backup_warning_days AS backupWarningDays,
            goal_warning_days AS goalWarningDays
     FROM notification_settings WHERE workspace_id = ? LIMIT 1`,
  ).bind(workspaceId).first<NotificationSettingsRow>();
  if (!row) throw new ApiError(500, "NOTIFICATION_SETTINGS_MISSING", "Pengaturan notifikasi tidak dapat dimuat.");
  return settingsRecord(row);
}

export async function getNotificationOverview(workspaceId: string, period: string): Promise<NotificationOverview> {
  await requireWorkspace(workspaceId);
  const settings = await getSettings(workspaceId);
  const d1 = getD1();
  const results = await d1.batch([
    d1.prepare(
      `SELECT id, name, due_date AS dueDate, frequency, reminder_days AS reminderDays,
              last_paid_period AS lastPaidPeriod
       FROM bills WHERE workspace_id = ? ORDER BY due_date, id`,
    ).bind(workspaceId),
    d1.prepare(`SELECT id, category, amount_limit AS amountLimit, period, color FROM budgets WHERE workspace_id = ? AND period = ? ORDER BY category, id`).bind(workspaceId, period),
    d1.prepare(
      `SELECT id, type, date, title, merchant, category, account_id AS accountId,
              destination_account_id AS destinationAccountId, amount, status,
              deleted_at AS deletedAt
       FROM transactions WHERE workspace_id = ? AND date LIKE ? ORDER BY date, id`,
    ).bind(workspaceId, `${period}-%`),
    d1.prepare(`SELECT id, name, target, current, deadline FROM goals WHERE workspace_id = ? ORDER BY deadline, id`).bind(workspaceId),
    d1.prepare(`SELECT id, ticker, active, price_status AS priceStatus FROM investment_assets WHERE workspace_id = ? AND active = 1 ORDER BY ticker, id`).bind(workspaceId),
    d1.prepare(`SELECT created_at AS createdAt FROM data_exports WHERE workspace_id = ? AND kind = 'backup' AND status = 'ready' ORDER BY created_at DESC LIMIT 1`).bind(workspaceId),
    d1.prepare(`SELECT notification_key AS notificationKey, read_at AS readAt, dismissed_at AS dismissedAt FROM notification_states WHERE workspace_id = ?`).bind(workspaceId),
  ]);

  const bills = (results[0].results as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    dueDate: String(row.dueDate),
    paid: String(row.lastPaidPeriod ?? "") === period,
    lastPaidPeriod: row.lastPaidPeriod ? String(row.lastPaidPeriod) : null,
    frequency: "monthly" as const,
    reminderDays: String(row.reminderDays ?? "7,3,1,0").split(",").map(Number).filter(Number.isSafeInteger),
  })) satisfies Array<Pick<Bill, "id" | "name" | "dueDate" | "paid" | "frequency" | "reminderDays" | "lastPaidPeriod">>;
  const budgets = (results[1].results as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id), category: String(row.category), limit: Number(row.amountLimit), period: String(row.period), color: String(row.color),
  })) satisfies Budget[];
  const transactions = (results[2].results as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id), type: String(row.type) as Transaction["type"], date: String(row.date), title: String(row.title),
    merchant: row.merchant ? String(row.merchant) : undefined, category: String(row.category), accountId: String(row.accountId),
    destinationAccountId: row.destinationAccountId ? String(row.destinationAccountId) : undefined, amount: Number(row.amount),
    status: String(row.status) as Transaction["status"], deletedAt: row.deletedAt ? String(row.deletedAt) : undefined,
  })) satisfies Transaction[];
  const goals = (results[3].results as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id), name: String(row.name), target: Number(row.target), current: Number(row.current), deadline: String(row.deadline),
  })) satisfies Array<Pick<Goal, "id" | "name" | "target" | "current" | "deadline">>;
  const investmentAssets = (results[4].results as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id), ticker: String(row.ticker), active: Boolean(row.active), priceStatus: String(row.priceStatus) as InvestmentAsset["priceStatus"],
  })) satisfies Array<Pick<InvestmentAsset, "id" | "ticker" | "active" | "priceStatus">>;
  const latestBackupAt = results[5].results[0] ? String((results[5].results[0] as Record<string, unknown>).createdAt) : null;
  const state = new Map((results[6].results as NotificationStateRow[]).map((row) => [row.notificationKey, row]));
  const generatedAt = nowIso();
  const notifications = buildFinanceNotifications({ period, today: jakartaToday(), settings, bills, budgets, transactions, goals, investmentAssets, latestBackupAt })
    .map((notification) => {
      const stored = state.get(notification.id);
      return { ...notification, read: Boolean(stored?.readAt), dismissed: Boolean(stored?.dismissedAt) };
    })
    .filter((notification) => !notification.dismissed);
  return { notifications, unreadCount: notifications.filter((notification) => !notification.read).length, generatedAt, settings };
}

export async function updateNotificationSettings(workspaceId: string, settings: NotificationSettings) {
  await requireWorkspace(workspaceId);
  const now = nowIso();
  const d1 = getD1();
  await d1.batch([
    d1.prepare(
      `INSERT INTO notification_settings
         (workspace_id, enabled, bill_reminder_days, budget_warning_percent, backup_warning_days, goal_warning_days, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET enabled = excluded.enabled,
         bill_reminder_days = excluded.bill_reminder_days,
         budget_warning_percent = excluded.budget_warning_percent,
         backup_warning_days = excluded.backup_warning_days,
         goal_warning_days = excluded.goal_warning_days,
         updated_at = excluded.updated_at`,
    ).bind(workspaceId, settings.enabled ? 1 : 0, JSON.stringify(settings.billReminderDays), settings.budgetWarningPercent, settings.backupWarningDays, settings.goalWarningDays, now, now),
    auditStatement(d1, {
      workspaceId,
      action: "notification.settings.update",
      entityType: "notification_settings",
      entityId: workspaceId,
      details: settings,
      createdAt: now,
    }),
  ]);
  return settings;
}

export async function updateNotificationStates(workspaceId: string, notificationIds: string[], action: NotificationStateAction) {
  await requireWorkspace(workspaceId);
  const now = nowIso();
  const d1 = getD1();
  const statements = notificationIds.map((notificationKey) => {
    const readAt = action === "read" || action === "dismiss" ? now : null;
    const dismissedAt = action === "dismiss" ? now : null;
    const updates = action === "read"
      ? "read_at = excluded.read_at, updated_at = excluded.updated_at"
      : action === "unread"
        ? "read_at = NULL, updated_at = excluded.updated_at"
        : action === "dismiss"
          ? "read_at = excluded.read_at, dismissed_at = excluded.dismissed_at, updated_at = excluded.updated_at"
          : "dismissed_at = NULL, updated_at = excluded.updated_at";
    return d1.prepare(
      `INSERT INTO notification_states
         (id, workspace_id, notification_key, read_at, dismissed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id, notification_key) DO UPDATE SET ${updates}`,
    ).bind(makeId("notification-state"), workspaceId, notificationKey, readAt, dismissedAt, now, now);
  });
  for (let index = 0; index < statements.length; index += 50) await d1.batch(statements.slice(index, index + 50));
  return { updated: notificationIds.length, action };
}
