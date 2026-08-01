// Mode Pasangan Fase 2 — pemisahan data pribadi dan bersama.
// Sumber kebenaran scope adalah kolom Accounts.scope_member_id. Akun tanpa nilai
// dianggap bersama; akun dengan ID anggota hanya terlihat oleh anggota tersebut.
// Transaksi mewarisi scope dari akun yang disentuhnya.

var VINN_SCOPE_INDEX_ = null;
var VINN_SCOPE_INDEX_STAMP_ = 0;
var VINN_SCOPE_SHEET_STAMP_ = 0;

const SCOPE_REDACTED_MERCHANT = 'Transaksi pribadi anggota lain';

function invalidateAccountScopeIndex_() {
  VINN_SCOPE_SHEET_STAMP_ += 1;
}

function currentScopeMemberId_() {
  if (!coupleModeEnabled_()) return '';
  const context = currentMemberContext_();
  if (!context || context.mode !== 'couple' || !context.member || !context.member.id) return '';
  return String(context.member.id);
}

function accountScopeIndex_() {
  if (VINN_SCOPE_INDEX_ && VINN_SCOPE_INDEX_STAMP_ === VINN_SCOPE_SHEET_STAMP_) return VINN_SCOPE_INDEX_;
  const index = {};
  rowsAsObjectsUnscoped_(VINN_CONFIG.SHEETS.ACCOUNTS).forEach(function(account) {
    index[String(account.id)] = String(account.scope_member_id || '').trim();
  });
  VINN_SCOPE_INDEX_ = index;
  VINN_SCOPE_INDEX_STAMP_ = VINN_SCOPE_SHEET_STAMP_;
  return index;
}

function accountScopeOwnerId_(accountId) {
  const index = accountScopeIndex_();
  const key = String(accountId || '');
  return key && Object.prototype.hasOwnProperty.call(index, key) ? index[key] : '';
}

function scopeVisibleToMember_(scopeOwnerId, memberId) {
  const owner = String(scopeOwnerId || '').trim();
  return !owner || owner === String(memberId || '');
}

function accountVisibleToMember_(account, memberId) {
  return scopeVisibleToMember_(account && account.scope_member_id, memberId);
}

function redactTransactionRow_(row) {
  const redacted = Object.assign({}, row);
  redacted.destination_account_id = '';
  redacted.merchant = SCOPE_REDACTED_MERCHANT;
  redacted.notes = '';
  redacted.tags_json = '[]';
  redacted.location = '';
  redacted.splits_json = '[]';
  redacted.receipt_file_id = '';
  redacted.receipt_filename = '';
  redacted.receipt_content_type = '';
  redacted.receipt_size_bytes = '';
  redacted.created_by_member_id = '';
  redacted.scope_redacted = true;
  return redacted;
}

// Baris transaksi yang menyentuh akun tersembunyi tetap dikembalikan dalam bentuk
// tersamar selama salah satu kakinya berada pada akun yang terlihat. Tanpa ini,
// saldo akun bersama akan berbeda antara kedua anggota.
function scopeTransactionRow_(row, memberId) {
  const sourceId = String(row.account_id || '');
  const destinationId = String(row.destination_account_id || '');
  const sourceVisible = !sourceId || scopeVisibleToMember_(accountScopeOwnerId_(sourceId), memberId);
  if (!sourceVisible) return null;
  if (!destinationId || scopeVisibleToMember_(accountScopeOwnerId_(destinationId), memberId)) return row;
  return redactTransactionRow_(row);
}

// Fase 3 — entitas perencanaan mewarisi scope dari akun yang ditautkannya.
// Kolom di bawah ini dievaluasi untuk setiap sheet; baris disembunyikan bila
// salah satu akun yang dirujuk berada di luar scope anggota.
const SCOPE_ACCOUNT_LINK_COLUMNS = Object.freeze({
  Goals: ['account_id'],
  SinkingFunds: ['account_id'],
  Bills: ['account_id', 'liability_account_id'],
  Recurring: ['account_id'],
  Assets: ['account_id'],
  InvestmentTransactions: ['account_id']
});

function accountLinkedRowVisible_(row, columns, memberId) {
  return columns.every(function(column) {
    const accountId = String(row[column] || '').trim();
    if (!accountId) return true;
    return scopeVisibleToMember_(accountScopeOwnerId_(accountId), memberId);
  });
}

// Entri pos dana tidak menyimpan akun, hanya fund_id, jadi scope-nya diturunkan
// dari pos dana induknya.
function sinkingFundScopeIndex_() {
  const index = {};
  rowsAsObjectsUnscoped_(VINN_CONFIG.SHEETS.SINKING_FUNDS).forEach(function(fund) {
    index[String(fund.id)] = accountScopeOwnerId_(String(fund.account_id || ''));
  });
  return index;
}

function applyScopeFilter_(sheetName, rows) {
  const memberId = currentScopeMemberId_();
  if (!memberId) return rows;
  if (sheetName === VINN_CONFIG.SHEETS.ACCOUNTS) {
    return rows.filter(function(account) { return accountVisibleToMember_(account, memberId); });
  }
  if (sheetName === VINN_CONFIG.SHEETS.TRANSACTIONS) {
    const scoped = [];
    rows.forEach(function(row) {
      const result = scopeTransactionRow_(row, memberId);
      if (result) scoped.push(result);
    });
    return scoped;
  }
  if (sheetName === VINN_CONFIG.SHEETS.SINKING_FUND_ENTRIES) {
    const funds = sinkingFundScopeIndex_();
    return rows.filter(function(entry) {
      const fundId = String(entry.fund_id || '').trim();
      if (!fundId) return true;
      return scopeVisibleToMember_(funds[fundId], memberId);
    });
  }
  const columns = SCOPE_ACCOUNT_LINK_COLUMNS[sheetName];
  if (columns) {
    return rows.filter(function(row) { return accountLinkedRowVisible_(row, columns, memberId); });
  }
  return rows;
}

function scopeVisibleAuditRow_(row, memberId) {
  const actor = String(row.actor_email || '').trim();
  // Baris tanpa pelaku anggota berasal dari perawatan sistem dan tetap terlihat.
  if (actor.indexOf('member-') !== 0) return true;
  return actor === String(memberId);
}

function applyAuditScopeFilter_(rows) {
  const memberId = currentScopeMemberId_();
  if (!memberId) return rows;
  return rows.filter(function(row) { return scopeVisibleAuditRow_(row, memberId); });
}

// Normalisasi nilai scope yang dikirim klien menjadi ID anggota atau string kosong.
function normalizedAccountScope_(value, memberId) {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw || raw === 'shared' || raw === 'bersama') return '';
  if (raw === 'private' || raw === 'pribadi' || raw === 'me') {
    if (!memberId) throw createError_('COUPLE_MODE_DISABLED', 'Akun pribadi hanya tersedia saat Mode Pasangan aktif.');
    return memberId;
  }
  if (raw !== String(memberId)) throw createError_('SCOPE_FORBIDDEN', 'Akun hanya dapat diberi scope pribadi milik Anda sendiri.');
  return raw;
}

function assertAccountScopeChangeAllowed_(previousScope, nextScope, context) {
  const before = String(previousScope || '').trim();
  const after = String(nextScope || '').trim();
  if (before === after) return after;
  const member = context && context.member;
  if (!member) throw createError_('AUTH_REQUIRED', 'Silakan masuk sebagai anggota terlebih dahulu.');
  const isOwner = String(member.role) === 'owner';
  // Menyembunyikan akun bersama menghilangkan visibilitas pasangan, jadi hanya pemilik yang boleh.
  if (!before && after && !isOwner) {
    throw createError_('OWNER_ONLY', 'Hanya pemilik workspace yang dapat mengubah akun bersama menjadi pribadi.');
  }
  // Akun pribadi hanya boleh dilepas atau dipindahkan oleh pemegang scope-nya.
  if (before && before !== String(member.id)) {
    throw createError_('SCOPE_FORBIDDEN', 'Hanya pemegang akun pribadi yang dapat mengubah scope akun tersebut.');
  }
  return after;
}

function accountScopeClientValue_(account, memberId) {
  const scope = String(account && account.scope_member_id || '').trim();
  if (!scope) return 'shared';
  return scope === String(memberId || '') ? 'private' : 'other';
}
