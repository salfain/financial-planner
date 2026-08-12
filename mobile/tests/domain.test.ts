import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSnapshot, normalizeTransactionList } from '../src/domain/normalize';
import { accountTotals, accountTotalsAtDate, budgetActual, budgetTransactionCount, expenseByCategory, recentTransactions } from '../src/domain/selectors';
import { validateTransactionDraft } from '../src/domain/transaction-validation';
import type { FinanceSnapshot, TransactionDraft } from '../src/domain/types';
import { compareVersions, isBackendCompatible } from '../src/utils/version';

const draft = (patch: Partial<TransactionDraft> = {}): TransactionDraft => ({
  type: 'expense', amount: 50_000, accountId: 'acc-1', category: 'Makanan',
  date: '2026-07-27', status: 'completed', ...patch,
});

test('validasi transaksi standar dan transfer', () => {
  assert.deepEqual(validateTransactionDraft(draft()), {});
  assert.equal(validateTransactionDraft(draft({ type: 'transfer', category: 'Transfer' })).destinationAccountId, 'Pilih akun tujuan.');
  assert.equal(validateTransactionDraft(draft({ type: 'transfer', category: 'Transfer', destinationAccountId: 'acc-1' })).destinationAccountId, 'Akun tujuan harus berbeda.');
});

test('split harus 2-20 dan total sama dengan nominal', () => {
  const invalid = validateTransactionDraft(draft({ splits: [
    { id: 'a', category: 'Makanan', amount: 20_000 },
    { id: 'b', category: 'Transportasi', amount: 20_000 },
  ] }));
  assert.match(invalid.splits ?? '', /sama/);
  assert.deepEqual(validateTransactionDraft(draft({ splits: [
    { id: 'a', category: 'Makanan', amount: 20_000 },
    { id: 'b', category: 'Transportasi', amount: 30_000 },
  ] })), {});
});

test('normalisasi snake_case bootstrap dan pagination', () => {
  const snapshot = normalizeSnapshot({
    configured: true, schema_version: '1.16.0', profile: { store_name: 'Rumah' },
    accounts: [{ id: 'a', name: 'Kas', type: 'Cash', current_balance: 100_000, opening_balance: 50_000, is_liability: false }],
    transactions: [{ id: 't', type: 'expense', date: '2026-07-01', account_id: 'a', amount: 20_000, category: 'Makanan', merchant: 'Warung', tags_json: '["makan"]', splits_json: '[]' }],
  });
  assert.equal(snapshot.profile.storeName, 'Rumah');
  assert.equal(snapshot.accounts[0].balance, 100_000);
  assert.deepEqual(snapshot.transactions[0].tags, ['makan']);
  const page = normalizeTransactionList({ items: snapshot.transactions, page: 2, pageSize: 25, total: 51 });
  assert.equal(page.totalPages, 3);
});

test('selector memasukkan split dan mengurangi refund', () => {
  const snapshot = normalizeSnapshot({
    configured: true,
    accounts: [{ id: 'asset', name: 'Kas', current_balance: 300_000 }, { id: 'debt', name: 'Kartu', current_balance: 100_000, is_liability: true }],
    transactions: [
      { id: '1', type: 'expense', date: '2026-07-01', status: 'completed', amount: 100_000, category: 'Lainnya', splits: [{ id: 's1', category: 'Makanan', amount: 60_000 }, { id: 's2', category: 'Transportasi', amount: 40_000 }] },
      { id: '2', type: 'refund', date: '2026-07-02', status: 'completed', amount: 10_000, category: 'Makanan' },
    ],
    budgets: [{ id: 'b', category: 'Makanan', limit_amount: 100_000 }],
  }) as FinanceSnapshot;
  assert.deepEqual(accountTotals(snapshot.accounts), { assets: 300_000, liabilities: 100_000, netWorth: 200_000 });
  assert.equal(expenseByCategory(snapshot).find((item) => item.category === 'Makanan')?.amount, 50_000);
  assert.equal(budgetActual(snapshot.budgets[0], snapshot), 50_000);
});

test('selector mobile membatasi anggaran dan ringkasan kategori ke bulan aktif', () => {
  const snapshot = normalizeSnapshot({
    configured: true,
    transactions: [
      { id: 'aug-1', type: 'expense', date: '2026-08-01', status: 'completed', amount: 5_000, category: ' Parkir ' },
      { id: 'aug-2', type: 'expense', date: '2026-08-02', status: 'completed', amount: 10_000, category: 'Lainnya', splits: [{ id: 's1', category: 'PARKIR', amount: 4_000 }, { id: 's2', category: 'Makanan', amount: 6_000 }] },
      { id: 'aug-refund', type: 'refund', date: '2026-08-03', status: 'completed', amount: 2_000, category: 'Lainnya', splits: [{ id: 's3', category: 'parkir', amount: 2_000 }] },
      { id: 'jul', type: 'expense', date: '2026-07-31', status: 'completed', amount: 50_000, category: 'Parkir' },
    ],
    budgets: [{ id: 'parking', category: 'Parkir', limit_amount: 100_000, month: '2026-08' }],
  }) as FinanceSnapshot;
  assert.equal(budgetActual(snapshot.budgets[0], snapshot, '2026-08'), 7_000);
  assert.equal(budgetTransactionCount(snapshot.budgets[0], snapshot, '2026-08'), 3);
  assert.equal(expenseByCategory(snapshot, '2026-08').find((item) => item.category === 'Parkir')?.amount, 7_000);
  assert.deepEqual(recentTransactions(snapshot, 5, '2026-08').map((item) => item.id), ['aug-refund', 'aug-2', 'aug-1']);
});

test('riwayat kekayaan merekonstruksi saldo aset dan kewajiban dari ledger', () => {
  const snapshot = normalizeSnapshot({
    configured: true,
    accounts: [
      { id: 'cash', name: 'Kas', type: 'Bank', opening_balance: 1_000_000, current_balance: 1_300_000 },
      { id: 'debt', name: 'Paylater', type: 'Paylater', opening_balance: 500_000, current_balance: 400_000, is_liability: true },
    ],
    transactions: [
      { id: 'income', type: 'income', date: '2026-06-10', status: 'completed', account_id: 'cash', amount: 500_000, category: 'Gaji' },
      { id: 'expense', type: 'expense', date: '2026-06-20', status: 'completed', account_id: 'cash', amount: 100_000, category: 'Makanan' },
      { id: 'payment', type: 'transfer', date: '2026-07-01', status: 'completed', account_id: 'cash', destination_account_id: 'debt', amount: 100_000, category: 'Transfer' },
    ],
  }) as FinanceSnapshot;

  assert.deepEqual(accountTotalsAtDate(snapshot.accounts, snapshot.transactions, '2026-06-30'), {
    assets: 1_400_000, liabilities: 500_000, netWorth: 900_000,
  });
  assert.deepEqual(accountTotalsAtDate(snapshot.accounts, snapshot.transactions, '2026-07-31'), {
    assets: 1_300_000, liabilities: 400_000, netWorth: 900_000,
  });
});

test('kompatibilitas schema memakai perbandingan semver numerik', () => {
  assert.equal(compareVersions('1.16.0', '1.9.9'), 1);
  assert.equal(isBackendCompatible('1.16.0', '1.16.0'), true);
  assert.equal(isBackendCompatible('1.15.9', '1.16.0'), false);
});
