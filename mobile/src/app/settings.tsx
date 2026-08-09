import { useRouter } from 'expo-router';
import { ChevronRight, LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialogs';
import { FormField, SegmentedControl, SwitchField } from '@/components/ui/forms';
import { PlanBadge } from '@/components/ui/progress';
import { ScreenHeader } from '@/components/ui/screen-header';
import { radius, spacing } from '@/constants/theme';
import { OPTIONAL_FEATURE_KEYS } from '@/domain/constants';
import type { OptionalFeatureKey } from '@/domain/types';
import { useApp } from '@/providers/app-provider';
import { type ThemeMode, usePreferences } from '@/providers/preferences-provider';

const FEATURE_LABELS: Record<OptionalFeatureKey, string> = { budgets: 'Anggaran', goals: 'Target', funds: 'Pos Dana', roadmap: 'Roadmap', forecast: 'Cashflow Forecast', emergency: 'Dana Darurat', bills: 'Tagihan', calendar: 'Kalender', recurring: 'Transaksi Rutin', debts: 'Pelunasan Utang', investments: 'Investasi', review: 'Review Bulanan', reports: 'Laporan', assistant: 'Financial Insight' };

export default function SettingsScreen() {
  const router = useRouter();
  const { snapshot, session, mutate, isMutating, isOnline, logout } = useApp();
  const { colors, themeMode, setThemeMode, privacyMode, setPrivacyMode } = usePreferences();
  const [profileName, setProfileName] = useState(snapshot?.profile.name ?? '');
  const [storeName, setStoreName] = useState(snapshot?.profile.storeName ?? '');
  const [preferences, setPreferences] = useState(snapshot?.featurePreferences);
  const [licenseKey, setLicenseKey] = useState('');
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const saveProfile = async () => {
    try { await mutate('updateProfile', { name: profileName.trim(), storeName: storeName.trim(), currency: snapshot?.profile.currency, timezone: snapshot?.profile.timezone }); setMessage('Profil berhasil diperbarui.'); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Profil gagal disimpan.'); }
  };
  const saveFeatures = async () => {
    if (!preferences) return;
    try { await mutate('updateFeaturePreferences', { preferences }); setMessage('Preferensi fitur berhasil disimpan.'); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Preferensi gagal disimpan.'); }
  };
  return <AppScreen>
    <ScreenHeader title="Pengaturan" subtitle={session ? 'Perangkat pribadi terhubung' : undefined} back menu={false} />
    <Card style={{ gap: spacing.md }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View><AppText variant="title">Paket {snapshot?.entitlement.label}</AppText><AppText variant="caption" muted>Status {snapshot?.entitlement.status}</AppText></View>{snapshot ? <PlanBadge tier={snapshot.entitlement.tier} /> : null}</View><FormField label="Kode lisensi" value={licenseKey} onChangeText={setLicenseKey} autoCapitalize="characters" placeholder="Opsional" /><AppButton tone="secondary" loading={isMutating} disabled={!licenseKey.trim() || !isOnline} onPress={() => void mutate('activateLicense', { licenseKey: licenseKey.trim() }).then(() => setMessage('Lisensi berhasil diperiksa.')).catch((cause) => setMessage(cause instanceof Error ? cause.message : 'Aktivasi gagal.'))}>Aktifkan lisensi</AppButton></Card>
    <Card style={{ gap: spacing.md }}><AppText variant="title">Profil workspace</AppText><FormField label="Nama pemilik" value={profileName} onChangeText={setProfileName} /><FormField label="Nama workspace" value={storeName} onChangeText={setStoreName} /><AppButton tone="secondary" loading={isMutating} disabled={!isOnline} onPress={() => void saveProfile()}>Simpan profil</AppButton></Card>
    <Card style={{ gap: spacing.md }}><AppText variant="title">Tampilan & privasi</AppText><SegmentedControl label="Tema aplikasi" value={themeMode} onChange={(value) => void setThemeMode(value)} options={[{ value: 'light' as ThemeMode, label: 'Terang' }, { value: 'dark' as ThemeMode, label: 'Gelap' }, { value: 'system' as ThemeMode, label: 'Sistem' }]} /><SwitchField label="Privacy mode" description="Samarkan seluruh nominal di aplikasi." value={privacyMode} onChange={(value) => void setPrivacyMode(value)} /></Card>
    <Card style={{ gap: spacing.xs }}><AppText variant="title">Fitur opsional</AppText><AppText variant="caption" muted>Fitur yang disembunyikan tidak tampil di menu, tetapi datanya tetap aman.</AppText>{preferences ? OPTIONAL_FEATURE_KEYS.map((key) => <SwitchField key={key} label={FEATURE_LABELS[key]} value={preferences[key]} onChange={(enabled) => setPreferences((current) => current ? ({ ...current, [key]: enabled }) : current)} />) : null}<AppButton tone="secondary" loading={isMutating} disabled={!isOnline} onPress={() => void saveFeatures()}>Simpan fitur</AppButton></Card>
    {['categories', 'integrity', 'audit'].map((slug) => <Pressable key={slug} accessibilityRole="button" onPress={() => router.push({ pathname: '/module/[slug]', params: { slug } })} style={({ pressed }) => ({ minHeight: 54, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: spacing.sm, backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderWidth: 1, borderColor: colors.border })}><AppText variant="label" style={{ flex: 1 }}>{slug === 'categories' ? 'Kelola kategori' : slug === 'integrity' ? 'Kesehatan penyimpanan & ledger' : 'Audit log terbaru'}</AppText><ChevronRight size={19} color={colors.textMuted} /></Pressable>)}
    {message ? <Card><AppText>{message}</AppText></Card> : null}
    <AppButton tone="danger" icon={LogOut} fullWidth onPress={() => setLogoutConfirm(true)}>Putuskan perangkat</AppButton>
    <ConfirmDialog visible={logoutConfirm} title="Putuskan perangkat?" message="URL, access key, cache, dan draft lokal akan dihapus. Data finansial di backend tidak berubah." destructive confirmLabel="Putuskan" onCancel={() => setLogoutConfirm(false)} onConfirm={() => void logout()} />
  </AppScreen>;
}
