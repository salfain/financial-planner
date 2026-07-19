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
  assert.match(layout, /\/og-advanced-transactions\.png/);
  assert.doesNotMatch(layout, /Starter Project|Your site is taking shape/);
});

test("copy produk tidak menampilkan bahasa dokumen pengembangan", async () => {
  const app = await source("../app/FinanceApp.tsx");
  assert.doesNotMatch(app, /tahap integrasi berikutnya|Impor CSV · segera|transaksi contoh/i);
  assert.match(app, /Pencatatan tagihan/);
  assert.match(app, /Konfirmasi manual/);
});

test("UI pengaturan menyediakan pemeriksaan dan repair ledger terkonfirmasi", async () => {
  const [app, client, route] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../lib/finance-client.ts"),
    source("../app/api/finance/ledger/route.ts"),
  ]);
  assert.match(app, /Integritas ledger/);
  assert.match(app, /Terapkan saldo hasil ledger/);
  assert.match(app, /Konfirmasi & lanjutkan/);
  assert.match(client, /\/api\/finance\/ledger/);
  assert.match(route, /ledger\.repair/);
  assert.match(route, /LEDGER_CHANGED/);
});

test("UI Core Finance mengekspos fitur nyata dengan data persisten", async () => {
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
  assert.match(app, /Duplikasi transaksi/);
  assert.match(app, /Split kategori/);
  assert.match(app, /Impor transaksi CSV/);
  assert.match(app, /Undo terakhir/);
  assert.match(client, /\/api\/finance\/transactions\/import/);
  assert.match(client, /\/api\/finance\/transactions\/undo/);
  assert.match(css, /\.advanced-filter-row/);
  assert.doesNotMatch(app, /const\s+demo(?:Accounts|Transactions|Budgets|Goals|Bills)/);
});

test("impor akun menyediakan template, preview, validasi duplikat, dan endpoint persisten", async () => {
  const [app, client, parser, route] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../lib/finance-client.ts"),
    source("../lib/account-import.ts"),
    source("../app/api/finance/accounts/import/route.ts"),
  ]);
  assert.match(app, /Impor akun & saldo awal/);
  assert.match(app, /Unduh template CSV/);
  assert.match(client, /\/api\/finance\/accounts\/import/);
  assert.match(parser, /Nama akun muncul lebih dari sekali/);
  assert.match(route, /account\.import/);
  assert.match(route, /DUPLICATE_IMPORT_NAME/);
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

test("UI AI dan OCR memakai backend nyata, disclosure, dan konfirmasi", async () => {
  const [app, client, aiRoute, ocrRoute] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../lib/finance-client.ts"),
    source("../app/api/finance/ai/assistant/route.ts"),
    source("../app/api/finance/ai/ocr/route.ts"),
  ]);
  assert.match(app, /AI & OCR Gemini/);
  assert.match(app, /data terpilih dan foto struk akan dikirim ke Gemini/);
  assert.match(app, /Belum ada transaksi yang disimpan/);
  assert.match(app, /Gunakan hasil OCR/);
  assert.match(client, /\/api\/finance\/ai\/assistant/);
  assert.match(client, /\/api\/finance\/ai\/ocr/);
  assert.match(aiRoute, /askAi/);
  assert.match(ocrRoute, /scanReceipt/);
  assert.doesNotMatch(app, /OCR belum diaktifkan|Analisis rule-based/);
});

test("UI laporan, backup, dan migrasi memakai storage serta preview nyata", async () => {
  const [app, client, reportRoute, backupRoute, migrationRoute, storage] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../lib/finance-client.ts"),
    source("../app/api/finance/reports/route.ts"),
    source("../app/api/finance/backups/route.ts"),
    source("../app/api/finance/migrations/preview/route.ts"),
    source("../.openai/hosting.json"),
  ]);
  assert.match(app, /Buat, simpan & unduh PDF/);
  assert.match(app, /Backup lengkap/);
  assert.match(app, /Preview siap diterapkan/);
  assert.match(app, /Backup pra-migrasi akan dibuat otomatis/);
  assert.match(client, /\/api\/finance\/reports/);
  assert.match(client, /\/api\/finance\/backups/);
  assert.match(client, /\/api\/finance\/migrations\/preview/);
  assert.match(reportRoute, /saveReport/);
  assert.match(backupRoute, /createBackup/);
  assert.match(migrationRoute, /previewMigration/);
  assert.match(storage, /"r2": "FILES"/);
  assert.doesNotMatch(app, /version: 2, exportedAt/);
});

test("notification center memakai engine, status persisten, dan pengaturan reminder", async () => {
  const [app, client, route, engine, schema] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../lib/finance-client.ts"),
    source("../app/api/finance/notifications/route.ts"),
    source("../lib/notifications.ts"),
    source("../db/schema.ts"),
  ]);
  assert.match(app, /Notification center & reminder/);
  assert.match(app, /Tandai semua/);
  assert.match(app, /Jadwal reminder/);
  assert.match(client, /\/api\/finance\/notifications/);
  assert.match(route, /updateNotificationStates/);
  assert.match(engine, /buildFinanceNotifications/);
  assert.match(schema, /notification_states/);
  assert.doesNotMatch(app, /pendingBills\.slice\(0, 1\)/);
});
