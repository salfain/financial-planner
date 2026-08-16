import assert from "node:assert/strict";
import test from "node:test";
import type { Account, FinanceCategory, Transaction } from "../lib/finance";
import { budgetSpent } from "../lib/finance";
import { chunkTransactions, MAX_IMPORT_TRANSACTIONS, parseCsvRecords, previewTransactionCsv } from "../lib/transaction-import";
import type { CategoryRule } from "../lib/category-rules";

const accounts: Account[] = [{ id: "cash", name: "Kas Utama", type: "Cash", institution: "", balance: 2_000_000, mask: "", color: "#16876f" }];
const categories: FinanceCategory[] = [
  { id: "food", name: "Makanan", type: "expense", color: "#16876f", active: true },
  { id: "transport", name: "Transportasi", type: "expense", color: "#4e79c7", active: true },
  { id: "income", name: "Pendapatan", type: "income", color: "#16876f", active: true },
];

test("CSV parser menangani kutip, koma, dan preview split yang valid", () => {
  const csv = [
    "tanggal,jenis,deskripsi,kategori,akun,nominal,catatan,split",
    '2026-07-18,pengeluaran,"Belanja, mingguan",Makanan,Kas Utama,150000,"stok, cabang",Makanan:100000|Transportasi:50000',
  ].join("\n");
  assert.equal(parseCsvRecords(csv)[0].title, "Belanja, mingguan");
  const preview = previewTransactionCsv(csv, accounts, categories);
  assert.equal(preview.errorCount, 0);
  assert.equal(preview.validCount, 1);
  assert.equal(preview.valid[0].splits?.length, 2);
  assert.equal(preview.expense, 150_000);
});

test("preview CSV menolak akun yang tidak ada dan total split yang berbeda", () => {
  const preview = previewTransactionCsv(
    "tanggal,jenis,deskripsi,kategori,akun,nominal,split\n2026-07-18,pengeluaran,Uji,Makanan,Tidak Ada,100000,Makanan:60000|Transportasi:30000",
    accounts,
    categories,
  );
  assert.equal(preview.validCount, 0);
  assert.equal(preview.errorCount, 1);
  assert.match(preview.rows[0].errors.join(" "), /Akun tidak ditemukan/);
  assert.match(preview.rows[0].errors.join(" "), /Total split/);
});

test("aturan kategori mengisi dan menimpa kategori CSV pada tahap preview", () => {
  const rules: CategoryRule[] = [
    { id: "rule-pln", keyword: "PLN", category: "Transportasi", transactionType: "expense", matchType: "contains", priority: 100, active: false },
    { id: "rule-indomaret", keyword: "Indomaret", category: "Makanan", transactionType: "expense", matchType: "contains", priority: 100, active: true },
  ];
  const preview = previewTransactionCsv(
    "tanggal,jenis,deskripsi,kategori,akun,nominal\n2026-07-18,pengeluaran,INDOMARET 012,,Kas Utama,125000",
    accounts,
    categories,
    rules,
  );
  assert.equal(preview.errorCount, 0);
  assert.equal(preview.valid[0].category, "Makanan");
  assert.equal(preview.rows[0].matchedRule?.id, "rule-indomaret");
});

test("rekonsiliasi impor melewati transaksi rekening yang sudah ada", () => {
  const existing: Transaction[] = [{
    id: "tx-existing", type: "expense", date: "2026-07-18", title: "Indomaret 012",
    category: "Makanan", accountId: "cash", amount: 125_000, status: "completed",
  }];
  const preview = previewTransactionCsv(
    "tanggal,jenis,deskripsi,kategori,akun,nominal\n2026-07-18,pengeluaran,  INDOMARET   012 ,Makanan,Kas Utama,125000",
    accounts,
    categories,
    [],
    existing,
  );
  assert.equal(preview.duplicateCount, 1);
  assert.equal(preview.validCount, 0);
  assert.equal(preview.errorCount, 0);
  assert.equal(preview.rows[0].duplicateOf, "tx-existing");
});

test("realisasi anggaran memakai alokasi split, bukan kategori induk saja", () => {
  const transaction: Transaction = {
    id: "tx-split",
    type: "expense",
    date: "2026-07-18",
    title: "Belanja campuran",
    category: "Makanan",
    accountId: "cash",
    amount: 150_000,
    status: "completed",
    splits: [
      { id: "split-food", category: "Makanan", amount: 100_000 },
      { id: "split-transport", category: "Transportasi", amount: 50_000 },
    ],
  };
  assert.equal(budgetSpent([transaction], "Makanan", "2026-07"), 100_000);
  assert.equal(budgetSpent([transaction], "Transportasi", "2026-07"), 50_000);
});

test("impor dipecah menjadi batch sesuai batas backend", () => {
  const items = Array.from({ length: 205 }, (_, index) => index + 1);
  const batches = chunkTransactions(items);
  assert.equal(batches.length, 3);
  assert.deepEqual(batches.map((batch) => batch.length), [100, 100, 5]);
  assert.deepEqual(batches.flat(), items, "tidak ada transaksi yang hilang atau tergandakan");
});

test("impor yang muat satu batch tidak dipecah", () => {
  assert.deepEqual(chunkTransactions([1, 2, 3]).length, 1);
  assert.deepEqual(chunkTransactions([]).length, 0);
});

test("ukuran batch nol ditolak agar tidak memecah tanpa henti", () => {
  assert.throws(() => chunkTransactions([1, 2], 0), RangeError);
});

test("preview menerima rekening koran ratusan baris", () => {
  const header = "tanggal,jenis,deskripsi,kategori,akun,nominal";
  const lines = Array.from({ length: 205 }, (_, index) => `2026-07-01,pengeluaran,Belanja ${index},Operasional,Kas Utama,10000`);
  const preview = previewTransactionCsv([header, ...lines].join("\n"), accounts, categories, [], []);
  assert.equal(preview.rows.length, 205);
  assert.equal(preview.rows.some((row) => row.errors.some((message) => /Maksimal/.test(message))), false);
});

test("melewati batas keseluruhan tetap ditolak", () => {
  const header = "tanggal,jenis,deskripsi,kategori,akun,nominal";
  const lines = Array.from({ length: MAX_IMPORT_TRANSACTIONS + 5 }, () => "2026-07-01,pengeluaran,Belanja,Operasional,Kas Utama,10000");
  const preview = previewTransactionCsv([header, ...lines].join("\n"), accounts, categories, [], []);
  assert.equal(preview.rows.length, MAX_IMPORT_TRANSACTIONS + 1);
  assert.match(preview.rows[preview.rows.length - 1].errors[0], /Maksimal 1000 transaksi/);
});
