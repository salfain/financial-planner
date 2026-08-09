import { useRouter } from 'expo-router';
import { CheckCheck, Settings2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { NotificationRow } from '@/components/finance/rows';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { AppBottomSheet } from '@/components/ui/dialogs';
import { SelectField, SwitchField } from '@/components/ui/forms';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-view';
import { useApp } from '@/providers/app-provider';

type Notification = { id: string; title: string; message: string; read: boolean; eventDate?: string; actionPage?: string };
type Settings = { enabled: boolean; billReminderDays: number[]; budgetWarningPercent: number; backupWarningDays: number; goalWarningDays: number };
const DEFAULT_SETTINGS: Settings = { enabled: true, billReminderDays: [7, 3, 1, 0], budgetWarningPercent: 75, backupWarningDays: 7, goalWarningDays: 30 };

export default function NotificationsScreen() {
  const router = useRouter();
  const { selectedMonth, read, mutate, isMutating, isOnline } = useApp();
  const [items, setItems] = useState<Notification[]>([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!isOnline) { setLoading(false); return; }
    try {
      const value = await read<{ notifications?: Notification[]; settings?: Settings }>('notificationOverview', { period: selectedMonth });
      setItems(value.notifications ?? []); setSettings(value.settings ?? DEFAULT_SETTINGS); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Notifikasi gagal dimuat.'); } finally { setLoading(false); }
  }, [isOnline, read, selectedMonth]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  const openItem = async (item: Notification) => {
    if (!item.read) await mutate('updateNotificationState', { notificationIds: [item.id], action: 'read' });
    if (item.actionPage === 'budgets') router.replace('/budgets');
    else if (item.actionPage === 'goals') router.replace('/goals');
    else if (item.actionPage === 'settings') router.push('/settings');
    else if (item.actionPage) router.push({ pathname: '/module/[slug]', params: { slug: item.actionPage } });
    else void load();
  };
  return <AppScreen refreshing={loading} onRefresh={() => void load()}>
    <ScreenHeader title="Notifikasi" subtitle="Pengingat finansial dalam aplikasi" back menu={false} />
    <View style={{ flexDirection: 'row', gap: 8 }}><AppButton tone="secondary" icon={CheckCheck} disabled={!items.some((item) => !item.read) || !isOnline} onPress={() => { const ids = items.filter((item) => !item.read).map((item) => item.id); if (ids.length) void mutate('updateNotificationState', { notificationIds: ids.slice(0, 50), action: 'read' }).then(load); }}>Tandai dibaca</AppButton><AppButton tone="secondary" icon={Settings2} onPress={() => setSettingsOpen(true)}>Atur</AppButton></View>
    {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : !items.length ? <EmptyState title="Tidak ada notifikasi" message="Tagihan, anggaran, target, backup, dan harga investasi akan muncul di sini." /> : <Card>{items.map((item) => <View key={item.id}><NotificationRow title={item.title} message={item.message} read={item.read} date={item.eventDate} onPress={() => void openItem(item)} /><AppButton tone="ghost" disabled={!isOnline} onPress={() => void mutate('updateNotificationState', { notificationIds: [item.id], action: 'dismiss' }).then(load)}>Arsipkan</AppButton></View>)}</Card>}
    <AppBottomSheet visible={settingsOpen} title="Pengaturan notifikasi" onClose={() => setSettingsOpen(false)} footer={<AppButton fullWidth loading={isMutating} disabled={!isOnline} onPress={() => void mutate('updateNotificationSettings', settings as unknown as Record<string, unknown>).then(() => setSettingsOpen(false))}>Simpan pengaturan</AppButton>}>
      <SwitchField label="Aktifkan notifikasi in-app" value={settings.enabled} onChange={(enabled) => setSettings((value) => ({ ...value, enabled }))} />
      <SelectField label="Ambang anggaran" value={String(settings.budgetWarningPercent)} onChange={(value) => setSettings((current) => ({ ...current, budgetWarningPercent: Number(value) }))} options={[{ label: '75%', value: '75' }, { label: '90%', value: '90' }]} />
      <SelectField label="Peringatan backup" value={String(settings.backupWarningDays)} onChange={(value) => setSettings((current) => ({ ...current, backupWarningDays: Number(value) }))} options={[7, 14, 30].map((value) => ({ label: `${value} hari`, value: String(value) }))} />
      <SelectField label="Peringatan deadline target" value={String(settings.goalWarningDays)} onChange={(value) => setSettings((current) => ({ ...current, goalWarningDays: Number(value) }))} options={[7, 30, 60].map((value) => ({ label: `${value} hari`, value: String(value) }))} />
      <AppText variant="caption" muted>Reminder tagihan aktif pada H-7, H-3, H-1, dan hari H.</AppText>
    </AppBottomSheet>
  </AppScreen>;
}
