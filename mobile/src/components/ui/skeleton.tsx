import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { usePreferences } from '@/providers/preferences-provider';

export function Skeleton({ height = 18, width = '100%' }: { height?: number; width?: number | `${number}%` }) {
  const { colors } = usePreferences();
  const reducedMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(0.45));
  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.55);
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.8, duration: 650, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion]);
  return <Animated.View style={{ height, width, borderRadius: radius.sm, backgroundColor: colors.skeleton, opacity }} />;
}

export function DashboardSkeleton() {
  return <View style={{ gap: spacing.md }}><Skeleton height={78} /><View style={{ flexDirection: 'row', gap: spacing.sm }}><Skeleton height={96} width="48%" /><Skeleton height={96} width="48%" /></View><Skeleton height={190} /><Skeleton height={120} /></View>;
}
