import type { Account, FinanceCategory, Transaction, TransactionSplit, TransactionType } from "./finance";
import { findCategoryRule, type CategoryRule } from "./category-rules";

export type TransactionImportPreviewRow = {
  rowNumber: number;
  raw: Record<string, string>;
  transaction?: Transaction;
  matchedRule?: CategoryRule;
  duplicateOf?: string;
  errors: string[];
};

export type TransactionImportPreview = {
  rows: TransactionImportPreviewRow[];
  valid: Transaction[];
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  income: number;
  expense: number;
};

const headerAliases: Record<string, string> = {
  tanggal: "date", date: "date",
  waktu: "time", time: "time",
  jenis: "type", type: "type",
  deskripsi: "title", description: "title", judul: "title", title: "title", merchant: "title",
  kategori: "category", category: "category",
  akun: "account", account: "account", account_id: "account",
  nominal: "amount", amount: "amount", jumlah: "amount",
  status: "status",
  catatan: "notes", notes: "notes",
  tag: "tags", tags: "tags",
  lokasi: "location", location: "location",
  split: "splits", rincian: "splits", splits: "splits",
};

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/^\uFEFF/, "").replace(/[\s-]+/g, "_");

export function parseCsvRecords(source: string): Record<string, string>[] {
  const firstLine = source.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ";" : ",";
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim())) matrix.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) matrix.push(row);
  if (matrix.length < 2) return [];
  const headers = matrix[0].map((value) => headerAliases[normalizeHeader(value)] || normalizeHeader(value));
  return matrix.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] || "").trim()])));
}

const parseDate = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
};

const parseType = (value: string): TransactionType | "" => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (["income", "pemasukan", "masuk"].includes(normalized)) return "income";
  if (["expense", "pengeluaran", "keluar"].includes(normalized)) return "expense";
  if (["refund", "pengembalian"].includes(normalized)) return "refund";
  return "";
};

const parseMoney = (value: string) => {
  const digits = value.replace(/[^\d-]/g, "");
  const number = Number(digits);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
};

const parseSplits = (value: string, amount: number): { splits: TransactionSplit[]; error?: string } => {
  if (!value.trim()) return { splits: [] };
  const splits = value.split("|").map((part) => {
    const [category, amountValue, ...note] = part.split(":");
    return { id: `split-${crypto.randomUUID()}`, category: (category || "").trim(), amount: parseMoney(amountValue || ""), note: note.join(":").trim() || undefined };
  });
  if (splits.length < 2 || splits.some((split) => !split.category || !split.amount)) return { splits, error: "Format split harus Kategori:Nominal|Kategori:Nominal." };
  if (splits.reduce((sum, split) => sum + split.amount, 0) !== amount) return { splits, error: "Total split tidak sama dengan nominal transaksi." };
  return { splits };
};

const comparableTitle = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export function previewTransactionCsv(source: string, accounts: Account[], categories: FinanceCategory[], categoryRules: CategoryRule[] = [], existingTransactions: Transaction[] = []): TransactionImportPreview {
  return previewTransactionRecords(parseCsvRecords(source), accounts, categories, categoryRules, existingTransactions);
}

/**
 * Validasi dan preview dari record kanonik, apa pun sumbernya.
 * Dipakai jalur CSV maupun jalur rekening koran PDF agar aturan kategori,
 * deteksi duplikat, dan batas 100 transaksi tetap satu implementasi.
 */
export function previewTransactionRecords(records: Record<string, string>[], accounts: Account[], categories: FinanceCategory[], categoryRules: CategoryRule[] = [], existingTransactions: Transaction[] = []): TransactionImportPreview {
  const activeAccounts = accounts.filter((account) => account.type !== "Investment");
  const activeCategories = categories.filter((category) => category.active);
  const rows = records.slice(0, 100).map((raw, index): TransactionImportPreviewRow => {
    const errors: string[] = [];
    const date = parseDate(raw.date || "");
    const type = parseType(raw.type || "");
    const amount = parseMoney(raw.amount || "");
    const title = (raw.title || "").trim();
    const importedCategory = (raw.category || "").trim();
    const accountValue = (raw.account || "").trim().toLowerCase();
    const account = activeAccounts.find((item) => item.id.toLowerCase() === accountValue || item.name.toLowerCase() === accountValue);
    const status = (raw.status || "completed").trim().toLowerCase();
    const time = (raw.time || "").trim();
    const parsedSplits = parseSplits(raw.splits || "", amount);
    const matchedRule = !parsedSplits.splits.length && type ? findCategoryRule(categoryRules, [title, raw.notes || "", raw.location || ""].filter(Boolean).join(" "), type === "income" ? "income" : "expense") : null;
    const category = matchedRule?.category || importedCategory;
    if (!date) errors.push("Tanggal tidak valid.");
    if (!type) errors.push("Jenis harus pemasukan, pengeluaran, atau refund.");
    if (!title) errors.push("Deskripsi wajib diisi.");
    if (!amount) errors.push("Nominal harus lebih dari nol.");
    if (!account) errors.push("Akun tidak ditemukan.");
    if (!category) errors.push("Kategori wajib diisi.");
    if (type && !activeCategories.some((item) => item.name.toLowerCase() === category.toLowerCase() && item.type === (type === "income" ? "income" : "expense"))) errors.push("Kategori tidak cocok dengan jenis transaksi.");
    if (!['completed', 'pending'].includes(status)) errors.push("Status harus completed atau pending.");
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.push("Waktu harus HH:mm.");
    if (parsedSplits.error) errors.push(parsedSplits.error);
    if (parsedSplits.splits.some((split) => !activeCategories.some((item) => item.name.toLowerCase() === split.category.toLowerCase() && item.type === (type === "income" ? "income" : "expense")))) errors.push("Kategori pada split tidak ditemukan atau tidak cocok.");
    const duplicate = !errors.length && type && account ? existingTransactions.find((item) =>
      !item.deletedAt && item.date === date && item.type === type && item.accountId === account.id && item.amount === amount
      && comparableTitle(item.title || item.merchant || "") === comparableTitle(title)) : undefined;
    const transaction = errors.length || !type || !account || duplicate ? undefined : {
      id: `tx-${crypto.randomUUID()}`,
      type,
      date,
      time,
      title,
      merchant: title,
      category,
      notes: (raw.notes || "").trim(),
      tags: (raw.tags || "").split("|").map((tag) => tag.trim()).filter(Boolean).slice(0, 10),
      location: (raw.location || "").trim(),
      splits: parsedSplits.splits,
      accountId: account.id,
      amount,
      status: status as Transaction["status"],
    };
    return { rowNumber: index + 2, raw, transaction, duplicateOf: duplicate?.id, matchedRule: errors.length ? undefined : matchedRule ?? undefined, errors };
  });
  if (records.length > 100) rows.push({ rowNumber: 102, raw: {}, errors: ["Maksimal 100 transaksi per impor."] });
  const valid = rows.flatMap((row) => row.transaction ? [row.transaction] : []);
  return {
    rows,
    valid,
    validCount: valid.length,
    errorCount: rows.filter((row) => row.errors.length > 0).length,
    duplicateCount: rows.filter((row) => row.duplicateOf).length,
    income: valid.filter((row) => row.type === "income").reduce((sum, row) => sum + row.amount, 0),
    expense: valid.filter((row) => row.type === "expense").reduce((sum, row) => sum + row.amount, 0),
  };
}

export const transactionCsvTemplate = [
  "tanggal,waktu,jenis,deskripsi,kategori,akun,nominal,status,catatan,tags,lokasi,split",
  "2026-07-18,09:30,pengeluaran,Belanja stok,Makanan,Rekening Utama,150000,completed,Contoh impor,operasional|stok,,",
].join("\n");
