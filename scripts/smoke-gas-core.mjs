import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
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
  "mutationStatus",
  "listCategories", "createCategory", "updateCategory", "archiveCategory",
  "importAccounts", "updateAccount", "updateProfile", "getRoadmapSettings", "updateRoadmapSettings",
  "updateBudget", "deleteBudget", "updateGoal", "deleteGoal", "contributeGoal", "updateBill", "deleteBill",
  "updateTransaction", "reconcileAccount", "listAuditLogs",
  "inspectLedger", "repairLedger",
  "createInvestmentAsset", "updateInvestmentAsset", "createInvestmentTrade",
  "aiSettings", "updateAiSettings", "aiHistory", "askAi", "clearAiHistory", "ocrReceipt",
  "createBackup", "backupOverview", "updateBackupSchedule", "listReports", "saveReportPdf",
  "migrationHistory", "previewMigration", "applyMigration", "cancelMigration",
  "notificationOverview", "updateNotificationSettings", "updateNotificationState",
  "listRecurring", "createRecurring", "updateRecurring", "confirmRecurring",
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
  "Bills", "Recurring", "Assets", "InvestmentTransactions", "AuditLog", "Trash",
  "AIChat",
  "NotificationStates",
  "Members", "MemberSessions", "MemberLoginAttempts",
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
    base64DecodeWebSafe: (value) => [...Buffer.from(value, "base64url")],
    base64EncodeWebSafe: (value) => Buffer.from(value).toString("base64url"),
    newBlob: (value, contentType, name) => makeBlob(value, contentType, name),
    DigestAlgorithm: { SHA_256: "SHA_256" },
    Charset: { UTF_8: "UTF_8" },
    computeDigest: (_algorithm, value) => [...createHash("sha256").update(String(value), "utf8").digest()],
    computeHmacSha256Signature: (value, key) => [...createHmac("sha256", String(key)).update(String(value), "utf8").digest()],
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
    getScriptId: () => "script-id",
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
      deleteProperty: (key) => properties.delete(key),
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
      assert.match(_url, /\/chat\/completions$/);
      assert.match(options.headers.Authorization, /^Bearer /);
      const isOcr = JSON.stringify(payload).includes("image_url");
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
        getContentText: () => JSON.stringify({ choices: [{ message: { content: text } }] }),
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
  Session: {
    getActiveUser: () => ({ getEmail: () => "" }),
    getEffectiveUser: () => ({ getEmail: () => "owner@test" }),
  },
});

new vm.Script(combinedSource, { filename: "apps-script/combined.gs" }).runInContext(context);
const gasLicenseTestSignature = "OmpvKf8hW7zw7hWD1Sd0U-MpSQAy8Ei0Z6KL7QWKCGxgamaqGDsf3Lm-0L2TOVNG2uwdQcHlNPSmRCMvnTTX7ioku4zmmaWxSiE6FA6o3TopX08Mhi3NU1uf2whBfo32Zb4Dp2maOx68Ok4cWamnvjhoqONk4i5sJaGvabqYuusgJXWuTy_9IBM8J89slkSZWnDFQLkqOwoHQBaaEubMuBIIN_VN7MCaA1GmFyBp-25BLDdBVQncT87n04IK0rZmjFljsGDviuIbamA_LMgIb4e10rptQ1NBP2JeV_rQaBSJ1I4qjBmppTLk-nMVlWuPRfRQKCctTZjkrrgoU67Jfw";
context.gasLicenseTestSignature = gasLicenseTestSignature;
assert.equal(vm.runInContext(`rsaSha256Valid_("financial-planner-license-test-vector", gasLicenseTestSignature)`, context), true);
assert.equal(vm.runInContext(`rsaSha256Valid_("financial-planner-license-test-vector-tampered", gasLicenseTestSignature)`, context), false);
vm.runInContext(`
  rowsAsObjectsUnscoped_ = function(name) {
    return (sheets[name] || []).map(function(row, index) {
      return Object.assign({ _row: index + 2 }, row);
    });
  };
  appendObjects_ = function(name, objects) {
    if (!sheets[name]) sheets[name] = [];
    objects.forEach(function(row) { sheets[name].push(Object.assign({}, stampMemberAttribution_(name, row))); });
    if (name === VINN_CONFIG.SHEETS.ACCOUNTS) invalidateAccountScopeIndex_();
  };
  findByIdUnscoped_ = function(name, id) {
    return rowsAsObjectsUnscoped_(name).find(function(row) { return String(row.id) === String(id); }) || null;
  };
  updateObjectRow_ = function(name, rowNumber, object) {
    assertNotRedactedRow_(object);
    sheets[name][rowNumber - 2] = Object.assign({}, object);
    if (name === VINN_CONFIG.SHEETS.ACCOUNTS) invalidateAccountScopeIndex_();
  };
  deleteObjectRow_ = function(name, rowNumber) {
    sheets[name].splice(rowNumber - 2, 1);
    if (name === VINN_CONFIG.SHEETS.ACCOUNTS) invalidateAccountScopeIndex_();
  };
  withDocumentLock_ = function(callback) { return callback(); };
  mockSheet_ = function(name) {
    return {
      getLastRow: function() { return (sheets[name] || []).length + 1; },
      getLastColumn: function() { return (VINN_CONFIG.HEADERS[name] || []).length; },
      deleteRow: function(rowNumber) { sheets[name].splice(rowNumber - 2, 1); },
      getRange: function(row, column, rowCount, columnCount) {
        return {
          getValues: function() {
            const headers = VINN_CONFIG.HEADERS[name] || [];
            return Array.from({ length: rowCount || 1 }, function(_, offset) {
              const sourceRow = row + offset;
              if (sourceRow === 1) return headers.slice(column - 1, column - 1 + (columnCount || headers.length));
              const record = sheets[name][sourceRow - 2] || {};
              return headers.slice(column - 1, column - 1 + (columnCount || headers.length)).map(function(header) { return record[header] === undefined ? '' : record[header]; });
            });
          },
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

// Simulasi paket pelanggan dimulai dari penyimpanan kosong, bukan dari fixture penjual.
let result = invoke(`setupFinancialPlanner()`);
assert.equal(result.ok, true);
assert.equal(sheets.Accounts.length, 0);
assert.equal(sheets.Transactions.length, 0);
assert.equal(sheets.Bills.length, 0);
assert.equal(sheets.Goals.length, 0);
assert.equal(sheets.Categories.filter((category) => category.is_default === true).length, 8);

result = invoke(`apiSetupWorkspace({ requestId: "customer-setup-1", profileName: "Pelanggan Uji", storeName: "Financial Planner Pelanggan", currency: "IDR", timezone: "Asia/Jakarta", accounts: [{ name: "Rekening Pelanggan", type: "Bank", institution: "Bank Uji", openingBalance: 1250000, color: "#126b59" }] })`);
assert.equal(result.ok, true);
assert.equal(result.data.configured, true);
assert.equal(sheets.Accounts.length, 1);
assert.equal(sheets.Accounts[0].name, "Rekening Pelanggan");
assert.equal(sheets.Transactions.length, 0);
assert.equal(sheets.Bills.length, 0);
assert.equal(JSON.stringify(sheets).includes("VINN STORE"), false);

vm.runInContext(`
  originalVerifyLicenseTokenForCustomerTest_ = verifyLicenseToken_;
  verifyLicenseToken_ = function() {
    return { product: 'financial-planner', version: 1, licenseId: 'lic-customer-test', tier: 'premium', installationId: licenseInstallationId_(), issuedAt: '2026-07-20T00:00:00.000Z', expiresAt: null };
  };
`, context);
result = invoke(`apiActivateLicense({ requestId: "customer-license-1", token: "FP1.customer-test.signature" })`);
assert.equal(result.ok, true);
assert.equal(result.data.tier, "premium");
assert.equal(result.data.capabilities.planning, true);
assert.equal(result.data.capabilities.investments, true);
assert.equal(result.data.capabilities.couple_mode, true);

result = invoke(`enableCoupleMode()`);
assert.equal(result.ok, true);
assert.equal(result.data.enabled, true);
assert.match(result.data.temporaryPin, /^\d{6}$/);
assert.equal(sheets.Members.length, 1);
assert.equal(sheets.Members[0].role, "owner");
const coupleOwnerId = result.data.owner.id;
const coupleOwnerPin = result.data.temporaryPin;
result = invoke(`api("bootstrap", {})`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "AUTH_REQUIRED");
result = invoke(`api("health", {})`);
assert.equal(result.ok, true);
assert.equal(result.data.coupleMode.enabled, true);
result = invoke(`api("whoami", {})`);
assert.equal(result.ok, true);
assert.equal(result.data.authenticated, false);
context.coupleOwnerId = coupleOwnerId;
context.coupleOwnerPin = coupleOwnerPin;
result = invoke(`api("memberLogin", { memberId: coupleOwnerId, pin: coupleOwnerPin, requestId: "member-login-valid" })`);
assert.equal(result.ok, true);
assert.equal(result.data.authenticated, true);
assert.match(result.data.sessionToken, /^[A-Za-z0-9_-]+$/);
context.coupleSessionToken = result.data.sessionToken;
result = invoke(`api("bootstrap", { sessionToken: coupleSessionToken })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "PIN_CHANGE_REQUIRED");
result = invoke(`api("changeOwnPin", { sessionToken: coupleSessionToken, requestId: "owner-pin-change", currentPin: coupleOwnerPin, newPin: "654321" })`);
assert.equal(result.ok, true);
assert.equal(result.data.member.mustChangePin, false);
assert.match(result.data.sessionToken, /^[A-Za-z0-9_-]+$/);
context.coupleSessionToken = result.data.sessionToken;
result = invoke(`api("bootstrap", { sessionToken: coupleSessionToken })`);
assert.equal(result.ok, true);
result = invoke(`api("createMember", { sessionToken: coupleSessionToken, requestId: "member-create-spouse", displayName: "Pasangan", email: "pasangan@example.com", initialPin: "234567" })`);
assert.equal(result.ok, true);
assert.equal(result.data.member.role, "editor");
assert.equal(result.data.member.mustChangePin, true);
const spouseId = result.data.member.id;
result = invoke(`api("createMember", { sessionToken: coupleSessionToken, requestId: "member-create-third", displayName: "Anggota Ketiga", initialPin: "345678" })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "MEMBER_LIMIT_REACHED");
result = invoke(`api("updateMember", { sessionToken: coupleSessionToken, requestId: "owner-self-deactivate", memberId: coupleOwnerId, active: false })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "OWNER_SELF_DEACTIVATE");
context.spouseId = spouseId;
result = invoke(`api("memberLogin", { memberId: spouseId, pin: "234567", requestId: "member-login-spouse" })`);
assert.equal(result.ok, true);
context.spouseSessionToken = result.data.sessionToken;
result = invoke(`api("bootstrap", { sessionToken: spouseSessionToken })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "PIN_CHANGE_REQUIRED");
result = invoke(`api("changeOwnPin", { sessionToken: spouseSessionToken, requestId: "spouse-pin-change", currentPin: "234567", newPin: "765432" })`);
assert.equal(result.ok, true);
context.spouseSessionToken = result.data.sessionToken;
result = invoke(`api("createMember", { sessionToken: spouseSessionToken, requestId: "editor-create-member", displayName: "Ditolak", initialPin: "456789" })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "OWNER_ONLY");
result = invoke(`api("listMembers", { sessionToken: spouseSessionToken })`);
assert.equal(result.ok, true);
assert.equal(result.data.members.length, 2);
assert.equal(result.data.members.some((member) => Object.hasOwn(member, "email")), false);
assert.equal(sheets.AuditLog.find((row) => row.request_id === "member-create-spouse").actor_email, coupleOwnerId);
assert.equal(sheets.AuditLog.find((row) => row.request_id === "spouse-pin-change").actor_email, spouseId);

// Fase 2 — pemisahan data pribadi dan bersama.
result = invoke(`api("createAccount", { sessionToken: coupleSessionToken, requestId: "scope-shared-account", name: "Rekening Bersama", type: "Bank", openingBalance: 1000000 })`);
assert.equal(result.ok, true);
const sharedAccountId = result.data.account.id;
context.sharedAccountId = sharedAccountId;
assert.equal(sheets.Accounts.find((row) => row.id === sharedAccountId).scope_member_id, "");
result = invoke(`api("createAccount", { sessionToken: coupleSessionToken, requestId: "scope-owner-private", name: "Dompet Pribadi Pemilik", type: "Cash", openingBalance: 500000, scope: "private" })`);
assert.equal(result.ok, true);
const ownerPrivateAccountId = result.data.account.id;
context.ownerPrivateAccountId = ownerPrivateAccountId;
assert.equal(sheets.Accounts.find((row) => row.id === ownerPrivateAccountId).scope_member_id, coupleOwnerId);
result = invoke(`api("createAccount", { sessionToken: spouseSessionToken, requestId: "scope-spouse-private", name: "Dompet Pribadi Pasangan", type: "Cash", openingBalance: 700000, scope: "private" })`);
assert.equal(result.ok, true);
const spousePrivateAccountId = result.data.account.id;
context.spousePrivateAccountId = spousePrivateAccountId;

// Akun pribadi anggota lain tidak pernah muncul pada bootstrap maupun daftar transaksi.
result = invoke(`api("bootstrap", { sessionToken: coupleSessionToken })`);
assert.equal(result.ok, true);
let visibleAccountIds = result.data.accounts.map((account) => account.id);
assert.equal(visibleAccountIds.includes(sharedAccountId), true);
assert.equal(visibleAccountIds.includes(ownerPrivateAccountId), true);
assert.equal(visibleAccountIds.includes(spousePrivateAccountId), false);
assert.equal(result.data.accounts.find((account) => account.id === sharedAccountId).scope, "shared");
assert.equal(result.data.accounts.find((account) => account.id === ownerPrivateAccountId).scope, "private");
result = invoke(`api("bootstrap", { sessionToken: spouseSessionToken })`);
assert.equal(result.ok, true);
visibleAccountIds = result.data.accounts.map((account) => account.id);
assert.equal(visibleAccountIds.includes(spousePrivateAccountId), true);
assert.equal(visibleAccountIds.includes(ownerPrivateAccountId), false);

// Transaksi pada akun pribadi hanya terlihat oleh pemegang scope-nya.
result = invoke(`api("createTransaction", { sessionToken: spouseSessionToken, requestId: "scope-spouse-expense", type: "expense", amount: 25000, accountId: spousePrivateAccountId, category: "Makanan", merchant: "Kado Ulang Tahun" })`);
assert.equal(result.ok, true);
const spousePrivateTransactionId = result.data.transactionId;
assert.equal(sheets.Transactions.find((row) => row.id === spousePrivateTransactionId).created_by_member_id, spouseId);
result = invoke(`api("listTransactions", { sessionToken: coupleSessionToken, pageSize: 100 })`);
assert.equal(result.ok, true);
assert.equal(result.data.items.some((item) => item.id === spousePrivateTransactionId), false);
assert.equal(result.data.items.some((item) => String(item.merchant).includes("Kado")), false);
result = invoke(`api("listTransactions", { sessionToken: spouseSessionToken, pageSize: 100 })`);
assert.equal(result.data.items.some((item) => item.id === spousePrivateTransactionId), true);

// Transaksi milik anggota lain tidak dapat dibaca atau diubah lewat ID langsung.
context.spousePrivateTransactionId = spousePrivateTransactionId;
result = invoke(`api("updateTransaction", { sessionToken: coupleSessionToken, requestId: "scope-cross-update", transactionId: spousePrivateTransactionId, amount: 1 })`);
assert.equal(result.ok, false);
result = invoke(`api("deleteTransaction", { sessionToken: coupleSessionToken, requestId: "scope-cross-delete", transactionId: spousePrivateTransactionId })`);
assert.equal(result.ok, false);
assert.equal(sheets.Transactions.find((row) => row.id === spousePrivateTransactionId).deleted_at, "");

// Transfer lintas batas tetap menjaga saldo akun bersama, tetapi detailnya disamarkan.
result = invoke(`api("createTransaction", { sessionToken: spouseSessionToken, requestId: "scope-cross-transfer", type: "transfer", amount: 100000, accountId: spousePrivateAccountId, destinationAccountId: sharedAccountId })`);
assert.equal(result.ok, true);
result = invoke(`api("bootstrap", { sessionToken: coupleSessionToken })`);
assert.equal(result.ok, true);
const sharedBalanceForOwner = result.data.accounts.find((account) => account.id === sharedAccountId).current_balance;
result = invoke(`api("bootstrap", { sessionToken: spouseSessionToken })`);
const sharedBalanceForSpouse = result.data.accounts.find((account) => account.id === sharedAccountId).current_balance;
assert.equal(sharedBalanceForOwner, 1100000);
assert.equal(sharedBalanceForSpouse, 1100000);
const redactedLeg = invoke(`api("listTransactions", { sessionToken: coupleSessionToken, pageSize: 100, accountId: sharedAccountId })`)
  .data.items.find((item) => item.amount === 100000);
assert.equal(Boolean(redactedLeg), true);
assert.equal(redactedLeg.merchant, "Transaksi pribadi anggota lain");
assert.equal(redactedLeg.destinationAccountId, null);
assert.equal(invoke(`api("inspectLedger", { sessionToken: coupleSessionToken })`).data.status, "healthy");
// Kaki tersamar tidak boleh ditulis ulang karena akan menghapus detail milik anggota lain.
context.redactedLegId = redactedLeg.id;
result = invoke(`api("updateTransaction", { sessionToken: coupleSessionToken, requestId: "scope-redacted-update", transactionId: redactedLegId, amount: 1 })`);
assert.equal(result.ok, false);
result = invoke(`api("deleteTransaction", { sessionToken: coupleSessionToken, requestId: "scope-redacted-delete", transactionId: redactedLegId })`);
assert.equal(result.ok, false);
assert.equal(sheets.Transactions.filter((row) => row.request_id === "scope-cross-transfer").every((row) => !row.deleted_at && row.merchant !== "Transaksi pribadi anggota lain"), true);

// Audit log pasangan tidak bocor ke anggota lain.
result = invoke(`api("listAuditLogs", { sessionToken: coupleSessionToken, pageSize: 100 })`);
assert.equal(result.ok, true);
assert.equal(result.data.items.every((item) => item.actor !== spouseId), true);

// Fase 3 — entitas perencanaan mewarisi scope akun yang ditautkannya.
result = invoke(`api("createBill", { sessionToken: spouseSessionToken, requestId: "scope-private-bill", name: "Langganan Pribadi", amount: 50000, category: "Tagihan", accountId: spousePrivateAccountId, dueDate: "2026-08-10" })`);
assert.equal(result.ok, true);
const privateBillId = result.data.bill.id;
result = invoke(`api("createSinkingFund", { sessionToken: spouseSessionToken, requestId: "scope-private-fund", name: "Kejutan Ulang Tahun", purpose: "Lainnya", targetAmount: 300000, currentAmount: 100000, monthlyContribution: 50000, accountId: spousePrivateAccountId })`);
assert.equal(result.ok, true);
const privateFundId = result.data.sinkingFund.id;
result = invoke(`api("createRecurring", { sessionToken: spouseSessionToken, requestId: "scope-private-recurring", name: "Streaming Pribadi", type: "expense", amount: 60000, category: "Hiburan", accountId: spousePrivateAccountId, frequency: "monthly", startDate: "2026-08-01" })`);
assert.equal(result.ok, true);
result = invoke(`api("createGoal", { sessionToken: spouseSessionToken, requestId: "scope-private-goal", name: "Tabungan Pribadi", targetAmount: 1000000, deadline: "2027-01-01", accountId: spousePrivateAccountId })`);
assert.equal(result.ok, true);

result = invoke(`api("bootstrap", { sessionToken: coupleSessionToken })`);
assert.equal(result.ok, true);
assert.equal(result.data.bills.some((bill) => bill.id === privateBillId), false);
assert.equal(result.data.sinkingFunds.some((fund) => fund.id === privateFundId), false);
assert.equal(result.data.sinkingFundEntries.some((entry) => entry.fundId === privateFundId), false);
assert.equal(result.data.recurring.some((row) => row.name === "Streaming Pribadi"), false);
assert.equal(result.data.goals.some((goal) => goal.name === "Tabungan Pribadi"), false);
result = invoke(`api("bootstrap", { sessionToken: spouseSessionToken })`);
assert.equal(result.data.bills.some((bill) => bill.id === privateBillId), true);
assert.equal(result.data.sinkingFunds.some((fund) => fund.id === privateFundId), true);
assert.equal(result.data.sinkingFundEntries.some((entry) => entry.fundId === privateFundId), true);
assert.equal(result.data.goals.some((goal) => goal.name === "Tabungan Pribadi"), true);

// Entitas milik anggota lain tidak dapat disentuh lewat ID langsung.
context.privateBillId = privateBillId;
context.privateFundId = privateFundId;
result = invoke(`api("markBillPaid", { sessionToken: coupleSessionToken, requestId: "scope-cross-bill-pay", billId: privateBillId, period: "2026-08" })`);
assert.equal(result.ok, false);
result = invoke(`api("adjustSinkingFund", { sessionToken: coupleSessionToken, requestId: "scope-cross-fund-adjust", fundId: privateFundId, type: "allocate", amount: 10000 })`);
assert.equal(result.ok, false);

// Entitas baru tidak dapat ditautkan ke akun pribadi anggota lain.
result = invoke(`api("createBill", { sessionToken: coupleSessionToken, requestId: "scope-cross-bill", name: "Tagihan Curi", amount: 10000, category: "Tagihan", accountId: spousePrivateAccountId, dueDate: "2026-08-10" })`);
assert.equal(result.ok, false);
result = invoke(`api("createGoal", { sessionToken: coupleSessionToken, requestId: "scope-cross-goal", name: "Target Curi", targetAmount: 10000, deadline: "2027-01-01", accountId: spousePrivateAccountId })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "ACCOUNT_REQUIRED");

// Aturan perubahan scope.
result = invoke(`api("updateAccount", { sessionToken: spouseSessionToken, requestId: "scope-hide-shared", accountId: sharedAccountId, scope: "private" })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "OWNER_ONLY");
result = invoke(`api("updateAccount", { sessionToken: coupleSessionToken, requestId: "scope-steal-private", accountId: spousePrivateAccountId, scope: "private" })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "NOT_FOUND");
result = invoke(`api("updateAccount", { sessionToken: spouseSessionToken, requestId: "scope-share-own", accountId: spousePrivateAccountId, scope: "shared" })`);
assert.equal(result.ok, true);
assert.equal(sheets.Accounts.find((row) => row.id === spousePrivateAccountId).scope_member_id, "");
result = invoke(`api("bootstrap", { sessionToken: coupleSessionToken })`);
assert.equal(result.data.accounts.map((account) => account.id).includes(spousePrivateAccountId), true);

for (let attempt = 1; attempt <= 5; attempt += 1) {
  result = invoke(`api("memberLogin", { memberId: coupleOwnerId, pin: "000000", requestId: "member-login-wrong-${attempt}" })`);
}
assert.equal(result.ok, false);
assert.equal(result.error.code, "LOGIN_LOCKED");
result = invoke(`disableCoupleMode()`);
assert.equal(result.ok, true);
assert.equal(sheets.MemberSessions.every((session) => Boolean(session.revoked_at)), true);

result = invoke(`apiCreateBackup("customer-install-test")`);
assert.equal(result.ok, true);
assert.equal(result.data.kind, "backup");
assert.match(result.data.downloadUrl, /^https:\/\/drive\.test\//);
vm.runInContext(`verifyLicenseToken_ = originalVerifyLicenseTokenForCustomerTest_;`, context);

// Fixture pengujian produk berikutnya juga dimulai bersih setelah alur instalasi pelanggan selesai.
Object.keys(sheets).forEach((name) => { sheets[name].length = 0; });
properties.clear();
userProperties.clear();
cache.clear();
triggers.length = 0;

for (const [id, liability] of [
  ["asset-up", false], ["asset-down", false], ["debt-up", true],
  ["debt-down", true], ["source", false], ["destination", false], ["recovery", false],
]) {
  add("Accounts", { id, name: id, opening_balance: 1000, is_liability: liability, is_active: true });
}
add("Accounts", { id: "inv-cash", name: "Kas Investasi", type: "Bank", opening_balance: 100000, is_liability: false, is_active: true });
add("Accounts", { id: "inv-book", name: "Portofolio", type: "Investment", opening_balance: 0, is_liability: false, is_active: true });
const accountCountBeforeImport = sheets.Accounts.length;
result = invoke(`apiImportAccounts({ requestId: "account-import-1", accounts: [{ id: "imported-bank", name: "Rekening Cabang", type: "Bank", institution: "BCA", openingBalance: 250000, mask: "7788", color: "#126b59" }, { id: "imported-card", name: "Kartu Operasional", type: "Credit Card", openingBalance: 500000, color: "#c76565" }] })`);
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
result = invoke(`apiUpdateDebtPlanner({ requestId: "debt-settings-1", mode: "settings", strategy: "avalanche", extraMonthlyPayment: 300000 })`);
assert.equal(result.ok, true);
assert.equal(result.data.settings.extraMonthlyPayment, 300000);
result = invoke(`apiUpdateDebtPlanner({ requestId: "debt-plan-1", mode: "debt", accountId: "imported-card", annualInterestRatePct: 24.5, minimumPayment: 100000, dueDay: 12 })`);
assert.equal(result.ok, true);
assert.equal(result.data.debts[0].annualInterestRatePct, 24.5);
result = invoke(`apiUpdateCashflowForecastSettings({ requestId: "forecast-settings-1", horizonDays: 90, monthlyIncomeOverride: 9000000, incomeDay: 25, minimumCashBuffer: 2500000 })`);
assert.equal(result.ok, true);
assert.equal(result.data.horizonDays, 90);
assert.equal(result.data.minimumCashBuffer, 2500000);
result = invoke(`apiUpdateEmergencyFundSettings({ requestId: "emergency-settings-1", targetMonths: 6, monthlyExpenseOverride: 4000000, monthlyContribution: 1000000, accountIds: ["imported-bank"] })`);
assert.equal(result.ok, true);
assert.equal(result.data.targetMonths, 6);
assert.equal(result.data.accountIds.join(","), "imported-bank");
result = invoke(`apiUpdateEmergencyFundSettings({ requestId: "emergency-settings-1", targetMonths: 3, monthlyExpenseOverride: 1, monthlyContribution: 1, accountIds: [] })`);
assert.equal(result.ok, true);
assert.equal(result.data.monthlyContribution, 1000000);
result = invoke(`apiUpdateCashflowForecastSettings({ requestId: "forecast-settings-1", horizonDays: 30, monthlyIncomeOverride: 1, incomeDay: 1, minimumCashBuffer: 0 })`);
assert.equal(result.ok, true);
assert.equal(result.data.horizonDays, 90);
result = invoke(`apiUpdateDebtPlanner({ requestId: "debt-plan-1", mode: "debt", accountId: "imported-card", annualInterestRatePct: 10, minimumPayment: 1, dueDay: 1 })`);
assert.equal(result.ok, true);
assert.equal(result.data.debts[0].annualInterestRatePct, 24.5);
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
result = invoke(`apiUpdateAiSettings({ enabled: true, consentAccepted: true, baseUrl: "https://api.example.com/v1", model: "default", apiKey: "test-universal-key-1234567890" })`);
assert.equal(result.ok, true);
assert.equal(result.data.configured, true);
assert.equal(result.data.enabled, true);
assert.equal(result.data.baseUrl, "https://api.example.com/v1");
assert.equal(result.data.model, "default");
assert.equal(JSON.stringify(result.data).includes("test-universal-key"), false);

result = invoke(`apiMutationStatus({ requestId: "cat-create" })`);
assert.equal(result.ok, true);
assert.equal(result.data.completed, true);
assert.equal(result.data.module, "categories");
result = invoke(`apiMutationStatus({ requestId: "not-recorded" })`);
assert.equal(result.ok, true);
assert.equal(result.data.completed, false);

result = invoke(`buildAiContext_("2026-07", "Gimana caranya bertahan dalam 2 bulan ke depan?")`);
assert.equal(result.context.financialPosition.activeAccountCount > 0, true);
assert.equal(Number.isFinite(result.context.financialPosition.netWorth), true);
assert.equal(
  result.context.financialPosition.netWorth,
  result.context.financialPosition.assets - result.context.financialPosition.liabilities,
);
assert.equal(result.context.dataAvailability.transactionCount > 0, true);
assert.equal(result.context.runway.calculable, true);
assert.equal(result.manifest.includes("Posisi keuangan agregat"), true);
assert.equal(result.manifest.includes("Saldo akun terpilih"), true);
assert.equal(result.manifest.includes("Anggaran aktif"), true);
assert.equal(result.manifest.includes("Tagihan"), true);

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
result = invoke(`setupFinancialPlanner()`);
assert.equal(result.ok, true);
assert.equal(result.data.edition, "single-owner");
assert.match(result.data.installationId, /^uuid-/);
const categoryCountAfterMigration = sheets.Categories.length;
assert.equal(sheets.Categories.filter((category) => category.is_default === true).length, 8);
assert.equal(sheets.Categories.some((category) => category.id === "cat-transport"), false);
assert.equal(sheets.Categories.find((category) => category.id === "custom-transport").is_default, true);
assert.equal(sheets.Categories.find((category) => category.id === "cat-food").is_active, true);
result = invoke(`setupVinnStore()`);
assert.equal(result.ok, true);
assert.equal(result.data.installationId, properties.get("FINANCIAL_PLANNER_INSTALLATION_ID"));
assert.equal(sheets.Categories.length, categoryCountAfterMigration);

result = invoke(`api("licenseStatus", {})`);
assert.equal(result.ok, true);
assert.equal(result.data.tier, "free");
assert.match(result.data.installationId, /^inst-/);
result = invoke(`api("activateLicense", { requestId: "license-invalid-1", token: "invalid" })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "LICENSE_MALFORMED");
result = invoke(`api("createRecurring", { requestId: "recurring-free-1" })`);
assert.equal(result.ok, false);
assert.equal(result.error.code, "FEATURE_NOT_INCLUDED");

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

result = invoke(`apiUpdateAccount({ requestId: "account-update-1", accountId: "imported-bank", name: "Rekening Utama", type: "Deposit", institution: "BCA", mask: "7788", color: "#126b59" })`);
assert.equal(result.ok, true);
assert.equal(sheets.Accounts.find((account) => account.id === "imported-bank").type, "Deposit");

result = invoke(`apiUpsertBudget({ requestId: "budget-create-1", month: "2026-07", category: "Hiburan", limitAmount: 750000 })`);
assert.equal(result.ok, true);
const editableBudgetId = result.data.budget.id;
result = invoke(`apiUpdateBudget({ requestId: "budget-update-1", budgetId: "${editableBudgetId}", limit: 900000, color: "#126b59" })`);
assert.equal(result.ok, true);
assert.equal(Number(result.data.budget.limit_amount), 900000);
result = invoke(`apiDeleteBudget({ requestId: "budget-delete-1", budgetId: "${editableBudgetId}" })`);
assert.equal(result.ok, true);
assert.equal(sheets.Budgets.some((budget) => budget.id === editableBudgetId), false);

result = invoke(`apiCreateGoal({ requestId: "goal-create-1", name: "Dana Liburan", targetAmount: 5000000, currentAmount: 1000000, deadline: "2027-07-20" })`);
assert.equal(result.ok, true);
const editableGoalId = result.data.goal.id;
result = invoke(`apiUpdateGoal({ requestId: "goal-update-1", goalId: "${editableGoalId}", name: "Dana Pendidikan", target: 6000000, deadline: "2028-07-20", color: "#126b59", icon: "target" })`);
assert.equal(result.ok, true);
result = invoke(`apiContributeGoal({ requestId: "goal-add-1", goalId: "${editableGoalId}", amount: 500000, mode: "add" })`);
assert.equal(result.ok, true);
assert.equal(Number(result.data.goal.current_amount), 1500000);
result = invoke(`apiContributeGoal({ requestId: "goal-withdraw-1", goalId: "${editableGoalId}", amount: 250000, mode: "withdraw" })`);
assert.equal(result.ok, true);
assert.equal(Number(result.data.goal.current_amount), 1250000);
result = invoke(`apiDeleteGoal({ requestId: "goal-delete-1", goalId: "${editableGoalId}" })`);
assert.equal(result.ok, true);

result = invoke(`apiCreateBill({ requestId: "bill-create-1", name: "Air", amount: 200000, category: "Tagihan", accountId: "source", frequency: "monthly", dueDate: "2026-08-10", reminderDays: [3, 1, 0] })`);
assert.equal(result.ok, true);
const editableBillId = result.data.bill.id;
result = invoke(`apiUpdateBill({ requestId: "bill-update-1", billId: "${editableBillId}", name: "Air Rumah", amount: 225000, category: "Tagihan", accountId: "source", frequency: "monthly", dueDate: "2026-08-12", reminderDays: [7, 1, 0] })`);
assert.equal(result.ok, true);
assert.equal(Number(result.data.bill.amount), 225000);
result = invoke(`apiDeleteBill({ requestId: "bill-delete-1", billId: "${editableBillId}" })`);
assert.equal(result.ok, true);
assert.equal(sheets.Bills.some((bill) => bill.id === editableBillId), false);

const cashBeforeInstallments = invoke(`accountCurrentBalance_(findById_("Accounts", "source"), rowsAsObjects_("Transactions"))`);
const debtBeforeInstallments = invoke(`accountCurrentBalance_(findById_("Accounts", "debt-down"), rowsAsObjects_("Transactions"))`);
result = invoke(`apiCreateBill({ requestId: "installment-create-1", name: "Cicilan Perangkat", amount: 10, category: "Tagihan", accountId: "source", liabilityAccountId: "debt-down", durationMonths: 2, frequency: "monthly", dueDate: "2026-08-15", reminderDays: [3, 1, 0] })`);
assert.equal(result.ok, true);
const installmentBillId = result.data.bill.id;
assert.equal(Number(result.data.bill.duration_months), 2);
result = invoke(`apiMarkBillPaid({ requestId: "installment-pay-1", billId: "${installmentBillId}", period: "2026-08", date: "2026-08-15" })`);
assert.equal(result.ok, true);
assert.equal(Number(result.data.bill.paid_count), 1);
assert.equal(sheets.Transactions.filter((transaction) => transaction.request_id === "installment-pay-1").length, 2);
result = invoke(`apiMarkBillPaid({ requestId: "installment-pay-2", billId: "${installmentBillId}", period: "2026-09", date: "2026-09-15" })`);
assert.equal(result.ok, true);
assert.equal(Number(result.data.bill.paid_count), 2);
assert.equal(result.data.bill.status, "completed");
assert.equal(invoke(`accountCurrentBalance_(findById_("Accounts", "source"), rowsAsObjects_("Transactions"))`), cashBeforeInstallments - 20);
assert.equal(invoke(`accountCurrentBalance_(findById_("Accounts", "debt-down"), rowsAsObjects_("Transactions"))`), debtBeforeInstallments - 20);

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
