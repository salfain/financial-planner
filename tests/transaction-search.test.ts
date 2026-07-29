import assert from "node:assert/strict";
import test from "node:test";
import type { Account, Transaction } from "../lib/finance";
import { searchTransactions } from "../lib/transaction-search";

const accounts: Account[] = [{
  id: "bank", name: "Rekening Utama", type: "Bank", institution: "BCA",
  balance: 100_000, openingBalance: 100_000, mask: "1234", color: "#126b59",
}];

const transactions: Transaction[] = [
  { id: "1", type: "expense", date: "2026-07-23", time: "19:43", title: "Jajan Aqua", merchant: "Indomaret", category: "Makanan", notes: "dua botol", tags: ["jajan"], location: "Bandung", accountId: "bank", amount: 5_000, status: "completed" },
  { id: "2", type: "adjustment_in", date: "2026-07-20", title: "Rekonsiliasi", category: "Penyesuaian", accountId: "bank", amount: 10_000, status: "completed" },
  { id: "3", type: "expense", date: "2026-07-19", title: "Belanja rumah", category: "Campuran", splits: [{ id: "s1", category: "Tagihan", amount: 20_000, note: "PLN" }], accountId: "bank", amount: 20_000, status: "pending" },
];

test("pencarian transaksi lokal mencakup merchant, tag, lokasi, dan nama akun", () => {
  assert.deepEqual(searchTransactions(transactions, accounts, { query: "indomaret" }).map((item) => item.id), ["1"]);
  assert.deepEqual(searchTransactions(transactions, accounts, { query: "jajan" }).map((item) => item.id), ["1"]);
  assert.deepEqual(searchTransactions(transactions, accounts, { query: "rekening utama" }).map((item) => item.id), ["1", "2", "3"]);
});

test("filter lokal mendukung split, penyesuaian, status, dan rentang tanggal", () => {
  assert.deepEqual(searchTransactions(transactions, accounts, { category: "Tagihan", status: "pending" }).map((item) => item.id), ["3"]);
  assert.deepEqual(searchTransactions(transactions, accounts, { type: "adjustment" }).map((item) => item.id), ["2"]);
  assert.deepEqual(searchTransactions(transactions, accounts, { dateFrom: "2026-07-20", dateTo: "2026-07-23" }).map((item) => item.id), ["1", "2"]);
});
