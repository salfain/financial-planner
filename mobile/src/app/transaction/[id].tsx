import { useLocalSearchParams, useRouter } from 'expo-router';
import { Copy, RotateCcw, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { TransactionForm } from '@/components/finance/transaction-form';
import { ReceiptAttachment } from '@/components/finance/receipt-tools';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialogs';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/state-view';
import { spacing } from '@/constants/theme';
import type { TransactionDraft } from '@/domain/types';
import { useApp } from '@/providers/app-provider';
import { usePreferences } from '@/providers/preferences-provider';
import { formatDate } from '@/utils/format';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { snapshot, mutate, isMutating, isOnline } = useApp();
  const { colors } = usePreferences();
  const transaction = snapshot?.transactions.find((item) => item.id === id || item.transferGroupId === id);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [undoConfirm, setUndoConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initial = useMemo<TransactionDraft | null>(() => transaction ? ({ id: transaction.id, type: ['income', 'expense', 'transfer', 'refund'].includes(transaction.type) ? transaction.type as TransactionDraft['type'] : 'expense', amount: transaction.amount, accountId: transaction.accountId, destinationAccountId: transaction.destinationAccountId, category: transaction.category, date: transaction.date, time: transaction.time, merchant: transaction.merchant, notes: transaction.notes, tags: transaction.tags, location: transaction.location, status: transaction.status, splits: transaction.splits, expectedUpdatedAt: transaction.updatedAt }) : null, [transaction]);

  if (!transaction || !initial) return <AppScreen><ScreenHeader title="Detail transaksi" back menu={false} /><EmptyState title="Transaksi tidak ditemukan" message="Data mungkin berada di periode lain atau telah dihapus." /></AppScreen>;
  return <AppScreen>
    <ScreenHeader title="Detail transaksi" subtitle={`Terakhir ${transaction.updatedAt ? formatDate(transaction.updatedAt) : 'disimpan'}`} back menu={false} />
    {error ? <Card style={{ borderColor: colors.negative }}><AppText style={{ color: colors.negative }}>{error}</AppText></Card> : null}
    <TransactionForm initial={initial} accounts={snapshot?.accounts ?? []} categories={snapshot?.categories ?? []} loading={isMutating} submitLabel="Simpan perubahan" onSubmit={async (draft) => {
      if (!isOnline) throw new Error('Perubahan dinonaktifkan saat offline.');
      await mutate('updateTransaction', { ...draft, transactionId: transaction.id } as unknown as Record<string, unknown>);
    }} />
    <ReceiptAttachment transactionId={transaction.id} receipt={transaction.receipt} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      <AppButton tone="secondary" icon={Copy} onPress={() => router.push({ pathname: '/transaction/new', params: { duplicate: transaction.id } })}>Duplikasi</AppButton>
      <AppButton tone="secondary" icon={RotateCcw} disabled={!isOnline} onPress={() => setUndoConfirm(true)}>Undo terakhir</AppButton>
      <AppButton tone="danger" icon={Trash2} disabled={!isOnline} onPress={() => setDeleteConfirm(true)}>Hapus</AppButton>
    </View>
    <ConfirmDialog visible={deleteConfirm} title="Hapus transaksi?" message="Transaksi dipindahkan ke trash dan aksi terakhir dapat di-undo selama belum ada konflik." destructive loading={isMutating} confirmLabel="Hapus" onCancel={() => setDeleteConfirm(false)} onConfirm={() => { void mutate('deleteTransaction', { transactionId: transaction.id, expectedUpdatedAt: transaction.updatedAt }).then(() => router.back()).catch((cause) => { setDeleteConfirm(false); setError(cause instanceof Error ? cause.message : 'Gagal menghapus transaksi.'); }); }} />
    <ConfirmDialog visible={undoConfirm} title="Undo aksi transaksi terakhir?" message="Backend akan membatalkan aksi transaksi terakhir yang masih aman dibatalkan." loading={isMutating} confirmLabel="Undo" onCancel={() => setUndoConfirm(false)} onConfirm={() => { void mutate('undoTransaction', {}).then(() => { setUndoConfirm(false); router.back(); }).catch((cause) => { setUndoConfirm(false); setError(cause instanceof Error ? cause.message : 'Undo gagal.'); }); }} />
  </AppScreen>;
}
