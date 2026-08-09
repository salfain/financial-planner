import type { ReactNode } from 'react';
import { View } from 'react-native';

import { spacing } from '@/constants/theme';
import { AppText } from './app-text';

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <AppText variant="title">{title}</AppText>
        {subtitle ? <AppText variant="caption" muted style={{ marginTop: 2 }}>{subtitle}</AppText> : null}
      </View>
      {action}
    </View>
  );
}
