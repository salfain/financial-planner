import { LogOut, RefreshCw } from 'lucide-react-native';
import { View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/buttons';
import { ErrorState, LoadingState } from '@/components/ui/state-view';
import { spacing } from '@/constants/theme';
import { useApp } from '@/providers/app-provider';

export default function SessionScreen() {
  const { dataError, isRefreshing, refresh, logout, isOnline } = useApp();
  return (
    <AppScreen>
      <View style={{ paddingTop: 60, alignItems: 'center', gap: spacing.sm }}>
        <AppText variant="heading">Financial Planner</AppText>
        <AppText muted>Memverifikasi workspace pemilik…</AppText>
      </View>
      {isRefreshing ? <LoadingState /> : dataError ? <ErrorState message={dataError} onRetry={isOnline ? () => void refresh() : undefined} /> : <LoadingState />}
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        {isOnline ? <AppButton icon={RefreshCw} tone="secondary" onPress={() => void refresh()}>Muat ulang</AppButton> : null}
        <AppButton icon={LogOut} tone="ghost" onPress={() => void logout()}>Putuskan perangkat</AppButton>
      </View>
    </AppScreen>
  );
}
