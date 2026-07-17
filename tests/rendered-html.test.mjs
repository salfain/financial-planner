import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("shell menggunakan identitas VINN STORE dan locale Indonesia", async () => {
  const [page, layout] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/layout.tsx"),
  ]);

  assert.match(page, /<FinanceApp\s*\/>/);
  assert.match(layout, /VINN STORE — Financial OS/);
  assert.match(layout, /<html lang="id"/);
  assert.match(layout, /\/og-investment\.png/);
  assert.doesNotMatch(layout, /Starter Project|Your site is taking shape/);
});

test("UI Core Finance mengekspos fitur nyata tanpa data transaksi dummy", async () => {
  const [app, client, css] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../lib/finance-client.ts"),
    source("../app/globals.css"),
  ]);

  assert.match(app, /Edit transaksi/);
  assert.match(app, /Cocokkan saldo/);
  assert.match(app, /Kategori transaksi/);
  assert.match(app, /Audit trail/);
  assert.match(client, /\/api\/finance\/accounts\/\$\{encodeURIComponent\(accountId\)\}\/reconcile/);
  assert.match(client, /\/api\/finance\/categories/);
  assert.match(css, /\.transaction-actions/);
  assert.match(css, /\.reconcile-preview/);
  assert.doesNotMatch(app, /const\s+demo(?:Accounts|Transactions|Budgets|Goals|Bills)/);
});

test("UI Investment mengekspos asset master, buy/sell, dan P/L tanpa placeholder", async () => {
  const app = await source("../app/FinanceApp.tsx");
  assert.match(app, /Aset investasi baru/);
  assert.match(app, /Transaksi investasi/);
  assert.match(app, /onTrade\("buy"/);
  assert.match(app, /realized P\/L/i);
  assert.match(app, /Weighted average cost/);
  assert.doesNotMatch(app, /Modul investasi belum diaktifkan/);
});
