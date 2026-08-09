import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeMobileApiUrl, normalizePersonalAccessKey } from '../src/utils/personal-access';

test('URL Personal Access hanya menerima deployment Apps Script HTTPS resmi', () => {
  const valid = 'https://script.google.com/macros/s/AKfycbx-example_123/exec/';
  assert.equal(
    normalizeMobileApiUrl(valid),
    'https://script.google.com/macros/s/AKfycbx-example_123/exec',
  );
  assert.throws(() => normalizeMobileApiUrl('http://script.google.com/macros/s/id/exec'), /HTTPS resmi/);
  assert.throws(() => normalizeMobileApiUrl('https://attacker.example/macros/s/id/exec'), /HTTPS resmi/);
  assert.throws(() => normalizeMobileApiUrl('https://script.google.com/macros/s/id/dev'), /berakhir dengan \/exec/);
});

test('Personal Access Key dinormalisasi tanpa menerima key lemah', () => {
  const key = 'vfp_0123456789abcdef0123456789abcdef';
  assert.equal(normalizePersonalAccessKey(`  ${key}  `), key);
  assert.throws(() => normalizePersonalAccessKey('terlalu-pendek'), /32–256/);
  assert.throws(() => normalizePersonalAccessKey('x'.repeat(257)), /32–256/);
});
