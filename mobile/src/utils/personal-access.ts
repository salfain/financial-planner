export function normalizeMobileApiUrl(raw: string) {
  let parsed: URL;
  try { parsed = new URL(String(raw ?? '').trim()); }
  catch { throw new Error('URL API Apps Script tidak valid.'); }
  const path = parsed.pathname.replace(/\/+$/, '');
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'script.google.com') {
    throw new Error('Gunakan URL HTTPS resmi dari script.google.com.');
  }
  if (!/^\/macros\/s\/[^/]+\/exec$/.test(path)) {
    throw new Error('Gunakan URL deployment Apps Script yang berakhir dengan /exec.');
  }
  return `${parsed.origin}${path}`;
}

export function normalizePersonalAccessKey(raw: string) {
  const value = String(raw ?? '').trim();
  if (value.length < 32 || value.length > 256) {
    throw new Error('Access key harus berisi 32–256 karakter.');
  }
  return value;
}
