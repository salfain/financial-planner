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
  "adjustment_in",
  "adjustment_out",
] as const;
export const TRANSACTION_STATUSES = ["completed", "pending"] as const;
export const CATEGORY_TYPES = [
  "income",
  "expense",
  "transfer",
  "investment",
  "system",
] as const;

export const DEFAULT_CATEGORIES = [
  { name: "Pendapatan", type: "income", color: "#16876f", icon: "wallet-cards" },
  { name: "Makanan", type: "expense", color: "#d4685c", icon: "utensils" },
  { name: "Transportasi", type: "expense", color: "#4e79c7", icon: "car" },
  { name: "Tagihan", type: "expense", color: "#da9a3a", icon: "receipt-text" },
  { name: "Tempat Tinggal", type: "expense", color: "#8b6bb1", icon: "house" },
  { name: "Hiburan", type: "expense", color: "#aa67a6", icon: "sparkles" },
  { name: "Kesehatan", type: "expense", color: "#2e8b8b", icon: "heart-pulse" },
  { name: "Transfer", type: "transfer", color: "#5574b8", icon: "arrow-right-left" },
  { name: "Investasi", type: "investment", color: "#1c7567", icon: "trending-up" },
  { name: "Kewajiban", type: "expense", color: "#c45b6c", icon: "credit-card" },
  { name: "Penyesuaian Saldo", type: "system", color: "#687386", icon: "scale" },
] as const;

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
  time: string;
  title: string;
  merchant: string | null;
  category: string;
  notes: string;
  tags: string[];
  location: string;
  splits: TransactionSplitInput[];
  accountId: string;
  destinationAccountId: string | null;
  amount: number;
  status: (typeof TRANSACTION_STATUSES)[number];
};

export type TransactionSplitInput = {
  id: string;
  category: string;
  amount: number;
  note: string;
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
  frequency: "monthly";
  reminderDays: number[];
};

export type CategoryInput = {
  id: string;
  name: string;
  type: (typeof CATEGORY_TYPES)[number];
  color: string;
  icon: string;
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
  const amount = positiveInteger(input, "amount");
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

  const time = optionalString(input, "time", 5) ?? "";
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new ApiError(400, "INVALID_TIME", "Waktu transaksi harus berformat HH:mm.");
  }
  const tags = input.tags === undefined
    ? []
    : Array.isArray(input.tags)
      ? [...new Set(input.tags.map((value) => String(value).trim()).filter(Boolean))]
      : [];
  if (tags.length > 10 || tags.some((tag) => tag.length > 30)) {
    throw new ApiError(400, "INVALID_TAGS", "Maksimal 10 tag, masing-masing 30 karakter.");
  }
  const rawSplits = input.splits === undefined ? [] : input.splits;
  if (!Array.isArray(rawSplits)) {
    throw new ApiError(400, "INVALID_SPLITS", "Rincian split transaksi tidak valid.");
  }
  if (rawSplits.length && !["income", "expense", "refund"].includes(type)) {
    throw new ApiError(400, "SPLIT_NOT_ALLOWED", "Split kategori hanya tersedia untuk pemasukan, pengeluaran, dan refund.");
  }
  if (rawSplits.length === 1 || rawSplits.length > 20) {
    throw new ApiError(400, "INVALID_SPLITS", "Split harus berisi 2 sampai 20 rincian.");
  }
  const splits = rawSplits.map((value, index): TransactionSplitInput => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ApiError(400, "INVALID_SPLITS", `Rincian split ke-${index + 1} tidak valid.`);
    }
    const row = value as Record<string, unknown>;
    return {
      id: row.id === undefined ? makeId("split") : validateId(row.id, `splits[${index}].id`),
      category: requiredString(row, "category", 100),
      amount: positiveInteger(row, "amount"),
      note: optionalString(row, "note", 160) ?? "",
    };
  });
  if (splits.length && splits.reduce((sum, split) => sum + split.amount, 0) !== amount) {
    throw new ApiError(400, "SPLIT_TOTAL_MISMATCH", "Total rincian split harus sama dengan nominal transaksi.");
  }

  return {
    id: fallbackId ?? (input.id === undefined ? makeId("tx") : validateId(input.id)),
    type,
    date: isoDate(input, "date"),
    time,
    title: requiredString(input, "title", 160),
    merchant: optionalString(input, "merchant", 160) ?? null,
    category: requiredString(input, "category", 100),
    notes: optionalString(input, "notes", 1000) ?? "",
    tags,
    location: optionalString(input, "location", 160) ?? "",
    splits,
    accountId,
    destinationAccountId,
    amount,
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
  const reminderDays = input.reminderDays === undefined
    ? [7, 3, 1, 0]
    : Array.isArray(input.reminderDays)
      ? [...new Set(input.reminderDays.map(Number))].filter((value) => Number.isSafeInteger(value) && value >= 0 && value <= 30).sort((a, b) => b - a)
      : [];
  if (!reminderDays.length) throw new ApiError(400, "INVALID_REMINDER_DAYS", "Pilih minimal satu jadwal reminder tagihan.");
  return {
    id: fallbackId ?? (input.id === undefined ? makeId("bill") : validateId(input.id)),
    name: requiredString(input, "name", 120),
    amount: positiveInteger(input, "amount"),
    dueDate: isoDate(input, "dueDate"),
    category: requiredString(input, "category", 100),
    accountId: validateId(input.accountId, "accountId"),
    paid: input.paid === undefined ? false : booleanValue(input, "paid"),
    frequency: input.frequency === undefined ? "monthly" : enumValue(input, "frequency", ["monthly"] as const),
    reminderDays,
  };
}

export function parseCategory(
  input: Record<string, unknown>,
  fallbackId?: string,
): CategoryInput {
  return {
    id: fallbackId ?? (input.id === undefined ? makeId("cat") : validateId(input.id)),
    name: requiredString(input, "name", 100),
    type: enumValue(input, "type", CATEGORY_TYPES),
    color: input.color === undefined ? "#16876f" : colorValue(input),
    icon: optionalString(input, "icon", 60) ?? "circle-dollar-sign",
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
