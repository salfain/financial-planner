import assert from "node:assert/strict";
import test from "node:test";
import type { Account, FinanceCategory, Transaction } from "../lib/finance";
import { budgetSpent } from "../lib/finance";
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
