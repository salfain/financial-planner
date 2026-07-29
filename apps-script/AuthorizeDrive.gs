/**
 * Run once from the Apps Script editor after Drive scopes are added.
 * This intentionally has no parameters so it appears in the Run menu.
 */
function authorizeGoogleDrive() {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  const folder = portabilityFolder_();
  return {
    authorized: Boolean(folder && folder.getId()),
    folderName: folder.getName(),
    checkedAt: nowIso_()
  };
}

/**
 * Clears an older partial consent so the next run requests every manifest
 * scope again, including full Google Drive write access.
 */
function resetGoogleAuthorization() {
  ScriptApp.invalidateAuth();
}
