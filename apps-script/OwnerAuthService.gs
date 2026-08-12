const OWNER_AUTH_PROPERTIES = Object.freeze({
  PASSWORD_HASH: 'FINANCE_OWNER_PASSWORD_SHA256',
  REVISION: 'FINANCE_OWNER_AUTH_REVISION',
  UPDATED_AT: 'FINANCE_OWNER_AUTH_UPDATED_AT'
});

function apiOwnerAuthState() {
  const properties = PropertiesService.getScriptProperties();
  const passwordHash = String(properties.getProperty(OWNER_AUTH_PROPERTIES.PASSWORD_HASH) || '').trim().toLowerCase();
  const revision = String(properties.getProperty(OWNER_AUTH_PROPERTIES.REVISION) || '').trim();
  return ok_({
    configured: /^[0-9a-f]{64}$/.test(passwordHash) && Boolean(revision),
    passwordHash: /^[0-9a-f]{64}$/.test(passwordHash) ? passwordHash : null,
    revision: revision || 'environment'
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
    [OWNER_AUTH_PROPERTIES.UPDATED_AT]: updatedAt
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
