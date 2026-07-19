export type DebtStrategy = "avalanche" | "snowball";

export type DebtPlan = {
  accountId: string;
  name: string;
  balance: number;
  annualInterestRatePct: number;
  minimumPayment: number;
  dueDay: number;
};

export type DebtPlannerSettings = {
  strategy: DebtStrategy;
  extraMonthlyPayment: number;
};

export type DebtPayoffItem = DebtPlan & {
  payoffMonth: number | null;
  interestPaid: number;
  totalPaid: number;
};

export type DebtSchedulePoint = {
  month: number;
  balance: number;
  interestPaid: number;
};

export type DebtPayoffResult = {
  strategy: DebtStrategy;
  months: number;
  totalInterest: number;
  totalPaid: number;
  startingBalance: number;
  monthlyCommitment: number;
  nonAmortizing: boolean;
  schedule: DebtSchedulePoint[];
  debts: DebtPayoffItem[];
};

export const DEFAULT_DEBT_SETTINGS: DebtPlannerSettings = {
  strategy: "avalanche",
  extraMonthlyPayment: 0,
};

const money = (value: number) => Math.max(0, Math.round(value));

export function simulateDebtPayoff(
  plans: DebtPlan[],
  settings: DebtPlannerSettings,
  maxMonths = 600,
): DebtPayoffResult {
  const debts = plans
    .filter((plan) => plan.balance > 0)
    .map((plan) => ({
      ...plan,
      balance: money(plan.balance),
      annualInterestRatePct: Math.max(0, plan.annualInterestRatePct),
      minimumPayment: money(plan.minimumPayment),
      interestPaid: 0,
      totalPaid: 0,
      payoffMonth: null as number | null,
    }));
  const startingBalance = debts.reduce((sum, debt) => sum + debt.balance, 0);
  const baseMinimum = debts.reduce((sum, debt) => sum + debt.minimumPayment, 0);
  const monthlyCommitment = baseMinimum + money(settings.extraMonthlyPayment);
  const schedule: DebtSchedulePoint[] = [{ month: 0, balance: startingBalance, interestPaid: 0 }];
  let totalInterest = 0;
  let month = 0;

  const priority = () => debts
    .filter((debt) => debt.balance > 0)
    .sort(settings.strategy === "avalanche"
      ? (a, b) => b.annualInterestRatePct - a.annualInterestRatePct || a.balance - b.balance || a.name.localeCompare(b.name)
      : (a, b) => a.balance - b.balance || b.annualInterestRatePct - a.annualInterestRatePct || a.name.localeCompare(b.name));

  while (month < maxMonths && debts.some((debt) => debt.balance > 0)) {
    month += 1;
    for (const debt of debts) {
      if (debt.balance <= 0) continue;
      const interest = money(debt.balance * debt.annualInterestRatePct / 1200);
      debt.balance += interest;
      debt.interestPaid += interest;
      totalInterest += interest;
    }

    let available = monthlyCommitment;
    for (const debt of debts.filter((item) => item.balance > 0)) {
      const payment = Math.min(debt.balance, debt.minimumPayment, available);
      debt.balance -= payment;
      debt.totalPaid += payment;
      available -= payment;
    }
    for (const debt of priority()) {
      if (available <= 0) break;
      const payment = Math.min(debt.balance, available);
      debt.balance -= payment;
      debt.totalPaid += payment;
      available -= payment;
    }
    for (const debt of debts) {
      if (debt.balance <= 0 && debt.payoffMonth === null) debt.payoffMonth = month;
    }
    const balance = debts.reduce((sum, debt) => sum + debt.balance, 0);
    if (month <= 24 || month % 3 === 0 || balance === 0) {
      schedule.push({ month, balance: money(balance), interestPaid: totalInterest });
    }
  }

  const nonAmortizing = debts.some((debt) => debt.balance > 0);
  return {
    strategy: settings.strategy,
    months: month,
    totalInterest,
    totalPaid: debts.reduce((sum, debt) => sum + debt.totalPaid, 0),
    startingBalance,
    monthlyCommitment,
    nonAmortizing,
    schedule,
    debts: debts.map((debt) => ({ ...debt, balance: money(debt.balance) })),
  };
}

export function compareDebtStrategies(plans: DebtPlan[], extraMonthlyPayment: number) {
  return {
    avalanche: simulateDebtPayoff(plans, { strategy: "avalanche", extraMonthlyPayment }),
    snowball: simulateDebtPayoff(plans, { strategy: "snowball", extraMonthlyPayment }),
  };
}

export function addMonthsToPeriod(period: string, months: number) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, Math.max(0, month - 1) + months, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
