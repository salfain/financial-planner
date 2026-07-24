import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFinanceDate } from "../lib/finance-client";

test("tanggal YYYY-MM-DD dipertahankan", () => {
  assert.equal(normalizeFinanceDate("2026-07-23"), "2026-07-23");
});

test("objek tanggal Google Sheets yang menjadi teks dinormalisasi", () => {
  assert.equal(
    normalizeFinanceDate("Thu Jul 23 2026 00:00:00 GMT+0700 (Western Indonesia Time)"),
    "2026-07-23",
  );
});

test("tanggal cache UTC dikembalikan ke tanggal Jakarta", () => {
  assert.equal(normalizeFinanceDate("2026-07-22T17:00:00.000Z"), "2026-07-23");
});

test("tanggal kosong atau rusak tidak menghasilkan tanggal palsu", () => {
  assert.equal(normalizeFinanceDate(""), "");
  assert.equal(normalizeFinanceDate("tanggal-rusak"), "");
});
