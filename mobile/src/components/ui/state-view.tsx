import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { CircleAlert, Inbox, RefreshCw, WifiOff } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { usePreferences } from '@/providers/preferences-provider';
import { AppText } from './app-text';
import { AppButton } from './buttons';

function StateLayout({ icon: Icon, title, message, action }: { icon: LucideIcon; title: string; message: string; action?: ReactNode }) {
  const { colors } = usePreferences();
  return (
    <View style={{ paddingVertical: 48, paddingHorizontal: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}>
        <Icon size={25} color={colors.primary} />
      </View>
      <AppText variant="title" style={{ textAlign: 'center' }}>{title}</AppText>
      <AppText muted style={{ textAlign: 'center' }}>{message}</AppText>
      {action}
    </View>
  );
}

export function LoadingState({ label = 'Memuat data…' }: { label?: string }) {
  const { colors } = usePreferences();
  return <View style={{ paddingVertical: 64, alignItems: 'center', gap: spacing.md }}><ActivityIndicator size="large" color={colors.primary} /><AppText muted>{label}</AppText></View>;
}
export const EmptyState = ({ title, message }: { title: string; message: string }) => <StateLayout icon={Inbox} title={title} message={message} />;
export const OfflineState = ({ message = 'Snapshot terakhir tetap dapat dilihat. Perubahan dinonaktifkan sampai koneksi kembali.' }: { message?: string }) => <StateLayout icon={WifiOff} title="Sedang offline" message={message} />;
export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <StateLayout icon={CircleAlert} title="Data belum dapat dimuat" message={message} action={onRetry ? <AppButton icon={RefreshCw} tone="secondary" onPress={onRetry}>Coba lagi</AppButton> : undefined} />
);
