import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';

import { fontFamily, radius, spacing } from '@/constants/theme';
import { usePreferences } from '@/providers/preferences-provider';
import { AppText } from './app-text';

type ButtonTone = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonProps = PressableProps & {
  children: ReactNode;
  tone?: ButtonTone;
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
};

export function AppButton({
  children, tone = 'primary', icon: Icon, loading, disabled, fullWidth, style, onPress, ...props
}: ButtonProps) {
  const { colors } = usePreferences();
  const background = tone === 'primary'
    ? colors.primary
    : tone === 'danger'
      ? colors.negative
      : tone === 'ghost'
        ? 'transparent'
        : colors.surfaceAlt;
  const foreground = tone === 'primary' || tone === 'danger' ? '#ffffff' : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={(event) => {
        void Haptics.selectionAsync();
        onPress?.(event);
      }}
      {...props}
      style={(state) => [
        {
          minHeight: 48,
          minWidth: 48,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          backgroundColor: background,
          borderWidth: tone === 'secondary' ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled || loading ? 0.52 : state.pressed ? 0.82 : 1,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        {loading ? <ActivityIndicator color={foreground} /> : Icon ? <Icon size={19} color={foreground} /> : null}
        <AppText style={{ color: foreground, fontFamily: fontFamily.semibold }}>{children}</AppText>
      </View>
    </Pressable>
  );
}

type IconButtonProps = PressableProps & { icon: LucideIcon; label: string; tone?: 'default' | 'danger' | 'primary' };

export function IconButton({ icon: Icon, label, tone = 'default', style, ...props }: IconButtonProps) {
  const { colors } = usePreferences();
  const foreground = tone === 'danger' ? colors.negative : tone === 'primary' ? colors.primary : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      {...props}
      style={(state) => [
        {
          width: 44, height: 44, borderRadius: radius.pill,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: state.pressed ? colors.surfaceAlt : 'transparent',
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <Icon size={21} color={foreground} />
    </Pressable>
  );
}
