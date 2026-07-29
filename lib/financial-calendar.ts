import type { Bill, Goal } from "./finance";
import { recurringOccurrences, type RecurringTemplate } from "./recurring";
import { installmentAmountAt } from "./installment-phases";

export type FinancialCalendarEventKind =
  | "bill"
  | "installment"
  | "income"
  | "recurring_expense"
  | "goal";

export type FinancialCalendarEvent = {
  id: string;
  date: string;
  kind: FinancialCalendarEventKind;
  title: string;
  amount: number;
  accountId?: string;
  liabilityAccountId?: string | null;
  paid?: boolean;
  countsTowardNeed: boolean;
};

const DAY_MS = 86_400_000;

const parseDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Tanggal kalender tidak valid.");
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new RangeError("Tanggal kalender tidak valid.");
  return date;
};

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

export function addCalendarDays(date: string, days: number) {
  const value = parseDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return dateKey(value);
}

export function addCalendarMonths(date: string, months: number) {
  const value = parseDate(date);
  const originalDay = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0, 12)).getUTCDate();
  value.setUTCDate(Math.min(originalDay, lastDay));
  return dateKey(value);
}

export function calendarBillsForActiveAccounts(bills: Bill[], activeAccountIds: string[]) {
  const activeAccounts = new Set(activeAccountIds.map(String));
  return bills.filter((bill) => !bill.liabilityAccountId || activeAccounts.has(String(bill.liabilityAccountId)));
}

export function buildFinancialCalendarEvents(input: {
  bills: Bill[];
  goals: Goal[];
  recurringTemplates: RecurringTemplate[];
  fromDate: string;
  throughDate: string;
}) {
  parseDate(input.fromDate);
  parseDate(input.throughDate);
  if (input.throughDate < input.fromDate) throw new RangeError("Rentang kalender tidak valid.");

  const events: FinancialCalendarEvent[] = [];

  input.bills.filter((bill) => !bill.completed).forEach((bill) => {
    const remaining = bill.durationMonths === null || bill.durationMonths === undefined
      ? 120
      : Math.max(0, bill.remainingMonths ?? bill.durationMonths);
    const occurrenceLimit = Math.min(120, remaining + (bill.paid ? 1 : 0));
    let occurrence = bill.dueDate;
    let occurrenceIndex = 0;
    while (occurrence <= input.throughDate && occurrenceIndex < occurrenceLimit) {
      if (occurrence >= input.fromDate) {
        const paid = Boolean(occurrenceIndex === 0 && (
          bill.paid || bill.lastPaidPeriod === occurrence.slice(0, 7)
        ));
        events.push({
          id: `bill:${bill.id}:${occurrence}`,
          date: occurrence,
          kind: bill.liabilityAccountId ? "installment" : "bill",
          title: bill.name,
          amount: installmentAmountAt(bill, occurrenceIndex),
          accountId: bill.accountId,
          liabilityAccountId: bill.liabilityAccountId,
          paid,
          countsTowardNeed: !paid,
        });
      }
      occurrence = addCalendarMonths(occurrence, 1);
      occurrenceIndex += 1;
    }
  });

  input.recurringTemplates.filter((template) => template.active).forEach((template) => {
    recurringOccurrences(template, input.throughDate).filter((date) => date >= input.fromDate).forEach((date) => {
      events.push({
        id: `recurring:${template.id}:${date}`,
        date,
        kind: template.type === "income" ? "income" : "recurring_expense",
        title: template.name,
        amount: template.amount,
        accountId: template.accountId,
        countsTowardNeed: template.type === "expense",
      });
    });
  });

  input.goals.filter((goal) => goal.current < goal.target && goal.deadline >= input.fromDate && goal.deadline <= input.throughDate).forEach((goal) => {
    events.push({
      id: `goal:${goal.id}:${goal.deadline}`,
      date: goal.deadline,
      kind: "goal",
      title: goal.name,
      amount: Math.max(0, goal.target - goal.current),
      countsTowardNeed: false,
    });
  });

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "id-ID"));
}

export function financialCalendarWindow(events: FinancialCalendarEvent[], fromDate: string, days: number) {
  const throughDate = addCalendarDays(fromDate, Math.max(0, days - 1));
  const selected = events.filter((event) => event.date >= fromDate && event.date <= throughDate);
  const outgoing = selected.filter((event) => event.countsTowardNeed).reduce((sum, event) => sum + event.amount, 0);
  const incoming = selected.filter((event) => event.kind === "income").reduce((sum, event) => sum + event.amount, 0);
  const daily = new Map<string, { outgoing: number; incoming: number }>();
  selected.forEach((event) => {
    const value = daily.get(event.date) ?? { outgoing: 0, incoming: 0 };
    if (event.countsTowardNeed) value.outgoing += event.amount;
    if (event.kind === "income") value.incoming += event.amount;
    daily.set(event.date, value);
  });
  return {
    fromDate,
    throughDate,
    outgoing,
    incoming,
    netNeed: Math.max(0, outgoing - incoming),
    criticalDays: [...daily.values()].filter((day) => day.outgoing > day.incoming).length,
  };
}

export function outstandingFinancialCalendarEvents(events: FinancialCalendarEvent[]) {
  return events.filter((event) => !event.paid);
}

export function calendarMonthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new RangeError("Periode kalender tidak valid.");
  const first = `${month}-01`;
  const firstDate = parseDate(first);
  const start = new Date(firstDate);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 41);
  return { startDate: dateKey(start), endDate: dateKey(end) };
}
