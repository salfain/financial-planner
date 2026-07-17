export const INVESTMENT_UNIT_SCALE = 100_000_000;

export type InvestmentPositionState = {
  unitsMicro: number;
  costBasis: number;
  realizedPl: number;
};

export type InvestmentTradeInput = {
  units: number;
  pricePerUnit: number;
  fee?: number;
  tax?: number;
};

export function toUnitMicro(units: number): number {
  const value = Math.round(units * INVESTMENT_UNIT_SCALE);
  if (!Number.isFinite(units) || !Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError("Unit investasi harus lebih besar dari nol dan maksimal 8 desimal.");
  }
  return value;
}

export const fromUnitMicro = (unitsMicro: number) => unitsMicro / INVESTMENT_UNIT_SCALE;

export function grossFromUnitMicro(unitsMicro: number, pricePerUnit: number): number {
  const gross = Math.round((unitsMicro * pricePerUnit) / INVESTMENT_UNIT_SCALE);
  if (!Number.isSafeInteger(gross) || gross <= 0) {
    throw new RangeError("Nilai transaksi investasi harus lebih besar dari nol.");
  }
  return gross;
}

function assertMoney(value: number, field: string, allowZero = true) {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new RangeError(`${field} harus berupa nominal Rupiah yang valid.`);
  }
}

export function calculateInvestmentBuy(
  current: InvestmentPositionState,
  input: InvestmentTradeInput,
) {
  const unitsMicro = toUnitMicro(input.units);
  assertMoney(input.pricePerUnit, "Harga", false);
  const fee = input.fee ?? 0;
  const tax = input.tax ?? 0;
  assertMoney(fee, "Fee");
  assertMoney(tax, "Pajak");
  const grossAmount = grossFromUnitMicro(unitsMicro, input.pricePerUnit);
  const netAmount = grossAmount + fee + tax;
  const remainingUnitsMicro = current.unitsMicro + unitsMicro;
  const costBasis = current.costBasis + netAmount;
  if (!Number.isSafeInteger(remainingUnitsMicro) || !Number.isSafeInteger(costBasis)) {
    throw new RangeError("Posisi investasi melewati batas angka aman.");
  }
  const averageCostAfter = remainingUnitsMicro > 0
    ? Math.round((costBasis * INVESTMENT_UNIT_SCALE) / remainingUnitsMicro)
    : 0;
  return {
    unitsMicro,
    grossAmount,
    netAmount,
    fee,
    tax,
    remainingUnitsMicro,
    costBasis,
    averageCostAfter,
    realizedPl: 0,
    realizedPlTotal: current.realizedPl,
  };
}

export function calculateInvestmentSell(
  current: InvestmentPositionState,
  input: InvestmentTradeInput,
) {
  const unitsMicro = toUnitMicro(input.units);
  if (unitsMicro > current.unitsMicro) {
    throw new RangeError("Unit yang dijual melebihi unit tersedia.");
  }
  assertMoney(input.pricePerUnit, "Harga", false);
  const fee = input.fee ?? 0;
  const tax = input.tax ?? 0;
  assertMoney(fee, "Fee");
  assertMoney(tax, "Pajak");
  const grossAmount = grossFromUnitMicro(unitsMicro, input.pricePerUnit);
  const netAmount = grossAmount - fee - tax;
  if (netAmount <= 0) throw new RangeError("Nilai penjualan bersih harus lebih besar dari nol.");
  const costBasisSold = unitsMicro === current.unitsMicro
    ? current.costBasis
    : Math.round((current.costBasis * unitsMicro) / current.unitsMicro);
  const remainingUnitsMicro = current.unitsMicro - unitsMicro;
  const costBasis = current.costBasis - costBasisSold;
  const realizedPl = netAmount - costBasisSold;
  const averageCostAfter = remainingUnitsMicro > 0
    ? Math.round((costBasis * INVESTMENT_UNIT_SCALE) / remainingUnitsMicro)
    : 0;
  return {
    unitsMicro,
    grossAmount,
    netAmount,
    fee,
    tax,
    costBasisSold,
    remainingUnitsMicro,
    costBasis,
    averageCostAfter,
    realizedPl,
    realizedPlTotal: current.realizedPl + realizedPl,
  };
}
