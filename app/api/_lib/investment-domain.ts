import {
  ApiError,
  booleanValue,
  isoDate,
  nonnegativeInteger,
  optionalString,
  positiveInteger,
  requiredString,
  validateId,
} from "./api";
import { toUnitMicro } from "@/lib/investment";

export const INVESTMENT_ASSET_CLASSES = [
  "Saham",
  "ETF",
  "Reksadana",
  "Kripto",
  "Deposito",
  "Emas",
  "Obligasi",
  "Properti",
  "Custom",
] as const;

export type InvestmentAssetInput = {
  accountId: string;
  ticker: string;
  name: string;
  assetClass: (typeof INVESTMENT_ASSET_CLASSES)[number];
  exchange: string;
  currency: string;
  manualPrice: number | null;
  active: boolean;
};

const assetClassValue = (input: Record<string, unknown>) => {
  const value = input.assetClass;
  if (typeof value !== "string" || !INVESTMENT_ASSET_CLASSES.includes(value as never)) {
    throw new ApiError(400, "INVALID_FIELD", `assetClass harus salah satu dari: ${INVESTMENT_ASSET_CLASSES.join(", ")}.`, { field: "assetClass" });
  }
  return value as InvestmentAssetInput["assetClass"];
};

export function parseInvestmentAsset(input: Record<string, unknown>): InvestmentAssetInput {
  const ticker = requiredString(input, "ticker", 24).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]{0,23}$/.test(ticker)) {
    throw new ApiError(400, "INVALID_FIELD", "ticker hanya boleh berisi huruf, angka, titik, dash, atau underscore.", { field: "ticker" });
  }
  const currency = requiredString(input, "currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ApiError(400, "INVALID_FIELD", "currency harus berupa kode ISO tiga huruf.", { field: "currency" });
  }
  const manualPrice = input.manualPrice === undefined || input.manualPrice === null || input.manualPrice === ""
    ? null
    : positiveInteger(input, "manualPrice");
  return {
    accountId: validateId(requiredString(input, "accountId", 80), "accountId"),
    ticker,
    name: requiredString(input, "name", 100),
    assetClass: assetClassValue(input),
    exchange: optionalString(input, "exchange", 60) ?? "",
    currency,
    manualPrice,
    active: input.active === undefined ? true : booleanValue(input, "active"),
  };
}

export type InvestmentTradePayload = {
  assetId: string;
  accountId: string;
  date: string;
  type: "buy" | "sell";
  units: number;
  unitsMicro: number;
  pricePerUnit: number;
  fee: number;
  tax: number;
  note: string | null;
  requestId: string;
};

export function parseInvestmentTrade(input: Record<string, unknown>): InvestmentTradePayload {
  if (input.type !== "buy" && input.type !== "sell") {
    throw new ApiError(400, "INVALID_FIELD", "type harus buy atau sell.", { field: "type" });
  }
  if (typeof input.units !== "number" || !Number.isFinite(input.units)) {
    throw new ApiError(400, "INVALID_FIELD", "units harus berupa angka positif maksimal 8 desimal.", { field: "units" });
  }
  let unitsMicro: number;
  try {
    unitsMicro = toUnitMicro(input.units);
  } catch (error) {
    throw new ApiError(400, "INVALID_FIELD", error instanceof Error ? error.message : "Unit investasi tidak valid.", { field: "units" });
  }
  return {
    assetId: validateId(requiredString(input, "assetId", 80), "assetId"),
    accountId: validateId(requiredString(input, "accountId", 80), "accountId"),
    date: isoDate(input, "date"),
    type: input.type,
    units: input.units,
    unitsMicro,
    pricePerUnit: positiveInteger(input, "pricePerUnit"),
    fee: input.fee === undefined ? 0 : nonnegativeInteger(input, "fee"),
    tax: input.tax === undefined ? 0 : nonnegativeInteger(input, "tax"),
    note: optionalString(input, "note", 300) ?? null,
    requestId: requiredString(input, "requestId", 120),
  };
}
