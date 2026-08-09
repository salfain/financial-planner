import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { GoalCard } from '@/components/finance/rows';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { AppBottomSheet, ConfirmDialog } from '@/components/ui/dialogs';
import { DateField, FormField, MoneyInput, SelectField } from '@/components/ui/forms';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/state-view';
import { spacing } from '@/constants/theme';
import type { Goal } from '@/domain/types';
import { useApp } from '@/providers/app-provider';
import { usePreferences } from '@/providers/preferences-provider';
import { formatCurrency, parseMoney, today } from '@/utils/format';

type GoalMode = 'form' | 'contribute';

export default function GoalsScreen() {
  const { snapshot, mutate, isMutating, isOnline, refresh, isRefreshing } = useApp();
  const { colors } = usePreferences();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [mode, setMode] = useState<GoalMode>('form');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [deadline, setDeadline] = useState(today());
  const [accountId, setAccountId] = useState('');
  const [contribution, setContribution] = useState('');
  const [contributionMode, setContributionMode] = useState('add');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const goals = snapshot?.goals ?? [];

  const recommendation = useMemo(() => {
    if (!editing) return 0;
    const end = new Date(`${editing.deadline}T12:00:00`);
    const now = new Date();
    const months = Math.max(1, (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth());
    return Math.ceil(Math.max(0, editing.target - editing.current) / months);
  }, [editing]);

  const showForm = (goal?: Goal) => {
    setMode('form'); setEditing(goal ?? null); setName(goal?.name ?? ''); setTarget(goal ? String(goal.target) : ''); setCurrent(goal ? String(goal.current) : ''); setDeadline(goal?.deadline || today()); setAccountId(goal?.accountId ?? ''); setError(null); setOpen(true);
  };
  const showContribution = (goal: Goal) => { setMode('contribute'); setEditing(goal); setContribution(''); setContributionMode('add'); setError(null); setOpen(true); };
  const save = async () => {
    try {
      setError(null);
      if (mode === 'contribute' && editing) {
        if (parseMoney(contribution) <= 0) throw new Error('Masukkan nominal kontribusi lebih dari 0.');
        await mutate('contributeGoal', { goalId: editing.id, amount: parseMoney(contribution), mode: contributionMode });
      } else if (editing) {
        if (!name.trim() || parseMoney(target) <= 0) throw new Error('Nama dan nominal target wajib diisi.');
        await mutate('updateGoal', { goalId: editing.id, name: name.trim(), targetAmount: parseMoney(target), deadline, color: editing.color, icon: editing.icon });
      } else {
        if (!name.trim() || parseMoney(target) <= 0) throw new Error('Nama dan nominal target wajib diisi.');
        await mutate('createGoal', { name: name.trim(), targetAmount: parseMoney(target), currentAmount: parseMoney(current), deadline, accountId, color: '#126b59', icon: 'target' });
      }
      setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Target gagal disimpan.'); }
  };

  return <AppScreen refreshing={isRefreshing} onRefresh={() => void refresh()}>
    <ScreenHeader title="Target" subtitle="Ubah rencana menjadi kemajuan" />
    <AppButton icon={Plus} fullWidth disabled={!isOnline} onPress={() => showForm()}>Tambah target</AppButton>
    {!goals.length ? <EmptyState title="Belum ada target" message="Buat target finansial dan pantau rekomendasi kontribusinya." /> : goals.map((goal) => <View key={goal.id} style={{ gap: spacing.xs }}><GoalCard goal={goal} onPress={() => showForm(goal)} /><View style={{ flexDirection: 'row', gap: spacing.xs }}><AppButton tone="secondary" disabled={!isOnline} onPress={() => showContribution(goal)}>Kontribusi</AppButton><AppButton tone="ghost" disabled={!isOnline} onPress={() => setDeleting(goal)}>Hapus</AppButton></View></View>)}
    <AppBottomSheet visible={open} title={mode === 'contribute' ? `Kontribusi ${editing?.name ?? ''}` : editing ? 'Ubah target' : 'Target baru'} onClose={() => setOpen(false)} footer={<AppButton fullWidth loading={isMutating} disabled={!isOnline} onPress={() => void save()}>Simpan</AppButton>}>
      {mode === 'contribute' ? <>
        <Card style={{ gap: spacing.xs }}><AppText variant="label">Rekomendasi bulanan</AppText><AppText variant="title">{formatCurrency(recommendation)}</AppText><AppText variant="caption" muted>Perkiraan sederhana berdasarkan sisa target dan deadline.</AppText></Card>
        <SelectField label="Aksi" value={contributionMode} onChange={setContributionMode} options={[{ label: 'Tambah dana', value: 'add' }, { label: 'Kurangi dana', value: 'withdraw' }]} />
        <MoneyInput label="Nominal" value={contribution} onChangeValue={setContribution} />
      </> : <>
        <FormField label="Nama target" value={name} onChangeText={setName} maxLength={100} />
        <MoneyInput label="Nominal target" value={target} onChangeValue={setTarget} />
        {!editing ? <MoneyInput label="Dana terkumpul awal" value={current} onChangeValue={setCurrent} /> : null}
        <DateField label="Deadline" value={deadline} onChange={setDeadline} minimumDate={new Date()} />
        {!editing ? <SelectField label="Akun referensi" value={accountId} onChange={setAccountId} options={[{ label: 'Tanpa akun referensi', value: '' }, ...(snapshot?.accounts.filter((item) => !item.liability).map((item) => ({ label: item.name, value: item.id })) ?? [])]} /> : null}
      </>}
      {error ? <AppText style={{ color: colors.negative }}>{error}</AppText> : null}
    </AppBottomSheet>
    <ConfirmDialog visible={Boolean(deleting)} title="Hapus target?" message={`Target ${deleting?.name ?? ''} akan dihapus. Saldo akun tidak berubah.`} destructive loading={isMutating} confirmLabel="Hapus" onCancel={() => setDeleting(null)} onConfirm={() => { if (!deleting) return; void mutate('deleteGoal', { goalId: deleting.id }).then(() => setDeleting(null)).catch((cause) => setError(cause instanceof Error ? cause.message : 'Gagal menghapus.')); }} />
  </AppScreen>;
}
