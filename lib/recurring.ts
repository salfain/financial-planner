export const RECURRING_FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"] as const;

export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export type RecurringTemplate = {
  id: string;
  name: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  accountId: string;
  frequency: RecurringFrequency;
  startDate: string;
  nextDueDate: string;
  isSubscription: boolean;
  active: boolean;
  lastPostedDate?: string | null;
  updatedAt?: string;
};

export type RecurringOverview = {
  templates: RecurringTemplate[];
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySubscriptions: number;
  annualSubscriptions: number;
  upcomingCount: number;
  overdueCount: number;
};

const dayMs = 86_400_000;

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Tanggal transaksi rutin tidak valid.");
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new RangeError("Tanggal transaksi rutin tidak valid.");
  return date;
}

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

export function addRecurringPeriod(date: string, frequency: RecurringFrequency) {
  const current = parseDate(date);
  if (frequency === "weekly") current.setUTCDate(current.getUTCDate() + 7);
  else {
    const originalDay = current.getUTCDate();
    const months = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;
    current.setUTCDate(1);
    current.setUTCMonth(current.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0, 12)).getUTCDate();
    current.setUTCDate(Math.min(originalDay, lastDay));
  }
  return dateKey(current);
}

export function monthlyEquivalent(amount: number, frequency: RecurringFrequency) {
  if (frequency === "weekly") return Math.round(amount * 52 / 12);
  if (frequency === "quarterly") return Math.round(amount / 3);
  if (frequency === "yearly") return Math.round(amount / 12);
  return Math.round(amount);
}

export function recurringOccurrences(template: RecurringTemplate, throughDate: string, limit = 100) {
  if (!template.active) return [];
  parseDate(throughDate);
  const result: string[] = [];
  let cursor = template.nextDueDate;
  while (cursor <= throughDate && result.length < limit) {
    result.push(cursor);
    cursor = addRecurringPeriod(cursor, template.frequency);
  }
  return result;
}

export function buildRecurringOverview(templates: RecurringTemplate[], today: string, horizonDays = 30): RecurringOverview {
  const current = parseDate(today);
  const end = new Date(current.getTime() + Math.max(0, horizonDays) * dayMs);
  const active = templates.filter((item) => item.active);
  const monthlyIncome = active.filter((item) => item.type === "income").reduce((sum, item) => sum + monthlyEquivalent(item.amount, item.frequency), 0);
  const monthlyExpense = active.filter((item) => item.type === "expense").reduce((sum, item) => sum + monthlyEquivalent(item.amount, item.frequency), 0);
  const monthlySubscriptions = active.filter((item) => item.type === "expense" && item.isSubscription).reduce((sum, item) => sum + monthlyEquivalent(item.amount, item.frequency), 0);
  return {
    templates,
    monthlyIncome,
    monthlyExpense,
    monthlySubscriptions,
    annualSubscriptions: monthlySubscriptions * 12,
    upcomingCount: active.reduce((sum, item) => sum + recurringOccurrences(item, dateKey(end)).length, 0),
    overdueCount: active.filter((item) => item.nextDueDate < today).length,
  };
}
