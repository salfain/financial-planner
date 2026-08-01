import assert from "node:assert/strict";
import test from "node:test";
import {
  addCalendarMonths,
  buildFinancialCalendarEvents,
  calendarBillsForActiveAccounts,
  calendarMonthRange,
  financialCalendarWindow,
  outstandingFinancialCalendarEvents,
} from "../lib/financial-calendar";

test("kalender memproyeksikan cicilan, tagihan, transaksi rutin, dan deadline target", () => {
  const events = buildFinancialCalendarEvents({
    fromDate: "2026-07-01",
    throughDate: "2026-09-30",
    bills: [
      {
        id: "motor",
        name: "Cicilan motor",
        amount: 1_500_000,
        dueDate: "2026-07-20",
        category: "Kewajiban",
        accountId: "bank",
        liabilityAccountId: "loan",
        paid: false,
        durationMonths: 3,
        paidCount: 0,
        remainingMonths: 3,
      },
      {
        id: "internet",
        name: "Internet",
        amount: 400_000,
        dueDate: "2026-07-25",
        category: "Tagihan",
        accountId: "bank",
        paid: false,
      },
    ],
    goals: [{ id: "goal", name: "Dana darurat", target: 10_000_000, current: 4_000_000, deadline: "2026-09-15", color: "#126b59", icon: "shield" }],
    recurringTemplates: [{
      id: "salary",
      name: "Gaji",
      type: "income",
      amount: 8_000_000,
      category: "Pendapatan",
      accountId: "bank",
      frequency: "monthly",
      startDate: "2026-07-01",
      nextDueDate: "2026-07-01",
      isSubscription: false,
      active: true,
    }],
  });

  assert.equal(events.filter((event) => event.kind === "installment").length, 3);
  assert.equal(events.filter((event) => event.kind === "bill").length, 3);
  assert.equal(events.filter((event) => event.kind === "income").length, 3);
  assert.equal(events.filter((event) => event.kind === "goal").length, 1);
});

test("kebutuhan dana tidak menganggap pinjaman baru atau target sebagai pengeluaran", () => {
  const events = buildFinancialCalendarEvents({
    fromDate: "2026-07-01",
    throughDate: "2026-07-31",
    bills: [{
      id: "bill",
      name: "Cicilan",
      amount: 2_000_000,
      dueDate: "2026-07-10",
      category: "Kewajiban",
      accountId: "bank",
      liabilityAccountId: "loan",
      paid: false,
      durationMonths: 12,
      paidCount: 1,
      remainingMonths: 11,
    }],
    goals: [{ id: "goal", name: "Liburan", target: 5_000_000, current: 1_000_000, deadline: "2026-07-20", color: "#126b59", icon: "target" }],
    recurringTemplates: [{
      id: "salary",
      name: "Gaji",
      type: "income",
      amount: 8_000_000,
      category: "Pendapatan",
      accountId: "bank",
      frequency: "monthly",
      startDate: "2026-07-05",
      nextDueDate: "2026-07-05",
      isSubscription: false,
      active: true,
    }],
  });
  const summary = financialCalendarWindow(events, "2026-07-01", 30);
  assert.equal(summary.outgoing, 2_000_000);
  assert.equal(summary.incoming, 8_000_000);
  assert.equal(summary.netNeed, 0);
});

test("rentang bulan selalu menghasilkan grid enam minggu", () => {
  const range = calendarMonthRange("2026-07");
  const days = Math.round((new Date(`${range.endDate}T12:00:00Z`).getTime() - new Date(`${range.startDate}T12:00:00Z`).getTime()) / 86_400_000) + 1;
  assert.equal(days, 42);
});

test("kalender hanya membuat tujuh jadwal tersisa untuk cicilan 2 dari 9", () => {
  const events = buildFinancialCalendarEvents({
    fromDate: "2026-07-01",
    throughDate: "2027-06-30",
    bills: [{
      id: "historical",
      name: "Cicilan HP",
      amount: 900_000,
      dueDate: "2026-07-23",
      category: "Kewajiban",
      accountId: "bank",
      liabilityAccountId: "paylater",
      paid: false,
      durationMonths: 9,
      paidCount: 2,
      remainingMonths: 7,
    }],
    goals: [],
    recurringTemplates: [],
  });
  assert.equal(events.filter((event) => event.kind === "installment").length, 7);
  assert.equal(events.at(-1)?.date, "2027-01-23");
});

test("kalender menyembunyikan cicilan lama yang akun utangnya sudah tidak aktif", () => {
  const bills = [
    {
      id: "legacy-motor",
      name: "Cicilan Motor",
      amount: 1_780_000,
      dueDate: "2026-08-01",
      category: "Kewajiban",
      accountId: "bank",
      liabilityAccountId: "loan-lama",
      paid: false,
      durationMonths: 24,
      paidCount: 2,
      remainingMonths: 22,
    },
    {
      id: "motor-nmax",
      name: "MOTOR NMAX",
      amount: 1_752_000,
      dueDate: "2026-08-01",
      category: "Kewajiban",
      accountId: "bank",
      liabilityAccountId: "baf-motor",
      paid: false,
      durationMonths: 24,
      paidCount: 2,
      remainingMonths: 22,
    },
    {
      id: "internet",
      name: "Internet",
      amount: 350_000,
      dueDate: "2026-08-05",
      category: "Tagihan",
      accountId: "bank",
      liabilityAccountId: null,
      paid: false,
      durationMonths: null,
      paidCount: 0,
      remainingMonths: null,
    },
  ];

  const visible = calendarBillsForActiveAccounts(bills, ["bank", "baf-motor"]);

  assert.deepEqual(visible.map((bill) => bill.id), ["motor-nmax", "internet"]);
});

test("agenda menandai periode cicilan yang sudah dibayar", () => {
  const events = buildFinancialCalendarEvents({
    fromDate: "2026-08-01",
    throughDate: "2026-09-30",
    bills: [{
      id: "motor-nmax",
      name: "MOTOR NMAX",
      amount: 1_752_000,
      dueDate: "2026-08-01",
      category: "Kewajiban",
      accountId: "bank",
      liabilityAccountId: "baf-motor",
      paid: false,
      lastPaidPeriod: "2026-08",
      durationMonths: 24,
      paidCount: 3,
      remainingMonths: 21,
    }],
    goals: [],
    recurringTemplates: [],
  });

  assert.equal(events[0]?.paid, true);
  assert.equal(events[0]?.countsTowardNeed, false);
  assert.equal(events[1]?.paid, false);
  assert.deepEqual(outstandingFinancialCalendarEvents(events).map((event) => event.date), ["2026-09-01"]);
});

test("status lunas bulan sebelumnya tidak menutup cicilan bulan berikutnya", () => {
  const events = buildFinancialCalendarEvents({
    fromDate: "2026-08-01",
    throughDate: "2026-08-31",
    bills: [{
      id: "motor-nmax",
      name: "MOTOR NMAX",
      amount: 1_752_000,
      dueDate: "2026-08-01",
      category: "Kewajiban",
      accountId: "bank",
      liabilityAccountId: "baf-motor",
      paid: true,
      lastPaidPeriod: "2026-07",
      durationMonths: 24,
      paidCount: 3,
      remainingMonths: 21,
    }],
    goals: [],
    recurringTemplates: [],
  });

  assert.equal(events[0]?.date, "2026-08-01");
  assert.equal(events[0]?.paid, false);
  assert.equal(events[0]?.countsTowardNeed, true);
  assert.deepEqual(outstandingFinancialCalendarEvents(events).map((event) => event.date), ["2026-08-01"]);
});

test("tanggal cicilan maju satu bulan tanpa melewati akhir bulan", () => {
  assert.equal(addCalendarMonths("2026-08-31", 1), "2026-09-30");
});
