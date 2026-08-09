import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { TransactionForm } from '@/components/finance/transaction-form';
import { ReceiptOcrButton } from '@/components/finance/receipt-tools';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { IconButton } from '@/components/ui/buttons';
import { ConfirmDialog } from '@/components/ui/dialogs';
import { spacing } from '@/constants/theme';
import type { TransactionDraft } from '@/domain/types';
import { useApp } from '@/providers/app-provider';
import { clearTransactionDraft, loadTransactionDraft, saveTransactionDraft } from '@/services/storage';
import { today } from '@/utils/format';

const blankDraft = (): TransactionDraft => ({ type: 'expense', amount: 0, accountId: '', category: '', date: today(), status: 'completed', tags: [], splits: [] });

export default function NewTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ duplicate?: string }>();
  const { snapshot, mutate, isMutating, isOnline } = useApp();
  const [initial, setInitial] = useState<TransactionDraft | null>(null);
  const [current, setCurrent] = useState<TransactionDraft | null>(null);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const source = params.duplicate ? snapshot?.transactions.find((item) => item.id === params.duplicate || item.transferGroupId === params.duplicate) : null;
        const next = source
          ? { type: ['income', 'expense', 'transfer', 'refund'].includes(source.type) ? source.type as TransactionDraft['type'] : 'expense', amount: source.amount, accountId: source.accountId, destinationAccountId: source.destinationAccountId, category: source.category, date: today(), time: source.time, merchant: source.merchant, notes: source.notes, tags: source.tags, location: source.location, status: source.status, splits: source.splits.map((item) => ({ ...item, id: `copy-${item.id}` })) }
          : await loadTransactionDraft() ?? blankDraft();
        if (active) setInitial(next);
      } catch {
        if (active) setInitial(blankDraft());
      }
    })();
    return () => { active = false; };
  }, [params.duplicate, snapshot?.transactions]);

  const dirty = useMemo(() => current && JSON.stringify(current) !== JSON.stringify(blankDraft()), [current]);
  const change = useCallback((draft: TransactionDraft) => setCurrent(draft), []);
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => { void saveTransactionDraft(current); }, 500);
    return () => clearTimeout(timer);
  }, [current]);
  const close = () => dirty ? setCloseConfirm(true) : router.back();
  if (!initial) return <AppScreen edges={['top', 'bottom', 'left', 'right']}><AppText muted>Memulihkan draft…</AppText></AppScreen>;

  return <AppScreen edges={['top', 'bottom', 'left', 'right']}>
    <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><IconButton icon={X} label="Tutup form transaksi" onPress={close} /><View style={{ flex: 1 }}><AppText variant="title">{params.duplicate ? 'Duplikasi transaksi' : 'Transaksi baru'}</AppText><AppText variant="caption" muted>{isOnline ? 'Mutasi diverifikasi backend' : 'Offline · penyimpanan dinonaktifkan'}</AppText></View></View>
    <ReceiptOcrButton onDraft={(patch) => { setInitial((value) => ({ ...(value ?? blankDraft()), ...patch })); setFormVersion((value) => value + 1); }} />
    <TransactionForm
      key={formVersion}
      initial={initial}
      accounts={snapshot?.accounts ?? []}
      categories={snapshot?.categories ?? []}
      loading={isMutating}
      onChange={change}
      onSubmit={async (draft) => {
        if (!isOnline) throw new Error('Sambungkan internet untuk menyimpan perubahan.');
        await mutate('createTransaction', draft as unknown as Record<string, unknown>);
        await clearTransactionDraft();
        router.back();
      }}
    />
    <ConfirmDialog visible={closeConfirm} title="Buang perubahan?" message="Draft aman disimpan di perangkat dan dapat dilanjutkan saat membuka form lagi." destructive confirmLabel="Tutup" onCancel={() => setCloseConfirm(false)} onConfirm={() => router.back()} />
  </AppScreen>;
}
