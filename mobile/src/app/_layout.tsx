import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { AppProvider, useApp } from '@/providers/app-provider';
import { PreferencesProvider, usePreferences } from '@/providers/preferences-provider';

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'sign-in',
};

function Navigation() {
  const { phase, session, snapshot } = useApp();
  const { colors, resolvedTheme, hydrated } = usePreferences();
  useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  // Font loading must never block the whole application. React Native can use
  // its fallback font while the bundled fonts finish loading in the background.
  // Render navigation immediately. Session, preferences, and fonts continue
  // hydrating in the background instead of holding the app on a loader.
  const ready = phase !== 'booting' && hydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <AppText muted>Menyiapkan ruang finansial…</AppText>
      </View>
    );
  }

  const navigationTheme = {
    dark: resolvedTheme === 'dark',
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.negative,
    },
    fonts: {
      regular: { fontFamily: 'PlusJakartaSans_400Regular', fontWeight: '400' as const },
      medium: { fontFamily: 'PlusJakartaSans_500Medium', fontWeight: '500' as const },
      bold: { fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700' as const },
      heavy: { fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700' as const },
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>

        <Stack.Protected guard={Boolean(session && !snapshot)}>
          <Stack.Screen name="session" />
        </Stack.Protected>

        <Stack.Protected guard={Boolean(session && snapshot && !snapshot.configured)}>
          <Stack.Screen name="setup" />
        </Stack.Protected>

        <Stack.Protected guard={Boolean(session && snapshot?.configured)}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="menu" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="accounts/index" />
          <Stack.Screen name="accounts/[id]" />
          <Stack.Screen name="transaction/new" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="transaction/[id]" />
          <Stack.Screen name="module/[slug]" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PreferencesProvider>
          <AppProvider>
            <Navigation />
          </AppProvider>
        </PreferencesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
