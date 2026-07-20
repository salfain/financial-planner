function setupFinancialPlanner() {
  return withDocumentLock_(function() {
    Object.keys(VINN_CONFIG.HEADERS).forEach(function(sheetName) {
      ensureSheet_(sheetName, VINN_CONFIG.HEADERS[sheetName]);
    });

    const settingsSheet = getWorkbook_().getSheetByName(VINN_CONFIG.SHEETS.SETTINGS);
    const settings = rowsAsObjects_(VINN_CONFIG.SHEETS.SETTINGS);
    const existingKeys = settings.map(function(item) { return String(item.key); });
    const defaults = [
      ['app_name', VINN_CONFIG.APP_NAME, nowIso_()],
      ['schema_version', VINN_CONFIG.SCHEMA_VERSION, nowIso_()],
      ['currency', VINN_CONFIG.CURRENCY, nowIso_()],
      ['timezone', VINN_CONFIG.TIMEZONE, nowIso_()],
      ['setup_completed', 'true', nowIso_()]
    ].filter(function(row) { return existingKeys.indexOf(row[0]) === -1; });
    if (defaults.length) settingsSheet.getRange(settingsSheet.getLastRow() + 1, 1, defaults.length, 3).setValues(defaults);
    const appNameSetting = rowsAsObjects_(VINN_CONFIG.SHEETS.SETTINGS).find(function(row) {
      return String(row.key) === 'app_name';
    });
    if (appNameSetting && String(appNameSetting.value).toUpperCase() === 'VINN STORE') {
      updateObjectRow_(VINN_CONFIG.SHEETS.SETTINGS, appNameSetting._row, {
        key: 'app_name', value: VINN_CONFIG.APP_NAME, updated_at: nowIso_()
      });
    }
    const schemaSetting = rowsAsObjects_(VINN_CONFIG.SHEETS.SETTINGS).find(function(row) {
      return String(row.key) === 'schema_version';
    });
    if (schemaSetting && String(schemaSetting.value) !== VINN_CONFIG.SCHEMA_VERSION) {
      updateObjectRow_(VINN_CONFIG.SHEETS.SETTINGS, schemaSetting._row, {
        key: 'schema_version', value: VINN_CONFIG.SCHEMA_VERSION, updated_at: nowIso_()
      });
    }

    const categoryTimestamp = nowIso_();
    let categories = rowsAsObjects_(VINN_CONFIG.SHEETS.CATEGORIES);
    const missingDefaults = [];
    DEFAULT_CATEGORIES.forEach(function(defaultCategory) {
      const defaultId = String(defaultCategory[0]);
      const defaultName = String(defaultCategory[1]).trim().toLowerCase();
      const byId = categories.find(function(category) { return String(category.id) === defaultId; });
      if (byId) return;
      const byName = categories.find(function(category) {
        return String(category.name).trim().toLowerCase() === defaultName;
      });
      if (byName) {
        const rowNumber = byName._row;
        byName.is_active = true;
        byName.is_default = true;
        byName.updated_at = byName.updated_at || categoryTimestamp;
        const updated = Object.assign({}, byName);
        delete updated._row;
        updateObjectRow_(VINN_CONFIG.SHEETS.CATEGORIES, rowNumber, updated);
        return;
      }
      missingDefaults.push({
        id: defaultCategory[0], name: defaultCategory[1], type: defaultCategory[2],
        parent_id: defaultCategory[3], color: defaultCategory[4], icon: defaultCategory[5],
        is_active: true, is_default: true, request_id: '',
        created_at: categoryTimestamp, updated_at: categoryTimestamp
      });
    });
    if (missingDefaults.length) appendObjects_(VINN_CONFIG.SHEETS.CATEGORIES, missingDefaults);
    categories = rowsAsObjects_(VINN_CONFIG.SHEETS.CATEGORIES);
    categories.forEach(function(category) {
      const rowNumber = category._row;
      const isDefault = truthy_(category.is_default) || defaultCategoryId_(category.id);
      category.is_active = (isDefault || category.is_active === '') ? true : category.is_active;
      category.is_default = isDefault;
      category.created_at = category.created_at || categoryTimestamp;
      category.updated_at = category.updated_at || category.created_at;
      delete category._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.CATEGORIES, rowNumber, category);
    });

    const documentProperties = PropertiesService.getDocumentProperties();
    let installationId = documentProperties.getProperty('FINANCIAL_PLANNER_INSTALLATION_ID');
    if (!installationId) {
      installationId = Utilities.getUuid();
      documentProperties.setProperty('FINANCIAL_PLANNER_INSTALLATION_ID', installationId);
      documentProperties.setProperty('FINANCIAL_PLANNER_INSTALLED_AT', nowIso_());
    }
    documentProperties.setProperty('FINANCIAL_PLANNER_SCHEMA_VERSION', VINN_CONFIG.SCHEMA_VERSION);
    documentProperties.setProperty('VINN_SCHEMA_VERSION', VINN_CONFIG.SCHEMA_VERSION);
    audit_('SETUP', 'system', '', id_('req'), {
      schemaVersion: VINN_CONFIG.SCHEMA_VERSION,
      edition: 'single-owner'
    });
    invalidateDashboard_();
    return ok_({
      appName: VINN_CONFIG.APP_NAME,
      schemaVersion: VINN_CONFIG.SCHEMA_VERSION,
      edition: 'single-owner',
      installationId: installationId
    });
  });
}

// Alias lama dipertahankan agar instalasi pelanggan versi sebelumnya tetap dapat diperbarui.
function setupVinnStore() {
  return setupFinancialPlanner();
}

function apiHealthCheck() {
  try {
    const results = Object.keys(VINN_CONFIG.HEADERS).map(function(name) {
      const sheet = getWorkbook_().getSheetByName(name);
      if (!sheet) return { sheet: name, status: 'missing' };
      const actual = sheet.getRange(1, 1, 1, VINN_CONFIG.HEADERS[name].length).getValues()[0];
      const valid = VINN_CONFIG.HEADERS[name].every(function(header, index) { return String(actual[index]) === header; });
      return { sheet: name, status: valid ? 'healthy' : 'header_mismatch' };
    });
    const properties = PropertiesService.getDocumentProperties();
    return ok_({
      appName: VINN_CONFIG.APP_NAME,
      schemaVersion: VINN_CONFIG.SCHEMA_VERSION,
      edition: 'single-owner',
      installationId: properties.getProperty('FINANCIAL_PLANNER_INSTALLATION_ID') || null,
      sheets: results
    });
  } catch (error) { return fail_(error); }
}
