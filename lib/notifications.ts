import type { Bill, Budget, Goal, InvestmentAsset, Transaction } from "./finance";
import { budgetSpent } from "./finance";

export type NotificationSeverity = "info" | "warning" | "critical";
export type NotificationActionPage = "bills" | "budgets" | "goals" | "investments" | "settings";

export type FinanceNotification = {
  id: string;
  type: "bill_due" | "bill_overdue" | "budget" | "goal" | "backup" | "investment_price";
  severity: NotificationSeverity;
  title: string;
  message: string;
  actionPage: NotificationActionPage;
  eventDate: string | null;
  read: boolean;
  dismissed: boolean;
};

export type NotificationSettings = {
  enabled: boolean;
  billReminderDays: number[];
  budgetWarningPercent: number;
  backupWarningDays: number;
  goalWarningDays: number;
  emailEnabled: boolean;
  emailAddress: string;
  weeklyDigest: boolean;
};

export type NotificationOverview = {
  notifications: FinanceNotification[];
  unreadCount: number;
  generatedAt: string;
  settings: NotificationSettings;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  billReminderDays: [7, 3, 1, 0],
  budgetWarningPercent: 75,
  backupWarningDays: 7,
  goalWarningDays: 30,
  emailEnabled: false,
  emailAddress: "",
  weeklyDigest: true,
};

export type NotificationEngineInput = {
  period: string;
  today: string;
  settings: NotificationSettings;
  bills: Array<Pick<Bill, "id" | "name" | "dueDate" | "paid" | "frequency" | "reminderDays" | "lastPaidPeriod">>;
  budgets: Budget[];
  transactions: Transaction[];
  goals: Array<Pick<Goal, "id" | "name" | "target" | "current" | "deadline">>;
  investmentAssets: Array<Pick<InvestmentAsset, "id" | "ticker" | "active" | "priceStatus">>;
  latestBackupAt: string | null;
};

const dayMs = 86_400_000;
const dateValue = (value: string) => new Date(`${value}T00:00:00Z`).getTime();

export function daysFromToday(today: string, eventDate: string) {
  return Math.round((dateValue(eventDate) - dateValue(today)) / dayMs);
}

export function recurringBillDueDate(dueDate: string, period: string, frequency: Bill["frequency"] = "monthly") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !/^\d{4}-\d{2}$/.test(period)) return dueDate;
  if (frequency !== "monthly") return dueDate;
  const [year, month] = period.split("-").map(Number);
  const originalDay = Number(dueDate.slice(8, 10));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${String(Math.min(originalDay, lastDay)).padStart(2, "0")}`;
}

function backupAgeDays(today: string, value: string) {
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((dateValue(today) - created.getTime()) / dayMs));
}

function priority(severity: NotificationSeverity) {
  return severity === "critical" ? 0 : severity === "warning" ? 1 : 2;
}

export function buildFinanceNotifications(input: NotificationEngineInput): FinanceNotification[] {
  if (!input.settings.enabled) return [];
  const notifications: FinanceNotification[] = [];

  input.bills.forEach((bill) => {
    if (bill.paid || bill.lastPaidPeriod === input.period || bill.dueDate.slice(0, 7) > input.period) return;
    const eventDate = recurringBillDueDate(bill.dueDate, input.period, bill.frequency);
    const remaining = daysFromToday(input.today, eventDate);
    const allowedDays = (bill.reminderDays?.length ? bill.reminderDays : input.settings.billReminderDays)
      .filter((day) => input.settings.billReminderDays.includes(day));
    const maxReminder = allowedDays.length ? Math.max(...allowedDays) : -1;
    if (remaining >= 0 && (maxReminder < 0 || remaining > maxReminder)) return;
    notifications.push({
      id: `bill:${bill.id}:${input.period}`,
      type: remaining < 0 ? "bill_overdue" : "bill_due",
      severity: remaining <= 0 ? "critical" : remaining <= 1 ? "warning" : "info",
      title: remaining < 0 ? `${bill.name} terlambat` : remaining === 0 ? `${bill.name} jatuh tempo hari ini` : `${bill.name} segera jatuh tempo`,
      message: remaining < 0
        ? `Terlambat ${Math.abs(remaining)} hari. Bayar dari akun sumber agar tidak tercatat ganda.`
        : `Jatuh tempo dalam ${remaining} hari pada ${eventDate}.`,
      actionPage: "bills",
      eventDate,
      read: false,
      dismissed: false,
    });
  });

  input.budgets.filter((budget) => !budget.period || budget.period === input.period).forEach((budget) => {
    const spent = budgetSpent(input.transactions, budget.category, input.period);
    const percent = budget.limit > 0 ? spent / budget.limit * 100 : 0;
    if (percent < input.settings.budgetWarningPercent) return;
    notifications.push({
      id: `budget:${budget.id}:${input.period}`,
      type: "budget",
      severity: percent > 100 ? "critical" : percent >= 90 ? "warning" : "info",
      title: percent > 100 ? `Anggaran ${budget.category} terlampaui` : `Anggaran ${budget.category} perlu dipantau`,
      message: `${percent.toFixed(1)}% dari batas bulanan sudah terpakai.`,
      actionPage: "budgets",
      eventDate: `${input.period}-01`,
      read: false,
      dismissed: false,
    });
  });

  input.goals.forEach((goal) => {
    if (goal.current >= goal.target) return;
    const remaining = daysFromToday(input.today, goal.deadline);
    if (remaining > input.settings.goalWarningDays) return;
    notifications.push({
      id: `goal:${goal.id}:${goal.deadline}`,
      type: "goal",
      severity: remaining < 0 ? "critical" : remaining <= 7 ? "warning" : "info",
      title: remaining < 0 ? `Deadline ${goal.name} terlewat` : `Deadline ${goal.name} mendekat`,
      message: remaining < 0 ? `Target belum tercapai dan terlambat ${Math.abs(remaining)} hari.` : `${remaining} hari tersisa untuk mencapai target.`,
      actionPage: "goals",
      eventDate: goal.deadline,
      read: false,
      dismissed: false,
    });
  });

  input.investmentAssets.filter((asset) => asset.active && asset.priceStatus === "unavailable").forEach((asset) => {
    notifications.push({
      id: `investment:${asset.id}:price`,
      type: "investment_price",
      severity: "warning",
      title: `Harga ${asset.ticker} belum tersedia`,
      message: "Tambahkan harga manual agar nilai portofolio dan net worth tetap terukur.",
      actionPage: "investments",
      eventDate: null,
      read: false,
      dismissed: false,
    });
  });

  const backupAge = input.latestBackupAt ? backupAgeDays(input.today, input.latestBackupAt) : Number.POSITIVE_INFINITY;
  if (!input.latestBackupAt || backupAge >= input.settings.backupWarningDays) {
    notifications.push({
      id: `backup:${input.latestBackupAt?.slice(0, 10) ?? "missing"}`,
      type: "backup",
      severity: !input.latestBackupAt || backupAge >= input.settings.backupWarningDays * 2 ? "critical" : "warning",
      title: input.latestBackupAt ? "Backup sudah terlalu lama" : "Belum ada backup lengkap",
      message: input.latestBackupAt ? `Backup terakhir dibuat ${backupAge} hari lalu.` : "Buat backup pertama untuk melindungi data keuangan.",
      actionPage: "settings",
      eventDate: input.latestBackupAt?.slice(0, 10) ?? null,
      read: false,
      dismissed: false,
    });
  }

  return notifications.sort((a, b) => priority(a.severity) - priority(b.severity)
    || String(a.eventDate ?? "9999").localeCompare(String(b.eventDate ?? "9999"))
    || a.id.localeCompare(b.id));
}
