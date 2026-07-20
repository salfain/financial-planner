const VINN_PORTABILITY_HISTORY_KEY = 'VINN_PORTABILITY_HISTORY';
const VINN_BACKUP_SCHEDULE_KEY = 'VINN_BACKUP_SCHEDULE';
const VINN_PORTABILITY_FOLDER = 'Financial Planner Files';

function portabilityFolder_() {
  const workbook = getWorkbook_();
  const source = DriveApp.getFileById(workbook.getId());
  const parents = source.getParents();
  const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const existing = parent.getFoldersByName(VINN_PORTABILITY_FOLDER);
  return existing.hasNext() ? existing.next() : parent.createFolder(VINN_PORTABILITY_FOLDER);
}

function portabilityHistory_() {
  try { return JSON.parse(PropertiesService.getDocumentProperties().getProperty(VINN_PORTABILITY_HISTORY_KEY) || '[]'); }
  catch (error) { return []; }
}

function savePortabilityHistory_(history) {
  PropertiesService.getDocumentProperties().setProperty(VINN_PORTABILITY_HISTORY_KEY, JSON.stringify((history || []).slice(0, 24)));
}

function recordPortability_(record) {
  const history = portabilityHistory_().filter(function(item) { return String(item.id) !== String(record.id); });
  history.unshift(record);
  savePortabilityHistory_(history);
  return record;
}

function portabilityExportRecord_(file, kind, metadata, period) {
  return {
    id: file.getId(), kind: kind, filename: file.getName(), contentType: kind === 'report' ? 'application/pdf' : 'application/json',
    sizeBytes: Number(file.getSize ? file.getSize() : 0), status: 'ready', period: period || null,
    createdAt: nowIso_(), downloadUrl: file.getUrl(), metadata: metadata || {}
  };
}

function apiSaveReportPdf(payload) {
  const requestId = String(payload.requestId || id_('req'));
  try {
    const base64 = String(payload.contentBase64 || '');
    const period = String(payload.period || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw createError_('INVALID_PERIOD', 'Periode laporan tidak valid.');
    const allowedSections = ['summary', 'cashflow', 'categories', 'accounts', 'budgets', 'bills', 'goals', 'roadmap', 'forecast', 'emergency', 'debts', 'investments'];
    const sections = Array.isArray(payload.sections) ? payload.sections.map(String) : [];
    if (!sections.length || sections.length > allowedSections.length || sections.some(function(item, index) { return allowedSections.indexOf(item) === -1 || sections.indexOf(item) !== index; })) throw createError_('INVALID_REPORT_SECTIONS', 'Bagian laporan tidak valid atau terduplikasi.');
    const pageCount = Number(payload.pageCount);
    if (pageCount % 1 !== 0 || pageCount < 1 || pageCount > 100) throw createError_('INVALID_PAGE_COUNT', 'Jumlah halaman PDF tidak valid.');
    if (!base64 || base64.length > 12000000) throw createError_('INVALID_PDF', 'Isi PDF kosong atau terlalu besar.');
    const bytes = Utilities.base64Decode(base64);
    if (bytes.length < 5 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]) !== '%PDF-') throw createError_('INVALID_PDF', 'File laporan bukan PDF yang valid.');
    const filename = String(payload.filename || ('Financial-Planner_Laporan_' + period + '.pdf')).replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 160);
    const file = portabilityFolder_().createFile(Utilities.newBlob(bytes, 'application/pdf', filename));
    const record = recordPortability_(portabilityExportRecord_(file, 'report', {
      sections: sections, privacy: truthy_(payload.privacy), pageCount: pageCount
    }, period));
    audit_('CREATE_REPORT', 'reports', file.getId(), requestId, { filename: filename, period: period, pageCount: record.metadata.pageCount });
    return ok_(record, requestId);
  } catch (error) { return fail_(error, requestId); }
}

function apiListReports() {
  try { return ok_({ reports: portabilityHistory_().filter(function(item) { return item.kind === 'report'; }) }); }
  catch (error) { return fail_(error); }
}

function nextBackupDateGs_(from, frequency) {
  const date = new Date(from);
  if (frequency === 'daily') date.setUTCDate(date.getUTCDate() + 1);
  else if (frequency === 'monthly') date.setUTCMonth(date.getUTCMonth() + 1);
  else date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString();
}

function backupScheduleGs_() {
  let schedule = {};
  try { schedule = JSON.parse(PropertiesService.getDocumentProperties().getProperty(VINN_BACKUP_SCHEDULE_KEY) || '{}'); }
  catch (error) { schedule = {}; }
  return {
    enabled: truthy_(schedule.enabled), frequency: ['daily', 'weekly', 'monthly'].indexOf(String(schedule.frequency)) >= 0 ? String(schedule.frequency) : 'weekly',
    lastBackupAt: schedule.lastBackupAt || null, nextBackupAt: schedule.nextBackupAt || null, mode: 'scheduled'
  };
}

function saveBackupScheduleGs_(schedule) {
  PropertiesService.getDocumentProperties().setProperty(VINN_BACKUP_SCHEDULE_KEY, JSON.stringify(schedule));
}

function apiBackupOverview() {
  try {
    return ok_({ schedule: backupScheduleGs_(), backups: portabilityHistory_().filter(function(item) { return item.kind === 'backup'; }) });
  } catch (error) { return fail_(error); }
}

function apiUpdateBackupSchedule(payload) {
  try {
    const enabled = truthy_(payload.enabled);
    const frequency = String(payload.frequency || 'weekly');
    if (['daily', 'weekly', 'monthly'].indexOf(frequency) === -1) throw createError_('INVALID_FREQUENCY', 'Frekuensi backup tidak valid.');
    ScriptApp.getProjectTriggers().forEach(function(trigger) {
      if (trigger.getHandlerFunction() === 'vinnStoreScheduledBackup') ScriptApp.deleteTrigger(trigger);
    });
    const current = backupScheduleGs_();
    const now = nowIso_();
    const schedule = {
      enabled: enabled, frequency: frequency, lastBackupAt: current.lastBackupAt,
      nextBackupAt: enabled ? nextBackupDateGs_(now, frequency) : null, mode: 'scheduled'
    };
    if (enabled) ScriptApp.newTrigger('vinnStoreScheduledBackup').timeBased().everyDays(1).atHour(2).create();
    saveBackupScheduleGs_(schedule);
    audit_('UPDATE_BACKUP_SCHEDULE', 'backup', '', id_('req'), { enabled: enabled, frequency: frequency, nextBackupAt: schedule.nextBackupAt });
    return apiBackupOverview();
  } catch (error) { return fail_(error); }
}

function vinnStoreScheduledBackup() {
  const schedule = backupScheduleGs_();
  if (!schedule.enabled) return;
  if (schedule.nextBackupAt && new Date(schedule.nextBackupAt).getTime() > Date.now()) return;
  apiCreateBackup('scheduled');
}

function portableSourceGs_(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw createError_('INVALID_BACKUP', 'File backup harus berupa object JSON.');
  const root = value;
  const source = root.data && typeof root.data === 'object' ? root.data : root;
  function rows() {
    for (let index = 0; index < arguments.length; index += 1) if (Array.isArray(source[arguments[index]])) return source[arguments[index]].filter(function(item) { return item && typeof item === 'object' && !Array.isArray(item); });
    return [];
  }
  return {
    schemaVersion: String(root.schemaVersion || root.version || 'legacy'),
    profile: root.profile || {}, settings: root.settings || {},
    accounts: rows('accounts', 'Accounts'), categories: rows('categories', 'Categories'), transactions: rows('transactions', 'Transactions'),
    budgets: rows('budgets', 'Budgets'), goals: rows('goals', 'Goals'), bills: rows('bills', 'Bills'),
    investmentAssets: rows('investmentAssets', 'investment_assets', 'assets', 'Assets'),
    investmentPositions: rows('investmentPositions', 'investment_positions', 'positions', 'Positions'),
    investmentTransactions: rows('investmentTransactions', 'investment_transactions', 'InvestmentTransactions')
  };
}

function portableValueGs_(row, keys, fallback) {
  for (let index = 0; index < keys.length; index += 1) if (row[keys[index]] !== undefined && row[keys[index]] !== null && row[keys[index]] !== '') return row[keys[index]];
  return fallback;
}

function portableIdGs_(row) { return String(portableValueGs_(row, ['id', 'ID'], '')).trim(); }
function portableNumberGs_(row, keys, fallback) { const value = Number(portableValueGs_(row, keys, fallback)); return isFinite(value) ? value : Number(fallback || 0); }
function portableBoolGs_(row, keys) { return truthy_(portableValueGs_(row, keys, false)); }

function validatePortableGs_(backup) {
  const warnings = [];
  const errors = [];
  const counts = {};
  const collections = ['accounts', 'categories', 'transactions', 'budgets', 'goals', 'bills', 'investmentAssets', 'investmentPositions', 'investmentTransactions'];
  let totalRecords = 0;
  collections.forEach(function(key) {
    counts[key] = backup[key].length;
    totalRecords += counts[key];
    const ids = {};
    backup[key].forEach(function(row, index) {
      const id = portableIdGs_(row);
      if (!id) warnings.push(key + ' baris ' + (index + 1) + ' tanpa ID akan diberi ID baru.');
      else if (ids[id]) errors.push(key + ' memiliki ID duplikat ' + id + '.');
      else ids[id] = true;
    });
  });
  if (!totalRecords) errors.push('File tidak berisi data yang dapat dimigrasikan.');
  if (totalRecords > 5000) errors.push('Batas aman migrasi adalah 5000 baris per proses.');
  if (backup.schemaVersion === 'legacy') warnings.push('Versi skema sumber tidak tersedia; field lama akan dipetakan secara konservatif.');
  const accountIds = {};
  backup.accounts.forEach(function(row) { if (portableIdGs_(row)) accountIds[portableIdGs_(row)] = true; });
  const assetIds = {};
  backup.investmentAssets.forEach(function(row) { if (portableIdGs_(row)) assetIds[portableIdGs_(row)] = true; });
  backup.transactions.forEach(function(row, index) {
    const accountId = String(portableValueGs_(row, ['accountId', 'account_id'], ''));
    const destination = String(portableValueGs_(row, ['destinationAccountId', 'destination_account_id'], ''));
    if (!accountId) errors.push('Transaksi baris ' + (index + 1) + ' tidak memiliki akun sumber.');
    else if (!accountIds[accountId]) errors.push('Transaksi baris ' + (index + 1) + ' merujuk akun sumber yang tidak ada.');
    if (String(row.type || '') === 'transfer' && !destination) errors.push('Transfer baris ' + (index + 1) + ' tidak memiliki akun tujuan.');
    if (destination && !accountIds[destination]) errors.push('Transaksi baris ' + (index + 1) + ' merujuk akun tujuan yang tidak ada.');
  });
  backup.bills.forEach(function(row, index) {
    const accountId = String(portableValueGs_(row, ['accountId', 'account_id'], ''));
    if (!accountId) errors.push('Tagihan baris ' + (index + 1) + ' tidak memiliki akun pembayaran.');
    else if (!accountIds[accountId]) errors.push('Tagihan baris ' + (index + 1) + ' merujuk akun yang tidak ada.');
  });
  backup.investmentAssets.forEach(function(row, index) {
    const accountId = String(portableValueGs_(row, ['accountId', 'account_id'], ''));
    if (!accountId) errors.push('Aset investasi baris ' + (index + 1) + ' tidak memiliki akun investasi.');
    else if (!accountIds[accountId]) errors.push('Aset investasi baris ' + (index + 1) + ' merujuk akun yang tidak ada.');
  });
  backup.investmentPositions.forEach(function(row, index) {
    const assetId = String(portableValueGs_(row, ['assetId', 'asset_id'], ''));
    if (!assetId) errors.push('Posisi investasi baris ' + (index + 1) + ' tidak memiliki aset.');
    else if (!assetIds[assetId]) errors.push('Posisi investasi baris ' + (index + 1) + ' merujuk aset yang tidak ada.');
  });
  backup.investmentTransactions.forEach(function(row, index) {
    const accountId = String(portableValueGs_(row, ['accountId', 'account_id'], ''));
    const assetId = String(portableValueGs_(row, ['assetId', 'asset_id'], ''));
    if (!accountId) errors.push('Transaksi investasi baris ' + (index + 1) + ' tidak memiliki akun.');
    else if (!accountIds[accountId]) errors.push('Transaksi investasi baris ' + (index + 1) + ' merujuk akun yang tidak ada.');
    if (!assetId) errors.push('Transaksi investasi baris ' + (index + 1) + ' tidak memiliki aset.');
    else if (!assetIds[assetId]) errors.push('Transaksi investasi baris ' + (index + 1) + ' merujuk aset yang tidak ada.');
  });
  const balances = {};
  let canReconcile = true;
  backup.accounts.forEach(function(row) {
    const id = portableIdGs_(row);
    const hasOpening = row.openingBalance !== undefined || row.opening_balance !== undefined;
    if (!hasOpening) canReconcile = false;
    balances[id] = { current: portableNumberGs_(row, ['balance', 'currentBalance', 'current_balance'], 0), expected: portableNumberGs_(row, ['openingBalance', 'opening_balance'], 0), liability: portableBoolGs_(row, ['liability', 'isLiability', 'is_liability']) };
  });
  if (canReconcile) backup.transactions.forEach(function(row) {
    if (portableValueGs_(row, ['deletedAt', 'deleted_at'], '') || String(row.status || '') === 'pending') return;
    const source = balances[String(portableValueGs_(row, ['accountId', 'account_id'], ''))];
    if (!source) return;
    const amount = Math.round(portableNumberGs_(row, ['amount'], 0));
    const type = String(row.type || '');
    const direction = String(row.direction || '');
    if (direction === 'in') source.expected += amount;
    else if (direction === 'out') source.expected -= amount;
    else if (['income', 'adjustment_in', 'refund'].indexOf(type) >= 0) source.expected += source.liability ? -amount : amount;
    else if (['expense', 'adjustment_out'].indexOf(type) >= 0) source.expected += source.liability ? amount : -amount;
    else if (type === 'transfer') {
      source.expected += source.liability ? amount : -amount;
      const destination = balances[String(portableValueGs_(row, ['destinationAccountId', 'destination_account_id'], ''))];
      if (destination) destination.expected += destination.liability ? -amount : amount;
    }
  });
  let balanceDifference = 0;
  if (canReconcile) Object.keys(balances).forEach(function(id) { balanceDifference += Math.abs(Math.round(balances[id].current - balances[id].expected)); });
  else warnings.push('Saldo tidak dapat direkonsiliasi penuh karena saldo awal tidak tersedia pada file lama.');
  if (balanceDifference) errors.push('Rekonsiliasi sumber memiliki selisih Rp' + balanceDifference + '.');
  return { counts: counts, totalRecords: totalRecords, warnings: warnings.filter(function(item, index) { return warnings.indexOf(item) === index; }), errors: errors.filter(function(item, index) { return errors.indexOf(item) === index; }), balanceDifference: balanceDifference };
}

function migrationRecordGs_(item) {
  return {
    id: item.id, sourceName: item.sourceName, sourceSchemaVersion: item.sourceSchemaVersion,
    status: item.status, counts: item.counts, totalRecords: item.totalRecords,
    warnings: item.warnings || [], errors: item.errors || [], balanceDifference: Number(item.balanceDifference || 0),
    createdAt: item.createdAt, appliedAt: item.appliedAt || null,
    canApply: item.status === 'preview' && !(item.errors || []).length && !Number(item.balanceDifference || 0),
    reportDownloadUrl: item.reportDownloadUrl || undefined
  };
}

function migrationHistoryGs_() { return portabilityHistory_().filter(function(item) { return item.kind === 'migration'; }); }

function apiMigrationHistory() {
  try { return ok_({ migrations: migrationHistoryGs_().map(migrationRecordGs_) }); }
  catch (error) { return fail_(error); }
}

function apiPreviewMigration(payload) {
  const requestId = String(payload.requestId || id_('req'));
  try {
    const backup = portableSourceGs_(payload.backup);
    const validation = validatePortableGs_(backup);
    const duplicateAssets = rowsAsObjects_(VINN_CONFIG.SHEETS.ASSETS);
    backup.investmentAssets.forEach(function(asset) {
      const ticker = String(asset.ticker || '').toLowerCase();
      const exchange = String(asset.exchange || '').toLowerCase();
      if (ticker && duplicateAssets.some(function(existing) { return String(existing.ticker || '').toLowerCase() === ticker && String(existing.exchange || '').toLowerCase() === exchange; })) validation.errors.push('Aset ' + ticker.toUpperCase() + ' sudah ada di target.');
    });
    const id = id_('migration');
    const sourceName = String(payload.sourceName || 'backup.json').slice(0, 140);
    const sourceFile = portabilityFolder_().createFile(Utilities.newBlob(JSON.stringify(payload.backup), 'application/json', id + '-source.json'));
    const item = {
      id: id, kind: 'migration', sourceName: sourceName, sourceSchemaVersion: backup.schemaVersion, status: 'preview',
      counts: validation.counts, totalRecords: validation.totalRecords, warnings: validation.warnings,
      errors: validation.errors.filter(function(error, index, values) { return values.indexOf(error) === index; }),
      balanceDifference: validation.balanceDifference, createdAt: nowIso_(), appliedAt: null,
      sourceFileId: sourceFile.getId(), requestId: requestId
    };
    recordPortability_(item);
    audit_('MIGRATION_PREVIEW', 'migration', id, requestId, { sourceName: sourceName, counts: validation.counts, warningCount: item.warnings.length, errorCount: item.errors.length, balanceDifference: item.balanceDifference });
    return ok_(migrationRecordGs_(item), requestId);
  } catch (error) { return fail_(error, requestId); }
}

function apiCancelMigration(payload) {
  try {
    const id = String(payload.migrationId || '');
    const history = portabilityHistory_();
    const item = history.find(function(entry) { return entry.kind === 'migration' && String(entry.id) === id; });
    if (!item) throw createError_('MIGRATION_NOT_FOUND', 'Preview migrasi tidak ditemukan.');
    if (item.status === 'applied') throw createError_('MIGRATION_APPLIED', 'Migrasi sudah diterapkan.');
    if (item.sourceFileId) try { DriveApp.getFileById(item.sourceFileId).setTrashed(true); } catch (error) { /* source may already be gone */ }
    item.status = 'cancelled';
    savePortabilityHistory_(history);
    audit_('MIGRATION_CANCEL', 'migration', id, id_('req'), {});
    return ok_(migrationRecordGs_(item));
  } catch (error) { return fail_(error); }
}

function migratedIdMapGs_(rows, prefix) {
  const map = {};
  rows.forEach(function(row, index) { map[portableIdGs_(row) || ('missing-' + index)] = id_(prefix); });
  return map;
}

function apiApplyMigration(payload) {
  try {
    return withDocumentLock_(function() {
      const id = String(payload.migrationId || '');
      const history = portabilityHistory_();
      const item = history.find(function(entry) { return entry.kind === 'migration' && String(entry.id) === id; });
      if (!item) throw createError_('MIGRATION_NOT_FOUND', 'Preview migrasi tidak ditemukan.');
      if (item.status === 'applied') return ok_(migrationRecordGs_(item));
      if (item.status !== 'preview' || (item.errors || []).length || Number(item.balanceDifference || 0)) throw createError_('MIGRATION_INVALID', 'Migrasi belum lolos validasi.');
      const raw = JSON.parse(DriveApp.getFileById(item.sourceFileId).getBlob().getDataAsString('UTF-8'));
      const backup = portableSourceGs_(raw);
      const validation = validatePortableGs_(backup);
      if (validation.errors.length || validation.balanceDifference) throw createError_('MIGRATION_INVALID', validation.errors.join(' '));
      apiCreateBackup('pre_migration:' + id);
      const now = nowIso_();
      const accountIds = migratedIdMapGs_(backup.accounts, 'account');
      const assetIds = migratedIdMapGs_(backup.investmentAssets, 'asset');
      const transactionIds = migratedIdMapGs_(backup.transactions, 'tx');

      appendObjects_(VINN_CONFIG.SHEETS.ACCOUNTS, backup.accounts.map(function(row, index) {
        const oldId = portableIdGs_(row) || ('missing-' + index);
        return { id: accountIds[oldId], name: String(portableValueGs_(row, ['name'], 'Akun migrasi')).slice(0, 100), type: String(portableValueGs_(row, ['type'], 'Bank')), institution: String(portableValueGs_(row, ['institution'], '')).slice(0, 100), mask: String(portableValueGs_(row, ['mask'], '')).slice(0, 40), currency: String(portableValueGs_(row, ['currency'], VINN_CONFIG.CURRENCY)), opening_balance: Math.max(0, Math.round(portableNumberGs_(row, ['openingBalance', 'opening_balance'], portableNumberGs_(row, ['balance', 'currentBalance', 'current_balance'], 0)))), color: String(portableValueGs_(row, ['color'], '#16876f')), is_liability: portableBoolGs_(row, ['liability', 'isLiability', 'is_liability']), is_active: row.active === undefined || portableBoolGs_(row, ['active', 'isActive', 'is_active']), created_at: now, updated_at: now };
      }));

      const existingCategoryNames = rowsAsObjects_(VINN_CONFIG.SHEETS.CATEGORIES).map(function(row) { return String(row.name || '').toLowerCase(); });
      appendObjects_(VINN_CONFIG.SHEETS.CATEGORIES, backup.categories.filter(function(row) { return existingCategoryNames.indexOf(String(row.name || '').toLowerCase()) === -1; }).map(function(row, index) {
        return { id: id_('category'), name: String(portableValueGs_(row, ['name'], 'Kategori migrasi ' + (index + 1))).slice(0, 100), type: String(portableValueGs_(row, ['type'], 'expense')), parent_id: '', color: String(portableValueGs_(row, ['color'], '#16876f')), icon: String(portableValueGs_(row, ['icon'], 'circle-dollar-sign')), is_active: row.active === undefined ? !portableBoolGs_(row, ['archived']) : portableBoolGs_(row, ['active']), is_default: false, request_id: 'migration:' + id, created_at: now, updated_at: now };
      }));

      const transactionRows = [];
      backup.transactions.forEach(function(row, index) {
        const oldId = portableIdGs_(row) || ('missing-' + index);
        const accountId = accountIds[String(portableValueGs_(row, ['accountId', 'account_id'], ''))];
        const destinationId = accountIds[String(portableValueGs_(row, ['destinationAccountId', 'destination_account_id'], ''))] || '';
        const rawTags = portableValueGs_(row, ['tags', 'tagsJson', 'tags_json'], []);
        const rawSplits = portableValueGs_(row, ['splits', 'splitsJson', 'splits_json'], []);
        const base = { request_id: 'migration:' + id + ':' + oldId, date: String(portableValueGs_(row, ['date'], now.slice(0, 10))), time: String(portableValueGs_(row, ['time'], '')), type: String(portableValueGs_(row, ['type'], 'expense')), amount: Math.max(1, Math.round(portableNumberGs_(row, ['amount'], 1))), category: String(portableValueGs_(row, ['category'], 'Lainnya')), merchant: String(portableValueGs_(row, ['merchant', 'title', 'description'], 'Transaksi migrasi')).slice(0, 120), notes: String(portableValueGs_(row, ['notes', 'note'], '')).slice(0, 1000), status: String(row.status || 'completed') === 'pending' ? 'pending' : 'completed', created_at: now, updated_at: now, deleted_at: String(portableValueGs_(row, ['deletedAt', 'deleted_at'], '')), tags_json: Array.isArray(rawTags) ? JSON.stringify(rawTags) : String(rawTags || '[]'), location: String(portableValueGs_(row, ['location'], '')).slice(0, 160), splits_json: Array.isArray(rawSplits) ? JSON.stringify(rawSplits) : String(rawSplits || '[]'), receipt_file_id: '', receipt_filename: '', receipt_content_type: '', receipt_size_bytes: '' };
        if (base.type === 'transfer' && !row.direction) {
          const groupId = id_('transfer');
          transactionRows.push(Object.assign({}, base, { id: transactionIds[oldId], transfer_group_id: groupId, account_id: accountId, destination_account_id: destinationId, direction: 'out' }));
          transactionRows.push(Object.assign({}, base, { id: id_('tx'), transfer_group_id: groupId, account_id: destinationId, destination_account_id: accountId, direction: 'in' }));
        } else transactionRows.push(Object.assign({}, base, { id: transactionIds[oldId], transfer_group_id: String(portableValueGs_(row, ['transferGroupId', 'transfer_group_id'], '')), account_id: accountId, destination_account_id: destinationId, direction: String(row.direction || '') }));
      });
      appendObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS, transactionRows);

      appendObjects_(VINN_CONFIG.SHEETS.BUDGETS, backup.budgets.map(function(row, index) { return { id: id_('budget'), month: String(portableValueGs_(row, ['period', 'month'], now.slice(0, 7))), category: String(portableValueGs_(row, ['category'], 'Lainnya')), limit_amount: Math.max(1, Math.round(portableNumberGs_(row, ['amountLimit', 'amount_limit', 'limit', 'limitAmount', 'limit_amount'], 1))), rollover: false, created_at: now, updated_at: now }; }));
      appendObjects_(VINN_CONFIG.SHEETS.GOALS, backup.goals.map(function(row, index) { return { id: id_('goal'), name: String(portableValueGs_(row, ['name'], 'Target migrasi ' + (index + 1))).slice(0, 100), target_amount: Math.max(1, Math.round(portableNumberGs_(row, ['target', 'targetAmount', 'target_amount'], 1))), current_amount: Math.max(0, Math.round(portableNumberGs_(row, ['current', 'currentAmount', 'current_amount'], 0))), deadline: String(portableValueGs_(row, ['deadline'], now.slice(0, 10))), account_id: '', color: String(portableValueGs_(row, ['color'], '#16876f')), icon: String(portableValueGs_(row, ['icon'], 'target')), status: 'active', created_at: now, updated_at: now }; }));
      appendObjects_(VINN_CONFIG.SHEETS.BILLS, backup.bills.map(function(row, index) { return { id: id_('bill'), name: String(portableValueGs_(row, ['name'], 'Tagihan migrasi ' + (index + 1))).slice(0, 100), amount: Math.max(1, Math.round(portableNumberGs_(row, ['amount'], 1))), category: String(portableValueGs_(row, ['category'], 'Tagihan')), account_id: accountIds[String(portableValueGs_(row, ['accountId', 'account_id'], ''))], frequency: String(portableValueGs_(row, ['frequency'], 'monthly')), due_date: String(portableValueGs_(row, ['dueDate', 'due_date'], now.slice(0, 10))), reminder_days: String(portableValueGs_(row, ['reminderDays', 'reminder_days'], '7,3,1,0')), status: 'active', last_paid_period: String(portableValueGs_(row, ['lastPaidPeriod', 'last_paid_period'], '')), created_at: now, updated_at: now }; }));
      appendObjects_(VINN_CONFIG.SHEETS.ASSETS, backup.investmentAssets.map(function(row, index) { const oldId = portableIdGs_(row) || ('missing-' + index); const manualPrice = Math.max(0, Math.round(portableNumberGs_(row, ['manualPrice', 'manual_price'], 0))); return { id: assetIds[oldId], request_id: 'migration:' + id + ':' + oldId, account_id: accountIds[String(portableValueGs_(row, ['accountId', 'account_id'], ''))], ticker: String(portableValueGs_(row, ['ticker'], 'MIG' + (index + 1))).toUpperCase(), name: String(portableValueGs_(row, ['name'], 'Aset migrasi')), asset_class: String(portableValueGs_(row, ['assetClass', 'asset_class'], 'Custom')), exchange: String(portableValueGs_(row, ['exchange'], '')), currency: String(portableValueGs_(row, ['currency'], VINN_CONFIG.CURRENCY)), manual_price: manualPrice || '', latest_price_cache: Math.max(0, Math.round(portableNumberGs_(row, ['latestPriceCache', 'latest_price_cache', 'marketPrice'], manualPrice))), price_source: String(portableValueGs_(row, ['priceSource', 'price_source'], manualPrice ? 'manual' : 'unavailable')), price_status: String(portableValueGs_(row, ['priceStatus', 'price_status'], manualPrice ? 'manual' : 'unavailable')), price_updated_at: String(portableValueGs_(row, ['priceUpdatedAt', 'price_updated_at'], '')), is_active: row.active === undefined || portableBoolGs_(row, ['active']), created_at: now, updated_at: now }; }));
      const realizedTotals = {};
      appendObjects_(VINN_CONFIG.SHEETS.INVESTMENT_TX, backup.investmentTransactions.map(function(row, index) {
        const oldId = portableIdGs_(row) || ('missing-' + index);
        const assetId = assetIds[String(portableValueGs_(row, ['assetId', 'asset_id'], ''))];
        const units = portableNumberGs_(row, ['units'], portableNumberGs_(row, ['unitsMicro', 'units_micro'], 0) / INVESTMENT_UNIT_PRECISION);
        const remaining = portableNumberGs_(row, ['remainingUnitsAfter', 'remaining_units_after'], portableNumberGs_(row, ['remainingUnitsMicro', 'remaining_units_micro'], 0) / INVESTMENT_UNIT_PRECISION);
        const average = Math.max(0, Math.round(portableNumberGs_(row, ['averageCostAfter', 'average_cost_after'], 0)));
        const realized = Math.round(portableNumberGs_(row, ['realizedPl', 'realized_pl'], 0));
        realizedTotals[assetId] = Number(realizedTotals[assetId] || 0) + realized;
        return { id: id_('investment-tx'), request_id: 'migration:' + id + ':' + oldId, date: String(portableValueGs_(row, ['date'], now.slice(0, 10))), type: String(row.type || 'buy') === 'sell' ? 'sell' : 'buy', asset_id: assetId, account_id: accountIds[String(portableValueGs_(row, ['accountId', 'account_id'], ''))], units: units, price_per_unit: Math.max(1, Math.round(portableNumberGs_(row, ['pricePerUnit', 'price_per_unit'], 1))), gross_amount: Math.max(1, Math.round(portableNumberGs_(row, ['grossAmount', 'gross_amount'], 1))), fee: Math.max(0, Math.round(portableNumberGs_(row, ['fee'], 0))), tax: Math.max(0, Math.round(portableNumberGs_(row, ['tax'], 0))), net_amount: Math.max(1, Math.round(portableNumberGs_(row, ['netAmount', 'net_amount'], 1))), average_cost_after: average, remaining_units_after: remaining, cost_basis_after: Math.max(0, Math.round(average * remaining)), realized_pl: realized, realized_pl_total: realizedTotals[assetId], linked_cash_transaction_id: transactionIds[String(portableValueGs_(row, ['linkedCashTransactionId', 'linked_cash_transaction_id'], ''))] || '', linked_adjustment_transaction_id: transactionIds[String(portableValueGs_(row, ['linkedAdjustmentTransactionId', 'linked_adjustment_transaction_id'], ''))] || '', note: String(portableValueGs_(row, ['note', 'notes'], '')), created_at: now, updated_at: now };
      }));
      if (backup.settings && typeof backup.settings === 'object') {
        if (backup.settings.notificationEnabled !== undefined) upsertSetting_('notification_enabled', backup.settings.notificationEnabled !== false);
        if (Array.isArray(backup.settings.notificationBillReminderDays)) upsertSetting_('notification_bill_days', JSON.stringify(notificationDays_(backup.settings.notificationBillReminderDays, NOTIFICATION_DEFAULTS.billReminderDays)));
        if ([75, 90].indexOf(Number(backup.settings.notificationBudgetWarningPercent)) >= 0) upsertSetting_('notification_budget_percent', Number(backup.settings.notificationBudgetWarningPercent));
        if ([7, 14, 30].indexOf(Number(backup.settings.notificationBackupWarningDays)) >= 0) upsertSetting_('notification_backup_days', Number(backup.settings.notificationBackupWarningDays));
        if ([7, 30, 60].indexOf(Number(backup.settings.notificationGoalWarningDays)) >= 0) upsertSetting_('notification_goal_days', Number(backup.settings.notificationGoalWarningDays));
      }
      const appliedAt = nowIso_();
      const report = { migrationId: id, sourceName: item.sourceName, sourceSchemaVersion: item.sourceSchemaVersion, targetSchemaVersion: VINN_CONFIG.SCHEMA_VERSION, appliedAt: appliedAt, counts: validation.counts, totalRecords: validation.totalRecords, balanceDifference: validation.balanceDifference, warnings: validation.warnings, status: 'applied' };
      const reportFile = portabilityFolder_().createFile(Utilities.newBlob(JSON.stringify(report, null, 2), 'application/json', 'Financial-Planner_Migration_Report_' + id + '.json'));
      item.status = 'applied'; item.appliedAt = appliedAt; item.reportDownloadUrl = reportFile.getUrl();
      savePortabilityHistory_(history);
      audit_('MIGRATION_APPLY', 'migration', id, String(payload.requestId || id_('req')), report);
      invalidateDashboard_();
      return ok_(migrationRecordGs_(item));
    });
  } catch (error) { return fail_(error); }
}
