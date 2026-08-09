import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, type ScrollViewProps, View } from 'react-native';
import { SafeAreaView, type Edge, useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/constants/theme';
import { usePreferences } from '@/providers/preferences-provider';

type Props = PropsWithChildren<{
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
}>;

export function AppScreen({
  children, scroll = true, refreshing = false, onRefresh, edges = ['top', 'left', 'right'], contentContainerStyle,
}: Props) {
  const { colors } = usePreferences();
  const insets = useSafeAreaInsets();
  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[{ padding: spacing.md, paddingBottom: 104 + Math.min(insets.bottom, 34), gap: spacing.md }, contentContainerStyle]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : <View style={{ flex: 1 }}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
