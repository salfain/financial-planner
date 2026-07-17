import {
  ApiError,
  booleanValue,
  colorValue,
  enumValue,
  isoDate,
  makeId,
  monthPeriod,
  nonnegativeInteger,
  optionalString,
  positiveInteger,
  requiredString,
  validateId,
} from "./api";

export const ACCOUNT_TYPES = [
  "Bank",
  "E-Wallet",
  "Cash",
  "Investment",
  "Credit Card",
] as const;
export const TRANSACTION_TYPES = [
  "income",
  "expense",
  "transfer",
  "refund",
  "investment_buy",
] as const;
export const TRANSACTION_STATUSES = ["completed", "pending"] as const;

export type AccountInput = {
  id: string;
  name: string;
  type: (typeof ACCOUNT_TYPES)[number];
  institution: string;
  balance: number;
  mask: string;
  color: string;
  liability: boolean;
};

export type TransactionInput = {
  id: string;
  type: (typeof TRANSACTION_TYPES)[number];
  date: string;
  title: string;
  merchant: string | null;
  category: string;
  accountId: string;
  destinationAccountId: string | null;
  amount: number;
  status: (typeof TRANSACTION_STATUSES)[number];
};

export type BudgetInput = {
  id: string;
  category: string;
  limit: number;
  period: string;
  color: string;
};

export type GoalInput = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  color: string;
  icon: string;
};

export type BillInput = {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  category: string;
  accountId: string;
  paid: boolean;
};

export function parseAccount(input: Record<string, unknown>, fallbackId?: string): AccountInput {
  const type = enumValue(input, "type", ACCOUNT_TYPES);
  return {
    id: fallbackId ?? (input.id === undefined ? makeId("acct") : validateId(input.id)),
    name: requiredString(input, "name", 100),
    type,
    institution: optionalString(input, "institution", 100) ?? "",
    balance: input.balance === undefined ? 0 : nonnegativeInteger(input, "balance"),
    mask: optionalString(input, "mask", 40) ?? "",
    color: input.color === undefined ? "#16876f" : colorValue(input),
    liability:
      input.liability === undefined ? type === "Credit Card" : booleanValue(input, "liability"),
  };
}

export function parseTransaction(
  input: Record<string, unknown>,
  fallbackId?: string,
): TransactionInput {
  const type = enumValue(input, "type", TRANSACTION_TYPES);
  const destination = optionalString(input, "destinationAccountId", 80);
  const destinationAccountId = destination ? validateId(destination, "destinationAccountId") : null;
  const accountId = validateId(input.accountId, "accountId");
  if ((type === "transfer" || type === "investment_buy") && !destinationAccountId) {
    throw new ApiError(
      400,
      "DESTINATION_REQUIRED",
      "destinationAccountId wajib untuk transfer atau pembelian investasi.",
    );
  }
  if (destinationAccountId && destinationAccountId === accountId) {
    throw new ApiError(400, "SAME_ACCOUNT", "Akun sumber dan tujuan harus berbeda.");
  }
  if (type !== "transfer" && type !== "investment_buy" && destinationAccountId) {
    throw new ApiError(
      400,
      "DESTINATION_NOT_ALLOWED",
      "destinationAccountId hanya boleh digunakan untuk transfer atau pembelian investasi.",
    );
  }

  return {
    id: fallbackId ?? (input.id === undefined ? makeId("tx") : validateId(input.id)),
    type,
    date: isoDate(input, "date"),
    title: requiredString(input, "title", 160),
    merchant: optionalString(input, "merchant", 160) ?? null,
    category: requiredString(input, "category", 100),
    accountId,
    destinationAccountId,
    amount: positiveInteger(input, "amount"),
    status:
      input.status === undefined
        ? "completed"
        : enumValue(input, "status", TRANSACTION_STATUSES),
  };
}

export function parseBudget(input: Record<string, unknown>, fallbackId?: string): BudgetInput {
  return {
    id: fallbackId ?? (input.id === undefined ? makeId("budget") : validateId(input.id)),
    category: requiredString(input, "category", 100),
    limit: positiveInteger(input, "limit"),
    period: monthPeriod(input),
    color: input.color === undefined ? "#16876f" : colorValue(input),
  };
}

export function parseGoal(input: Record<string, unknown>, fallbackId?: string): GoalInput {
  const target = positiveInteger(input, "target");
  const current = input.current === undefined ? 0 : nonnegativeInteger(input, "current");
  if (current > target) {
    throw new ApiError(400, "INVALID_PROGRESS", "current tidak boleh melebihi target.");
  }
  return {
    id: fallbackId ?? (input.id === undefined ? makeId("goal") : validateId(input.id)),
    name: requiredString(input, "name", 120),
    target,
    current,
    deadline: isoDate(input, "deadline"),
    color: input.color === undefined ? "#16876f" : colorValue(input),
    icon: optionalString(input, "icon", 40) ?? "target",
  };
}

export function parseBill(input: Record<string, unknown>, fallbackId?: string): BillInput {
  return {
    id: fallbackId ?? (input.id === undefined ? makeId("bill") : validateId(input.id)),
    name: requiredString(input, "name", 120),
    amount: positiveInteger(input, "amount"),
    dueDate: isoDate(input, "dueDate"),
    category: requiredString(input, "category", 100),
    accountId: validateId(input.accountId, "accountId"),
    paid: input.paid === undefined ? false : booleanValue(input, "paid"),
  };
}

export function mergePayload(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  const merged = { ...current };
  for (const field of fields) {
    if (patch[field] !== undefined) merged[field] = patch[field];
  }
  return merged;
}
