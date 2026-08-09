import type { ComponentProps } from 'react';
import { Text } from 'react-native';

import { fontFamily } from '@/constants/theme';
import { usePreferences } from '@/providers/preferences-provider';

type Variant = 'body' | 'caption' | 'label' | 'title' | 'heading' | 'amount';
type Props = ComponentProps<typeof Text> & { variant?: Variant; muted?: boolean };

const variants = {
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17 },
  label: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18 },
  title: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 24 },
  heading: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 34 },
  amount: { fontFamily: fontFamily.bold, fontSize: 30, lineHeight: 38 },
} as const;

export function AppText({ variant = 'body', muted, style, ...props }: Props) {
  const { colors } = usePreferences();
  return (
    <Text
      maxFontSizeMultiplier={1.8}
      {...props}
      style={[variants[variant], { color: muted ? colors.textMuted : colors.text }, style]}
    />
  );
}
