import { Bell, ChevronLeft, Eye, EyeOff, Menu } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useApp } from '@/providers/app-provider';
import { usePreferences } from '@/providers/preferences-provider';
import { relativeUpdatedAt } from '@/utils/format';
import { AppText } from './app-text';
import { IconButton } from './buttons';
import { StatusPill } from './progress';

export function ScreenHeader({ title, subtitle, back = false, menu = true }: { title: string; subtitle?: string; back?: boolean; menu?: boolean }) {
  const router = useRouter();
  const { isOnline, cacheUpdatedAt } = useApp();
  const { privacyMode, togglePrivacyMode } = usePreferences();
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        {back ? <IconButton icon={ChevronLeft} label="Kembali" onPress={() => router.back()} /> : menu ? <IconButton icon={Menu} label="Buka menu lainnya" onPress={() => router.push('/menu')} /> : null}
        <View style={{ flex: 1 }}>
          <AppText variant="title" numberOfLines={1}>{title}</AppText>
          {subtitle ? <AppText variant="caption" muted numberOfLines={1}>{subtitle}</AppText> : null}
        </View>
        <IconButton icon={privacyMode ? EyeOff : Eye} label={privacyMode ? 'Tampilkan nominal' : 'Sembunyikan nominal'} onPress={() => void togglePrivacyMode()} tone={privacyMode ? 'primary' : 'default'} />
        <IconButton icon={Bell} label="Pusat notifikasi" onPress={() => router.push('/notifications')} />
      </View>
      {!isOnline ? <StatusPill label="Offline · hanya baca" tone="warning" /> : cacheUpdatedAt ? <AppText variant="caption" muted>{relativeUpdatedAt(cacheUpdatedAt)}</AppText> : null}
    </View>
  );
}
