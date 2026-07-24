import type { Account } from "./finance";

export type SinkingFundPurpose =
  | "Kendaraan"
  | "Pajak"
  | "Liburan"
  | "Pendidikan"
  | "Rumah"
  | "Kesehatan"
  | "Teknologi"
  | "Lainnya";

export interface SinkingFund {
  id: string;
  name: string;
  purpose: SinkingFundPurpose;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  targetDate: string;
  accountId: string;
  color: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SinkingFundEntry {
  id: string;
  fundId: string;
  type: "allocate" | "release";
  amount: number;
  date: string;
  note: string;
  createdAt?: string;
}

export const sinkingFundProgress = (fund: SinkingFund) =>
  fund.targetAmount > 0 ? Math.min(100, fund.currentAmount / fund.targetAmount * 100) : 0;

export const sinkingFundRemaining = (fund: SinkingFund) =>
  Math.max(0, fund.targetAmount - fund.currentAmount);

export const monthsUntil = (date: string, now = new Date()) => {
  const target = new Date(`${date}T12:00:00`);
  if (Number.isNaN(target.getTime())) return 0;
  return Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth());
};

export const sinkingFundMonthlyNeed = (fund: SinkingFund, now = new Date()) => {
  const months = Math.max(1, monthsUntil(fund.targetDate, now));
  return Math.ceil(sinkingFundRemaining(fund) / months);
};

export const allocatedByAccount = (funds: SinkingFund[]) =>
  funds.filter((fund) => fund.active).reduce<Record<string, number>>((result, fund) => {
    result[fund.accountId] = (result[fund.accountId] ?? 0) + fund.currentAmount;
    return result;
  }, {});

export const unallocatedCash = (accounts: Account[], funds: SinkingFund[]) => {
  const allocated = allocatedByAccount(funds);
  return accounts
    .filter((account) => !account.liability && ["Bank", "E-Wallet", "Cash", "Deposit"].includes(account.type))
    .reduce((total, account) => total + Math.max(0, account.balance - (allocated[account.id] ?? 0)), 0);
};
