import type { ComponentProps } from 'react';

import { usePreferences } from '@/providers/preferences-provider';
import { formatCurrency } from '@/utils/format';
import { AppText } from './app-text';

type Props = Omit<ComponentProps<typeof AppText>, 'children'> & {
  value: number;
  currency?: string;
  signed?: boolean;
};

export function Amount({ value, currency = 'IDR', signed, style, ...props }: Props) {
  const { privacyMode, colors } = usePreferences();
  const prefix = !privacyMode && signed && value > 0 ? '+' : '';
  return (
    <AppText
      accessibilityLabel={privacyMode ? 'Nominal disembunyikan' : formatCurrency(value, false, currency)}
      {...props}
      style={[{ color: signed ? (value < 0 ? colors.negative : colors.positive) : colors.text }, style]}
    >
      {prefix}{formatCurrency(value, privacyMode, currency)}
    </AppText>
  );
}
