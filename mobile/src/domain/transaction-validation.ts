import type { TransactionDraft, TransactionSplit } from './types';

export type TransactionValidationErrors = Partial<Record<
  'amount' | 'accountId' | 'destinationAccountId' | 'category' | 'date' | 'tags' | 'splits',
  string
>>;

export function splitTotal(splits: TransactionSplit[] = []) {
  return splits.reduce((total, split) => total + Number(split.amount || 0), 0);
}

export function validateTransactionDraft(draft: TransactionDraft): TransactionValidationErrors {
  const errors: TransactionValidationErrors = {};
  if (!Number.isSafeInteger(draft.amount) || draft.amount <= 0) errors.amount = 'Nominal harus berupa Rupiah bulat lebih dari 0.';
  if (!draft.accountId) errors.accountId = 'Pilih akun sumber.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) errors.date = 'Tanggal transaksi tidak valid.';
  if (draft.type === 'transfer') {
    if (!draft.destinationAccountId) errors.destinationAccountId = 'Pilih akun tujuan.';
    if (draft.destinationAccountId && draft.destinationAccountId === draft.accountId) errors.destinationAccountId = 'Akun tujuan harus berbeda.';
  } else if (!draft.category) {
    errors.category = 'Pilih kategori.';
  }
  const tags = draft.tags ?? [];
  if (tags.length > 10) errors.tags = 'Maksimal 10 tag.';
  if (draft.splits?.length) {
    if (draft.splits.length < 2 || draft.splits.length > 20) errors.splits = 'Split harus terdiri dari 2–20 kategori.';
    else if (draft.splits.some((item) => !item.category || !Number.isSafeInteger(item.amount) || item.amount <= 0)) errors.splits = 'Setiap split memerlukan kategori dan nominal valid.';
    else if (splitTotal(draft.splits) !== draft.amount) errors.splits = 'Jumlah seluruh split harus sama dengan nominal transaksi.';
  }
  return errors;
}

export const isTransactionDraftValid = (draft: TransactionDraft) =>
  Object.keys(validateTransactionDraft(draft)).length === 0;
