import { CheckCircle2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { FormField, MoneyInput, SelectField } from '@/components/ui/forms';
import { ACCOUNT_TYPES } from '@/domain/constants';
import type { AccountType } from '@/domain/types';
import { useApp } from '@/providers/app-provider';
import { usePreferences } from '@/providers/preferences-provider';
import { spacing } from '@/constants/theme';

export default function SetupScreen() {
  const { setupWorkspace, isMutating, isOnline } = useApp();
  const { colors } = usePreferences();
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const [profileName, setProfileName] = useState('Pemilik');
  const [storeName, setStoreName] = useState('Financial Planner');
  const [accountName, setAccountName] = useState('Rekening Utama');
  const [accountType, setAccountType] = useState<AccountType>('Bank');
  const [openingBalance, setOpeningBalance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const valid = useMemo(() => Boolean(profileName.trim() && storeName.trim() && accountName.trim()), [accountName, profileName, storeName]);
  return (
    <AppScreen>
      <View style={{ gap: spacing.xs }}><AppText variant="heading">Siapkan workspace</AppText><AppText muted>Setup ini hanya dijalankan sekali dan hasilnya langsung tersedia di web maupun mobile.</AppText></View>
      <Card style={{ gap: spacing.md }}>
        <AppText variant="title">Profil</AppText>
        <FormField label="Nama pemilik" value={profileName} onChangeText={setProfileName} required maxLength={80} />
        <FormField label="Nama workspace" value={storeName} onChangeText={setStoreName} required maxLength={80} />
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: spacing.sm }}><View style={{ flex: 1 }}><FormField label="Mata uang" value="IDR" editable={false} /></View><View style={{ flex: 1 }}><FormField label="Zona waktu" value="Asia/Jakarta" editable={false} /></View></View>
      </Card>
      <Card style={{ gap: spacing.md }}>
        <AppText variant="title">Akun pertama</AppText>
        <FormField label="Nama akun" value={accountName} onChangeText={setAccountName} required maxLength={80} />
        <SelectField label="Jenis akun" value={accountType} onChange={(value) => setAccountType(value as AccountType)} options={ACCOUNT_TYPES.map((value) => ({ value, label: value }))} />
        <MoneyInput label="Saldo awal" value={openingBalance} onChangeValue={setOpeningBalance} hint="Untuk kewajiban, isi total saldo utang saat ini." />
      </Card>
      {error ? <AppText accessibilityRole="alert" style={{ color: colors.negative }}>{error}</AppText> : null}
      <AppButton
        fullWidth
        icon={CheckCircle2}
        loading={isMutating}
        disabled={!valid || !isOnline || isMutating}
        onPress={async () => {
          setError(null);
          try {
            await setupWorkspace({
              profileName: profileName.trim(), storeName: storeName.trim(), currency: 'IDR', timezone: 'Asia/Jakarta',
              accounts: [{ name: accountName.trim(), type: accountType, openingBalance: Number(openingBalance || 0), color: '#126b59' }],
            });
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Setup tidak dapat disimpan.');
          }
        }}
      >
        Buat workspace
      </AppButton>
      {!isOnline ? <AppText variant="caption" muted style={{ textAlign: 'center' }}>Setup memerlukan koneksi internet.</AppText> : null}
    </AppScreen>
  );
}
