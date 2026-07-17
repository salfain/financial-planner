function setupVinnStore() {
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

    const categories = rowsAsObjects_(VINN_CONFIG.SHEETS.CATEGORIES);
    if (!categories.length) {
      getWorkbook_().getSheetByName(VINN_CONFIG.SHEETS.CATEGORIES)
        .getRange(2, 1, DEFAULT_CATEGORIES.length, DEFAULT_CATEGORIES[0].length)
        .setValues(DEFAULT_CATEGORIES);
    }

    PropertiesService.getDocumentProperties().setProperty('VINN_SCHEMA_VERSION', VINN_CONFIG.SCHEMA_VERSION);
    audit_('SETUP', 'system', '', id_('req'), { schemaVersion: VINN_CONFIG.SCHEMA_VERSION });
    return ok_({ appName: VINN_CONFIG.APP_NAME, schemaVersion: VINN_CONFIG.SCHEMA_VERSION });
  });
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
    return ok_({ appName: VINN_CONFIG.APP_NAME, schemaVersion: VINN_CONFIG.SCHEMA_VERSION, sheets: results });
  } catch (error) { return fail_(error); }
}
