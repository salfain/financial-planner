import assert from 'node:assert/strict';
import test from 'node:test';

import { mapAccountCsv, mapTransactionCsv, parseCsv } from '../src/utils/csv';

test('parser CSV menangani quoted comma, CRLF, dan escaped quote', () => {
  const result = parseCsv('\uFEFFname,type,notes\r\n"Dompet, Utama",Cash,"kata ""aman"""\r\n');
  assert.deepEqual(result.headers, ['name', 'type', 'notes']);
  assert.equal(result.rows[0].name, 'Dompet, Utama');
  assert.equal(result.rows[0].notes, 'kata "aman"');
});

test('mapping CSV akun dan transaksi mendukung header Indonesia', () => {
  const accounts = mapAccountCsv([{ nama: 'Tunai', jenis: 'Cash', saldo_awal: 'Rp 50.000' }]);
  assert.equal(accounts[0].openingBalance, 50000);
  const transactions = mapTransactionCsv([{ tanggal: '2026-07-27', jenis: 'expense', akun: 'Tunai', nominal: '25.000', kategori: 'Makanan', deskripsi: 'Warung' }], [{ id: 'acc-1', name: 'Tunai' }]);
  assert.equal(transactions[0].accountId, 'acc-1');
  assert.equal(transactions[0].amount, 25000);
});

test('parser menolak quote dan header duplikat yang rusak', () => {
  assert.throws(() => parseCsv('name,name\na,b'), /duplikat/);
  assert.throws(() => parseCsv('name,type\n"a,Cash'), /kutip/);
});
