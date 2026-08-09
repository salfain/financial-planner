import { useRouter } from 'expo-router';
import { Plus, ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { AccountCard } from '@/components/finance/rows';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/state-view';
import { spacing } from '@/constants/theme';
import { accountTotals } from '@/domain/selectors';
import { useApp } from '@/providers/app-provider';
import { Amount } from '@/components/ui/amount';
import { CsvImporter } from '@/components/finance/csv-importer';

export default function AccountsScreen() {
  const router = useRouter();
  const { snapshot, refresh, isRefreshing, isOnline } = useApp();
  const accounts = snapshot?.accounts ?? [];
  const totals = accountTotals(accounts);
  return <AppScreen refreshing={isRefreshing} onRefresh={() => void refresh()}>
    <ScreenHeader title="Akun & saldo" subtitle="Saldo bersumber dari ledger" back menu={false} />
    <View style={{ flexDirection: 'row', gap: spacing.xs }}><Card style={{ flex: 1, gap: 4 }}><AppText variant="caption" muted>Total aset</AppText><Amount value={totals.assets} variant="title" /></Card><Card style={{ flex: 1, gap: 4 }}><AppText variant="caption" muted>Kewajiban</AppText><Amount value={totals.liabilities} variant="title" /></Card></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}><AppButton icon={Plus} disabled={!isOnline} onPress={() => router.push('/accounts/new')}>Tambah akun</AppButton><CsvImporter kind="accounts" /></View>
    {!accounts.length ? <EmptyState title="Belum ada akun" message="Tambahkan bank, e-wallet, cash, atau akun kewajiban." /> : accounts.map((account) => <AccountCard key={account.id} account={account} onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: account.id } })} />)}
    <Card style={{ gap: spacing.xs }}><ShieldCheck size={22} color="#126b59" /><AppText variant="label">Ledger sebagai sumber kebenaran</AppText><AppText muted>Saldo akun tidak diedit langsung. Rekonsiliasi membuat adjustment tercatat dan dapat diaudit.</AppText></Card>
  </AppScreen>;
}
