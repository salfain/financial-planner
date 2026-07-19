import assert from "node:assert/strict";
import test from "node:test";
import type { Account } from "../lib/finance";
import { accountCsvTemplate, previewAccountCsv } from "../lib/account-import";

const existingAccounts: Account[] = [{
  id: "existing",
  name: "Rekening Utama",
  type: "Bank",
  institution: "BCA",
  balance: 1_000_000,
  openingBalance: 1_000_000,
  mask: "1234",
  color: "#126b59",
}];

test("preview impor akun membaca template Indonesia dan saldo awal", () => {
  const preview = previewAccountCsv(accountCsvTemplate, []);
  assert.equal(preview.errorCount, 0);
  assert.equal(preview.validCount, 2);
  assert.equal(preview.totalOpeningBalance, 6_000_000);
  assert.equal(preview.valid[0].type, "Bank");
  assert.equal(preview.valid[1].type, "Cash");
  assert.equal(preview.valid[0].openingBalance, 5_000_000);
});

test("preview menandai nama yang sudah ada dan duplikat di dalam file", () => {
  const preview = previewAccountCsv([
    "nama,jenis,saldo_awal",
    "rekening utama,Bank,1000",
    "Kas Cabang,Cash,2000",
    "KAS CABANG,E-Wallet,3000",
  ].join("\n"), existingAccounts);
  assert.equal(preview.validCount, 0);
  assert.equal(preview.errorCount, 3);
  assert.match(preview.rows[0].errors.join(" "), /sudah digunakan/i);
  assert.match(preview.rows[1].errors.join(" "), /lebih dari sekali/i);
});

test("preview menolak jenis, saldo, dan warna yang tidak valid", () => {
  const preview = previewAccountCsv([
    "name,type,institution,opening_balance,mask,color",
    "Akun Salah,Paylater,Contoh,-100,99,biru",
  ].join("\n"), []);
  assert.equal(preview.validCount, 0);
  assert.equal(preview.errorCount, 1);
  assert.match(preview.rows[0].errors.join(" "), /jenis akun/i);
  assert.match(preview.rows[0].errors.join(" "), /saldo awal/i);
  assert.match(preview.rows[0].errors.join(" "), /kode hex/i);
});

test("preview membatasi satu batch hingga 100 akun", () => {
  const csv = ["nama,jenis", ...Array.from({ length: 101 }, (_, index) => `Akun ${index + 1},Cash`)].join("\n");
  const preview = previewAccountCsv(csv, []);
  assert.equal(preview.validCount, 100);
  assert.equal(preview.errorCount, 1);
  assert.match(preview.rows.at(-1)?.errors.join(" ") || "", /maksimal 100/i);
});
