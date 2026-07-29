import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const [config, utils] = await Promise.all([
  readFile(new URL("apps-script/Config.gs", root), "utf8"),
  readFile(new URL("apps-script/Utils.gs", root), "utf8"),
]);
const context = vm.createContext({ console });
new vm.Script(`${config}\n${utils}`, { filename: "gas-bootstrap-performance.gs" }).runInContext(context);

test("bootstrap menghitung saldo 10.000 transaksi dalam satu lintasan", () => {
  context.testAccounts = Array.from({ length: 25 }, (_, index) => ({
    id: `account-${index}`,
    opening_balance: 10_000_000,
    is_liability: index >= 20,
  }));
  context.testTransactions = Array.from({ length: 10_000 }, (_, index) => ({
    id: `transaction-${index}`,
    account_id: `account-${index % 25}`,
    type: index % 3 === 0 ? "income" : "expense",
    amount: 1_000 + index,
    status: "completed",
    deleted_at: "",
  }));

  const startedAt = performance.now();
  const balances = JSON.parse(vm.runInContext(`
    (function() {
      const movements = transactionMovementsByAccount_(testTransactions);
      return JSON.stringify(testAccounts.map(function(account) {
        return accountCurrentBalanceFromMovements_(account, movements);
      }));
    })()
  `, context));
  const durationMs = performance.now() - startedAt;

  assert.equal(balances.length, 25);
  assert.ok(balances.every(Number.isFinite));
  assert.ok(durationMs < 2_000, `Perhitungan 10.000 transaksi terlalu lambat: ${Math.round(durationMs)} ms`);
});
