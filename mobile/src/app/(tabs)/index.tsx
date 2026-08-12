import { ChevronLeft, ChevronRight, Landmark, Lightbulb, Plus, ReceiptText, Target } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { CashflowBarChart, DonutChart, WealthHistoryChart } from '@/components/finance/charts';
import { TransactionRow } from '@/components/finance/rows';
import { Amount } from '@/components/ui/amount';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { AppButton, IconButton } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { ProgressBar, StatusPill } from '@/components/ui/progress';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { categoryColors, spacing } from '@/constants/theme';
import { accountTotals, accountTotalsAtDate, expenseByCategory, recentTransactions, upcomingBills } from '@/domain/selectors';
import { useApp } from '@/providers/app-provider';
import { usePreferences } from '@/providers/preferences-provider';
import { formatCurrency, formatDate, formatMonth } from '@/utils/format';

const shiftMonth = (month: string, delta: number) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

export default function SummaryScreen() {
  const router = useRouter();
  const { snapshot, selectedMonth, setSelectedMonth, refresh, isRefreshing } = useApp();
  const { colors, privacyMode } = usePreferences();
  const totals = accountTotals(snapshot?.accounts ?? []);
  const categories = expenseByCategory(snapshot!, selectedMonth);
  const recent = recentTransactions(snapshot!, 5, selectedMonth);
  const bills = upcomingBills(snapshot!).slice(0, 3);
  const goals = snapshot!.goals.slice().sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 3);
  const accountMap = new Map(snapshot!.accounts.map((item) => [item.id, item.name]));
  const chartData = useMemo(() => {
    const points = new Map<string, { income: number; expense: number }>();
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const key = date.toISOString().slice(0, 10);
      points.set(key, { income: 0, expense: 0 });
    }
    snapshot!.transactions.forEach((transaction) => {
      const point = points.get(transaction.date);
      if (!point || transaction.status !== 'completed' || transaction.deletedAt) return;
      if (transaction.type === 'income') point.income += transaction.amount;
      if (transaction.type === 'expense') point.expense += transaction.amount;
      if (transaction.type === 'refund') point.expense = Math.max(0, point.expense - transaction.amount);
    });
    return [...points.entries()].map(([date, value]) => ({ label: date.slice(8), ...value }));
  }, [snapshot]);
  const wealthHistory = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const period = shiftMonth(selectedMonth, index - 6);
    const [year, month] = period.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endDate = `${period}-${String(lastDay).padStart(2, '0')}`;
    return {
      period,
      label: formatDate(`${period}-01`, { month: 'short' }).toUpperCase(),
      value: accountTotalsAtDate(snapshot!.accounts, snapshot!.transactions, endDate).netWorth,
    };
  }), [selectedMonth, snapshot]);
  const wealthChange = wealthHistory.at(-1)!.value - wealthHistory[0].value;
  const palette = [categoryColors.food, categoryColors.housing, categoryColors.bills, categoryColors.transport, categoryColors.entertainment];

  return (
    <AppScreen refreshing={isRefreshing} onRefresh={() => void refresh()}>
      <ScreenHeader title={`Halo, ${snapshot!.profile.name}`} subtitle={snapshot!.profile.storeName} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={ChevronLeft} label="Bulan sebelumnya" onPress={() => void setSelectedMonth(shiftMonth(selectedMonth, -1))} />
        <Pressable accessibilityRole="button"><AppText variant="title" style={{ textTransform: 'capitalize' }}>{formatMonth(selectedMonth)}</AppText></Pressable>
        <IconButton icon={ChevronRight} label="Bulan berikutnya" onPress={() => void setSelectedMonth(shiftMonth(selectedMonth, 1))} />
      </View>

      <Card style={{ gap: spacing.xs, backgroundColor: colors.primary }}>
        <AppText variant="label" style={{ color: '#dff8ee' }}>Kekayaan bersih</AppText>
        <Amount value={totals.netWorth} variant="amount" style={{ color: '#ffffff' }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
          <View><AppText variant="caption" style={{ color: '#dff8ee' }}>Total aset</AppText><AppText variant="label" style={{ color: '#ffffff' }}>{formatCurrency(totals.assets, privacyMode)}</AppText></View>
          <View style={{ alignItems: 'flex-end' }}><AppText variant="caption" style={{ color: '#dff8ee' }}>Kewajiban</AppText><AppText variant="label" style={{ color: '#ffffff' }}>{formatCurrency(totals.liabilities, privacyMode)}</AppText></View>
        </View>
      </Card>

      <View accessibilityLabel="Akses cepat" style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs }}>
        {[
          { label: 'Transaksi', icon: Plus, route: '/transaction/new' as const, primary: true },
          { label: 'Akun', icon: Landmark, route: '/accounts' as const },
          { label: 'Tagihan', icon: ReceiptText, route: '/module/bills' as const },
          { label: 'Target', icon: Target, route: '/goals' as const },
        ].map((action) => {
          const Icon = action.icon;
          return <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={() => router.push(action.route)} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, opacity: pressed ? .72 : 1 })}>
            <View style={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: action.primary ? colors.primary : colors.border, backgroundColor: action.primary ? colors.primary : colors.surface }}><Icon size={21} color={action.primary ? '#ffffff' : colors.primary} /></View>
            <AppText variant="caption" numberOfLines={1}>{action.label}</AppText>
          </Pressable>;
        })}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Card style={{ width: '48%', flexGrow: 1, gap: 5 }}><AppText variant="caption" muted>Pemasukan</AppText><Amount value={snapshot!.summary.income} variant="title" /><StatusPill label="Bulan ini" tone="positive" /></Card>
        <Card style={{ width: '48%', flexGrow: 1, gap: 5 }}><AppText variant="caption" muted>Pengeluaran</AppText><Amount value={snapshot!.summary.expense} variant="title" /><StatusPill label="Bulan ini" tone="negative" /></Card>
        <Card style={{ width: '48%', flexGrow: 1, gap: 5 }}><AppText variant="caption" muted>Arus kas</AppText><Amount value={snapshot!.summary.cashflow} signed variant="title" /><StatusPill label={snapshot!.summary.cashflow >= 0 ? 'Positif' : 'Defisit'} tone={snapshot!.summary.cashflow >= 0 ? 'positive' : 'negative'} /></Card>
        <Card style={{ width: '48%', flexGrow: 1, gap: 5 }}><AppText variant="caption" muted>Savings rate</AppText><AppText variant="title">{privacyMode ? '•••%' : `${snapshot!.summary.savingsRate.toFixed(1)}%`}</AppText><StatusPill label={snapshot!.summary.savingsRate >= 20 ? 'Sehat' : 'Perlu perhatian'} tone={snapshot!.summary.savingsRate >= 20 ? 'positive' : 'warning'} /></Card>
      </View>

      {bills.length ? <View style={{ gap: spacing.sm }}><SectionHeader title="Tagihan terdekat" action={<AppButton tone="ghost" onPress={() => router.push('/module/bills')}>Lihat semua</AppButton>} />{bills.map((bill) => <Card key={bill.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><View style={{ flex: 1 }}><AppText variant="label">{bill.name}</AppText><AppText variant="caption" muted>Jatuh tempo {bill.dueDate}</AppText></View><Amount value={bill.amount} variant="label" /></Card>)}</View> : null}

      <Card style={{ gap: spacing.md }}>
        <SectionHeader
          title="Riwayat kekayaan"
          subtitle="Perkembangan 7 bulan"
          action={<View style={{ maxWidth: '46%' }}><Amount value={wealthChange} signed variant="label" numberOfLines={1} adjustsFontSizeToFit /></View>}
        />
        <WealthHistoryChart data={wealthHistory} />
      </Card>

      <Card style={{ gap: spacing.md }}><SectionHeader title="Arus kas 14 hari" subtitle="Hijau pemasukan, merah pengeluaran" /><CashflowBarChart data={chartData} /></Card>

      <Card style={{ gap: spacing.md }}>
        <SectionHeader title="Komposisi pengeluaran" subtitle={categories.length ? `${categories.length} kategori bulan ini` : 'Belum ada pengeluaran'} />
        {categories.length ? <DonutChart items={categories.map((item, index) => ({ label: item.category, value: item.amount, color: snapshot!.categories.find((category) => category.name === item.category)?.color ?? palette[index] }))} /> : <AppText muted>Catat pengeluaran untuk melihat komposisinya.</AppText>}
      </Card>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Akun" action={<AppButton tone="ghost" onPress={() => router.push('/accounts')}>Lihat semua</AppButton>} />
        {snapshot!.accounts.slice(0, 4).map((account) => <Card key={account.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><View style={{ width: 10, height: 40, borderRadius: 5, backgroundColor: account.color }} /><View style={{ flex: 1 }}><AppText variant="label">{account.name}</AppText><AppText variant="caption" muted>{account.type}</AppText></View><Amount value={account.balance} variant="label" /></Card>)}
      </View>

      {goals.length ? <View style={{ gap: spacing.sm }}><SectionHeader title="Kemajuan target" action={<AppButton tone="ghost" onPress={() => router.navigate('/goals')}>Lihat semua</AppButton>} />{goals.map((goal) => <Card key={goal.id} style={{ gap: spacing.xs }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><AppText variant="label">{goal.name}</AppText><Amount value={goal.current} variant="caption" /></View><ProgressBar value={goal.target ? goal.current / goal.target * 100 : 0} label={`Kemajuan ${goal.name}`} color={goal.color} /></Card>)}</View> : null}

      <View style={{ gap: spacing.sm }}><SectionHeader title="Transaksi terbaru" action={<AppButton tone="ghost" onPress={() => router.navigate('/transactions')}>Lihat semua</AppButton>} /><Card>{recent.length ? recent.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} accountName={accountMap.get(transaction.accountId)} onPress={() => router.push(`/transaction/${transaction.id}`)} />) : <AppText muted>Belum ada transaksi pada periode ini.</AppText>}</Card></View>

      <AppButton icon={Lightbulb} tone="secondary" fullWidth onPress={() => router.push('/module/insight')}>Buka Financial Insight</AppButton>

    </AppScreen>
  );
}
