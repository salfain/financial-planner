import { View } from 'react-native';

import { radius } from '@/constants/theme';
import { usePreferences } from '@/providers/preferences-provider';
import { AppText } from './app-text';

export function ProgressBar({ value, label, color }: { value: number; label: string; color?: string }) {
  const { colors } = usePreferences();
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: safeValue }}>
      <View style={{ height: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ width: `${safeValue}%`, height: '100%', borderRadius: radius.pill, backgroundColor: color ?? colors.primary }} />
      </View>
      <AppText variant="caption" muted style={{ marginTop: 5 }}>{label} · {Math.round(safeValue)}%</AppText>
    </View>
  );
}

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'positive' | 'negative' | 'warning' | 'info' | 'neutral' }) {
  const { colors } = usePreferences();
  const foreground = tone === 'positive' ? colors.positive
    : tone === 'negative' ? colors.negative
      : tone === 'warning' ? colors.warning
        : tone === 'info' ? colors.info
          : colors.textMuted;
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: `${foreground}18`, borderWidth: 1, borderColor: `${foreground}55` }}>
      <AppText variant="caption" style={{ color: foreground }}>{label}</AppText>
    </View>
  );
}

export function PlanBadge({ tier }: { tier: 'free' | 'pro' | 'premium' }) {
  return <StatusPill label={tier === 'premium' ? 'Premium' : tier === 'pro' ? 'Pro' : 'Free'} tone={tier === 'free' ? 'neutral' : tier === 'pro' ? 'info' : 'warning'} />;
}
