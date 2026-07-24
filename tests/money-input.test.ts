import assert from "node:assert/strict";
import test from "node:test";
import { formatMoneyInput, moneyInputDigits, moneyInputNumber } from "../lib/money-input";

test("kolom uang memakai pemisah ribuan Indonesia tanpa mengubah nilai simpan", () => {
  assert.equal(formatMoneyInput("5000"), "5.000");
  assert.equal(formatMoneyInput("Rp 1.250.000"), "1.250.000");
  assert.equal(formatMoneyInput(1405493), "1.405.493");
  assert.equal(moneyInputDigits("Rp 1.250.000"), "1250000");
  assert.equal(moneyInputNumber("1.250.000"), 1_250_000);
});

test("kolom uang tetap aman saat kosong dan menghapus nol di depan", () => {
  assert.equal(formatMoneyInput(""), "");
  assert.equal(moneyInputDigits("0005000"), "5000");
  assert.equal(moneyInputNumber(""), 0);
});
