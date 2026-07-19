import type { Account, Goal, Transaction } from "./finance";
import { accountSummary } from "./finance";

export type RoadmapSettings = {
  horizonMonths: 12 | 24 | 36 | 60;
  incomeAdjustmentPct: number;
  expenseAdjustmentPct: number;
  annualInvestmentReturnPct: number;
  annualInflationPct: number;
  monthlyInvestment: number;
};

export const DEFAULT_ROADMAP_SETTINGS: RoadmapSettings = {
  horizonMonths: 24,
  incomeAdjustmentPct: 0,
  expenseAdjustmentPct: 0,
  annualInvestmentReturnPct: 6,
  annualInflationPct: 3,
  monthlyInvestment: 0,
};

export type RoadmapScenarioKey = "conservative" | "base" | "optimistic";

export type RoadmapProjectionPoint = {
  month: string;
  income: number;
  expense: number;
  surplus: number;
  investmentValue: number;
  netWorth: number;
};

export type RoadmapScenario = {
  key: RoadmapScenarioKey;
  label: string;
  description: string;
  points: RoadmapProjectionPoint[];
  finalNetWorth: number;
  growth: number;
  deficitMonths: number;
  firstDeficitMonth?: string;
};

export type RoadmapGoalForecast = {
  id: string;
  name: string;
  remaining: number;
  recommendedMonthly: number;
  projectedMonth?: string;
  onTrack: boolean;
};

export type RoadmapResult = {
  observedMonths: number;
  baseline: {
    monthlyIncome: number;
    monthlyExpense: number;
    monthlySurplus: number;
    startingNetWorth: number;
    startingInvestment: number;
  };
  scenarios: RoadmapScenario[];
  goalForecasts: RoadmapGoalForecast[];
};

const addMonths = (month: string, offset: number) => {
  const [year, rawMonth] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, rawMonth - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const monthsBetween = (fromMonth: string, toDate: string) => {
  const targetMonth = /^\d{4}-\d{2}/.test(toDate) ? toDate.slice(0, 7) : fromMonth;
  const [fromYear, fromValue] = fromMonth.split("-").map(Number);
  const [toYear, toValue] = targetMonth.split("-").map(Number);
  return Math.max(1, (toYear - fromYear) * 12 + toValue - fromValue + 1);
};

const monthlyAverages = (transactions: Transaction[], asOfMonth: string) => {
  const buckets = new Map<string, { income: number; expense: number }>();
  transactions.forEach((transaction) => {
    const month = transaction.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month) || month > asOfMonth || transaction.deletedAt || transaction.status !== "completed") return;
    const bucket = buckets.get(month) ?? { income: 0, expense: 0 };
    if (transaction.type === "income") bucket.income += transaction.amount;
    if (transaction.type === "expense") bucket.expense += transaction.amount;
    if (transaction.type === "refund") bucket.expense -= transaction.amount;
    buckets.set(month, bucket);
  });
  const observed = [...buckets.entries()].sort(([left], [right]) => right.localeCompare(left)).slice(0, 6);
  if (!observed.length) return { income: 0, expense: 0, observedMonths: 0 };
  return {
    income: Math.round(observed.reduce((sum, [, value]) => sum + value.income, 0) / observed.length),
    expense: Math.max(0, Math.round(observed.reduce((sum, [, value]) => sum + value.expense, 0) / observed.length)),
    observedMonths: observed.length,
  };
};

const scenarioAssumptions: Record<RoadmapScenarioKey, {
  label: string;
  description: string;
  incomeDelta: number;
  expenseDelta: number;
  returnDelta: number;
}> = {
  conservative: { label: "Konservatif", description: "Pendapatan lebih rendah, biaya lebih tinggi, dan imbal hasil terbatas.", incomeDelta: -5, expenseDelta: 8, returnDelta: -4 },
  base: { label: "Rencana utama", description: "Menggunakan asumsi yang kamu atur sebagai jalur perencanaan utama.", incomeDelta: 0, expenseDelta: 0, returnDelta: 0 },
  optimistic: { label: "Optimistis", description: "Pendapatan lebih kuat, biaya lebih efisien, dan imbal hasil lebih tinggi.", incomeDelta: 5, expenseDelta: -5, returnDelta: 3 },
};

export function buildFinancialRoadmap(input: {
  transactions: Transaction[];
  accounts: Account[];
  goals: Goal[];
  investmentMarketValue: number;
  settings: RoadmapSettings;
  asOfMonth: string;
}): RoadmapResult {
  const average = monthlyAverages(input.transactions, input.asOfMonth);
  const summary = accountSummary(input.accounts, input.investmentMarketValue);
  const startingNonInvestment = summary.netWorth - summary.investment;

  const scenarios = (Object.keys(scenarioAssumptions) as RoadmapScenarioKey[]).map((key) => {
    const assumption = scenarioAssumptions[key];
    const baseIncome = Math.max(0, average.income * (1 + (input.settings.incomeAdjustmentPct + assumption.incomeDelta) / 100));
    const baseExpense = Math.max(0, average.expense * (1 + (input.settings.expenseAdjustmentPct + assumption.expenseDelta) / 100));
    const monthlyInflation = Math.pow(1 + Math.max(0, input.settings.annualInflationPct) / 100, 1 / 12) - 1;
    const monthlyReturn = Math.pow(1 + Math.max(0, input.settings.annualInvestmentReturnPct + assumption.returnDelta) / 100, 1 / 12) - 1;
    let investmentValue = Math.max(0, input.investmentMarketValue);
    let cumulativeCashflow = 0;
    let deficitMonths = 0;
    let firstDeficitMonth: string | undefined;
    const points: RoadmapProjectionPoint[] = [{
      month: input.asOfMonth,
      income: Math.round(baseIncome),
      expense: Math.round(baseExpense),
      surplus: Math.round(baseIncome - baseExpense),
      investmentValue: Math.round(investmentValue),
      netWorth: Math.round(summary.netWorth),
    }];

    for (let index = 1; index <= input.settings.horizonMonths; index += 1) {
      const month = addMonths(input.asOfMonth, index);
      const expense = baseExpense * Math.pow(1 + monthlyInflation, index);
      const surplus = baseIncome - expense;
      if (surplus < 0) {
        deficitMonths += 1;
        firstDeficitMonth ??= month;
      }
      const contribution = Math.min(Math.max(0, surplus), input.settings.monthlyInvestment);
      investmentValue = investmentValue * (1 + monthlyReturn) + contribution;
      cumulativeCashflow += surplus - contribution;
      points.push({
        month,
        income: Math.round(baseIncome),
        expense: Math.round(expense),
        surplus: Math.round(surplus),
        investmentValue: Math.round(investmentValue),
        netWorth: Math.round(startingNonInvestment + cumulativeCashflow + investmentValue),
      });
    }
    const finalNetWorth = points.at(-1)?.netWorth ?? summary.netWorth;
    return {
      key,
      label: assumption.label,
      description: assumption.description,
      points,
      finalNetWorth,
      growth: finalNetWorth - summary.netWorth,
      deficitMonths,
      ...(firstDeficitMonth ? { firstDeficitMonth } : {}),
    };
  });

  const baseMonthlySurplus = Math.max(0, scenarios.find((scenario) => scenario.key === "base")?.points[1]?.surplus ?? 0);
  const activeGoals = input.goals.filter((goal) => goal.current < goal.target);
  let availableForGoals = Math.max(0, baseMonthlySurplus - input.settings.monthlyInvestment);
  const goalForecasts = [...activeGoals]
    .sort((left, right) => left.deadline.localeCompare(right.deadline))
    .map((goal) => {
      const remaining = Math.max(0, goal.target - goal.current);
      const deadlineMonths = monthsBetween(input.asOfMonth, goal.deadline);
      const recommendedMonthly = Math.ceil(remaining / deadlineMonths);
      const allocatedMonthly = Math.min(recommendedMonthly, availableForGoals);
      availableForGoals = Math.max(0, availableForGoals - allocatedMonthly);
      const monthsNeeded = allocatedMonthly > 0 ? Math.ceil(remaining / allocatedMonthly) : undefined;
      const projectedMonth = monthsNeeded ? addMonths(input.asOfMonth, monthsNeeded) : undefined;
      return {
        id: goal.id,
        name: goal.name,
        remaining,
        recommendedMonthly,
        ...(projectedMonth ? { projectedMonth } : {}),
        onTrack: Boolean(projectedMonth && projectedMonth <= goal.deadline.slice(0, 7)),
      };
    });

  return {
    observedMonths: average.observedMonths,
    baseline: {
      monthlyIncome: average.income,
      monthlyExpense: average.expense,
      monthlySurplus: average.income - average.expense,
      startingNetWorth: summary.netWorth,
      startingInvestment: summary.investment,
    },
    scenarios,
    goalForecasts,
  };
}
