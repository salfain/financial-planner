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

test("sidebar dikelompokkan tanpa menyembunyikan menu", async () => {
  const [app, css] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../app/globals.css"),
  ]);
  assert.match(app, /Keuangan/);
  assert.match(app, /Perencanaan/);
  assert.match(app, /Tagihan & Utang/);
  assert.match(app, /Analisis & Sistem/);
  assert.doesNotMatch(app, /financial-planner-nav-groups/);
  assert.doesNotMatch(app, /aria-expanded=\{expanded\}/);
  assert.match(css, /\.nav-group-label/);
  assert.match(css, /\.nav-group-items/);
  assert.match(css, /\.sidebar-card-copy/);
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
  assert.match(app, /roadmap-goal-empty/);
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
  assert.match(app, /Catat pinjaman baru/);
  assert.match(app, /Bukan pemasukan/);
  assert.match(app, /Kalender keuangan/);
  assert.match(app, /Kebutuhan 7 hari/);
  assert.match(app, /Kebutuhan 30 hari/);
  assert.match(app, /Paylater & kartu/);
  assert.match(app, /Kredit & pinjaman/);
  assert.match(app, /Cicilan bulan ini/);
  assert.match(app, /Jatuh tempo terdekat/);
  assert.match(client, /\/api\/finance\/transactions\/import/);
  assert.match(client, /\/api\/finance\/transactions\/undo/);
  assert.match(css, /\.advanced-filter-row/);
  assert.match(css, /\.hero-liability-details/);
  assert.doesNotMatch(app, /const\s+demo(?:Accounts|Transactions|Budgets|Goals|Bills)/);
});

test("penyimpanan UI tidak menunggu sinkronisasi penuh selesai", async () => {
  const [app, client, router] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../lib/finance-client.ts"),
    source("../apps-script/Router.gs"),
  ]);
  const mutationBlock = app.slice(app.indexOf("const runMutation"), app.indexOf("const addTransaction"));
  assert.match(mutationBlock, /await work\(\)/);
  assert.match(mutationBlock, /void refreshData\(\)/);
  assert.doesNotMatch(mutationBlock, /await refreshData\(\)/);
  assert.match(mutationBlock, /showToast\(successMessage\)/);
  assert.match(mutationBlock, /isFinanceMutationCommittedError/);
  assert.match(client, /mutationStatus/);
  assert.match(client, /15_000/);
  assert.match(client, /FINANCE_MUTATION_PROGRESS_EVENT/);
  assert.match(client, /phase: "slow"/);
  assert.match(app, /Google Sheets masih memproses/);
  assert.match(app, /Cold start Google/);
  assert.match(router, /mutationStatus/);
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
  assert.match(app, /Paylater & kartu kredit/);
  assert.match(app, /Kredit kendaraan & pinjaman/);
  assert.match(app, /Tagihan biasa/);
  assert.match(app, /Tagihan gabungan bulan ini/);
  assert.match(app, /Bayar semua/);
  assert.match(app, /Total tenor \(bulan\)/);
  assert.match(app, /Sudah dibayar/);
  assert.match(app, /bulan tersisa/);
  assert.match(app, /payBillGroup/);
  assert.match(client, /updateFinanceAccount/);
  assert.match(client, /deleteFinanceBudget/);
  assert.match(client, /deleteFinanceGoal/);
  assert.match(client, /deleteFinanceBill/);
  assert.match(appsScript, /apiUpdateAccount/);
  assert.match(appsScript, /apiDeleteBudget/);
  assert.match(appsScript, /apiDeleteGoal/);
  assert.match(appsScript, /apiDeleteBill/);
  assert.match(appsScript, /billPaidCount_/);
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
  const [app, client, aiRoute, ocrRoute, cloudAi, gasAi] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../lib/finance-client.ts"),
    source("../app/api/finance/ai/assistant/route.ts"),
    source("../app/api/finance/ai/ocr/route.ts"),
    source("../app/api/_lib/ai.ts"),
    source("../apps-script/AIService.gs"),
  ]);
  assert.match(app, /AI & OCR Universal/);
  assert.match(app, /data terpilih dan foto struk akan dikirim ke penyedia AI/);
  assert.match(app, /Base URL API/);
  assert.match(app, /Belum ada transaksi yang disimpan/);
  assert.match(app, /Gunakan hasil OCR/);
  assert.match(client, /\/api\/finance\/ai\/assistant/);
  assert.match(client, /\/api\/finance\/ai\/ocr/);
  assert.match(aiRoute, /askAi/);
  assert.match(ocrRoute, /scanReceipt/);
  for (const backend of [cloudAi, gasAi]) {
    assert.match(backend, /financialPosition/);
    assert.match(backend, /dataAvailability/);
    assert.match(backend, /bertahan\|runway/);
    assert.match(backend, /Posisi keuangan agregat/);
  }
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

test("review dan tutup buku bulanan memakai snapshot persisten serta mengunci ledger", async () => {
  const [app, client, route, schema, gasClosing, gasValidation, undo, investment] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../lib/finance-client.ts"),
    source("../app/api/finance/monthly-closing/route.ts"),
    source("../db/schema.ts"),
    source("../apps-script/MonthlyClosingService.gs"),
    source("../apps-script/Utils.gs"),
    source("../app/api/finance/transactions/undo/route.ts"),
    source("../app/api/finance/investments/transactions/route.ts"),
  ]);
  assert.match(app, /Review & tutup buku/);
  assert.match(app, /Tutup bulan & simpan snapshot/);
  assert.match(app, /Buka kembali bulan/);
  assert.match(client, /monthlyClosingStatus/);
  assert.match(client, /closeMonthlyBook/);
  assert.match(client, /reopenMonthlyBook/);
  assert.match(route, /monthly_closings/);
  assert.match(schema, /monthlyClosings/);
  assert.match(gasClosing, /apiCloseMonthlyBook/);
  assert.match(gasClosing, /apiReopenMonthlyBook/);
  assert.match(gasValidation, /assertMonthlyPeriodsOpen_/);
  assert.match(undo, /assertMonthlyPeriodOpen/);
  assert.match(investment, /assertMonthlyPeriodOpen/);
});

test("aturan kategori otomatis tersimpan dan diterapkan saat preview impor CSV", async () => {
  const [app, client, engine, route, schema, gasRules, gasImport] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../lib/finance-client.ts"),
    source("../lib/category-rules.ts"),
    source("../app/api/finance/category-rules/route.ts"),
    source("../db/schema.ts"),
    source("../apps-script/CategoryRuleService.gs"),
    source("../apps-script/TransactionService.gs"),
  ]);
  assert.match(app, /Aturan kategori otomatis/);
  assert.match(app, /Otomatis: /);
  assert.match(client, /createCategoryRule/);
  assert.match(client, /updateCategoryRule/);
  assert.match(client, /deleteCategoryRule/);
  assert.match(engine, /findCategoryRule/);
  assert.match(route, /category_rules/);
  assert.match(schema, /categoryRules/);
  assert.match(gasRules, /applyCategoryRuleGs_/);
  assert.match(gasImport, /applyCategoryRuleGs_\(item\)/);
});

test("paket Free, Pro, dan Premium tampil sebagai produk final dengan aktivasi offline", async () => {
  const [app, styles, client, plans, licenseRoute, gasLicense, guide] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../app/globals.css"),
    source("../lib/finance-client.ts"),
    source("../lib/plans.ts"),
    source("../app/api/finance/license/route.ts"),
    source("../apps-script/LicenseService.gs"),
    source("../docs/PANDUAN-JUAL-PUTUS.md"),
  ]);
  assert.match(app, /Paket & lisensi/);
  assert.match(app, /Aktivasi lisensi/);
  assert.match(app, /license-modal/);
  assert.match(styles, /\.modal\.license-modal/);
  assert.match(styles, /\.license-current/);
  assert.match(styles, /\.license-installation/);
  assert.match(styles, /\.license-limit-note/);
  assert.match(styles, /\.nav-plan-lock \{/);
  assert.match(styles, /\.nav-plan-lock svg/);
  assert.match(styles, /\.price-status > span/);
  assert.doesNotMatch(styles, /\.online i, \.price-status span/);
  assert.match(styles, /\.investment-history-list > \.investment-history-empty/);
  assert.match(app, /settings-wide license-summary-panel/);
  assert.match(styles, /\.settings-title > span:first-child/);
  assert.doesNotMatch(styles, /\.settings-title > span\s*\{/);
  assert.match(client, /\/api\/finance\/license/);
  assert.match(plans, /advanced_transactions: "pro"/);
  assert.match(plans, /investments: "premium"/);
  assert.match(licenseRoute, /activateLicense/);
  assert.match(gasLicense, /apiActivateLicense/);
  assert.match(gasLicense, /FEATURE_NOT_INCLUDED/);
  assert.match(guide, /Aktivasi paket/);
});

test("tampilan mobile target memakai aksi jelas dan area navigasi aman", async () => {
  const [app, styles] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../app/globals.css"),
  ]);
  assert.match(app, /Belum ada target finansial/);
  assert.match(app, /Buat target pertama/);
  assert.match(app, /theme-toggle/);
  assert.match(styles, /\.goal-add\.is-empty/);
  assert.match(styles, /\.goal-add-cta/);
  assert.match(styles, /safe-area-inset-bottom/);
  assert.match(styles, /\.global-search:focus-within/);
  assert.match(styles, /grid-template-columns: auto minmax\(0,1fr\)/);
  assert.match(styles, /\.mobile-menu:hover/);
});

test("layout mobile GAS menyusut tanpa menutupi navigasi", async () => {
  const [styles, gasStyles, app, main, index, layout] = await Promise.all([
    source("../app/globals.css"),
    source("../gas-frontend/styles.css"),
    source("../app/FinanceApp.tsx"),
    source("../apps-script/Main.gs"),
    source("../apps-script/Index.html"),
    source("../app/layout.tsx"),
  ]);
  assert.match(styles, /\.global-search \{ min-width: 0; grid-template-columns: auto minmax\(0,1fr\); overflow: hidden/);
  assert.match(styles, /\.hero-card \{ min-height: 0; padding: 18px; \}/);
  assert.match(styles, /\.bar-chart \{ height: 150px/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.metric-card,\.metric-card\.cashflow \{ grid-column: span 12; \}/);
  assert.match(gasStyles, /bottom: calc\(66px \+ env\(safe-area-inset-bottom\) \+ 16px\)/);
  assert.match(styles, /body \{ padding-bottom: 0; \}/);
  assert.match(styles, /--mobile-safe-bottom: min\(env\(safe-area-inset-bottom, 0px\), 34px\)/);
  assert.match(styles, /min-height: var\(--app-viewport-height, 100dvh\)/);
  assert.match(styles, /inset: auto 0 var\(--app-fixed-bottom, 0px\)/);
  assert.match(styles, /padding-bottom: calc\(88px \+ var\(--mobile-safe-bottom\)\)/);
  assert.match(styles, /\.mobile-nav \.nav-item \{ min-width: 0; flex: 1 1 0; \}/);
  assert.match(styles, /font-size: 16px/);
  assert.match(app, /window\.visualViewport/);
  assert.match(app, /--app-fixed-bottom/);
  assert.match(main, /viewport-fit=cover, interactive-widget=resizes-content/);
  assert.match(index, /viewport-fit=cover, interactive-widget=resizes-content/);
  assert.match(layout, /viewportFit: "cover"/);
});

test("grafik arus kas menampilkan nilai saat hover, fokus, dan sentuhan", async () => {
  const [app, styles] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../app/globals.css"),
  ]);
  assert.match(app, /className="bar-tooltip"/);
  assert.match(app, /aria-describedby=\{tooltipId\}/);
  assert.match(app, /Pemasukan \$\{incomeLabel\}\. Pengeluaran \$\{expenseLabel\}/);
  assert.match(styles, /\.bar-column:hover \.bar-tooltip/);
  assert.match(styles, /\.bar-column:focus-visible \.bar-tooltip/);
});

test("mode demo publik read-only terpisah dari build pelanggan", async () => {
  const [app, client, demo, main, index, demoMain, demoIndex, styles] = await Promise.all([
    source("../app/FinanceApp.tsx"), source("../lib/finance-client.ts"), source("../lib/demo-finance.ts"),
    source("../apps-script/Main.gs"), source("../apps-script/Index.html"), source("../apps-script-demo/Main.gs"),
    source("../apps-script-demo/Index.html"), source("../app/globals.css"),
  ]);
  assert.match(app, /Mode Demo Premium · hanya-baca/);
  assert.match(app, /Beli via WhatsApp/);
  assert.doesNotMatch(app, /Reset data demo/);
  assert.match(client, /isFinanceDemoMode\(\)/);
  assert.match(demo, /capabilityMap\("premium"\)/);
  assert.match(demo, /Mode demo hanya-baca/);
  assert.doesNotMatch(main, /event\.parameter\.demo/);
  assert.match(index, /__FINANCE_DEMO__ = false/);
  assert.match(demoMain, /DEMO_READ_ONLY/);
  assert.match(demoIndex, /__FINANCE_DEMO__ = true/);
  assert.match(styles, /\.demo-banner a/);
});

test("form transaksi memformat Rupiah dan dapat memakai ulang isian terakhir", async () => {
  const [app, styles, moneyInput] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../app/globals.css"),
    source("../lib/money-input.ts"),
  ]);
  assert.match(app, /Terakhir digunakan/);
  assert.match(app, /Ketuk untuk mengisi ulang/);
  assert.match(app, /applyRecentTransaction/);
  assert.match(app, /transactions=\{transactions\}/);
  assert.match(app, /value=\{formatMoneyInput\(amount\)\}/);
  assert.match(app, /setAmount\(moneyInputDigits\(event\.target\.value\)\)/);
  assert.match(styles, /\.transaction-recent/);
  assert.match(moneyInput, /replace\(\/\\B\(\?=\(\\d\{3\}\)\+\(\?!\\d\)\)\/g, "\."\)/);
});

test("Pos Dana memakai alokasi virtual, riwayat, Google Sheets, AI, backup, dan migrasi", async () => {
  const [app, styles, client, schema, route, gas, config, router, ai, portability] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../app/globals.css"),
    source("../lib/finance-client.ts"),
    source("../db/schema.ts"),
    source("../app/api/sinking-funds/route.ts"),
    source("../apps-script/SinkingFundService.gs"),
    source("../apps-script/Config.gs"),
    source("../apps-script/Router.gs"),
    source("../apps-script/AIService.gs"),
    source("../app/api/_lib/portability.ts"),
  ]);
  assert.match(app, /Sinking Fund \/ Pos Dana/);
  assert.match(app, /Tidak menghitung uang dua kali/);
  assert.match(app, /SinkingFundAdjustmentModal/);
  assert.match(styles, /\.sinking-fund-card/);
  assert.match(client, /createFinanceSinkingFund/);
  assert.match(client, /adjustFinanceSinkingFund/);
  assert.match(schema, /sinkingFunds/);
  assert.match(schema, /sinkingFundEntries/);
  assert.match(route, /sinking_funds/);
  assert.match(gas, /apiCreateSinkingFund/);
  assert.match(gas, /apiAdjustSinkingFund/);
  assert.match(config, /SINKING_FUNDS/);
  assert.match(config, /SINKING_FUND_ENTRIES/);
  assert.match(router, /createSinkingFund/);
  assert.match(router, /adjustSinkingFund/);
  assert.match(ai, /sinkingFundAllocated/);
  assert.match(portability, /sinkingFundEntries/);
});

test("fitur opsional dapat disembunyikan secara persisten tanpa mematikan ledger inti", async () => {
  const [app, styles, client, preferences, route, schema, gas, dashboard, router] = await Promise.all([
    source("../app/FinanceApp.tsx"),
    source("../app/globals.css"),
    source("../lib/finance-client.ts"),
    source("../lib/feature-preferences.ts"),
    source("../app/api/finance/feature-preferences/route.ts"),
    source("../db/schema.ts"),
    source("../apps-script/FeaturePreferenceService.gs"),
    source("../apps-script/DashboardService.gs"),
    source("../apps-script/Router.gs"),
  ]);
  assert.match(app, /Fitur aktif/);
  assert.match(app, /Fitur inti selalu aktif/);
  assert.match(app, /isOptionalFeatureEnabled\(featurePreferences/);
  assert.match(app, /Simpan pilihan fitur/);
  assert.match(styles, /\.feature-preference-groups/);
  assert.match(client, /updateFinanceFeaturePreferences/);
  assert.match(client, /\/api\/finance\/feature-preferences/);
  assert.match(preferences, /DEFAULT_FEATURE_PREFERENCES/);
  assert.match(route, /feature_preferences\.update/);
  assert.match(schema, /featurePreferences/);
  assert.match(gas, /apiUpdateFeaturePreferences/);
  assert.match(dashboard, /const settings = rowsAsObjects_\(VINN_CONFIG\.SHEETS\.SETTINGS\)/);
  assert.match(dashboard, /featurePreferences: normalizeFeaturePreferencesGs_\(setting\('feature_preferences'/);
  assert.match(router, /updateFeaturePreferences/);
});

test("tanggal Google Sheets dinormalisasi sebelum ditampilkan dan dihitung", async () => {
  const [client, repository] = await Promise.all([
    source("../lib/finance-client.ts"),
    source("../apps-script/SheetRepository.gs"),
  ]);
  assert.match(client, /function normalizeFinanceDate/);
  assert.match(client, /timeZone: "Asia\/Jakarta"/);
  assert.match(client, /date: normalizeFinanceDate\(row\.date\)/);
  assert.match(repository, /function sheetCellValue_/);
  assert.match(repository, /Utilities\.formatDate\(value, VINN_CONFIG\.TIMEZONE, 'yyyy-MM-dd'\)/);
  assert.match(repository, /result\[String\(header\)\] = sheetCellValue_/);
});
