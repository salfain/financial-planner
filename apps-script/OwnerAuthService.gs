const OWNER_AUTH_PROPERTIES = Object.freeze({
  PASSWORD_HASH: 'FINANCE_OWNER_PASSWORD_SHA256',
  REVISION: 'FINANCE_OWNER_AUTH_REVISION',
  UPDATED_AT: 'FINANCE_OWNER_AUTH_UPDATED_AT',
  CREDENTIAL_KIND: 'FINANCE_OWNER_CREDENTIAL_KIND'
});

const OWNER_DEFAULT_PIN_HASH = 'f8c94f689e2eecbfea9ffa0e5328688980dac5436bb39b1cac228a9045c338c0';
const OWNER_PIN_CREDENTIAL_KIND = 'pin-v1';

function apiOwnerAuthState() {
  const properties = PropertiesService.getScriptProperties();
  let passwordHash = String(properties.getProperty(OWNER_AUTH_PROPERTIES.PASSWORD_HASH) || '').trim().toLowerCase();
  let revision = String(properties.getProperty(OWNER_AUTH_PROPERTIES.REVISION) || '').trim();
  const credentialKind = String(properties.getProperty(OWNER_AUTH_PROPERTIES.CREDENTIAL_KIND) || '').trim();
  if (credentialKind !== OWNER_PIN_CREDENTIAL_KIND) {
    passwordHash = OWNER_DEFAULT_PIN_HASH;
    revision = Utilities.getUuid();
    properties.setProperties({
      [OWNER_AUTH_PROPERTIES.PASSWORD_HASH]: passwordHash,
      [OWNER_AUTH_PROPERTIES.REVISION]: revision,
      [OWNER_AUTH_PROPERTIES.UPDATED_AT]: nowIso_(),
      [OWNER_AUTH_PROPERTIES.CREDENTIAL_KIND]: OWNER_PIN_CREDENTIAL_KIND
    }, false);
  }
  return ok_({
    configured: /^[0-9a-f]{64}$/.test(passwordHash) && Boolean(revision),
    passwordHash: /^[0-9a-f]{64}$/.test(passwordHash) ? passwordHash : null,
    revision: revision || 'environment',
    credentialKind: OWNER_PIN_CREDENTIAL_KIND
  });
}

function apiRotateOwnerPassword(payload) {
  const passwordHash = String(payload && payload.passwordHash || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(passwordHash)) {
    throw createError_('OWNER_PASSWORD_HASH_INVALID', 'Hash kunci pemilik tidak valid.');
  }

  const properties = PropertiesService.getScriptProperties();
  const revision = Utilities.getUuid();
  const updatedAt = nowIso_();
  properties.setProperties({
    [OWNER_AUTH_PROPERTIES.PASSWORD_HASH]: passwordHash,
    [OWNER_AUTH_PROPERTIES.REVISION]: revision,
    [OWNER_AUTH_PROPERTIES.UPDATED_AT]: updatedAt,
    [OWNER_AUTH_PROPERTIES.CREDENTIAL_KIND]: OWNER_PIN_CREDENTIAL_KIND
  }, false);

  try {
    audit_('OWNER_PASSWORD_ROTATED', 'security', 'owner-auth', payload && payload.requestId, {
      revision: revision,
      sessionsRevoked: true
    });
  } catch (_error) {
    // Rotasi kunci tidak boleh gagal hanya karena audit sheet belum siap.
  }
  return ok_({ revision: revision, updatedAt: updatedAt, sessionsRevoked: true }, payload && payload.requestId);
}
