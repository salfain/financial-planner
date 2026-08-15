const FINANCIAL_PLANNER_PLAN_RULES = Object.freeze({
  advanced_transactions: 'pro', imports: 'pro', attachments: 'pro', planning: 'pro',
  recurring: 'pro', pdf_reports: 'pro', scheduled_backup: 'pro', investments: 'premium',
  ai: 'premium', ocr: 'premium'
});

function licenseInstallationId_() {
  const properties = PropertiesService.getDocumentProperties();
  let installationId = properties.getProperty('FINANCIAL_PLANNER_INSTALLATION_ID');
  if (!installationId) {
    installationId = Utilities.getUuid();
    properties.setProperty('FINANCIAL_PLANNER_INSTALLATION_ID', installationId);
    properties.setProperty('FINANCIAL_PLANNER_INSTALLED_AT', nowIso_());
  }
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    installationId + ':' + getWorkbook_().getId() + ':' + ScriptApp.getScriptId(),
    Utilities.Charset.UTF_8
  );
  return 'inst-' + hexBytes_(digest).slice(0, 32);
}

function hexBytes_(bytes) {
  return bytes.map(function(byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}

const LICENSE_RSA_LIMB_BITS = 15;
const LICENSE_RSA_LIMB_BASE = 32768;

function bytesToLicenseLimbs_(bytes) {
  const limbs = [];
  let accumulator = 0;
  let bits = 0;
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    accumulator += ((bytes[index] + 256) % 256) * Math.pow(2, bits);
    bits += 8;
    while (bits >= LICENSE_RSA_LIMB_BITS) {
      limbs.push(accumulator % LICENSE_RSA_LIMB_BASE);
      accumulator = Math.floor(accumulator / LICENSE_RSA_LIMB_BASE);
      bits -= LICENSE_RSA_LIMB_BITS;
    }
  }
  if (bits || accumulator) limbs.push(accumulator);
  return limbs;
}

function licenseLimbsToBytes_(limbs, length) {
  const littleEndian = [];
  let accumulator = 0;
  let bits = 0;
  limbs.forEach(function(limb) {
    accumulator += limb * Math.pow(2, bits);
    bits += LICENSE_RSA_LIMB_BITS;
    while (bits >= 8) {
      littleEndian.push(accumulator % 256);
      accumulator = Math.floor(accumulator / 256);
      bits -= 8;
    }
  });
  if (bits) littleEndian.push(accumulator % 256);
  while (littleEndian.length < length) littleEndian.push(0);
  return littleEndian.slice(0, length).reverse();
}

function compareLicenseLimbs_(left, right) {
  for (let index = right.length - 1; index >= 0; index -= 1) {
    const leftValue = left[index] || 0;
    const rightValue = right[index] || 0;
    if (leftValue !== rightValue) return leftValue > rightValue ? 1 : -1;
  }
  return 0;
}

function subtractLicenseLimbs_(left, right) {
  const result = left.slice();
  let borrow = 0;
  for (let index = 0; index < right.length; index += 1) {
    let value = (result[index] || 0) - right[index] - borrow;
    if (value < 0) {
      value += LICENSE_RSA_LIMB_BASE;
      borrow = 1;
    } else {
      borrow = 0;
    }
    result[index] = value;
  }
  return result;
}

function doubleLicenseMod_(value, modulus) {
  const result = new Array(modulus.length);
  let carry = 0;
  for (let index = 0; index < modulus.length; index += 1) {
    const doubled = (value[index] || 0) * 2 + carry;
    result[index] = doubled % LICENSE_RSA_LIMB_BASE;
    carry = Math.floor(doubled / LICENSE_RSA_LIMB_BASE);
  }
  return carry || compareLicenseLimbs_(result, modulus) >= 0
    ? subtractLicenseLimbs_(result, modulus)
    : result;
}

function inverseLicenseLimb_(value) {
  let previous = 0;
  let current = 1;
  let remainder = LICENSE_RSA_LIMB_BASE;
  let nextRemainder = value;
  while (nextRemainder) {
    const quotient = Math.floor(remainder / nextRemainder);
    const next = previous - quotient * current;
    previous = current;
    current = next;
    const remainderNext = remainder - quotient * nextRemainder;
    remainder = nextRemainder;
    nextRemainder = remainderNext;
  }
  return previous < 0 ? previous + LICENSE_RSA_LIMB_BASE : previous;
}

function montgomeryLicenseMultiply_(left, right, modulus, modulusFactor) {
  const length = modulus.length;
  const temporary = new Array(length + 1).fill(0);
  for (let outer = 0; outer < length; outer += 1) {
    let carry = 0;
    for (let inner = 0; inner < length; inner += 1) {
      const product = temporary[inner] + (left[inner] || 0) * (right[outer] || 0) + carry;
      temporary[inner] = product % LICENSE_RSA_LIMB_BASE;
      carry = Math.floor(product / LICENSE_RSA_LIMB_BASE);
    }
    temporary[length] += carry;
    const reduction = temporary[0] * modulusFactor % LICENSE_RSA_LIMB_BASE;
    carry = 0;
    for (let inner = 0; inner < length; inner += 1) {
      const product = temporary[inner] + reduction * modulus[inner] + carry;
      if (inner) temporary[inner - 1] = product % LICENSE_RSA_LIMB_BASE;
      carry = Math.floor(product / LICENSE_RSA_LIMB_BASE);
    }
    const high = temporary[length] + carry;
    temporary[length - 1] = high % LICENSE_RSA_LIMB_BASE;
    temporary[length] = Math.floor(high / LICENSE_RSA_LIMB_BASE);
  }
  let result = temporary.slice(0, length);
  if (temporary[length] || compareLicenseLimbs_(result, modulus) >= 0) {
    result = subtractLicenseLimbs_(result, modulus);
  }
  return result;
}

function rsaPublicOperation_(signatureBytes, exponentBytes, modulusBytes) {
  const modulus = bytesToLicenseLimbs_(modulusBytes);
  const length = modulus.length;
  const modulusFactor = (LICENSE_RSA_LIMB_BASE - inverseLicenseLimb_(modulus[0])) % LICENSE_RSA_LIMB_BASE;
  let exponent = 0;
  exponentBytes.forEach(function(byte) { exponent = exponent * 256 + ((byte + 256) % 256); });
  if (!exponent || exponent > 0x7fffffff) return null;

  let base = bytesToLicenseLimbs_(signatureBytes);
  while (base.length < length) base.push(0);
  if (compareLicenseLimbs_(base, modulus) >= 0) return null;

  let rSquared = new Array(length).fill(0);
  rSquared[0] = 1;
  for (let index = 0; index < 2 * length * LICENSE_RSA_LIMB_BITS; index += 1) {
    rSquared = doubleLicenseMod_(rSquared, modulus);
  }
  const one = new Array(length).fill(0);
  one[0] = 1;
  base = montgomeryLicenseMultiply_(base, rSquared, modulus, modulusFactor);
  let result = montgomeryLicenseMultiply_(one, rSquared, modulus, modulusFactor);
  const exponentBits = [];
  while (exponent) {
    exponentBits.push(exponent % 2);
    exponent = Math.floor(exponent / 2);
  }
  for (let index = exponentBits.length - 1; index >= 0; index -= 1) {
    result = montgomeryLicenseMultiply_(result, result, modulus, modulusFactor);
    if (exponentBits[index]) result = montgomeryLicenseMultiply_(result, base, modulus, modulusFactor);
  }
  result = montgomeryLicenseMultiply_(result, one, modulus, modulusFactor);
  return licenseLimbsToBytes_(result, modulusBytes.length);
}

function rsaSha256Valid_(input, signature) {
  if (!FINANCIAL_PLANNER_LICENSE_PUBLIC_KEY.n || FINANCIAL_PLANNER_LICENSE_PUBLIC_KEY.fingerprint === 'UNCONFIGURED') {
    throw createError_('LICENSE_KEY_UNAVAILABLE', 'Public key lisensi belum dikonfigurasi.');
  }
  const modulusBytes = Utilities.base64DecodeWebSafe(FINANCIAL_PLANNER_LICENSE_PUBLIC_KEY.n);
  const exponentBytes = Utilities.base64DecodeWebSafe(FINANCIAL_PLANNER_LICENSE_PUBLIC_KEY.e);
  const signatureBytes = Utilities.base64DecodeWebSafe(signature);
  if (signatureBytes.length !== modulusBytes.length) return false;
  const encoded = rsaPublicOperation_(signatureBytes, exponentBytes, modulusBytes);
  if (!encoded) return false;
  const digestInfoPrefix = [48, 49, 48, 13, 6, 9, 96, 134, 72, 1, 101, 3, 4, 2, 1, 5, 0, 4, 32];
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8)
    .map(function(byte) { return (byte + 256) % 256; });
  const paddingLength = encoded.length - digestInfoPrefix.length - digest.length - 3;
  if (paddingLength < 8 || encoded[0] !== 0 || encoded[1] !== 1 || encoded[2 + paddingLength] !== 0) return false;
  for (let index = 2; index < 2 + paddingLength; index += 1) if (encoded[index] !== 255) return false;
  return encoded.slice(3 + paddingLength).join(',') === digestInfoPrefix.concat(digest).join(',');
}

function decodeLicenseClaims_(payloadPart) {
  let claims;
  try {
    claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadPart)).getDataAsString());
  } catch (error) {
    throw createError_('LICENSE_MALFORMED', 'Payload lisensi tidak valid.');
  }
  if (!claims || claims.product !== 'financial-planner' || Number(claims.version) !== 1) {
    throw createError_('LICENSE_PRODUCT_MISMATCH', 'Kode lisensi bukan untuk produk ini.');
  }
  if (['pro', 'premium'].indexOf(String(claims.tier)) === -1) throw createError_('LICENSE_TIER_INVALID', 'Paket lisensi tidak valid.');
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{5,79}$/.test(String(claims.licenseId || ''))) throw createError_('LICENSE_MALFORMED', 'ID lisensi tidak valid.');
  if (String(claims.installationId || '') !== licenseInstallationId_()) throw createError_('LICENSE_INSTALLATION_MISMATCH', 'Kode lisensi dibuat untuk instalasi lain.');
  const issuedAt = Date.parse(String(claims.issuedAt || ''));
  const expiresAt = claims.expiresAt ? Date.parse(String(claims.expiresAt)) : null;
  if (!isFinite(issuedAt) || (claims.expiresAt && !isFinite(expiresAt))) throw createError_('LICENSE_DATE_INVALID', 'Tanggal lisensi tidak valid.');
  if (issuedAt > Date.now() + 5 * 60 * 1000) throw createError_('LICENSE_NOT_YET_VALID', 'Kode lisensi belum berlaku.');
  if (expiresAt !== null && expiresAt <= Date.now()) throw createError_('LICENSE_EXPIRED', 'Kode lisensi sudah kedaluwarsa.');
  return claims;
}

function verifyLicenseToken_(token) {
  const normalized = String(token || '').trim();
  const parts = normalized.split('.');
  if (normalized.length > 4096 || parts.length !== 3 || parts[0] !== 'FP1') throw createError_('LICENSE_MALFORMED', 'Format kode lisensi tidak valid.');
  if (!rsaSha256Valid_(parts[0] + '.' + parts[1], parts[2])) throw createError_('LICENSE_SIGNATURE_INVALID', 'Tanda tangan lisensi tidak valid.');
  return decodeLicenseClaims_(parts[1]);
}

function planCapabilities_(tier) {
  const rank = { free: 0, pro: 1, premium: 2 };
  const capabilities = {};
  Object.keys(FINANCIAL_PLANNER_PLAN_RULES).forEach(function(capability) {
    capabilities[capability] = rank[tier] >= rank[FINANCIAL_PLANNER_PLAN_RULES[capability]];
  });
  return capabilities;
}

function licenseStatus_() {
  const installationId = licenseInstallationId_();
  const token = PropertiesService.getDocumentProperties().getProperty('FINANCIAL_PLANNER_LICENSE_TOKEN');
  if (!token) return { tier: 'free', label: 'Free', status: 'free', capabilities: planCapabilities_('free'), installationId: installationId, licenseId: null, expiresAt: null };
  try {
    const claims = verifyLicenseToken_(token);
    return { tier: claims.tier, label: claims.tier === 'premium' ? 'Premium' : 'Pro', status: 'active', capabilities: planCapabilities_(claims.tier), installationId: installationId, licenseId: claims.licenseId, expiresAt: claims.expiresAt || null };
  } catch (error) {
    return { tier: 'free', label: 'Free', status: error.code === 'LICENSE_EXPIRED' ? 'expired' : 'invalid', capabilities: planCapabilities_('free'), installationId: installationId, licenseId: null, expiresAt: null };
  }
}

function requirePlanCapability_(capability) {
  const status = licenseStatus_();
  if (!status.capabilities[capability]) throw createError_('FEATURE_NOT_INCLUDED', 'Fitur ini memerlukan paket ' + (FINANCIAL_PLANNER_PLAN_RULES[capability] === 'premium' ? 'Premium' : 'Pro') + '.', { capability: capability, requiredTier: FINANCIAL_PLANNER_PLAN_RULES[capability], currentTier: status.tier });
  return status;
}

function apiLicenseStatus() { try { return ok_(licenseStatus_()); } catch (error) { return fail_(error); } }

function apiActivateLicense(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    const token = String(payload && payload.token || '').trim();
    const claims = verifyLicenseToken_(token);
    PropertiesService.getDocumentProperties().setProperty('FINANCIAL_PLANNER_LICENSE_TOKEN', token);
    invalidateDashboard_();
    audit_('LICENSE_ACTIVATE', 'license', String(claims.licenseId), requestId, { tier: claims.tier, expiresAt: claims.expiresAt || null });
    return ok_(licenseStatus_(), requestId);
  } catch (error) { return fail_(error, requestId); }
}

function apiDeactivateLicense(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    const before = licenseStatus_();
    PropertiesService.getDocumentProperties().deleteProperty('FINANCIAL_PLANNER_LICENSE_TOKEN');
    invalidateDashboard_();
    audit_('LICENSE_DEACTIVATE', 'license', String(before.licenseId || ''), requestId, { previousTier: before.tier });
    return ok_(licenseStatus_(), requestId);
  } catch (error) { return fail_(error, requestId); }
}

function requireActionPlan_(action, payload) {
  const map = {
    importAccounts: 'imports', importTransactions: 'imports', createCategoryRule: 'imports', updateCategoryRule: 'imports', deleteCategoryRule: 'imports', attachTransactionReceipt: 'attachments',
    updateRoadmapSettings: 'planning', updateDebtPlanner: 'planning', updateCashflowForecastSettings: 'planning', updateEmergencyFundSettings: 'planning', updateZakatSettings: 'planning',
    createSinkingFund: 'planning', updateSinkingFund: 'planning', archiveSinkingFund: 'planning', adjustSinkingFund: 'planning',
    createRecurring: 'recurring', updateRecurring: 'recurring', confirmRecurring: 'recurring', saveReportPdf: 'pdf_reports', updateBackupSchedule: 'scheduled_backup',
    createInvestmentAsset: 'investments', updateInvestmentAsset: 'investments', createInvestmentTrade: 'investments',
    saveAiKey: 'ai', askAi: 'ai', ocrReceipt: 'ocr'
  };
  if (map[action]) requirePlanCapability_(map[action]);
  if (action === 'updateAiSettings' && payload && (truthy_(payload.enabled) || truthy_(payload.consentAccepted) || payload.apiKey || payload.baseUrl || payload.model)) requirePlanCapability_('ai');
  if ((action === 'createTransaction' || action === 'updateTransaction') && payload && (
    (Array.isArray(payload.tags) && payload.tags.length) || String(payload.location || '') || (Array.isArray(payload.splits) && payload.splits.length)
  )) requirePlanCapability_('advanced_transactions');
}
