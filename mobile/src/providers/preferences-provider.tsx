import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type AppColors } from '@/constants/theme';

export type ThemeMode = 'light' | 'dark' | 'system';

type PreferencesContextValue = {
  hydrated: boolean;
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  colors: AppColors;
  privacyMode: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setPrivacyMode: (enabled: boolean) => Promise<void>;
  togglePrivacyMode: () => Promise<void>;
};

const STORAGE_KEY = 'financial-planner:preferences:v1';
const HYDRATION_TIMEOUT_MS = 3000;
const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: PropsWithChildren) {
  const systemTheme = useColorScheme();
  const [hydrated, setHydrated] = useState(true);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [privacyMode, setPrivacyModeState] = useState(false);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      if (active) setHydrated(true);
    }, HYDRATION_TIMEOUT_MS);
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const parsed = JSON.parse(raw) as { themeMode?: ThemeMode; privacyMode?: boolean };
        if (parsed.themeMode && ['light', 'dark', 'system'].includes(parsed.themeMode)) {
          setThemeModeState(parsed.themeMode);
        }
        setPrivacyModeState(parsed.privacyMode === true);
      })
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timeout);
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);

  const persist = useCallback(async (nextTheme: ThemeMode, nextPrivacy: boolean) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      themeMode: nextTheme,
      privacyMode: nextPrivacy,
    }));
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await persist(mode, privacyMode);
  }, [persist, privacyMode]);

  const setPrivacyMode = useCallback(async (enabled: boolean) => {
    setPrivacyModeState(enabled);
    await persist(themeMode, enabled);
  }, [persist, themeMode]);

  const togglePrivacyMode = useCallback(
    () => setPrivacyMode(!privacyMode),
    [privacyMode, setPrivacyMode],
  );

  const resolvedTheme = themeMode === 'system' ? (systemTheme === 'dark' ? 'dark' : 'light') : themeMode;
  const value = useMemo<PreferencesContextValue>(() => ({
    hydrated,
    themeMode,
    resolvedTheme,
    colors: resolvedTheme === 'dark' ? darkColors : lightColors,
    privacyMode,
    setThemeMode,
    setPrivacyMode,
    togglePrivacyMode,
  }), [hydrated, privacyMode, resolvedTheme, setPrivacyMode, setThemeMode, themeMode, togglePrivacyMode]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences harus dipakai di dalam PreferencesProvider.');
  return value;
}
