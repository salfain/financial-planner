import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

import { radius, shadows, spacing } from '@/constants/theme';
import { usePreferences } from '@/providers/preferences-provider';

export function Card({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  const { colors, resolvedTheme } = usePreferences();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.md,
        },
        resolvedTheme === 'light' ? shadows.card : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
