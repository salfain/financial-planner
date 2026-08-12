import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Bell, Target, WalletCards } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import type { Account, Budget, Goal, Transaction } from '@/domain/types';
import { usePreferences } from '@/providers/preferences-provider';
import { formatDate } from '@/utils/format';
import { Amount } from '@/components/ui/amount';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { ProgressBar, StatusPill } from '@/components/ui/progress';

export function TransactionRow({ transaction, accountName, onPress }: { transaction: Transaction; accountName?: string; onPress?: () => void }) {
  const { colors } = usePreferences();
  const positive = transaction.type === 'income' || transaction.type === 'refund';
  const sign = positive ? 1 : transaction.type === 'transfer' ? 0 : -1;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${transaction.title}, ${transaction.category}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingVertical: spacing.sm, opacity: pressed ? 0.72 : 1,
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: positive ? `${colors.positive}18` : transaction.type === 'transfer' ? colors.primarySoft : `${colors.negative}18` }}>
        {positive ? <ArrowDownLeft size={20} color={colors.positive} /> : transaction.type === 'transfer' ? <ArrowRightLeft size={20} color={colors.primary} /> : <ArrowUpRight size={20} color={colors.negative} />}
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="label" numberOfLines={1}>{transaction.title}</AppText>
        <AppText variant="caption" muted numberOfLines={1}>{transaction.category} · {accountName ?? 'Akun'} · {formatDate(transaction.date, { day: 'numeric', month: 'short' })}</AppText>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Amount value={sign * transaction.amount} signed={sign !== 0} variant="label" />
        {transaction.status === 'pending' ? <StatusPill label="Pending" tone="warning" /> : null}
      </View>
    </Pressable>
  );
}

export function AccountCard({ account, onPress }: { account: Account; onPress?: () => void }) {
  const { colors } = usePreferences();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => <Card style={{ opacity: pressed ? 0.75 : 1, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: `${account.color || colors.primary}20` }}>
            <WalletCards size={20} color={account.color || colors.primary} />
          </View>
          <View style={{ flex: 1 }}><AppText variant="label">{account.name}</AppText><AppText variant="caption" muted>{account.type}{account.institution ? ` · ${account.institution}` : ''}</AppText></View>
          {account.liability ? <StatusPill label="Kewajiban" tone="warning" /> : <StatusPill label="Aset" tone="positive" />}
        </View>
        <Amount value={account.balance} variant="title" />
      </Card>}
    </Pressable>
  );
}

export function BudgetCard({ budget, actual, transactionCount, onPress }: { budget: Budget; actual: number; transactionCount?: number; onPress?: () => void }) {
  const ratio = budget.limit > 0 ? actual / budget.limit * 100 : 0;
  const tone = ratio >= 100 ? 'negative' : ratio >= 90 ? 'warning' : ratio >= 75 ? 'info' : 'positive';
  const label = ratio >= 100 ? 'Terlewati' : ratio >= 90 ? 'Hampir penuh' : ratio >= 75 ? 'Peringatan' : 'Aman';
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>{({ pressed }) => <Card style={{ opacity: pressed ? 0.75 : 1, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}><AppText variant="title" style={{ flex: 1 }}>{budget.category}</AppText><StatusPill label={label} tone={tone} /></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Amount value={actual} variant="label" /><Amount value={budget.limit} variant="label" /></View>
      <ProgressBar value={ratio} label={`${label}, realisasi anggaran ${Math.round(ratio)} persen`} color={budget.color} />
      {transactionCount !== undefined ? <AppText variant="caption" muted>{transactionCount} transaksi diperhitungkan pada periode ini</AppText> : null}
    </Card>}</Pressable>
  );
}

export function GoalCard({ goal, onPress }: { goal: Goal; onPress?: () => void }) {
  const { colors } = usePreferences();
  const ratio = goal.target > 0 ? goal.current / goal.target * 100 : 0;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>{({ pressed }) => <Card style={{ opacity: pressed ? 0.75 : 1, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: `${goal.color || colors.primary}20` }}><Target size={20} color={goal.color || colors.primary} /></View>
        <View style={{ flex: 1 }}><AppText variant="title">{goal.name}</AppText><AppText variant="caption" muted>Target {formatDate(goal.deadline)}</AppText></View>
        {ratio >= 100 ? <StatusPill label="Tercapai" tone="positive" /> : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Amount value={goal.current} variant="label" /><Amount value={goal.target} variant="label" /></View>
      <ProgressBar value={ratio} label={`Kemajuan target ${Math.round(ratio)} persen`} color={goal.color} />
    </Card>}</Pressable>
  );
}

export function NotificationRow({ title, message, read, date, onPress }: { title: string; message: string; read?: boolean; date?: string; onPress?: () => void }) {
  const { colors } = usePreferences();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: read ? colors.surfaceAlt : colors.primarySoft }}><Bell size={19} color={read ? colors.textMuted : colors.primary} /></View>
      <View style={{ flex: 1 }}><AppText variant="label">{title}</AppText><AppText variant="caption" muted>{message}</AppText>{date ? <AppText variant="caption" muted style={{ marginTop: 3 }}>{formatDate(date)}</AppText> : null}</View>
      {!read ? <View accessibilityLabel="Belum dibaca" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 8 }} /> : null}
    </Pressable>
  );
}
