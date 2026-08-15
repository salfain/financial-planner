import type { Account, InvestmentAsset } from "./finance";

/** Jenis akun yang dianggap kas dan setara kas untuk perhitungan zakat maal. */
const CASH_ACCOUNT_TYPES = ["Bank", "E-Wallet", "Cash", "Deposit"];

/** Nisab zakat maal setara 85 gram emas. */
export const DEFAULT_NISAB_GRAMS = 85;

/** Haul satu tahun hijriah dibulatkan ke 354 hari. */
export const HAUL_DAYS = 354;

/** Kadar zakat maal 2,5 persen. */
export const ZAKAT_RATE = 0.025;

export type ZakatSettings = {
  /** Harga emas per gram dalam rupiah. Diisi manual karena aplikasi tidak memakai sumber harga otomatis. */
  goldPricePerGram: number;
  /** Gram emas sebagai patokan nisab. Default 85. */
  nisabGrams: number;
  /** Tanggal harta pertama kali mencapai nisab, format YYYY-MM-DD. Kosong berarti haul belum dimulai. */
  haulStartDate: string;
  /** Sertakan nilai pasar aset investasi ke dalam basis zakat. */
  includeInvestments: boolean;
  /** Akun yang dikecualikan dari basis zakat. */
  excludedAccountIds: string[];
};

export type ZakatStatus = "belum_diatur" | "belum_nisab" | "menunggu_haul" | "wajib";

export type ZakatResult = {
  cashAssets: number;
  investmentAssets: number;
  zakatableAssets: number;
  liabilities: number;
  netAssets: number;
  nisabAmount: number;
  reachesNisab: boolean;
  shortfallToNisab: number;
  haulStartDate: string;
  haulCompleteDate: string;
  haulDaysElapsed: number;
  haulDaysRemaining: number;
  haulComplete: boolean;
  zakatDue: number;
  status: ZakatStatus;
  accountIds: string[];
};

export const DEFAULT_ZAKAT_SETTINGS: ZakatSettings = {
  goldPricePerGram: 0,
  nisabGrams: DEFAULT_NISAB_GRAMS,
  haulStartDate: "",
  includeInvestments: true,
  excludedAccountIds: [],
};

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Tengah hari UTC dipakai agar pergeseran zona waktu tidak menggeser tanggal. */
const parseDate = (value: string) => new Date(`${value}T12:00:00.000Z`);

const daysBetween = (from: string, to: string) =>
  Math.floor((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);

export function addDays(date: string, days: number) {
  const result = new Date(parseDate(date).getTime() + days * 86_400_000);
  return result.toISOString().slice(0, 10);
}

/**
 * Menghitung kewajiban zakat maal dari ledger aktif.
 *
 * Basisnya adalah kas dan setara kas ditambah nilai pasar investasi (opsional),
 * dikurangi seluruh kewajiban. Zakat baru terutang bila harta bersih mencapai
 * nisab DAN haul satu tahun hijriah sudah terlewati sejak `haulStartDate`.
 */
export function buildZakatReport(input: {
  accounts: Account[];
  investmentAssets: InvestmentAsset[];
  settings: ZakatSettings;
  asOfDate: string;
}): ZakatResult {
  const excluded = new Set(input.settings.excludedAccountIds);
  const eligible = input.accounts.filter(
    (account) => !account.liability && CASH_ACCOUNT_TYPES.includes(account.type) && !excluded.has(account.id),
  );
  const cashAssets = eligible.reduce((sum, account) => sum + account.balance, 0);
  const investmentAssets = input.settings.includeInvestments
    ? input.investmentAssets.filter((asset) => asset.active).reduce((sum, asset) => sum + asset.marketValue, 0)
    : 0;
  const zakatableAssets = cashAssets + investmentAssets;
  const liabilities = input.accounts
    .filter((account) => account.liability)
    .reduce((sum, account) => sum + account.balance, 0);
  const netAssets = Math.max(0, zakatableAssets - liabilities);

  const nisabAmount = Math.round(Math.max(0, input.settings.goldPricePerGram) * Math.max(0, input.settings.nisabGrams));
  const configured = nisabAmount > 0;
  const reachesNisab = configured && netAssets >= nisabAmount;
  const shortfallToNisab = configured ? Math.max(0, nisabAmount - netAssets) : 0;

  const haulStartDate = isDate(input.settings.haulStartDate) ? input.settings.haulStartDate : "";
  const asOfDate = isDate(input.asOfDate) ? input.asOfDate : "";
  const haulCompleteDate = haulStartDate ? addDays(haulStartDate, HAUL_DAYS) : "";
  const haulDaysElapsed = haulStartDate && asOfDate ? Math.max(0, daysBetween(haulStartDate, asOfDate)) : 0;
  const haulDaysRemaining = haulStartDate && asOfDate ? Math.max(0, HAUL_DAYS - haulDaysElapsed) : HAUL_DAYS;
  const haulComplete = Boolean(haulStartDate) && haulDaysElapsed >= HAUL_DAYS;

  const status: ZakatStatus = !configured
    ? "belum_diatur"
    : !reachesNisab
      ? "belum_nisab"
      : haulComplete
        ? "wajib"
        : "menunggu_haul";
  const zakatDue = status === "wajib" ? Math.round(netAssets * ZAKAT_RATE) : 0;

  return {
    cashAssets,
    investmentAssets,
    zakatableAssets,
    liabilities,
    netAssets,
    nisabAmount,
    reachesNisab,
    shortfallToNisab,
    haulStartDate,
    haulCompleteDate,
    haulDaysElapsed,
    haulDaysRemaining,
    haulComplete,
    zakatDue,
    status,
    accountIds: eligible.map((account) => account.id),
  };
}
