import { useLocalSearchParams } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { PlanBadge } from '@/components/ui/progress';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/state-view';
import {
  AuditModule, CategoriesModule, InsightModule, IntegrityModule, InvestmentsModule,
  PortabilityModule, ReportsModule,
} from '@/components/modules/advanced-modules';
import { BillsModule, CalendarModule, FundsModule, RecurringModule, ReviewModule } from '@/components/modules/operations-modules';
import { DebtsModule, EmergencyModule, ForecastModule, RoadmapModule } from '@/components/modules/planning-modules';
import { spacing } from '@/constants/theme';
import type { PlanCapability } from '@/domain/types';
import { useApp } from '@/providers/app-provider';
import { usePreferences } from '@/providers/preferences-provider';

const CONFIG: Record<string, { title: string; subtitle: string; capability?: PlanCapability; tier?: 'pro' | 'premium' }> = {
  funds: { title: 'Pos Dana', subtitle: 'Alokasi tercatat tanpa mengubah saldo', capability: 'planning', tier: 'pro' },
  bills: { title: 'Tagihan', subtitle: 'Jatuh tempo dan pembayaran manual' },
  calendar: { title: 'Kalender Keuangan', subtitle: 'Agenda finansial bulan berjalan' },
  recurring: { title: 'Transaksi Rutin', subtitle: 'Template dengan konfirmasi ledger', capability: 'recurring', tier: 'pro' },
  roadmap: { title: 'Roadmap', subtitle: 'Simulasi rencana jangka panjang', capability: 'planning', tier: 'pro' },
  forecast: { title: 'Cashflow Forecast', subtitle: 'Proyeksi kas dan buffer', capability: 'planning', tier: 'pro' },
  emergency: { title: 'Dana Darurat', subtitle: 'Coverage, gap, dan safety score', capability: 'planning', tier: 'pro' },
  debts: { title: 'Pelunasan Utang', subtitle: 'Avalanche dan snowball', capability: 'planning', tier: 'pro' },
  investments: { title: 'Investasi', subtitle: 'Portfolio berbasis harga manual/delayed', capability: 'investments', tier: 'premium' },
  review: { title: 'Review Bulanan', subtitle: 'Periksa lalu tutup buku' },
  reports: { title: 'Laporan', subtitle: 'PDF, CSV, Drive, dan share', capability: 'pdf_reports', tier: 'pro' },
  insight: { title: 'Financial Insight', subtitle: 'AI read-only dengan konteks minimum', capability: 'ai', tier: 'premium' },
  portability: { title: 'Backup & Migrasi', subtitle: 'Portabilitas data tervalidasi' },
  categories: { title: 'Kategori', subtitle: 'Kelola klasifikasi transaksi' },
  integrity: { title: 'Kesehatan Ledger', subtitle: 'Preview integritas dan rekalkulasi aman' },
  audit: { title: 'Audit Log', subtitle: 'Riwayat perubahan penting' },
};

const MODULES: Record<string, () => ReactNode> = {
  funds: () => <FundsModule />, bills: () => <BillsModule />, calendar: () => <CalendarModule />,
  recurring: () => <RecurringModule />, roadmap: () => <RoadmapModule />, forecast: () => <ForecastModule />,
  emergency: () => <EmergencyModule />, debts: () => <DebtsModule />, investments: () => <InvestmentsModule />,
  review: () => <ReviewModule />, reports: () => <ReportsModule />, insight: () => <InsightModule />,
  portability: () => <PortabilityModule />, categories: () => <CategoriesModule />, integrity: () => <IntegrityModule />,
  audit: () => <AuditModule />,
};

export default function ModuleScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const { snapshot } = useApp();
  const { colors } = usePreferences();
  const config = CONFIG[slug];
  const locked = Boolean(config?.capability && !snapshot?.entitlement.capabilities[config.capability]);
  return <AppScreen>
    <ScreenHeader title={config?.title ?? 'Modul'} subtitle={config?.subtitle} back menu={false} />
    {!config || !MODULES[slug] ? <EmptyState title="Modul tidak ditemukan" message="Kembali ke menu dan pilih fitur yang tersedia." /> : locked ? <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl }}><LockKeyhole size={34} color={colors.primary} /><AppText variant="title">Fitur {config.tier === 'premium' ? 'Premium' : 'Pro'}</AppText>{config.tier ? <PlanBadge tier={config.tier} /> : null}<AppText muted style={{ textAlign: 'center' }}>Lisensi backend belum memberikan capability untuk modul ini. Data tetap aman dan tidak diubah.</AppText></Card> : MODULES[slug]()}
  </AppScreen>;
}
