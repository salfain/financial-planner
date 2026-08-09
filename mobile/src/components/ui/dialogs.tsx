import type { PropsWithChildren, ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { usePreferences } from '@/providers/preferences-provider';
import { AppText } from './app-text';
import { AppButton } from './buttons';

export function ConfirmDialog({ visible, title, message, confirmLabel = 'Konfirmasi', destructive, loading, onConfirm, onCancel }: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = usePreferences();
  const reducedMotion = useReducedMotion();
  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, padding: spacing.xl, justifyContent: 'center' }}>
        <View accessibilityRole="alert" style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md }}>
          <AppText variant="title">{title}</AppText>
          <AppText muted>{message}</AppText>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs }}>
            <AppButton tone="ghost" onPress={onCancel} disabled={loading}>Batal</AppButton>
            <AppButton tone={destructive ? 'danger' : 'primary'} onPress={onConfirm} loading={loading}>{confirmLabel}</AppButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function AppBottomSheet({ visible, title, onClose, children, footer }: PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
}>) {
  const { colors } = usePreferences();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={(event) => event.stopPropagation()} style={{ maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.md, paddingBottom: Math.max(insets.bottom, spacing.lg), gap: spacing.md }}>
          <View style={{ width: 44, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: colors.border }} />
          <AppText variant="title">{title}</AppText>
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xs }}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {children}
          </ScrollView>
          {footer}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function Snackbar({ visible, message, action }: { visible: boolean; message: string; action?: ReactNode }) {
  const { colors } = usePreferences();
  if (!visible) return null;
  return (
    <View accessibilityLiveRegion="polite" style={{ position: 'absolute', left: spacing.md, right: spacing.md, bottom: 94, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.text, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <AppText style={{ flex: 1, color: colors.background }}>{message}</AppText>{action}
    </View>
  );
}
