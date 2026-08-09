import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { BudgetCard } from '@/components/finance/rows';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { AppBottomSheet, ConfirmDialog } from '@/components/ui/dialogs';
import { MoneyInput, SelectField, SwitchField } from '@/components/ui/forms';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/state-view';
import { spacing } from '@/constants/theme';
import { budgetActual } from '@/domain/selectors';
import type { Budget } from '@/domain/types';
import { useApp } from '@/providers/app-provider';
import { usePreferences } from '@/providers/preferences-provider';
import { parseMoney } from '@/utils/format';

export default function BudgetsScreen() {
  const { snapshot, selectedMonth, mutate, isMutating, isOnline, refresh, isRefreshing } = useApp();
  const { colors } = usePreferences();
  const [editing, setEditing] = useState<Budget | null>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [rollover, setRollover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const budgets = useMemo(() => (snapshot?.budgets ?? []).filter((item) => !item.period || item.period === selectedMonth), [selectedMonth, snapshot?.budgets]);
  const categories = snapshot?.categories.filter((item) => item.active && item.type === 'expense') ?? [];

  const showForm = (budget?: Budget) => {
    setEditing(budget ?? null); setCategory(budget?.category ?? ''); setAmount(budget ? String(budget.limit) : ''); setRollover(Boolean(budget?.rollover)); setError(null); setOpen(true);
  };
  const save = async () => {
    if (!category || parseMoney(amount) <= 0) { setError('Kategori dan batas anggaran wajib diisi.'); return; }
    setError(null);
    try {
      await mutate(editing ? 'updateBudget' : 'upsertBudget', editing
        ? { budgetId: editing.id, limitAmount: parseMoney(amount), color: editing.color }
        : { month: selectedMonth, category, limitAmount: parseMoney(amount), rollover });
      setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Anggaran gagal disimpan.'); }
  };

  return <AppScreen refreshing={isRefreshing} onRefresh={() => void refresh()}>
    <ScreenHeader title="Anggaran" subtitle="Jaga pengeluaran tetap terarah" />
    <AppButton icon={Plus} fullWidth disabled={!isOnline} onPress={() => showForm()}>Tambah anggaran</AppButton>
    {!budgets.length ? <EmptyState title="Belum ada anggaran" message="Tentukan batas pengeluaran per kategori untuk bulan ini." /> : budgets.map((budget) => <View key={budget.id} style={{ gap: spacing.xs }}><BudgetCard budget={budget} actual={snapshot ? budgetActual(budget, snapshot) : 0} onPress={() => showForm(budget)} /><AppButton tone="ghost" disabled={!isOnline} onPress={() => setDeleting(budget)}>Hapus</AppButton></View>)}
    <Card style={{ gap: spacing.xs }}><AppText variant="label">Realisasi yang akurat</AppText><AppText muted>Split kategori ikut dihitung dan refund mengurangi realisasi anggaran.</AppText></Card>
    <AppBottomSheet visible={open} title={editing ? 'Ubah anggaran' : 'Anggaran baru'} onClose={() => setOpen(false)} footer={<AppButton fullWidth loading={isMutating} disabled={!isOnline} onPress={() => void save()}>Simpan anggaran</AppButton>}>
      <SelectField label="Kategori" value={category} onChange={setCategory} error={!category && error ? 'Pilih kategori.' : undefined} options={categories.map((item) => ({ label: item.name, value: item.name, disabled: Boolean(editing) }))} />
      <MoneyInput label="Batas bulanan" value={amount} onChangeValue={setAmount} error={parseMoney(amount) <= 0 && error ? 'Masukkan nominal lebih dari 0.' : undefined} />
      {!editing ? <SwitchField label="Rollover" description="Sisa batas dibawa sesuai dukungan backend." value={rollover} onChange={setRollover} /> : null}
      {error ? <AppText style={{ color: colors.negative }}>{error}</AppText> : null}
    </AppBottomSheet>
    <ConfirmDialog visible={Boolean(deleting)} title="Hapus anggaran?" message={`Anggaran ${deleting?.category ?? ''} akan dihapus untuk periode ini.`} destructive loading={isMutating} confirmLabel="Hapus" onCancel={() => setDeleting(null)} onConfirm={() => { if (!deleting) return; void mutate('deleteBudget', { budgetId: deleting.id }).then(() => setDeleting(null)).catch((cause) => setError(cause instanceof Error ? cause.message : 'Gagal menghapus.')); }} />
  </AppScreen>;
}
