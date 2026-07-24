function apiSaveAiKey(provider, apiKey) {
  try {
    const normalized = String(apiKey || '').trim();
    if (normalized.length < 8 || normalized.length > 2048) throw createError_('INVALID_KEY', 'API key AI tidak valid.');
    PropertiesService.getUserProperties().setProperty('AI_API_KEY', normalized);
    audit_('SAVE_SECRET', 'settings', 'AI_API_KEY', id_('req'), { provider: 'openai-compatible' });
    return ok_({ saved: true, provider: 'openai-compatible' });
  } catch (error) { return fail_(error); }
}

function apiAiKeyStatus(provider) {
  return ok_({ configured: Boolean(PropertiesService.getUserProperties().getProperty('AI_API_KEY')) });
}

function aiPreferences_() {
  const properties = PropertiesService.getUserProperties();
  let preferences = {};
  try { preferences = JSON.parse(properties.getProperty('VINN_AI_PREFERENCES') || '{}'); } catch (error) { preferences = {}; }
  const baseUrl = String(preferences.baseUrl || '').trim();
  return {
    provider: 'openai-compatible',
    baseUrl: baseUrl,
    model: String(preferences.model || 'default'),
    enabled: truthy_(preferences.enabled),
    consentAccepted: truthy_(preferences.consentAccepted),
    configured: Boolean(properties.getProperty('AI_API_KEY') && baseUrl),
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
    let current = {};
    try { current = JSON.parse(properties.getProperty('VINN_AI_PREFERENCES') || '{}'); } catch (error) { current = {}; }
    const baseUrl = normalizeAiBaseUrl_(payload.baseUrl === undefined ? current.baseUrl : payload.baseUrl);
    const model = String(payload.model === undefined ? current.model || 'default' : payload.model).trim();
    if (!model || model.length > 120 || !/^[A-Za-z0-9._:\/-]+$/.test(model)) throw createError_('INVALID_AI_MODEL', 'Nama model AI tidak valid.');
    if (truthy_(payload.removeApiKey)) {
      properties.deleteProperty('AI_API_KEY');
      properties.deleteProperty('GEMINI_API_KEY');
    }
    if (payload.apiKey) {
      const key = String(payload.apiKey).trim();
      if (key.length < 8 || key.length > 2048) throw createError_('INVALID_AI_KEY', 'API key AI tidak valid.');
      properties.setProperty('AI_API_KEY', key);
    }
    if (enabled && !baseUrl) throw createError_('AI_NOT_CONFIGURED', 'Tambahkan Base URL API sebelum AI diaktifkan.');
    if (enabled && !properties.getProperty('AI_API_KEY')) throw createError_('AI_NOT_CONFIGURED', 'Tambahkan API key sebelum AI diaktifkan.');
    properties.setProperty('VINN_AI_PREFERENCES', JSON.stringify({
      enabled: enabled,
      consentAccepted: consentAccepted,
      baseUrl: baseUrl,
      model: model
    }));
    audit_('UPDATE_AI_SETTINGS', 'ai_settings', '', id_('req'), {
      enabled: enabled,
      consentAccepted: consentAccepted,
      endpointHost: baseUrl ? baseUrl.replace(/^https:\/\//, '').split('/')[0] : '',
      model: model,
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
