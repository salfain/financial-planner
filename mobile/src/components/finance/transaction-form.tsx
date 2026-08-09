import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { splitTotal, validateTransactionDraft } from '@/domain/transaction-validation';
import type { TransactionDraft, TransactionSplit } from '@/domain/types';
import { usePreferences } from '@/providers/preferences-provider';
import { formatCurrency, parseMoney } from '@/utils/format';
import { Amount } from '../ui/amount';
import { AppText } from '../ui/app-text';
import { AppButton, IconButton } from '../ui/buttons';
import { Card } from '../ui/card';
import { ConfirmDialog } from '../ui/dialogs';
import { DateField, FormField, MoneyInput, SegmentedControl, SelectField, SwitchField } from '../ui/forms';

type Props = {
  initial: TransactionDraft;
  accounts: Array<{ id: string; name: string; balance: number; liability: boolean }>;
  categories: Array<{ name: string; type: 'income' | 'expense'; active: boolean }>;
  loading?: boolean;
  submitLabel?: string;
  onChange?: (draft: TransactionDraft) => void;
  onSubmit: (draft: TransactionDraft) => Promise<void>;
};

const newSplit = (index: number): TransactionSplit => ({ id: `draft-${Date.now()}-${index}`, category: '', amount: 0 });

export function TransactionForm({ initial, accounts, categories, loading, submitLabel = 'Simpan transaksi', onChange, onSubmit }: Props) {
  const { colors } = usePreferences();
  const [draft, setDraft] = useState(initial);
  const [amountText, setAmountText] = useState(String(initial.amount || ''));
  const [advanced, setAdvanced] = useState(Boolean(initial.merchant || initial.notes || initial.tags?.length || initial.location || initial.splits?.length));
  const [splitEnabled, setSplitEnabled] = useState(Boolean(initial.splits?.length));
  const [errors, setErrors] = useState<ReturnType<typeof validateTransactionDraft>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => { onChange?.(draft); }, [draft, onChange]);
  const set = <Key extends keyof TransactionDraft>(key: Key, value: TransactionDraft[Key]) => setDraft((current) => ({ ...current, [key]: value }));
  const filteredCategories = useMemo(() => categories.filter((item) => item.active && (draft.type === 'income' ? item.type === 'income' : item.type === 'expense')), [categories, draft.type]);
  const source = accounts.find((item) => item.id === draft.accountId);
  const destination = accounts.find((item) => item.id === draft.destinationAccountId);
  const requiresImpactConfirmation = draft.type === 'transfer' || draft.amount >= 10_000_000;

  const updateSplit = (index: number, patch: Partial<TransactionSplit>) => {
    const splits = [...(draft.splits ?? [])];
    splits[index] = { ...splits[index], ...patch };
    set('splits', splits);
  };
  const submit = async () => {
    const next = { ...draft, amount: parseMoney(amountText), splits: splitEnabled ? draft.splits : [] };
    const validation = validateTransactionDraft(next);
    setDraft(next);
    setErrors(validation);
    setServerError(null);
    if (Object.keys(validation).length) return;
    if (requiresImpactConfirmation && !confirm) { setConfirm(true); return; }
    try { await onSubmit(next); } catch (cause) { setServerError(cause instanceof Error ? cause.message : 'Transaksi gagal disimpan.'); }
  };

  return <View style={{ gap: spacing.md }}>
    <SegmentedControl label="Jenis transaksi" value={draft.type} onChange={(type) => { setDraft((value) => ({ ...value, type, category: type === 'transfer' ? 'Transfer' : '', destinationAccountId: undefined, splits: [] })); setSplitEnabled(false); }} options={[{ value: 'expense', label: 'Keluar' }, { value: 'income', label: 'Masuk' }, { value: 'transfer', label: 'Transfer' }, { value: 'refund', label: 'Refund' }]} />
    <MoneyInput label="Nominal" required value={amountText} onChangeValue={(value) => { setAmountText(value); set('amount', parseMoney(value)); }} error={errors.amount} />
    <SelectField label={draft.type === 'transfer' ? 'Akun sumber' : 'Akun'} value={draft.accountId} onChange={(accountId) => set('accountId', accountId)} error={errors.accountId} options={accounts.map((item) => ({ label: item.name, value: item.id, description: formatCurrency(item.balance) }))} />
    {draft.type === 'transfer' ? <SelectField label="Akun tujuan" value={draft.destinationAccountId ?? ''} onChange={(destinationAccountId) => set('destinationAccountId', destinationAccountId)} error={errors.destinationAccountId} options={accounts.map((item) => ({ label: item.name, value: item.id, description: formatCurrency(item.balance), disabled: item.id === draft.accountId }))} /> : <SelectField label="Kategori" value={draft.category} onChange={(category) => set('category', category)} error={errors.category} options={filteredCategories.map((item) => ({ label: item.name, value: item.name }))} />}
    <DateField label="Tanggal" value={draft.date} onChange={(date) => set('date', date)} />
    <SelectField label="Status" value={draft.status} onChange={(status) => set('status', status as TransactionDraft['status'])} options={[{ label: 'Selesai', value: 'completed' }, { label: 'Pending', value: 'pending', description: 'Belum memengaruhi saldo sampai diselesaikan.' }]} />

    <Pressable accessibilityRole="button" onPress={() => setAdvanced((value) => !value)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <AppText variant="label">Detail tambahan</AppText>{advanced ? <ChevronUp size={20} color={colors.textMuted} /> : <ChevronDown size={20} color={colors.textMuted} />}
    </Pressable>
    {advanced ? <View style={{ gap: spacing.md }}>
      <FormField label="Waktu" value={draft.time ?? ''} onChangeText={(time) => set('time', time)} placeholder="HH:mm" maxLength={5} inputMode="numeric" />
      <FormField label="Merchant / judul" value={draft.merchant ?? ''} onChangeText={(merchant) => set('merchant', merchant)} maxLength={120} />
      <FormField label="Catatan" value={draft.notes ?? ''} onChangeText={(notes) => set('notes', notes)} maxLength={500} multiline style={{ minHeight: 88, textAlignVertical: 'top' }} />
      <FormField label="Tag" value={(draft.tags ?? []).join(', ')} onChangeText={(value) => set('tags', value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 11))} hint="Pisahkan dengan koma, maksimal 10 tag." error={errors.tags} />
      <FormField label="Lokasi" value={draft.location ?? ''} onChangeText={(location) => set('location', location)} maxLength={160} />
      {draft.type !== 'transfer' ? <>
        <SwitchField label="Split kategori" description="Bagi nominal ke 2–20 kategori." value={splitEnabled} onChange={(enabled) => { setSplitEnabled(enabled); set('splits', enabled ? (draft.splits?.length ? draft.splits : [newSplit(0), newSplit(1)]) : []); }} />
        {splitEnabled ? <Card style={{ gap: spacing.md }}>
          {(draft.splits ?? []).map((split, index) => <View key={split.id} style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs }}>
              <View style={{ flex: 1 }}><SelectField label={`Kategori split ${index + 1}`} value={split.category} onChange={(category) => updateSplit(index, { category })} options={filteredCategories.map((item) => ({ label: item.name, value: item.name }))} /></View>
              {(draft.splits?.length ?? 0) > 2 ? <IconButton icon={Minus} label={`Hapus split ${index + 1}`} tone="danger" onPress={() => set('splits', draft.splits?.filter((_, itemIndex) => itemIndex !== index))} /> : null}
            </View>
            <MoneyInput label={`Nominal split ${index + 1}`} value={String(split.amount || '')} onChangeValue={(value) => updateSplit(index, { amount: parseMoney(value) })} />
          </View>)}
          {(draft.splits?.length ?? 0) < 20 ? <AppButton tone="secondary" icon={Plus} onPress={() => set('splits', [...(draft.splits ?? []), newSplit(draft.splits?.length ?? 0)])}>Tambah split</AppButton> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><AppText muted>Total split</AppText><Amount value={splitTotal(draft.splits)} variant="label" /></View>
          {errors.splits ? <AppText style={{ color: colors.negative }}>{errors.splits}</AppText> : null}
        </Card> : null}
      </> : null}
    </View> : null}

    {serverError ? <Card style={{ borderColor: colors.negative }}><AppText style={{ color: colors.negative }}>{serverError}</AppText></Card> : null}
    {!source && accounts.length === 0 ? <AppText style={{ color: colors.warning }}>Tambahkan akun sebelum mencatat transaksi.</AppText> : null}
    <AppButton fullWidth loading={loading} disabled={!accounts.length} onPress={() => void submit()}>{submitLabel}</AppButton>

    <ConfirmDialog visible={confirm} title="Periksa dampak saldo" message={draft.type === 'transfer'
      ? `${source?.name ?? 'Akun sumber'}: ${formatCurrency((source?.balance ?? 0) - draft.amount)}. ${destination?.name ?? 'Akun tujuan'}: ${formatCurrency((destination?.balance ?? 0) + draft.amount)}.`
      : `Transaksi bernilai ${formatCurrency(draft.amount)}. Pastikan akun dan nominal sudah benar.`} confirmLabel="Ya, simpan" loading={loading} onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void onSubmit({ ...draft, amount: parseMoney(amountText), splits: splitEnabled ? draft.splits : [] }).catch((cause) => setServerError(cause instanceof Error ? cause.message : 'Transaksi gagal disimpan.')); }} />
  </View>;
}
