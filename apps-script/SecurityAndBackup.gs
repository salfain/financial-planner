function apiSaveAiKey(provider, apiKey) {
  try {
    if (!apiKey || String(apiKey).length < 16) throw createError_('INVALID_KEY', 'API key tidak valid.');
    const keyName = String(provider || 'gemini').toUpperCase() + '_API_KEY';
    PropertiesService.getUserProperties().setProperty(keyName, String(apiKey));
    audit_('SAVE_SECRET', 'settings', keyName, id_('req'), { provider: provider || 'gemini' });
    return ok_({ saved: true, provider: provider || 'gemini' });
  } catch (error) { return fail_(error); }
}

function apiAiKeyStatus(provider) {
  const keyName = String(provider || 'gemini').toUpperCase() + '_API_KEY';
  return ok_({ configured: Boolean(PropertiesService.getUserProperties().getProperty(keyName)) });
}

function apiCreateBackup() {
  const requestId = id_('req');
  try {
    const workbook = getWorkbook_();
    const file = DriveApp.getFileById(workbook.getId());
    const folderIterator = file.getParents();
    const folder = folderIterator.hasNext() ? folderIterator.next() : DriveApp.getRootFolder();
    const stamp = Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, 'yyyyMMdd-HHmm');
    const backup = file.makeCopy(VINN_CONFIG.APP_NAME + ' Backup ' + stamp, folder);
    audit_('BACKUP', 'system', backup.getId(), requestId, { name: backup.getName() });
    return ok_({ fileId: backup.getId(), name: backup.getName(), url: backup.getUrl() }, requestId);
  } catch (error) { return fail_(error, requestId); }
}
