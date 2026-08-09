import { useLocalSearchParams, useRouter } from 'expo-router';
import { Archive, Scale } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { TransactionRow } from '@/components/finance/rows';
import { AppScreen } from '@/components/ui/app-screen';
import { Amount } from '@/components/ui/amount';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { AppBottomSheet, ConfirmDialog } from '@/components/ui/dialogs';
import { FormField, MoneyInput, SelectField } from '@/components/ui/forms';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { ACCOUNT_TYPES } from '@/domain/constants';
import type { AccountType } from '@/domain/types';
import { useApp } from '@/providers/app-provider';
import { usePreferences } from '@/providers/preferences-provider';
import { parseMoney } from '@/utils/format';
import { spacing } from '@/constants/theme';

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const creating = id === 'new';
  const router = useRouter();
  const { snapshot, mutate, isMutating, isOnline } = useApp();
  const { colors } = usePreferences();
  const account = snapshot?.accounts.find((item) => item.id === id);
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'Bank');
  const [institution, setInstitution] = useState(account?.institution ?? '');
  const [mask, setMask] = useState(account?.mask ?? '');
  const [openingBalance, setOpeningBalance] = useState(String(account?.openingBalance || ''));
  const [actualBalance, setActualBalance] = useState(String(account?.balance ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const history = useMemo(() => snapshot?.transactions.filter((item) => item.accountId === id || item.destinationAccountId === id).slice(0, 20) ?? [], [id, snapshot?.transactions]);

  if (!creating && !account) return <AppScreen><ScreenHeader title="Akun" back menu={false} /><AppText>Akun tidak ditemukan.</AppText></AppScreen>;
  const save = async () => {
    if (!name.trim()) { setError('Nama akun wajib diisi.'); return; }
    try {
      setError(null);
      await mutate(creating ? 'createAccount' : 'updateAccount', creating
        ? { name: name.trim(), type, institution, mask, openingBalance: parseMoney(openingBalance), color: '#126b59' }
        : { accountId: id, name: name.trim(), type, institution, mask, color: account?.color ?? '#126b59' });
      router.back();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Akun gagal disimpan.'); }
  };

  return <AppScreen>
    <ScreenHeader title={creating ? 'Akun baru' : account?.name ?? 'Akun'} subtitle={creating ? 'Tambahkan sumber dana atau kewajiban' : account?.type} back menu={false} />
    {!creating && account ? <Card style={{ gap: spacing.xs }}><AppText variant="caption" muted>Saldo ledger saat ini</AppText><Amount value={account.balance} variant="amount" /><AppText variant="caption" muted>Saldo awal {account.openingBalance.toLocaleString('id-ID')}</AppText></Card> : null}
    <FormField label="Nama akun" required value={name} onChangeText={setName} maxLength={100} />
    <SelectField label="Jenis akun" value={type} onChange={(value) => setType(value as AccountType)} options={ACCOUNT_TYPES.map((value) => ({ label: value, value }))} />
    <FormField label="Institusi" value={institution} onChangeText={setInstitution} maxLength={100} placeholder="Opsional" />
    <FormField label="Nomor singkat / mask" value={mask} onChangeText={setMask} maxLength={40} placeholder="Contoh: •••• 1234" />
    {creating ? <MoneyInput label="Saldo awal" value={openingBalance} onChangeValue={setOpeningBalance} hint="Saldo awal tidak dapat diedit langsung setelah akun dibuat." /> : null}
    {error ? <Card style={{ borderColor: colors.negative }}><AppText style={{ color: colors.negative }}>{error}</AppText></Card> : null}
    <AppButton fullWidth loading={isMutating} disabled={!isOnline} onPress={() => void save()}>{creating ? 'Buat akun' : 'Simpan perubahan'}</AppButton>
    {!creating && account ? <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}><AppButton tone="secondary" icon={Scale} disabled={!isOnline} onPress={() => setReconcileOpen(true)}>Rekonsiliasi</AppButton><AppButton tone="danger" icon={Archive} disabled={!isOnline} onPress={() => setArchiveOpen(true)}>Arsipkan</AppButton></View>
      <SectionHeader title="Histori akun" subtitle="20 transaksi terbaru pada snapshot" />
      {history.length ? history.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} accountName={account.name} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: transaction.transferGroupId || transaction.id } })} />) : <AppText muted>Belum ada transaksi pada akun ini.</AppText>}
    </> : null}
    <AppBottomSheet visible={reconcileOpen} title="Rekonsiliasi saldo" onClose={() => setReconcileOpen(false)} footer={<AppButton fullWidth loading={isMutating} onPress={() => { if (!account) return; void mutate('reconcileAccount', { accountId: account.id, actualBalance: parseMoney(actualBalance) }).then(() => setReconcileOpen(false)).catch((cause) => setError(cause instanceof Error ? cause.message : 'Rekonsiliasi gagal.')); }}>Konfirmasi adjustment</AppButton>}>
      <AppText muted>Selisih terhadap saldo ledger akan dibuat sebagai adjustment_in atau adjustment_out. Saldo lama tidak ditimpa.</AppText><MoneyInput label="Saldo aktual" value={actualBalance} onChangeValue={setActualBalance} />
    </AppBottomSheet>
    <ConfirmDialog visible={archiveOpen} title="Arsipkan akun?" message="Backend hanya mengizinkan arsip jika akun tidak lagi direferensikan transaksi atau tagihan." destructive loading={isMutating} confirmLabel="Arsipkan" onCancel={() => setArchiveOpen(false)} onConfirm={() => { if (!account) return; void mutate('archiveAccount', { accountId: account.id }).then(() => router.back()).catch((cause) => { setArchiveOpen(false); setError(cause instanceof Error ? cause.message : 'Akun tidak dapat diarsipkan.'); }); }} />
  </AppScreen>;
}
