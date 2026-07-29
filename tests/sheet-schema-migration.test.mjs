import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const [config, repository] = await Promise.all([
  readFile(new URL("apps-script/Config.gs", root), "utf8"),
  readFile(new URL("apps-script/SheetRepository.gs", root), "utf8"),
]);
const context = vm.createContext({ console });
new vm.Script(`${config}\n${repository}`, { filename: "sheet-schema-migration.gs" }).runInContext(context);

const expectedBillsHeaders = JSON.parse(
  vm.runInContext("JSON.stringify(VINN_CONFIG.HEADERS.Bills)", context),
);

const rebuild = (headers, rows) => {
  context.testHeaders = headers;
  context.testRows = rows;
  const value = vm.runInContext(
    "rebuildSheetRowsForHeaders_(testHeaders, testRows, VINN_CONFIG.HEADERS.Bills)",
    context,
  );
  return value === null ? null : JSON.parse(JSON.stringify(value));
};

test("migrasi Bills memindahkan fase lama tanpa menghapus data", () => {
  const oldHeaders = [
    ...expectedBillsHeaders.slice(0, 15),
    "installment_phases_json",
    "total_paid",
    "installment_phases_json",
  ];
  const phaseJson = JSON.stringify([
    { label: "Bebas bunga", durationMonths: 6, amount: 850000 },
    { label: "Dengan bunga", durationMonths: 6, amount: 980000 },
  ]);
  const row = expectedBillsHeaders.slice(0, 15).map((header) => `value:${header}`);
  row.push(phaseJson, 1700000, "");

  const migrated = rebuild(oldHeaders, [row]);
  assert.ok(migrated);
  assert.equal(migrated[0].length, expectedBillsHeaders.length);
  assert.equal(migrated[0][15], "");
  assert.equal(migrated[0][16], 1700000);
  assert.equal(migrated[0][17], phaseJson);
});

test("migrasi tidak menimpa kolom asing dan melewati struktur yang sudah sesuai", () => {
  assert.equal(rebuild(expectedBillsHeaders, []), null);
  const customHeaders = [...expectedBillsHeaders];
  customHeaders[4] = "kolom_manual_pelanggan";
  assert.equal(rebuild(customHeaders, [["nilai"]]), null);
});
