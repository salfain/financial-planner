import type { Account, AccountType } from "./finance";
import { parseCsvRecords } from "./transaction-import";

export type AccountImportItem = {
  id: string;
  name: string;
  type: AccountType;
  institution: string;
  openingBalance: number;
  mask: string;
  color: string;
  liability: boolean;
};

export type AccountImportPreviewRow = {
  rowNumber: number;
  raw: Record<string, string>;
  account?: AccountImportItem;
  errors: string[];
};

export type AccountImportPreview = {
  rows: AccountImportPreviewRow[];
  valid: AccountImportItem[];
  validCount: number;
  errorCount: number;
  totalOpeningBalance: number;
  liabilityCount: number;
};

const accountHeaderAliases: Record<string, string> = {
  nama: "name",
  name: "name",
  nama_akun: "name",
  jenis: "type",
  type: "type",
  jenis_akun: "type",
  institusi: "institution",
  institution: "institution",
  bank: "institution",
  saldo: "opening_balance",
  saldo_awal: "opening_balance",
  opening_balance: "opening_balance",
  openingbalance: "opening_balance",
  nomor_akhir: "mask",
  mask: "mask",
  warna: "color",
  color: "color",
};

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/^\uFEFF/, "").replace(/[\s-]+/g, "_");

const normalizeAccountRecords = (source: string) => {
  const firstLine = source.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ";" : ",";
  const normalizedHeader = firstLine
    .split(delimiter)
    .map((header) => accountHeaderAliases[normalizeHeader(header.replace(/^"|"$/g, ""))] || normalizeHeader(header.replace(/^"|"$/g, "")))
    .join(delimiter);
  return parseCsvRecords(source.replace(firstLine, normalizedHeader));
};

const parseAccountType = (value: string): AccountType | "" => {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (["bank", "rekening", "rekening bank"].includes(normalized)) return "Bank";
  if (["e wallet", "ewallet", "dompet digital"].includes(normalized)) return "E-Wallet";
  if (["cash", "kas", "tunai"].includes(normalized)) return "Cash";
  if (["credit card", "kartu kredit"].includes(normalized)) return "Credit Card";
  if (["investment", "investasi"].includes(normalized)) return "Investment";
  return "";
};

const parseOpeningBalance = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const normalized = trimmed.replace(/^rp\s*/i, "").replace(/[.,\s]/g, "");
  if (!/^\d+$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
};

const validColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

export function previewAccountCsv(source: string, existingAccounts: Account[]): AccountImportPreview {
  const records = normalizeAccountRecords(source);
  const existingNames = new Set(existingAccounts.map((account) => account.name.trim().toLocaleLowerCase("id-ID")));
  const incomingNameCounts = new Map<string, number>();
  records.slice(0, 100).forEach((raw) => {
    const normalized = (raw.name || "").trim().toLocaleLowerCase("id-ID");
    if (normalized) incomingNameCounts.set(normalized, (incomingNameCounts.get(normalized) || 0) + 1);
  });

  const rows = records.slice(0, 100).map((raw, index): AccountImportPreviewRow => {
    const errors: string[] = [];
    const name = (raw.name || "").trim();
    const normalizedName = name.toLocaleLowerCase("id-ID");
    const type = parseAccountType(raw.type || "");
    const openingBalance = parseOpeningBalance(raw.opening_balance || "");
    const institution = (raw.institution || "").trim();
    const mask = (raw.mask || "").trim();
    const color = (raw.color || "#126b59").trim();
    if (!name) errors.push("Nama akun wajib diisi.");
    if (name.length > 100) errors.push("Nama akun maksimal 100 karakter.");
    if (!type) errors.push("Jenis akun tidak dikenali.");
    if (openingBalance === null) errors.push("Saldo awal harus berupa Rupiah bulat non-negatif.");
    if (institution.length > 100) errors.push("Institusi maksimal 100 karakter.");
    if (mask.length > 40) errors.push("Nomor akhir maksimal 40 karakter.");
    if (!validColor(color)) errors.push("Warna harus berupa kode hex, misalnya #126b59.");
    if (normalizedName && existingNames.has(normalizedName)) errors.push("Nama akun sudah digunakan.");
    if (normalizedName && (incomingNameCounts.get(normalizedName) || 0) > 1) errors.push("Nama akun muncul lebih dari sekali di file.");

    const account = errors.length || !type || openingBalance === null ? undefined : {
      id: `acct-${crypto.randomUUID()}`,
      name,
      type,
      institution,
      openingBalance,
      mask,
      color,
      liability: type === "Credit Card",
    };
    return { rowNumber: index + 2, raw, account, errors };
  });
  if (records.length > 100) rows.push({ rowNumber: 102, raw: {}, errors: ["Maksimal 100 akun per impor."] });
  const valid = rows.flatMap((row) => row.account ? [row.account] : []);
  return {
    rows,
    valid,
    validCount: valid.length,
    errorCount: rows.filter((row) => row.errors.length > 0).length,
    totalOpeningBalance: valid.reduce((sum, account) => sum + account.openingBalance, 0),
    liabilityCount: valid.filter((account) => account.liability).length,
  };
}

export const accountCsvTemplate = [
  "nama,jenis,institusi,saldo_awal,nomor_akhir,warna",
  "Rekening Operasional,Bank,BCA,5000000,1234,#126b59",
  "Kas Toko,Cash,,1000000,,#c98b2e",
].join("\n");
