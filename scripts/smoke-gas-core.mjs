import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appsScriptDirectory = join(projectRoot, "apps-script");
const sources = readdirSync(appsScriptDirectory)
  .filter((file) => file.endsWith(".gs"))
  .sort()
  .map((file) => readFileSync(join(appsScriptDirectory, file), "utf8"));
const combinedSource = sources.join("\n");
for (const action of [
  "listCategories", "createCategory", "updateCategory", "archiveCategory",
  "importAccounts", "updateProfile", "getRoadmapSettings", "updateRoadmapSettings",
  "updateTransaction", "reconcileAccount", "listAuditLogs",
  "inspectLedger", "repairLedger",
  "createInvestmentAsset", "updateInvestmentAsset", "createInvestmentTrade",
  "aiSettings", "updateAiSettings", "aiHistory", "askAi", "clearAiHistory", "ocrReceipt",
  "createBackup", "backupOverview", "updateBackupSchedule", "listReports", "saveReportPdf",
  "migrationHistory", "previewMigration", "applyMigration", "cancelMigration",
  "notificationOverview", "updateNotificationSettings", "updateNotificationState",
]) {
  assert.match(combinedSource, new RegExp(`\\b${action}\\s*:`), `Router action ${action} is missing`);
}

let uuid = 0;
const properties = new Map();
const userProperties = new Map();
const cache = new Map();
const writes = [];
const driveFiles = new Map();
const driveFolders = new Map();
const triggers = [];
let driveId = 0;
const iterator = (items) => ({
  index: 0,
  hasNext() { return this.index < items.length; },
  next() { return items[this.index++]; },
});
const makeBlob = (value, contentType = "application/octet-stream", name = "blob") => {
  const bytes = Array.isArray(value) ? Buffer.from(value) : Buffer.from(String(value));
  return {
    bytes, contentType, name,
    getDataAsString: () => bytes.toString("utf8"),
  };
};
const makeFile = (name, blob = makeBlob(""), parent = null, forcedId) => {
  const id = forcedId || `drive-${++driveId}`;
  const file = {
    id, name, blob, parent, trashed: false,
    getId: () => id,
    getName: () => name,
    getSize: () => blob.bytes.length,
    getUrl: () => `https://drive.test/${id}`,
    getBlob: () => blob,
    getParents: () => iterator(parent ? [parent] : []),
    setTrashed(value) { file.trashed = value; return file; },
    makeCopy(copyName, folder) { return makeFile(copyName, makeBlob(blob.bytes, blob.contentType, copyName), folder); },
  };
  driveFiles.set(id, file);
  return file;
};
const rootFolder = {
  id: "root", name: "root", folders: [], files: [],
  getFoldersByName(name) { return iterator(this.folders.filter((folder) => folder.name === name)); },
  createFolder(name) {
    const folder = {
      id: `folder-${++driveId}`, name, folders: [], files: [],
      getFoldersByName: rootFolder.getFoldersByName,
      createFolder: rootFolder.createFolder,
      createFile(blob) { const file = makeFile(blob.name, blob, folder); folder.files.push(file); return file; },
    };
    this.folders.push(folder); driveFolders.set(folder.id, folder); return folder;
  },
  createFile(blob) { const file = makeFile(blob.name, blob, this); this.files.push(file); return file; },
};
makeFile("Financial Planner", makeBlob("spreadsheet", "application/vnd.google-apps.spreadsheet"), rootFolder, "workbook-id");
const sheetNames = [
  "Settings", "Accounts", "Categories", "Transactions", "Budgets", "Goals",
  "Bills", "Assets", "InvestmentTransactions", "AuditLog", "Trash",
  "AIChat",
  "NotificationStates",
];
const sheets = Object.fromEntries(sheetNames.map((name) => [name, []]));
const context = vm.createContext({
  sheets, writes,
  console: { log: console.log, error: () => {} },
  Utilities: {
    getUuid: () => `uuid-${++uuid}`,
    formatDate(value, _timezone, format) {
      const iso = new Date(value).toISOString();
      if (format === "yyyy-MM") return iso.slice(0, 7);
      if (format === "yyyy-MM-dd") return iso.slice(0, 10);
      return iso;
    },
    base64Decode: (value) => [...Buffer.from(value, "base64")],
    newBlob: (value, contentType, name) => makeBlob(value, contentType, name),
    DigestAlgorithm: { SHA_256: "SHA_256" },
    Charset: { UTF_8: "UTF_8" },
    computeDigest: (_algorithm, value) => [...createHash("sha256").update(String(value), "utf8").digest()],
  },
  DriveApp: {
    getFileById: (id) => {
      const file = driveFiles.get(id);
      if (!file) throw new Error(`Drive file ${id} not found`);
      return file;
    },
    getRootFolder: () => rootFolder,
  },
  ScriptApp: {
    getProjectTriggers: () => [...triggers],
    deleteTrigger: (trigger) => { const index = triggers.indexOf(trigger); if (index >= 0) triggers.splice(index, 1); },
    newTrigger: (handler) => ({
      timeBased() { return this; }, everyDays() { return this; }, atHour() { return this; },
      create() { const trigger = { getHandlerFunction: () => handler }; triggers.push(trigger); return trigger; },
    }),
  },
  PropertiesService: {
    getDocumentProperties: () => ({
      getProperty: (key) => properties.get(key) ?? null,
      setProperty: (key, value) => properties.set(key, value),
    }),
    getUserProperties: () => ({
      getProperty: (key) => userProperties.get(key) ?? null,
      setProperty: (key, value) => userProperties.set(key, value),
      deleteProperty: (key) => userProperties.delete(key),
    }),
  },
  UrlFetchApp: {
    fetch: (_url, options) => {
      const payload = JSON.parse(options.payload);
      const isOcr = JSON.stringify(payload).includes("inlineData");
      const text = isOcr
        ? JSON.stringify({
            merchant: "VINN Mart", date: "2026-07-18", total: 125000,
            tax: 12500, serviceFee: 0, paymentMethod: "QRIS",
            suggestedCategory: "Makanan", notes: "", items: [{ name: "Kopi", quantity: 1, amount: 125000 }],
            confidence: 0.94, imageQuality: "clear", warnings: [],
          })
        : "Fakta: Arus kas bulan 2026-07 positif.\nPerhitungan: berdasarkan ringkasan terpilih.\nSaran umum: pertahankan anggaran.";
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
      };
    },
  },
  CacheService: {
    getDocumentCache: () => ({
      get: (key) => cache.get(key) ?? null,
      put: (key, value) => cache.set(key, value),
      remove: (key) => cache.delete(key),
    }),
  },
  Session: { getActiveUser: () => ({ getEmail: () => "owner@test" }) },
});

new vm.Script(combinedSource, { filename: "apps-script/combined.gs" }).runInContext(context);
vm.runInContext(`
  rowsAsObjects_ = function(name) {
    return (sheets[name] || []).map(function(row, index) {
      return Object.assign({ _row: index + 2 }, row);
    });
  };
  appendObjects_ = function(name, objects) {
    if (!sheets[name]) sheets[name] = [];
    objects.forEach(function(row) { sheets[name].push(Object.assign({}, row)); });
  };
  findById_ = function(name, id) {
    return rowsAsObjects_(name).find(function(row) { return String(row.id) === String(id); }) || null;
  };
  updateObjectRow_ = function(name, rowNumber, object) {
    sheets[name][rowNumber - 2] = Object.assign({}, object);
  };
  withDocumentLock_ = function(callback) { return callback(); };
  mockSheet_ = function(name) {
    return {
      getLastRow: function() { return (sheets[name] || []).length + 1; },
      getRange: function(row, column, rowCount) {
        return {
          setValues: function(values) {
            writes.push({ sheet: name, row: row, count: values.length });
            const headers = VINN_CONFIG.HEADERS[name];
            values.forEach(function(valuesRow, offset) {
              const object = {};
              valuesRow.forEach(function(value, index) { object[headers[column - 1 + index]] = value; });
              const dataIndex = row - 2 + offset;
              if (dataIndex >= sheets[name].length) sheets[name].push(object);
              else sheets[name][dataIndex] = Object.assign({}, sheets[name][dataIndex], object);
            });
          },
          clearContent: function() {
            if (row >= 2) sheets[name].splice(row - 2, rowCount || sheets[name].length);
          }
        };
      }
    };
  };
  getWorkbook_ = function() { return { getId: function() { return "workbook-id"; }, getSheetByName: function(name) { return mockSheet_(name); } }; };
  ensureSheet_ = function(name) { if (!sheets[name]) sheets[name] = []; return mockSheet_(name); };
`, context);

const invoke = (expression) => vm.runInContext(expression, context);
const add = (sheet, row) => sheets[sheet].push({ ...row });
const transactionBase = {
  transfer_group_id: "", destination_account_id: "", category: "", merchant: "",
  notes: "", status: "completed", direction: "", created_at: "2026-07-18T00:00:00Z",
  updated_at: "2026-07-18T00:00:00Z", deleted_at: "",
};

for (const [id, liability] of [
  ["asset-up", false], ["asset-down", false], ["debt-up", true],
  ["debt-down", true], ["source", false], ["destination", false], ["recovery", false],
]) {
  add("Accounts", { id, name: id, opening_balance: 1000, is_liability: liability, is_active: true });
}
add("Accounts", { id: "inv-cash", name: "Kas Investasi", type: "Bank", opening_balance: 100000, is_liability: false, is_active: true });
add("Accounts", { id: "inv-book", name: "Portofolio", type: "Investment", opening_balance: 0, is_liability: false, is_active: true });
const accountCountBeforeImport = sheets.Accounts.length;
let result = invoke(`apiImportAccounts({ requestId: "account-import-1", accounts: [{ id: "imported-bank", name: "Rekening Cabang", type: "Bank", institution: "BCA", openingBalance: 250000, mask: "7788", color: "#126b59" }, { id: "imported-card", name: "Kartu Operasional", type: "Credit Card", openingBalance: 500000, color: "#c76565" }] })`);
assert.equal(result.ok, true);
assert.equal(result.data.imported, 2);
assert.equal(sheets.Accounts.find((account) => account.id === "imported-card").is_liability, true);
assert.equal(sheets.Accounts.find((account) => account.id === "imported-bank").opening_balance, 250000);
result = invoke(`apiImportAccounts({ requestId: "account-import-1", accounts: [{ name: "Tidak Disimpan", type: "Cash" }] })`);
assert.equal(result.ok, true);
assert.equal(result.data.duplicate, true);
assert.equal(sheets.Accounts.length, accountCountBeforeImport + 2);
result = invoke(`apiImportAccounts({ requestId: "account-import-duplicate", accounts: [{ name: "rekening cabang", type: "Cash" }] })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "DUPLICATE_ACCOUNT_NAME");
assert.equal(sheets.Accounts.length, accountCountBeforeImport + 2);
result = invoke(`apiUpdateProfile({ requestId: "profile-update-1", name: "Pemilik Baru" })`);
assert.equal(result.ok, true);
assert.equal(result.data.profileName, "Pemilik Baru");
assert.equal(sheets.Settings.find((setting) => setting.key === "profile_name").value, "Pemilik Baru");
result = invoke(`apiUpdateProfile({ requestId: "profile-update-1", name: "Tidak Ditulis Ulang" })`);
assert.equal(result.ok, true);
assert.equal(result.data.duplicate, true);
assert.equal(result.data.profileName, "Pemilik Baru");
assert.equal(sheets.Settings.find((setting) => setting.key === "profile_name").value, "Pemilik Baru");
result = invoke(`apiUpdateRoadmapSettings({ requestId: "roadmap-update-1", horizonMonths: 36, incomeAdjustmentPct: 8, expenseAdjustmentPct: -4, annualInvestmentReturnPct: 7, annualInflationPct: 3, monthlyInvestment: 1500000 })`);
assert.equal(result.ok, true);
assert.equal(result.data.horizonMonths, 36);
assert.equal(result.data.monthlyInvestment, 1500000);
result = invoke(`apiUpdateRoadmapSettings({ requestId: "roadmap-update-1", horizonMonths: 12, incomeAdjustmentPct: 0, expenseAdjustmentPct: 0, annualInvestmentReturnPct: 0, annualInflationPct: 0, monthlyInvestment: 0 })`);
assert.equal(result.ok, true);
assert.equal(result.data.horizonMonths, 36);
assert.equal(JSON.parse(sheets.Settings.find((setting) => setting.key === "roadmap_settings").value).incomeAdjustmentPct, 8);
add("Categories", {
  id: "cat-food", name: "Makanan", type: "expense", parent_id: "", color: "#16876f",
  icon: "tag", is_active: true, is_default: true, request_id: "",
});

result = invoke(`apiCreateCategory({ requestId: "cat-create", name: "Hobi", type: "expense", color: "#112233", icon: "sparkles" })`);
assert.equal(result.ok, true);
assert.equal(result.data.duplicate, false);
result = invoke(`apiCreateCategory({ requestId: "cat-create", name: "Hobi", type: "expense", color: "#112233", icon: "sparkles" })`);
assert.equal(result.data.duplicate, true);
assert.equal(sheets.Categories.filter((category) => category.name === "Hobi").length, 1);
result = invoke(`apiCreateCategory({ requestId: "cat-duplicate-name", name: "  hObI  ", type: "income", color: "#112233", icon: "wallet" })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "CATEGORY_EXISTS");

result = invoke(`apiArchiveCategory({ requestId: "archive-default", categoryId: "cat-food" })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "DEFAULT_CATEGORY");

const customCategory = sheets.Categories.find((category) => category.name === "Hobi");
add("Transactions", {
  ...transactionBase, id: "category-reference", request_id: "category-reference",
  date: "2026-07-01", type: "expense", account_id: "source", amount: 50, category: "Hobi",
});
add("Budgets", { id: "budget-reference", month: "2026-07", category: "Hobi", limit_amount: 500, updated_at: "" });
add("Bills", { id: "bill-reference", category: "Hobi", account_id: "source", updated_at: "" });
result = invoke(`apiUpdateCategory({ requestId: "cat-update", categoryId: "${customCategory.id}", name: "Hiburan Baru", type: "expense", color: "#112233", icon: "sparkles" })`);
assert.equal(result.ok, true);
assert.equal(sheets.Transactions.find((row) => row.id === "category-reference").category, "Hiburan Baru");
assert.equal(sheets.Budgets[0].category, "Hiburan Baru");
assert.equal(sheets.Bills[0].category, "Hiburan Baru");

add("Transactions", {
  ...transactionBase, id: "transfer-out", transfer_group_id: "transfer-group",
  request_id: "transfer-create", date: "2026-07-02", type: "transfer", account_id: "source",
  destination_account_id: "destination", amount: 100, category: "Transfer", direction: "out",
});
add("Transactions", {
  ...transactionBase, id: "transfer-in", transfer_group_id: "transfer-group",
  request_id: "transfer-create", date: "2026-07-02", type: "transfer", account_id: "destination",
  destination_account_id: "source", amount: 100, category: "Transfer", direction: "in",
});
result = invoke(`apiUpdateTransaction({ requestId: "transfer-update", transactionId: "transfer-out", type: "transfer", accountId: "source", destinationAccountId: "destination", amount: 275, date: "2026-07-03", title: "Transfer diperbarui", status: "completed" })`);
assert.equal(result.ok, true);
assert.equal(result.data.updated, 2);
assert.equal(result.data.transaction.updatedAt, sheets.Transactions.find((row) => row.id === "transfer-out").updated_at);
assert.equal(sheets.Transactions.find((row) => row.id === "transfer-out").amount, 275);
assert.equal(sheets.Transactions.find((row) => row.id === "transfer-in").amount, 275);
assert.equal(writes.filter((write) => write.sheet === "Transactions" && write.count === 2).length, 1);
result = invoke(`apiUpdateTransaction({ requestId: "transfer-update", transactionId: "transfer-out", amount: 999 })`);
assert.equal(result.data.duplicate, true);
assert.equal(sheets.Transactions.find((row) => row.id === "transfer-out").amount, 275);
const pairAuditCount = sheets.AuditLog.length;
result = invoke(`apiUpdateTransaction({ requestId: "transfer-overdraw", transactionId: "transfer-out", amount: 2000 })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "INSUFFICIENT_BALANCE");
assert.equal(sheets.Transactions.find((row) => row.id === "transfer-out").amount, 275);
assert.equal(sheets.Transactions.find((row) => row.id === "transfer-in").amount, 275);
assert.equal(sheets.AuditLog.length, pairAuditCount);
result = invoke(`apiUpdateTransaction({ requestId: "transfer-stale", transactionId: "transfer-out", amount: 300, expectedUpdatedAt: "stale-version" })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "STALE_TRANSACTION");
assert.equal(sheets.Transactions.find((row) => row.id === "transfer-out").amount, 275);

const beforeRejectedCreate = sheets.Transactions.length;
result = invoke(`apiCreateTransaction({ requestId: "expense-overdraw", type: "expense", date: "2026-07-18", accountId: "asset-down", amount: 2000, category: "Hiburan Baru" })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "INSUFFICIENT_BALANCE");
assert.equal(sheets.Transactions.length, beforeRejectedCreate);

for (const [accountId, target, adjustmentType] of [
  ["asset-up", 1200, "adjustment_in"], ["asset-down", 800, "adjustment_out"],
  ["debt-up", 1200, "adjustment_out"], ["debt-down", 800, "adjustment_in"],
]) {
  result = invoke(`apiReconcileAccount({ requestId: "reconcile-${accountId}", accountId: "${accountId}", actualBalance: ${target}, date: "2026-07-18", notes: "saldo fisik" })`);
  assert.equal(result.ok, true);
  assert.equal(result.data.adjustmentType, adjustmentType);
  assert.equal(sheets.Transactions.find((row) => row.id === result.data.transactionId).category, "Penyesuaian Saldo");
  assert.equal(invoke(`accountCurrentBalance_(findById_("Accounts", "${accountId}"), rowsAsObjects_("Transactions"))`), target);
  const transactionCount = sheets.Transactions.length;
  result = invoke(`apiReconcileAccount({ requestId: "reconcile-${accountId}", accountId: "${accountId}", actualBalance: ${target} })`);
  assert.equal(result.data.duplicate, true);
  assert.equal(sheets.Transactions.length, transactionCount);
}

result = invoke(`apiReconcileAccount({ requestId: "reconcile-negative", accountId: "asset-up", actualBalance: -1 })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "INVALID_BALANCE");

result = invoke(`apiCreateInvestmentAsset({ requestId: "asset-create", accountId: "inv-book", ticker: "BBCA", name: "Bank Central Asia", assetClass: "Saham", exchange: "IDX", currency: "IDR", manualPrice: 1500 })`);
assert.equal(result.ok, true);
assert.equal(result.data.duplicate, false);
const investmentAssetId = result.data.asset.id;
result = invoke(`apiCreateInvestmentAsset({ requestId: "asset-create", accountId: "inv-book", ticker: "REPLAY", name: "Replay", assetClass: "Saham" })`);
assert.equal(result.data.duplicate, true);
assert.equal(sheets.Assets.length, 1);

result = invoke(`apiCreateInvestmentTrade({ requestId: "investment-buy-1", type: "buy", assetId: "${investmentAssetId}", accountId: "inv-cash", date: "2026-07-18", units: 10, pricePerUnit: 1000, fee: 100, tax: 0 })`);
assert.equal(result.ok, true);
assert.equal(result.data.transaction.remainingUnitsAfter, 10);
assert.equal(result.data.transaction.averageCostAfter, 1010);
result = invoke(`apiCreateInvestmentTrade({ requestId: "investment-buy-2", type: "buy", assetId: "${investmentAssetId}", accountId: "inv-cash", date: "2026-07-18", units: 5, pricePerUnit: 1300, fee: 100, tax: 50 })`);
assert.equal(result.ok, true);
assert.equal(result.data.transaction.remainingUnitsAfter, 15);
assert.equal(result.data.transaction.averageCostAfter, 1117);
const tradeCountBeforeReplay = sheets.InvestmentTransactions.length;
result = invoke(`apiCreateInvestmentTrade({ requestId: "investment-buy-2", type: "buy", assetId: "${investmentAssetId}", accountId: "inv-cash", date: "2026-07-18", units: 99, pricePerUnit: 1 })`);
assert.equal(result.data.duplicate, true);
assert.equal(sheets.InvestmentTransactions.length, tradeCountBeforeReplay);

result = invoke(`apiCreateInvestmentTrade({ requestId: "investment-sell-1", type: "sell", assetId: "${investmentAssetId}", accountId: "inv-cash", date: "2026-07-18", units: 6, pricePerUnit: 1500, fee: 100, tax: 50 })`);
assert.equal(result.ok, true);
assert.equal(result.data.transaction.remainingUnitsAfter, 9);
assert.equal(result.data.transaction.realizedPl, 2150);
assert.equal(invoke(`investmentPosition_("${investmentAssetId}").costBasis`), 10050);
assert.equal(invoke(`accountCurrentBalance_(findById_("Accounts", "inv-book"), rowsAsObjects_("Transactions"))`), 10050);
assert.equal(invoke(`accountCurrentBalance_(findById_("Accounts", "inv-cash"), rowsAsObjects_("Transactions"))`), 92100);
const investmentRowsBeforeOversell = sheets.InvestmentTransactions.length;
result = invoke(`apiCreateInvestmentTrade({ requestId: "investment-oversell", type: "sell", assetId: "${investmentAssetId}", accountId: "inv-cash", date: "2026-07-18", units: 10, pricePerUnit: 1500 })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "INSUFFICIENT_UNITS");
assert.equal(sheets.InvestmentTransactions.length, investmentRowsBeforeOversell);

add("Transactions", {
  ...transactionBase, id: "partial-adjustment", request_id: "reconcile-recovery",
  date: "2026-07-18", type: "adjustment_in", account_id: "recovery", amount: 100,
  category: "Penyesuaian Saldo", direction: "in",
});
result = invoke(`apiReconcileAccount({ requestId: "reconcile-recovery", accountId: "recovery", actualBalance: 1100 })`);
assert.equal(result.ok, true);
assert.equal(result.data.duplicate, true);
assert.equal(result.data.previousBalance, 1000);
assert.equal(result.data.actualBalance, 1100);
assert.equal(sheets.AuditLog.filter((row) => row.request_id === "reconcile-recovery").length, 1);

const beforeRejectedTransfer = sheets.Transactions.length;
result = invoke(`apiCreateTransaction({ requestId: "debt-overpayment", type: "transfer", date: "2026-07-18", accountId: "asset-up", destinationAccountId: "debt-down", amount: 900, category: "Transfer" })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "INSUFFICIENT_BALANCE");
assert.equal(sheets.Transactions.length, beforeRejectedTransfer);

result = invoke(`apiInspectLedger()`);
assert.equal(result.ok, true);
assert.equal(result.data.status, "healthy");
assert.equal(result.data.storageMode, "calculated");
assert.equal(result.data.summary.issueCount, 0);
context.ledgerRevision = result.data.revision;
result = invoke(`apiRepairLedger({ requestId: "ledger-recalculate-1", expectedRevision: ledgerRevision })`);
assert.equal(result.ok, true);
assert.equal(result.data.repairedAccounts, 0);
assert.equal(sheets.AuditLog.filter((row) => row.request_id === "ledger-recalculate-1").length, 1);
result = invoke(`apiRepairLedger({ requestId: "ledger-recalculate-1", expectedRevision: "stale" })`);
assert.equal(result.ok, true);
assert.equal(result.data.replayed, true);

result = invoke(`apiGetBootstrap("2026-07")`);
assert.equal(result.ok, true);
assert.equal(result.data.summary.income, 0);
assert.equal(result.data.summary.expense, 50);
assert.equal(result.data.categories.length, 2);
assert.ok(result.data.auditLogs.length >= 7);
assert.equal(result.data.investmentAssets.length, 1);
assert.equal(result.data.investmentTransactions.length, 3);
assert.equal(result.data.investmentAssets[0].units, 9);
for (const [accountId, target] of [["asset-up", 1200], ["asset-down", 800], ["debt-up", 1200], ["debt-down", 800]]) {
  assert.equal(result.data.accounts.find((account) => account.id === accountId).current_balance, target);
}

result = invoke(`apiAiSettings()`);
assert.equal(result.ok, true);
assert.equal(result.data.configured, false);
result = invoke(`apiUpdateAiSettings({ enabled: true, consentAccepted: true })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "AI_NOT_CONFIGURED");
result = invoke(`apiUpdateAiSettings({ enabled: true, consentAccepted: true, apiKey: "test-gemini-key-1234567890" })`);
assert.equal(result.ok, true);
assert.equal(result.data.configured, true);
assert.equal(result.data.enabled, true);
assert.equal(JSON.stringify(result.data).includes("test-gemini-key"), false);

result = invoke(`apiAskAi({ requestId: "ai-ask-1", question: "Mengapa saldo saya turun?", period: "2026-07" })`);
assert.equal(result.ok, true);
assert.equal(result.data.message.role, "assistant");
assert.equal(result.data.contextUsed.includes("Saldo akun terpilih"), true);
assert.equal(sheets.AIChat.length, 2);
result = invoke(`apiAiHistory()`);
assert.equal(result.ok, true);
assert.equal(result.data.messages.length, 2);

result = invoke(`apiOcrReceipt({ requestId: "ocr-1", mimeType: "image/jpeg", imageBase64: "YWJj" })`);
assert.equal(result.ok, true);
assert.equal(result.data.receipt.merchant, "VINN Mart");
assert.equal(result.data.receipt.total, 125000);
assert.equal(result.data.imageStored, false);
assert.equal(sheets.Transactions.some((row) => row.request_id === "ocr-1"), false);

result = invoke(`apiClearAiHistory()`);
assert.equal(result.ok, true);
assert.equal(sheets.AIChat.length, 0);

result = invoke(`apiListAuditLogs({ page: 1, pageSize: 100, module: "accounts" })`);
assert.equal(result.ok, true);
assert.equal(result.data.total, 6);

const transferVersion = sheets.Transactions.find((row) => row.id === "transfer-out").updated_at;
const transactionWritesBeforeDelete = writes.filter((write) => write.sheet === "Transactions").length;
result = invoke(`apiDeleteTransaction("transfer-out", "transfer-delete-stale", "stale-version")`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "STALE_TRANSACTION");
assert.equal(sheets.Transactions.filter((row) => row.transfer_group_id === "transfer-group" && row.deleted_at).length, 0);
result = invoke(`apiDeleteTransaction("transfer-out", "transfer-delete", "${transferVersion}")`);
assert.equal(result.ok, true);
assert.equal(result.data.deleted, 2);
assert.equal(sheets.Transactions.filter((row) => row.transfer_group_id === "transfer-group" && row.deleted_at).length, 2);
assert.equal(writes.filter((write) => write.sheet === "Transactions").length, transactionWritesBeforeDelete + 1);
assert.equal(writes.filter((write) => write.sheet === "Transactions").at(-1).count, 2);
const trashCount = sheets.Trash.length;
result = invoke(`apiDeleteTransaction("transfer-out", "transfer-delete", "${transferVersion}")`);
assert.equal(result.data.duplicate, true);
assert.equal(sheets.Trash.length, trashCount);

add("Categories", {
  id: "custom-transport", name: "Transportasi", type: "expense", parent_id: "",
  color: "#123456", icon: "car", is_active: true, is_default: false, request_id: "custom-seed",
});
sheets.Categories.find((category) => category.id === "cat-food").is_active = false;
result = invoke(`setupVinnStore()`);
assert.equal(result.ok, true);
const categoryCountAfterMigration = sheets.Categories.length;
assert.equal(sheets.Categories.filter((category) => category.is_default === true).length, 8);
assert.equal(sheets.Categories.some((category) => category.id === "cat-transport"), false);
assert.equal(sheets.Categories.find((category) => category.id === "custom-transport").is_default, true);
assert.equal(sheets.Categories.find((category) => category.id === "cat-food").is_active, true);
result = invoke(`setupVinnStore()`);
assert.equal(result.ok, true);
assert.equal(sheets.Categories.length, categoryCountAfterMigration);

result = invoke(`apiUpdateBackupSchedule({ enabled: true, frequency: "weekly" })`);
assert.equal(result.ok, true);
assert.equal(result.data.schedule.enabled, true);
assert.equal(triggers.length, 1);
result = invoke(`apiCreateBackup("manual")`);
assert.equal(result.ok, true);
assert.equal(result.data.kind, "backup");
assert.match(result.data.downloadUrl, /^https:\/\/drive\.test\//);
result = invoke(`apiBackupOverview()`);
assert.equal(result.ok, true);
assert.equal(result.data.backups.length >= 1, true);

add("Bills", { id: "bill-reminder", name: "Internet", amount: 350000, category: "Tagihan", account_id: "source", frequency: "monthly", due_date: "2026-07-18", reminder_days: "7,3,1,0", status: "active", last_paid_period: "" });
result = invoke(`apiNotificationOverview({ period: "2026-07" })`);
assert.equal(result.ok, true);
assert.equal(result.data.notifications.some((item) => item.id === "bill:bill-reminder:2026-07"), true);
assert.equal(result.data.unreadCount > 0, true);
result = invoke(`apiUpdateNotificationState({ notificationIds: ["bill:bill-reminder:2026-07"], action: "read" })`);
assert.equal(result.ok, true);
result = invoke(`apiNotificationOverview({ period: "2026-07" })`);
assert.equal(result.data.notifications.find((item) => item.id === "bill:bill-reminder:2026-07").read, true);
result = invoke(`apiUpdateNotificationState({ notificationIds: ["bill:bill-reminder:2026-07"], action: "dismiss" })`);
assert.equal(result.ok, true);
result = invoke(`apiNotificationOverview({ period: "2026-07" })`);
assert.equal(result.data.notifications.some((item) => item.id === "bill:bill-reminder:2026-07"), false);
result = invoke(`apiUpdateNotificationSettings({ enabled: true, billReminderDays: [3, 1, 0], budgetWarningPercent: 90, backupWarningDays: 14, goalWarningDays: 7 })`);
assert.equal(result.ok, true);
assert.deepEqual([...result.data.settings.billReminderDays], [3, 1, 0]);

const samplePdf = Buffer.from("%PDF-1.4\nsample").toString("base64");
result = invoke(`apiSaveReportPdf({ requestId: "report-1", contentBase64: "${samplePdf}", filename: "Financial-Planner_Laporan_2026-07.pdf", period: "2026-07", sections: ["summary"], privacy: false, pageCount: 1 })`);
assert.equal(result.ok, true);
assert.equal(result.data.kind, "report");
result = invoke(`apiListReports()`);
assert.equal(result.ok, true);
assert.equal(result.data.reports.length, 1);

context.migrationSource = {
  format: "vinn-store-backup",
  schemaVersion: "1.4.0",
  profile: { name: "Vinn", storeName: "Financial Planner", currency: "IDR", timezone: "Asia/Jakarta" },
  data: {
    accounts: [{ id: "legacy-cash", name: "Kas Lama", type: "Cash", openingBalance: 250000, balance: 250000, active: true }],
    categories: [], transactions: [], budgets: [], goals: [], bills: [],
    investmentAssets: [], investmentPositions: [], investmentTransactions: [],
  },
};
result = invoke(`apiPreviewMigration({ requestId: "migration-preview-1", sourceName: "legacy.json", backup: migrationSource })`);
assert.equal(result.ok, true);
assert.equal(result.data.canApply, true);
assert.equal(result.data.balanceDifference, 0);
const migrationId = result.data.id;
result = invoke(`apiApplyMigration({ requestId: "migration-apply-1", migrationId: "${migrationId}" })`);
assert.equal(result.ok, true);
assert.equal(result.data.status, "applied");
assert.equal(sheets.Accounts.some((account) => account.name === "Kas Lama"), true);
assert.match(result.data.reportDownloadUrl, /^https:\/\/drive\.test\//);

console.log(`GAS core smoke passed: ${sources.length} files, ${sheets.Transactions.length} transactions, ${sheets.AuditLog.length} audit rows.`);
