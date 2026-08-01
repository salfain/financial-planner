const COUPLE_MODE_ENABLED_PROPERTY = 'FINANCIAL_PLANNER_COUPLE_MODE_ENABLED';
const COUPLE_MODE_PEPPER_PROPERTY = 'FINANCIAL_PLANNER_MEMBER_AUTH_PEPPER';
const MEMBER_SESSION_DAYS = 30;
const MEMBER_SESSION_ABSOLUTE_DAYS = 90;
const MEMBER_LOGIN_WINDOW_MINUTES = 10;
const MEMBER_LOGIN_MAX_FAILURES = 5;
var VINN_REQUEST_MEMBER_CONTEXT_ = null;

function coupleModeEnabled_() {
  return truthy_(PropertiesService.getDocumentProperties().getProperty(COUPLE_MODE_ENABLED_PROPERTY));
}

function setCoupleModeEnabled_(enabled) {
  PropertiesService.getDocumentProperties().setProperty(COUPLE_MODE_ENABLED_PROPERTY, enabled ? 'true' : 'false');
  if (getWorkbook_().getSheetByName(VINN_CONFIG.SHEETS.SETTINGS)) {
    upsertSetting_('couple_mode_enabled', enabled ? 'true' : 'false');
  }
}

function setRequestMemberContext_(context) {
  VINN_REQUEST_MEMBER_CONTEXT_ = context || null;
}

function currentMemberContext_() {
  return VINN_REQUEST_MEMBER_CONTEXT_;
}

function currentAuditActor_() {
  const context = currentMemberContext_();
  if (context && context.member && context.member.id) return String(context.member.id);
  try {
    return Session.getEffectiveUser().getEmail() || 'owner';
  } catch (error) {
    return 'owner';
  }
}

function legacyMemberContext_() {
  let email = '';
  try { email = Session.getEffectiveUser().getEmail() || ''; } catch (error) { email = ''; }
  return {
    mode: 'single',
    member: { id: 'legacy-owner', displayName: 'Pemilik', role: 'owner', email: email },
    session: null
  };
}

function memberClientRow_(member) {
  return {
    id: String(member.id || ''),
    displayName: String(member.display_name || member.displayName || 'Anggota'),
    role: String(member.role || 'editor'),
    mustChangePin: truthy_(member.must_change_pin)
  };
}

function activeMembers_() {
  return rowsAsObjects_(VINN_CONFIG.SHEETS.MEMBERS).filter(function(member) {
    return member.active === '' || member.active === undefined || truthy_(member.active);
  });
}

function memberAuthPepper_() {
  const properties = PropertiesService.getDocumentProperties();
  let pepper = properties.getProperty(COUPLE_MODE_PEPPER_PROPERTY);
  if (!pepper) {
    pepper = randomSecret_();
    properties.setProperty(COUPLE_MODE_PEPPER_PROPERTY, pepper);
  }
  return pepper;
}

function bytesBase64WebSafe_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function sha256Text_(value) {
  return bytesBase64WebSafe_(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  ));
}

function randomSecret_() {
  return sha256Text_(Utilities.getUuid() + ':' + Utilities.getUuid() + ':' + new Date().getTime());
}

function pinHash_(pin, salt) {
  const signature = Utilities.computeHmacSha256Signature(
    String(salt) + ':' + String(pin),
    memberAuthPepper_(),
    Utilities.Charset.UTF_8
  );
  return bytesBase64WebSafe_(signature);
}

function constantTimeTextEqual_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index % Math.max(1, a.length)) || 0) ^ (b.charCodeAt(index % Math.max(1, b.length)) || 0);
  }
  return difference === 0;
}

function assertMemberPin_(pin) {
  const normalized = String(pin || '').trim();
  if (!/^\d{6}$/.test(normalized)) throw createError_('INVALID_PIN', 'PIN harus terdiri dari 6 angka.');
  return normalized;
}

function randomTemporaryPin_() {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, randomSecret_(), Utilities.Charset.UTF_8);
  const first = digest[0] < 0 ? digest[0] + 256 : digest[0];
  const second = digest[1] < 0 ? digest[1] + 256 : digest[1];
  const third = digest[2] < 0 ? digest[2] + 256 : digest[2];
  return String(100000 + ((first * 65536 + second * 256 + third) % 900000));
}

function addDaysIso_(from, days) {
  const value = new Date(from);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString();
}

function issueMemberSession_(member) {
  const now = new Date().toISOString();
  const token = randomSecret_();
  appendObjects_(VINN_CONFIG.SHEETS.MEMBER_SESSIONS, [{
    token_hash: sha256Text_(token),
    member_id: String(member.id),
    created_at: now,
    expires_at: addDaysIso_(now, MEMBER_SESSION_DAYS),
    absolute_expires_at: addDaysIso_(now, MEMBER_SESSION_ABSOLUTE_DAYS),
    last_seen_at: now,
    revoked_at: ''
  }]);
  return token;
}

function revokeAllMemberSessions_() {
  const now = new Date().toISOString();
  rowsAsObjects_(VINN_CONFIG.SHEETS.MEMBER_SESSIONS).forEach(function(session) {
    if (session.revoked_at) return;
    const rowNumber = session._row;
    session.revoked_at = now;
    delete session._row;
    updateObjectRow_(VINN_CONFIG.SHEETS.MEMBER_SESSIONS, rowNumber, session);
  });
}

function cleanupMemberAuth_() {
  if (!getWorkbook_().getSheetByName(VINN_CONFIG.SHEETS.MEMBER_SESSIONS)) return;
  const now = Date.now();
  rowsAsObjects_(VINN_CONFIG.SHEETS.MEMBER_SESSIONS)
    .filter(function(session) {
      const expired = Date.parse(String(session.absolute_expires_at || session.expires_at || '')) <= now;
      const revokedLongAgo = session.revoked_at && Date.parse(String(session.revoked_at)) < now - (7 * 86400000);
      return expired || revokedLongAgo;
    })
    .sort(function(a, b) { return b._row - a._row; })
    .forEach(function(session) { deleteObjectRow_(VINN_CONFIG.SHEETS.MEMBER_SESSIONS, session._row); });

  rowsAsObjects_(VINN_CONFIG.SHEETS.MEMBER_LOGIN_ATTEMPTS)
    .filter(function(attempt) { return Date.parse(String(attempt.updated_at || '')) < now - (24 * 60 * 60000); })
    .sort(function(a, b) { return b._row - a._row; })
    .forEach(function(attempt) { deleteObjectRow_(VINN_CONFIG.SHEETS.MEMBER_LOGIN_ATTEMPTS, attempt._row); });
}

function configureMemberAuthMaintenance_(enabled) {
  ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === 'vinnStoreMemberAuthMaintenance';
  }).forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
  if (enabled) ScriptApp.newTrigger('vinnStoreMemberAuthMaintenance').timeBased().everyDays(1).atHour(3).create();
}

function vinnStoreMemberAuthMaintenance() {
  cleanupMemberAuth_();
}

function resolveMemberContext_(sessionToken) {
  if (!coupleModeEnabled_()) return legacyMemberContext_();
  const token = String(sessionToken || '').trim();
  if (!token || token.length > 256) throw createError_('AUTH_REQUIRED', 'Silakan masuk sebagai anggota terlebih dahulu.');
  const tokenHash = sha256Text_(token);
  const session = rowsAsObjects_(VINN_CONFIG.SHEETS.MEMBER_SESSIONS).find(function(item) {
    return constantTimeTextEqual_(item.token_hash, tokenHash);
  });
  const now = Date.now();
  if (!session || session.revoked_at || Date.parse(String(session.expires_at || '')) <= now || Date.parse(String(session.absolute_expires_at || '')) <= now) {
    throw createError_('AUTH_REQUIRED', 'Sesi anggota sudah berakhir. Silakan masuk kembali.');
  }
  const member = findById_(VINN_CONFIG.SHEETS.MEMBERS, session.member_id);
  if (!member || (!truthy_(member.active) && member.active !== '')) {
    throw createError_('AUTH_REQUIRED', 'Akun anggota sudah tidak aktif.');
  }
  const nowIso = new Date(now).toISOString();
  const lastSeenAt = Date.parse(String(session.last_seen_at || session.created_at || ''));
  if (!lastSeenAt || now - lastSeenAt >= 6 * 60 * 60000) {
    const rowNumber = session._row;
    const absoluteExpiresAt = String(session.absolute_expires_at || addDaysIso_(session.created_at || nowIso, MEMBER_SESSION_ABSOLUTE_DAYS));
    const slidingExpiry = addDaysIso_(nowIso, MEMBER_SESSION_DAYS);
    session.last_seen_at = nowIso;
    session.expires_at = new Date(Math.min(Date.parse(slidingExpiry), Date.parse(absoluteExpiresAt))).toISOString();
    session.absolute_expires_at = absoluteExpiresAt;
    delete session._row;
    updateObjectRow_(VINN_CONFIG.SHEETS.MEMBER_SESSIONS, rowNumber, session);
  }
  return { mode: 'couple', member: memberClientRow_(member), session: { tokenHash: tokenHash } };
}

function loginAttempt_(memberId) {
  return rowsAsObjects_(VINN_CONFIG.SHEETS.MEMBER_LOGIN_ATTEMPTS).find(function(item) {
    return String(item.key) === 'member:' + String(memberId);
  }) || null;
}

function assertLoginAllowed_(memberId) {
  const attempt = loginAttempt_(memberId);
  if (attempt && attempt.locked_until && Date.parse(String(attempt.locked_until)) > Date.now()) {
    throw createError_('LOGIN_LOCKED', 'Terlalu banyak percobaan PIN. Coba lagi dalam 10 menit.');
  }
}

function recordLoginFailure_(memberId) {
  const now = new Date();
  const attempt = loginAttempt_(memberId);
  const windowStarted = attempt && Date.parse(String(attempt.window_started_at || ''));
  const withinWindow = windowStarted && now.getTime() - windowStarted < MEMBER_LOGIN_WINDOW_MINUTES * 60000;
  const failedCount = withinWindow ? Number(attempt.failed_count || 0) + 1 : 1;
  const record = {
    key: 'member:' + String(memberId),
    member_id: String(memberId),
    failed_count: failedCount,
    window_started_at: withinWindow ? String(attempt.window_started_at) : now.toISOString(),
    locked_until: failedCount >= MEMBER_LOGIN_MAX_FAILURES ? new Date(now.getTime() + MEMBER_LOGIN_WINDOW_MINUTES * 60000).toISOString() : '',
    updated_at: now.toISOString()
  };
  if (attempt) updateObjectRow_(VINN_CONFIG.SHEETS.MEMBER_LOGIN_ATTEMPTS, attempt._row, record);
  else appendObjects_(VINN_CONFIG.SHEETS.MEMBER_LOGIN_ATTEMPTS, [record]);
  if (record.locked_until) throw createError_('LOGIN_LOCKED', 'Terlalu banyak percobaan PIN. Coba lagi dalam 10 menit.');
}

function clearLoginFailures_(memberId) {
  const attempt = loginAttempt_(memberId);
  if (attempt) deleteObjectRow_(VINN_CONFIG.SHEETS.MEMBER_LOGIN_ATTEMPTS, attempt._row);
}

function publicMemberChoices_() {
  return activeMembers_().map(function(member) {
    return { id: String(member.id), displayName: String(member.display_name || 'Anggota') };
  });
}

function apiWhoami(payload) {
  try {
    if (!coupleModeEnabled_()) {
      return ok_({ mode: 'single', authenticated: true, member: memberClientRow_(legacyMemberContext_().member), members: [] });
    }
    const token = String(payload && payload.sessionToken || '').trim();
    if (token) {
      try {
        const context = resolveMemberContext_(token);
        return ok_({ mode: 'couple', authenticated: true, member: context.member, members: publicMemberChoices_() });
      } catch (error) {
        if (error.code !== 'AUTH_REQUIRED') throw error;
      }
    }
    let activeEmail = '';
    try { activeEmail = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (error) { activeEmail = ''; }
    const matched = activeEmail && activeMembers_().find(function(member) {
      return String(member.email || '').trim().toLowerCase() === activeEmail;
    });
    if (matched) {
      const autoToken = withDocumentLock_(function() { return issueMemberSession_(matched); });
      return ok_({ mode: 'couple', authenticated: true, member: memberClientRow_(matched), members: publicMemberChoices_(), sessionToken: autoToken });
    }
    return ok_({ mode: 'couple', authenticated: false, member: null, members: publicMemberChoices_() });
  } catch (error) {
    return fail_(error);
  }
}

function apiMemberLogin(payload) {
  try {
    return withDocumentLock_(function() {
      if (!coupleModeEnabled_()) throw createError_('COUPLE_MODE_DISABLED', 'Mode Pasangan belum diaktifkan.');
      const memberId = String(payload && payload.memberId || '').trim();
      const pin = assertMemberPin_(payload && payload.pin);
      const member = activeMembers_().find(function(item) { return String(item.id) === memberId; });
      const attemptMemberId = member ? memberId : 'unknown';
      assertLoginAllowed_(attemptMemberId);
      if (!member || !constantTimeTextEqual_(member.pin_hash, pinHash_(pin, member.pin_salt))) {
        recordLoginFailure_(attemptMemberId);
        throw createError_('INVALID_CREDENTIALS', 'Anggota atau PIN tidak sesuai.');
      }
      clearLoginFailures_(memberId);
      const token = issueMemberSession_(member);
      setRequestMemberContext_({ mode: 'couple', member: memberClientRow_(member), session: null });
      audit_('MEMBER_LOGIN', 'members', memberId, String(payload && payload.requestId || id_('req')), {});
      setRequestMemberContext_(null);
      return ok_({ mode: 'couple', authenticated: true, member: memberClientRow_(member), sessionToken: token });
    });
  } catch (error) {
    setRequestMemberContext_(null);
    return fail_(error, payload && payload.requestId);
  }
}

function enableCoupleMode() {
  requirePlanCapability_('couple_mode');
  setupFinancialPlanner();
  return withDocumentLock_(function() {
    const members = rowsAsObjects_(VINN_CONFIG.SHEETS.MEMBERS);
    let temporaryPin = null;
    let owner = members.find(function(member) { return String(member.role) === 'owner'; });
    if (!owner) {
      temporaryPin = randomTemporaryPin_();
      const salt = randomSecret_();
      let email = '';
      try { email = Session.getEffectiveUser().getEmail() || ''; } catch (error) { email = ''; }
      const now = nowIso_();
      owner = {
        id: id_('member'), email: email, display_name: 'Pemilik', role: 'owner',
        pin_hash: pinHash_(temporaryPin, salt), pin_salt: salt, active: true,
        must_change_pin: true, created_at: now, updated_at: now
      };
      appendObjects_(VINN_CONFIG.SHEETS.MEMBERS, [owner]);
    }
    setCoupleModeEnabled_(true);
    cleanupMemberAuth_();
    configureMemberAuthMaintenance_(true);
    audit_('ENABLE_COUPLE_MODE', 'members', String(owner.id), id_('req'), {});
    if (temporaryPin) console.log('PIN sementara Mode Pasangan: ' + temporaryPin);
    return ok_({
      enabled: true,
      owner: memberClientRow_(owner),
      temporaryPin: temporaryPin,
      message: temporaryPin ? 'Simpan PIN sementara ini. PIN juga tersedia di log eksekusi.' : 'Mode Pasangan aktif kembali. Gunakan PIN pemilik sebelumnya.'
    });
  });
}

function disableCoupleMode() {
  return withDocumentLock_(function() {
    setCoupleModeEnabled_(false);
    revokeAllMemberSessions_();
    configureMemberAuthMaintenance_(false);
    audit_('DISABLE_COUPLE_MODE', 'members', '', id_('req'), {});
    return ok_({ enabled: false });
  });
}

function setCoupleModeOwnerPin(optionalPin) {
  let pin = String(optionalPin || '').trim();
  if (!pin) {
    const response = SpreadsheetApp.getUi().prompt(
      'Atur PIN Pemilik',
      'Masukkan PIN baru yang terdiri dari 6 angka.',
      SpreadsheetApp.getUi().ButtonSet.OK_CANCEL
    );
    if (response.getSelectedButton() !== SpreadsheetApp.getUi().Button.OK) return ok_({ changed: false, cancelled: true });
    pin = String(response.getResponseText() || '').trim();
  }
  pin = assertMemberPin_(pin);
  return withDocumentLock_(function() {
    if (!coupleModeEnabled_()) throw createError_('COUPLE_MODE_DISABLED', 'Aktifkan Mode Pasangan terlebih dahulu.');
    const owner = rowsAsObjects_(VINN_CONFIG.SHEETS.MEMBERS).find(function(member) { return String(member.role) === 'owner'; });
    if (!owner) throw createError_('OWNER_NOT_FOUND', 'Profil pemilik belum tersedia.');
    const rowNumber = owner._row;
    const salt = randomSecret_();
    owner.pin_salt = salt;
    owner.pin_hash = pinHash_(pin, salt);
    owner.must_change_pin = false;
    owner.updated_at = nowIso_();
    delete owner._row;
    updateObjectRow_(VINN_CONFIG.SHEETS.MEMBERS, rowNumber, owner);
    revokeAllMemberSessions_();
    audit_('CHANGE_OWNER_PIN', 'members', String(owner.id), id_('req'), {});
    return ok_({ changed: true, owner: memberClientRow_(owner), sessionsRevoked: true });
  });
}
