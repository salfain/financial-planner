import { Tabs, useRouter } from 'expo-router';
import { ChartNoAxesCombined, PiggyBank, Plus, ReceiptText, Target } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontFamily, shadows } from '@/constants/theme';
import { usePreferences } from '@/providers/preferences-provider';

export default function TabsLayout() {
  const router = useRouter();
  const { colors } = usePreferences();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(Math.min(insets.bottom, 34), 8);
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: 11 },
          tabBarStyle: { height: 64 + bottomInset, paddingTop: 6, paddingBottom: bottomInset, backgroundColor: colors.tabBar, borderTopColor: colors.border },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Ringkasan', tabBarIcon: ({ color }) => <ChartNoAxesCombined color={color} size={21} /> }} />
        <Tabs.Screen name="transactions" options={{ title: 'Transaksi', tabBarIcon: ({ color }) => <ReceiptText color={color} size={21} /> }} />
        <Tabs.Screen name="fab-placeholder" options={{ title: '', tabBarButton: () => <View accessibilityElementsHidden style={{ flex: 1 }} /> }} />
        <Tabs.Screen name="budgets" options={{ title: 'Anggaran', tabBarIcon: ({ color }) => <PiggyBank color={color} size={21} /> }} />
        <Tabs.Screen name="goals" options={{ title: 'Target', tabBarIcon: ({ color }) => <Target color={color} size={21} /> }} />
      </Tabs>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tambah transaksi baru"
        onPress={() => router.push('/transaction/new')}
        style={({ pressed }) => [{
          position: 'absolute', bottom: bottomInset + 32, alignSelf: 'center', width: 58, height: 58,
          borderRadius: 29, alignItems: 'center', justifyContent: 'center',
          backgroundColor: pressed ? colors.primaryPressed : colors.primary,
          borderWidth: 4, borderColor: colors.tabBar,
        }, shadows.fab]}
      >
        <Plus color="#ffffff" size={27} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}
