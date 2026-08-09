import { useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { Archive, BarChart3, BookCheck, CalendarDays, ChevronRight, CircleDollarSign, FileText, Landmark, Lightbulb, PiggyBank, ReceiptText, RefreshCw, Settings, Shield, TrendingUp, WalletCards } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { PlanBadge } from '@/components/ui/progress';
import { ScreenHeader } from '@/components/ui/screen-header';
import { radius, spacing } from '@/constants/theme';
import type { OptionalFeatureKey, PlanCapability } from '@/domain/types';
import { useApp } from '@/providers/app-provider';
import { usePreferences } from '@/providers/preferences-provider';

type Item = { slug: string; label: string; description: string; icon: LucideIcon; feature?: OptionalFeatureKey; capability?: PlanCapability; tier?: 'pro' | 'premium' };
const ITEMS: Item[] = [
  { slug: 'accounts', label: 'Akun', description: 'Saldo, rekonsiliasi, dan integritas ledger', icon: WalletCards },
  { slug: 'funds', label: 'Pos Dana', description: 'Alokasi kebutuhan tanpa menghitung uang dua kali', icon: PiggyBank, feature: 'funds', capability: 'planning', tier: 'pro' },
  { slug: 'bills', label: 'Tagihan', description: 'Jatuh tempo, cicilan, dan pembayaran manual', icon: ReceiptText, feature: 'bills' },
  { slug: 'calendar', label: 'Kalender Keuangan', description: 'Agenda pemasukan, tagihan, rutin, dan target', icon: CalendarDays, feature: 'calendar' },
  { slug: 'recurring', label: 'Transaksi Rutin', description: 'Template yang dicatat ke ledger setelah konfirmasi', icon: RefreshCw, feature: 'recurring', capability: 'recurring', tier: 'pro' },
  { slug: 'roadmap', label: 'Roadmap', description: 'Proyeksi net worth hingga 60 bulan', icon: TrendingUp, feature: 'roadmap', capability: 'planning', tier: 'pro' },
  { slug: 'forecast', label: 'Cashflow Forecast', description: 'Skenario kas 30–90 hari', icon: BarChart3, feature: 'forecast', capability: 'planning', tier: 'pro' },
  { slug: 'emergency', label: 'Dana Darurat', description: 'Coverage dan estimasi waktu tercapai', icon: Shield, feature: 'emergency', capability: 'planning', tier: 'pro' },
  { slug: 'debts', label: 'Pelunasan Utang', description: 'Strategi avalanche dan snowball', icon: Landmark, feature: 'debts', capability: 'planning', tier: 'pro' },
  { slug: 'investments', label: 'Investasi', description: 'Portfolio, average cost, dan profit/loss', icon: CircleDollarSign, feature: 'investments', capability: 'investments', tier: 'premium' },
  { slug: 'review', label: 'Review Bulanan', description: 'Periksa dan tutup buku dengan aman', icon: BookCheck, feature: 'review' },
  { slug: 'reports', label: 'Laporan', description: 'PDF, CSV, Drive, dan native share', icon: FileText, feature: 'reports', capability: 'pdf_reports', tier: 'pro' },
  { slug: 'insight', label: 'Financial Insight', description: 'Analisis AI read-only dengan konteks minimum', icon: Lightbulb, feature: 'assistant', capability: 'ai', tier: 'premium' },
  { slug: 'portability', label: 'Backup & Migrasi', description: 'Backup Drive dan migrasi tervalidasi', icon: Archive },
];

export default function MenuScreen() {
  const router = useRouter();
  const { snapshot } = useApp();
  const { colors } = usePreferences();
  const visible = ITEMS.filter((item) => !item.feature || snapshot?.featurePreferences[item.feature] !== false);
  return <AppScreen>
    <ScreenHeader title="Menu lainnya" subtitle={snapshot?.profile.storeName} back menu={false} />
    {visible.map((item) => {
      const Icon = item.icon;
      const locked = Boolean(item.capability && !snapshot?.entitlement.capabilities[item.capability]);
      return <Pressable key={item.slug} accessibilityRole="button" onPress={() => item.slug === 'accounts' ? router.push('/accounts') : router.push({ pathname: '/module/[slug]', params: { slug: item.slug } })} style={({ pressed }) => ({ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.sm, backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderWidth: 1, borderColor: colors.border })}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}><Icon size={21} color={colors.primary} /></View>
        <View style={{ flex: 1 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}><AppText variant="label">{item.label}</AppText>{locked && item.tier ? <PlanBadge tier={item.tier} /> : null}</View><AppText variant="caption" muted numberOfLines={2}>{item.description}</AppText></View><ChevronRight size={19} color={colors.textMuted} />
      </Pressable>;
    })}
    <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={({ pressed }) => ({ minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.sm, backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderWidth: 1, borderColor: colors.border })}><Settings size={22} color={colors.primary} /><View style={{ flex: 1 }}><AppText variant="label">Pengaturan</AppText><AppText variant="caption" muted>Profil, tema, privasi, fitur, kategori, lisensi</AppText></View><ChevronRight size={19} color={colors.textMuted} /></Pressable>
  </AppScreen>;
}
