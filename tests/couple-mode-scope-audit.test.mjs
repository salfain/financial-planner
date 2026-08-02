import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Audit kebocoran Fase 4. Pemeriksaan ini bersifat statis dan sengaja memakai
// daftar izin yang eksplisit: menambah pembacaan tanpa scope atau membuka aksi
// tingkat workspace harus menjadi keputusan sadar, bukan efek samping.

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appsScriptDirectory = join(projectRoot, "apps-script");
const sourceFiles = readdirSync(appsScriptDirectory).filter((file) => file.endsWith(".gs")).sort();
const sourceByFile = new Map(
  sourceFiles.map((file) => [file, readFileSync(join(appsScriptDirectory, file), "utf8")]),
);
const combinedSource = [...sourceByFile.values()].join("\n");
const countOccurrences = (text, needle) => text.split(needle).length - 1;

// Setiap entri wajib punya alasan yang tidak melibatkan pengiriman baris ke klien.
const UNSCOPED_READ_ALLOWLIST = {
  "ScopeService.gs": 2, // membangun indeks scope akun dan pos dana itu sendiri
  "SheetRepository.gs": 3, // definisi pembaca dan pembungkusnya
  "CoreFinanceService.gs": 4, // idempotensi requestId dan cascade nama kategori
  "TransactionService.gs": 2, // deteksi replay requestId
  "DomainService.gs": 2, // deteksi replay requestId
  "SinkingFundService.gs": 2, // deteksi replay requestId
  "RecurringService.gs": 1, // deteksi replay requestId
  "InvestmentService.gs": 3, // deteksi replay requestId
  "MonthlyClosingService.gs": 1, // hitungan transaksi pending seluruh workspace
};

test("pembacaan tanpa scope hanya terjadi pada jalur yang sudah diaudit", () => {
  const actual = {};
  for (const [file, source] of sourceByFile) {
    const count = countOccurrences(source, "rowsAsObjectsUnscoped_(");
    if (count > 0) actual[file] = count;
  }
  assert.deepEqual(
    actual,
    UNSCOPED_READ_ALLOWLIST,
    "Jumlah pembacaan tanpa scope berubah. Tinjau ulang jalur baru sebelum memperbarui daftar izin.",
  );
});

test("sheet yang membawa data anggota disaring oleh ScopeService", () => {
  const scopeSource = sourceByFile.get("ScopeService.gs");
  for (const sheet of ["Goals", "SinkingFunds", "Bills", "Recurring", "Assets", "InvestmentTransactions"]) {
    assert.match(scopeSource, new RegExp(`\\b${sheet}:`), `Sheet ${sheet} tidak terdaftar pada pewarisan scope akun.`);
  }
  for (const sheet of ["AIChat", "NotificationStates"]) {
    assert.match(scopeSource, new RegExp(`\\b${sheet}: 'member_id'`), `Sheet ${sheet} tidak terdaftar sebagai milik anggota.`);
  }
  assert.match(scopeSource, /SHEETS\.ACCOUNTS/, "Penyaringan akun hilang dari ScopeService.");
  assert.match(scopeSource, /SHEETS\.TRANSACTIONS/, "Penyaringan transaksi hilang dari ScopeService.");
  assert.match(scopeSource, /SHEETS\.SINKING_FUND_ENTRIES/, "Penyaringan entri pos dana hilang dari ScopeService.");
});

test("aksi tingkat workspace tetap terkunci untuk pemilik", () => {
  for (const action of [
    "setup", "setupWorkspace", "upgradeWorkspace",
    "updateProfile",
    "activateLicense", "deactivateLicense",
    "backup", "createBackup", "backupOverview", "updateBackupSchedule",
    "migrationHistory", "previewMigration", "applyMigration", "cancelMigration",
    "repairLedger", "closeMonthlyBook", "reopenMonthlyBook", "saveAiKey",
  ]) {
    assert.match(
      sourceByFile.get("Router.gs"),
      new RegExp(`\\b${action}: true`),
      `Aksi ${action} tidak lagi dibatasi untuk pemilik workspace.`,
    );
  }
  assert.match(sourceByFile.get("Router.gs"), /assertActionAllowedForMember_\(action, context\)/);
});

test("hanya health, whoami, dan memberLogin yang terbuka tanpa sesi anggota", () => {
  const publicLine = sourceByFile.get("Router.gs").match(/const publicActions = \{([^}]*)\}/);
  assert.ok(publicLine, "Daftar aksi publik tidak ditemukan.");
  const actions = publicLine[1].split(",").map((part) => part.split(":")[0].trim()).filter(Boolean).sort();
  assert.deepEqual(actions, ["health", "memberLogin", "whoami"]);
});

test("baris tersamar tidak dapat ditulis ulang", () => {
  assert.match(combinedSource, /function assertNotRedactedRow_/);
  assert.match(combinedSource, /assertNotRedactedRow_\(object\)/);
  assert.match(combinedSource, /assertNotRedactedRow_\(entry\.object\)/);
});

test("kunci cache dashboard memuat scope anggota", () => {
  assert.match(sourceByFile.get("Utils.gs"), /const scope = currentScopeMemberId_\(\)/);
});
