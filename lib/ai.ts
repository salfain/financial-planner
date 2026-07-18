export const DEFAULT_AI_PROVIDER = "gemini" as const;
export const DEFAULT_AI_MODEL = "gemini-3.5-flash";
export const MAX_AI_QUESTION_LENGTH = 600;
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;

export type AiSettingsStatus = {
  provider: typeof DEFAULT_AI_PROVIDER;
  model: string;
  enabled: boolean;
  consentAccepted: boolean;
  configured: boolean;
  storesReceiptImages: false;
};

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  period: string;
  contextUsed: string[];
  createdAt: string;
};

export type AiAnswer = {
  message: AiChatMessage;
  contextUsed: string[];
  period: string;
  model: string;
};

export type ReceiptItem = {
  name: string;
  quantity: number | null;
  amount: number | null;
};

export type OcrReceipt = {
  merchant: string;
  date: string;
  total: number;
  tax: number;
  serviceFee: number;
  paymentMethod: string;
  suggestedCategory: string;
  notes: string;
  items: ReceiptItem[];
  confidence: number;
  imageQuality: "clear" | "blurry" | "unreadable";
  warnings: string[];
};

const text = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const nonnegativeMoney = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
};

const validIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export function normalizeOcrReceipt(
  value: unknown,
  allowedCategories: string[],
  fallbackDate: string,
): OcrReceipt {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawCategory = text(source.suggestedCategory ?? source.suggested_category, 100);
  const suggestedCategory = allowedCategories.find(
    (category) => category.toLocaleLowerCase("id-ID") === rawCategory.toLocaleLowerCase("id-ID"),
  ) ?? allowedCategories.find((category) => category === "Lainnya") ?? allowedCategories[0] ?? "Lainnya";
  const rawQuality = text(source.imageQuality ?? source.image_quality, 20);
  const imageQuality: OcrReceipt["imageQuality"] =
    rawQuality === "blurry" || rawQuality === "unreadable" ? rawQuality : "clear";
  const rawConfidence = typeof source.confidence === "number" ? source.confidence : Number(source.confidence);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : 0;
  const items = Array.isArray(source.items)
    ? source.items.slice(0, 50).flatMap((item): ReceiptItem[] => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const row = item as Record<string, unknown>;
        const name = text(row.name, 120);
        if (!name) return [];
        const rawQuantity = typeof row.quantity === "number" ? row.quantity : Number(row.quantity);
        const rawAmount = typeof row.amount === "number" ? row.amount : Number(row.amount);
        return [{
          name,
          quantity: Number.isFinite(rawQuantity) && rawQuantity > 0 ? rawQuantity : null,
          amount: Number.isFinite(rawAmount) && rawAmount >= 0 ? Math.round(rawAmount) : null,
        }];
      })
    : [];
  const warnings = Array.isArray(source.warnings)
    ? source.warnings.map((warning) => text(warning, 180)).filter(Boolean).slice(0, 8)
    : [];
  const rawDate = text(source.date, 10);

  return {
    merchant: text(source.merchant, 160),
    date: validIsoDate(rawDate) ? rawDate : fallbackDate,
    total: nonnegativeMoney(source.total),
    tax: nonnegativeMoney(source.tax),
    serviceFee: nonnegativeMoney(source.serviceFee ?? source.service_fee),
    paymentMethod: text(source.paymentMethod ?? source.payment_method, 100),
    suggestedCategory,
    notes: text(source.notes, 300),
    items,
    confidence,
    imageQuality,
    warnings,
  };
}

export function receiptNeedsRetake(receipt: OcrReceipt) {
  return receipt.imageQuality !== "clear" || receipt.confidence < 0.45 || receipt.total <= 0;
}

export function stripDataUrlPrefix(value: string) {
  const marker = value.indexOf(",");
  return value.startsWith("data:") && marker >= 0 ? value.slice(marker + 1) : value;
}

export function estimateBase64Bytes(value: string) {
  const normalized = stripDataUrlPrefix(value).replace(/\s/g, "");
  if (!normalized) return 0;
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(normalized.length * 3 / 4) - padding);
}
