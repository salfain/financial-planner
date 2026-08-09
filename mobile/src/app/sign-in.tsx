import { Database, KeyRound, LockKeyhole, Server, WalletCards } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/forms';
import { radius, spacing } from '@/constants/theme';
import { useApp } from '@/providers/app-provider';
import { usePreferences } from '@/providers/preferences-provider';

const Feature = ({ icon: Icon, children }: { icon: typeof LockKeyhole; children: string }) => {
  const { colors } = usePreferences();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><View style={{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={colors.primary} /></View><AppText style={{ flex: 1 }}>{children}</AppText></View>;
};

export default function SignInScreen() {
  const { login, authError, isOnline } = useApp();
  const { colors } = usePreferences();
  const [loading, setLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [accessKey, setAccessKey] = useState('');
  return (
    <AppScreen contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
        <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><WalletCards size={36} color="#ffffff" /></View>
        <AppText variant="heading" style={{ textAlign: 'center' }}>Financial Planner</AppText>
        <AppText muted style={{ textAlign: 'center' }}>Ruang finansial pribadi yang tetap tersimpan di Google Sheets milik Anda.</AppText>
      </View>

      <Card style={{ gap: spacing.md }}>
        <Feature icon={KeyRound}>Satu access key pribadi melindungi seluruh data.</Feature>
        <Feature icon={Database}>Mobile dan web memakai Spreadsheet serta ledger yang sama.</Feature>
        <Feature icon={LockKeyhole}>Key dienkripsi di perangkat dan tidak ditanam dalam APK.</Feature>
      </Card>

      {authError ? <Card accessibilityRole="alert" style={{ borderColor: colors.negative, backgroundColor: `${colors.negative}0d` }}><AppText style={{ color: colors.negative }}>{authError}</AppText></Card> : null}

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}><Server size={20} color={colors.primary} /><AppText variant="title">Hubungkan perangkat</AppText></View>
        <FormField
          label="URL API Apps Script"
          value={apiUrl}
          onChangeText={setApiUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://script.google.com/macros/s/.../exec"
          required
        />
        <FormField
          label="Personal access key"
          value={accessKey}
          onChangeText={setAccessKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="Tempel key pribadi"
          hint="Key minimal 32 karakter dan hanya disimpan di SecureStore perangkat ini."
          required
        />
      </Card>

      <AppButton
        fullWidth
        icon={KeyRound}
        loading={loading}
        disabled={loading || !isOnline || !apiUrl.trim() || accessKey.trim().length < 32}
        onPress={async () => {
          setLoading(true);
          try { await login({ apiUrl, accessKey }); } catch { /* provider exposes localized error */ }
          finally { setLoading(false); }
        }}
      >
        Hubungkan perangkat
      </AppButton>
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>Key hanya dikirim ke URL Apps Script resmi melalui HTTPS. Data finansial tidak dikirim ke database lain.</AppText>
    </AppScreen>
  );
}
