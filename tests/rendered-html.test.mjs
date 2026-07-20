import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("shell menggunakan identitas Financial Planner dan locale Indonesia", async () => {
  const [page, layout] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/layout.tsx"),
  ]);

  assert.match(page, /<FinanceApp\s*\/>/);
  assert.match(layout, /title: "Financial Planner"/);
  assert.match(layout, /<html lang="id"/);
  assert.match(layout, /\/og-financial-planner\.png/);
  assert.doesNotMatch(layout, /Starter Project|Your site is taking shape/);
});

test("copy produk tidak menampilkan bahasa dokumen pengembangan", async () => {
  const app = await source("../app/FinanceApp.tsx");
  assert.doesNotMatch(app, /tahap integrasi berikutnya|Impor CSV · segera|transaksi contoh/i);
  assert.doesNotMatch(app, /VINN STORE|VINN Insight/i);
  assert.match(app, /Financial Planner/);
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

test("profil pemilik dapat diubah dan disimpan secara persisten", async () => {
  const [app, client, route, appsScript] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../lib/finance-client.ts"),
    source("../app/api/finance/profile/route.ts"),
    source("../apps-script/DomainService.gs"),
  ]);
  assert.match(app, /Profil pemilik/);
  assert.match(app, /Simpan nama/);
  assert.match(app, /laporan, backup, dan ekspor/);
  assert.match(client, /\/api\/finance\/profile/);
  assert.match(route, /profile\.update/);
  assert.match(appsScript, /apiUpdateProfile/);
  assert.match(appsScript, /UPDATE_PROFILE/);
});

test("pengaturan menampilkan keamanan owner-only dan isolasi workspace", async () => {
  const [app, client, route, api, worker] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../lib/finance-client.ts"),
    source("../app/api/finance/access-status/route.ts"),
    source("../app/api/_lib/api.ts"),
    source("../worker/index.ts"),
  ]);
  assert.match(app, /Keamanan & akses/);
  assert.match(app, /Hanya pemilik/);
  assert.match(app, /Dikunci di server/);
  assert.match(client, /\/api\/finance\/access-status/);
  assert.match(route, /owner_only/);
  assert.match(api, /WORKSPACE_ACCESS_DENIED/);
  assert.match(worker, /applySecurityHeaders/);
});

test("Financial Roadmap menyediakan simulasi tiga skenario dan asumsi persisten", async () => {
  const [app, client, engine, route, schema] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../lib/finance-client.ts"),
    source("../lib/roadmap.ts"),
    source("../app/api/finance/roadmap/route.ts"),
    source("../db/schema.ts"),
  ]);
  assert.match(app, /Financial Roadmap/);
  assert.match(app, /Tiga kemungkinan perjalanan/);
  assert.match(engine, /Konservatif/);
  assert.match(engine, /Optimistis/);
  assert.match(app, /Kesiapan target finansial/);
  assert.match(client, /\/api\/finance\/roadmap/);
  assert.match(engine, /buildFinancialRoadmap/);
  assert.match(route, /roadmap\.update/);
  assert.match(schema, /roadmap_settings/);
});

test("Debt Payoff Planner memakai simulasi dan penyimpanan persisten", async () => {
  const [app, client, engine, route, schema, appsScript] = await Promise.all([
    source("../app/FinanceApp.tsx"), source("../lib/finance-client.ts"), source("../lib/debt.ts"),
    source("../app/api/finance/debts/route.ts"), source("../db/schema.ts"), source("../apps-script/DomainService.gs"),
  ]);
  assert.match(app, /Debt Payoff Planner/);
  assert.match(app, /Avalanche/);
  assert.match(app, /Snowball/);
  assert.match(client, /\/api\/finance\/debts/);
  assert.match(engine, /simulateDebtPayoff/);
  assert.match(route, /debt\.plan\.upsert/);
  assert.match(schema, /debt_payoff_settings/);
  assert.match(appsScript, /apiUpdateDebtPlanner/);
});

test("Cashflow Forecast memproyeksikan saldo dan menyimpan asumsi", async () => {
  const [app, client, engine, route, schema, appsScript] = await Promise.all([
    source("../app/FinanceApp.tsx"), source("../lib/finance-client.ts"), source("../lib/cashflow-forecast.ts"),
    source("../app/api/finance/forecast/route.ts"), source("../db/schema.ts"), source("../apps-script/DomainService.gs"),
  ]);
  assert.match(app, /Cashflow Forecast/);
  assert.match(app, /Jalur saldo kas/);
  assert.match(app, /Kalender arus kas/);
  assert.match(client, /\/api\/finance\/forecast/);
  assert.match(engine, /buildCashflowForecast/);
  assert.match(route, /forecast\.settings\.update/);
  assert.match(schema, /cashflow_forecast_settings/);
  assert.match(appsScript, /apiUpdateCashflowForecastSettings/);
});

test("Emergency Fund Planner menghitung safety score dan menyimpan akun dana", async () => {
  const [app, client, engine, route, schema, appsScript] = await Promise.all([
    source("../app/FinanceApp.tsx"), source("../lib/finance-client.ts"), source("../lib/emergency-fund.ts"),
    source("../app/api/finance/emergency-fund/route.ts"), source("../db/schema.ts"), source("../apps-script/DomainService.gs"),
  ]);
  assert.match(app, /Emergency Fund Planner/);
  assert.match(app, /Financial safety score/i);
  assert.match(app, /Progress perlindungan/);
  assert.match(client, /\/api\/finance\/emergency-fund/);
  assert.match(engine, /buildEmergencyFundPlan/);
  assert.match(route, /emergency_fund\.settings\.update/);
  assert.match(schema, /emergency_fund_settings/);
  assert.match(appsScript, /apiUpdateEmergencyFundSettings/);
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

test("akun, anggaran, target, dan tagihan memiliki pengelolaan lengkap", async () => {
  const [app, client, appsScript] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../lib/finance-client.ts"),
    source("../apps-script/DomainService.gs"),
  ]);
  assert.match(app, /Edit akun/);
  assert.match(app, /Edit anggaran/);
  assert.match(app, /Atur progress/);
  assert.match(app, /Kurangi dana/);
  assert.match(app, /Edit tagihan rutin/);
  assert.match(app, /Frekuensi tagihan bulanan/);
  assert.match(client, /updateFinanceAccount/);
  assert.match(client, /deleteFinanceBudget/);
  assert.match(client, /deleteFinanceGoal/);
  assert.match(client, /deleteFinanceBill/);
  assert.match(appsScript, /apiUpdateAccount/);
  assert.match(appsScript, /apiDeleteBudget/);
  assert.match(appsScript, /apiDeleteGoal/);
  assert.match(appsScript, /apiDeleteBill/);
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

test("transaksi rutin dan subscription memakai jadwal persisten serta konfirmasi ledger", async () => {
  const [app, client, route, confirmRoute, schema, gas] = await Promise.all([
    source("../app/FinanceApp.tsx"), source("../lib/finance-client.ts"), source("../app/api/finance/recurring/route.ts"),
    source("../app/api/finance/recurring/[id]/confirm/route.ts"), source("../db/schema.ts"), source("../apps-script/RecurringService.gs"),
  ]);
  assert.match(app, /Transaksi rutin & langganan/);
  assert.match(app, /Catat ke ledger/);
  assert.match(app, /Subscription/);
  assert.match(client, /\/api\/finance\/recurring/);
  assert.match(route, /recurring_templates/);
  assert.match(confirmRoute, /createTransaction/);
  assert.match(schema, /recurringTemplates/);
  assert.match(gas, /apiConfirmRecurring/);
});
