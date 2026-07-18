function apiSaveAiKey(provider, apiKey) {
  try {
    if (!apiKey || String(apiKey).trim().length < 20) throw createError_('INVALID_KEY', 'API key tidak valid.');
    const keyName = String(provider || 'gemini').toUpperCase() + '_API_KEY';
    PropertiesService.getUserProperties().setProperty(keyName, String(apiKey).trim());
    audit_('SAVE_SECRET', 'settings', keyName, id_('req'), { provider: provider || 'gemini' });
    return ok_({ saved: true, provider: provider || 'gemini' });
  } catch (error) { return fail_(error); }
}

function apiAiKeyStatus(provider) {
  const keyName = String(provider || 'gemini').toUpperCase() + '_API_KEY';
  return ok_({ configured: Boolean(PropertiesService.getUserProperties().getProperty(keyName)) });
}

function aiPreferences_() {
  const properties = PropertiesService.getUserProperties();
  let preferences = {};
  try { preferences = JSON.parse(properties.getProperty('VINN_AI_PREFERENCES') || '{}'); } catch (error) { preferences = {}; }
  return {
    provider: 'gemini',
    model: String(preferences.model || 'gemini-3.5-flash'),
    enabled: truthy_(preferences.enabled),
    consentAccepted: truthy_(preferences.consentAccepted),
    configured: Boolean(properties.getProperty('GEMINI_API_KEY')),
    storesReceiptImages: false
  };
}

function apiAiSettings() {
  try { return ok_(aiPreferences_()); } catch (error) { return fail_(error); }
}

function apiUpdateAiSettings(payload) {
  try {
    payload = payload || {};
    const enabled = truthy_(payload.enabled);
    const consentAccepted = truthy_(payload.consentAccepted);
    if (enabled && !consentAccepted) throw createError_('AI_CONSENT_REQUIRED', 'Persetujuan privasi wajib sebelum AI diaktifkan.');
    const properties = PropertiesService.getUserProperties();
    if (truthy_(payload.removeApiKey)) properties.deleteProperty('GEMINI_API_KEY');
    if (payload.apiKey) {
      const key = String(payload.apiKey).trim();
      if (key.length < 20 || key.length > 512) throw createError_('INVALID_AI_KEY', 'API key Gemini tidak valid.');
      properties.setProperty('GEMINI_API_KEY', key);
    }
    if (enabled && !properties.getProperty('GEMINI_API_KEY')) throw createError_('AI_NOT_CONFIGURED', 'Tambahkan API key Gemini sebelum AI diaktifkan.');
    properties.setProperty('VINN_AI_PREFERENCES', JSON.stringify({
      enabled: enabled,
      consentAccepted: consentAccepted,
      model: 'gemini-3.5-flash'
    }));
    audit_('UPDATE_AI_SETTINGS', 'ai_settings', '', id_('req'), {
      enabled: enabled,
      consentAccepted: consentAccepted,
      keyChanged: Boolean(payload.apiKey || payload.removeApiKey)
    });
    return ok_(aiPreferences_());
  } catch (error) { return fail_(error); }
}

function apiCreateBackup(reason) {
  const requestId = id_('req');
  try {
    const workbook = getWorkbook_();
    const file = DriveApp.getFileById(workbook.getId());
    const folder = portabilityFolder_();
    const stamp = Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, 'yyyyMMdd-HHmm');
    const backup = file.makeCopy(VINN_CONFIG.APP_NAME + ' Backup ' + stamp, folder);
    const record = recordPortability_(portabilityExportRecord_(backup, 'backup', { reason: String(reason || 'manual'), schemaVersion: VINN_CONFIG.SCHEMA_VERSION }, null));
    const schedule = backupScheduleGs_();
    schedule.lastBackupAt = record.createdAt;
    schedule.nextBackupAt = schedule.enabled ? nextBackupDateGs_(record.createdAt, schedule.frequency) : null;
    saveBackupScheduleGs_(schedule);
    audit_('BACKUP', 'system', backup.getId(), requestId, { name: backup.getName(), reason: record.metadata.reason });
    return ok_(record, requestId);
  } catch (error) { return fail_(error, requestId); }
}
