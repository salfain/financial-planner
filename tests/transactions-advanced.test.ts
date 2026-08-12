import assert from "node:assert/strict";
import test from "node:test";
import type { Account, Budget, FinanceCategory, Transaction } from "../lib/finance";
import { budgetsForPeriod, budgetSpent, budgetTransactionCount } from "../lib/finance";
import { parseCsvRecords, previewTransactionCsv } from "../lib/transaction-import";
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

test("realisasi Parkir menggabungkan variasi spasi dan kapitalisasi pada bulan yang dipilih", () => {
  const transactions: Transaction[] = [
    { id: "parking-1", type: "expense", date: "2026-08-01", title: "Parkir", category: "Parkir", accountId: "cash", amount: 5_000, status: "completed" },
    { id: "parking-2", type: "expense", date: "2026-08-02", title: "Parkir", category: " parkir ", accountId: "cash", amount: 6_000, status: "completed" },
    { id: "parking-3", type: "expense", date: "2026-08-03", title: "Belanja campuran", category: "Lainnya", accountId: "cash", amount: 10_000, status: "completed", splits: [{ id: "parking-split", category: "PARKIR", amount: 4_000 }, { id: "food-split", category: "Makanan", amount: 6_000 }] },
    { id: "parking-old", type: "expense", date: "2026-07-31", title: "Parkir lama", category: "Parkir", accountId: "cash", amount: 50_000, status: "completed" },
    { id: "parking-pending", type: "expense", date: "2026-08-04", title: "Parkir pending", category: "Parkir", accountId: "cash", amount: 20_000, status: "pending" },
  ];
  assert.equal(budgetSpent(transactions, "Parkir", "2026-08"), 15_000);
  assert.equal(budgetTransactionCount(transactions, "Parkir", "2026-08"), 3);
});

test("anggaran periode aktif tidak menghitung kategori lama atau duplikat dua kali", () => {
  const budgets: Budget[] = [
    { id: "legacy-parking", category: "Parkir", limit: 100_000, color: "#16876f" },
    { id: "old-parking", category: "PARKIR", limit: 150_000, color: "#16876f", period: "2026-07" },
    { id: "current-parking-old", category: " parkir ", limit: 200_000, color: "#16876f", period: "2026-08" },
    { id: "current-parking-new", category: "Parkir", limit: 250_000, color: "#16876f", period: "2026-08" },
    { id: "food", category: "Makanan", limit: 500_000, color: "#16876f", period: "2026-08" },
  ];
  const selected = budgetsForPeriod(budgets, "2026-08");
  assert.deepEqual(selected.map((budget) => [budget.id, budget.limit]), [
    ["current-parking-new", 250_000],
    ["food", 500_000],
  ]);
});

test("refund tidak membuat realisasi anggaran menjadi negatif", () => {
  const transactions: Transaction[] = [
    { id: "expense", type: "expense", date: "2026-08-01", title: "Parkir", category: "Parkir", accountId: "cash", amount: 5_000, status: "completed" },
    { id: "refund", type: "refund", date: "2026-08-02", title: "Refund parkir", category: "Parkir", accountId: "cash", amount: 8_000, status: "completed" },
  ];
  assert.equal(budgetSpent(transactions, "Parkir", "2026-08"), 0);
});
