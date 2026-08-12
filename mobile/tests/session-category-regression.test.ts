import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { shouldClearSessionForCode } from '../src/utils/auth-errors';
import { isValidSecureStoreKey, SECURE_STORE_KEYS } from '../src/utils/secure-store-keys';

const source = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('hanya credential invalid yang menghapus sesi lokal', () => {
  assert.equal(shouldClearSessionForCode('AUTH_REQUIRED'), true);
  assert.equal(shouldClearSessionForCode('AUTH_INVALID'), true);
  assert.equal(shouldClearSessionForCode('MOBILE_API_NOT_CONFIGURED'), false);
  assert.equal(shouldClearSessionForCode('MOBILE_API_DISABLED'), false);
  assert.equal(shouldClearSessionForCode('NETWORK_ERROR'), false);
});

test('boot menunggu SecureStore dan refresh saat kembali dari background', () => {
  const provider = source('../src/providers/app-provider.tsx');
  assert.match(provider, /useState<AppPhase>\('booting'\)/);
  assert.doesNotMatch(provider, /withFallbackTimeout\(loadAuthSession\(\), null\)/);
  assert.match(provider, /AppState\.addEventListener\('change'/);
  assert.match(provider, /RESUME_REFRESH_AFTER_MS/);
});

test('semua nama kunci SecureStore memakai karakter yang didukung Android', () => {
  Object.values(SECURE_STORE_KEYS).forEach((key) => assert.equal(isValidSecureStoreKey(key), true, key));
});

test('kategori arsip tidak dipalsukan dari bootstrap aktif dan selalu dimuat segar', () => {
  const provider = source('../src/providers/app-provider.tsx');
  const modules = source('../src/components/modules/advanced-modules.tsx');
  assert.doesNotMatch(provider, /set\('listCategories', \{ includeArchived: true \}/);
  assert.match(modules, /'listCategories', \{ includeArchived: true \}, \{ force: true, cacheTtlMs: 0 \}/);
});

test('pilihan kategori panjang dapat digulir sampai item terakhir', () => {
  const forms = source('../src/components/ui/forms.tsx');
  assert.match(forms, /Modal, Platform, Pressable, ScrollView/);
  assert.match(forms, /<ScrollView[\s\S]*options\.map[\s\S]*<\/ScrollView>/);
  assert.match(forms, /showsVerticalScrollIndicator=\{options\.length > 6\}/);
});

test('layar memakai satu safe-area root dan form transaksi menjaga semua sisi', () => {
  const appScreen = source('../src/components/ui/app-screen.tsx');
  const transaction = source('../src/app/transaction/new.tsx');
  assert.match(appScreen, /SafeAreaView, type Edge, useSafeAreaInsets/);
  assert.doesNotMatch(appScreen, /<SafeAreaProvider>/);
  assert.match(appScreen, /paddingBottom: 104 \+ Math\.min\(insets\.bottom, 34\)/);
  assert.match(appScreen, /<SafeAreaView edges=\{edges\}/);
  assert.match(transaction, /edges=\{\['top', 'bottom', 'left', 'right'\]\}/);
});

test('input Android memakai warna tema dan input rahasia tidak merender blok seleksi', () => {
  const forms = source('../src/components/ui/forms.tsx');
  assert.match(forms, /const hideSecureSelection = Platform\.OS === 'android' && secureTextEntry/);
  assert.match(forms, /selectionColor=\{hideSecureSelection \? 'transparent' : colors\.primary\}/);
  assert.match(forms, /cursorColor=\{colors\.primary\}/);
  assert.match(forms, /selectionHandleColor=\{hideSecureSelection \? 'transparent' : colors\.primary\}/);
  assert.match(forms, /underlineColorAndroid="transparent"/);
});

test('bottom sheet panjang dapat digulir dan menjaga navigasi bawah', () => {
  const dialogs = source('../src/components/ui/dialogs.tsx');
  assert.match(dialogs, /useSafeAreaInsets/);
  assert.match(dialogs, /paddingBottom: Math\.max\(insets\.bottom, spacing\.lg\)/);
  assert.match(dialogs, /<ScrollView[\s\S]*keyboardShouldPersistTaps="handled"[\s\S]*\{children\}[\s\S]*<\/ScrollView>/);
});

test('tab, FAB, transaksi, dan setup menyesuaikan ukuran layar', () => {
  const tabs = source('../src/app/(tabs)/_layout.tsx');
  const transactions = source('../src/app/(tabs)/transactions.tsx');
  const setup = source('../src/app/setup.tsx');
  assert.match(tabs, /useSafeAreaInsets/);
  assert.match(tabs, /Math\.min\(insets\.bottom, 34\)/);
  assert.match(tabs, /tabBarHideOnKeyboard: true/);
  assert.match(tabs, /bottom: bottomInset \+ 32/);
  assert.match(transactions, /SafeAreaView edges=\{\['top', 'left', 'right'\]\}/);
  assert.doesNotMatch(transactions, /<SafeAreaProvider>/);
  assert.match(setup, /const compact = width < 380/);
  assert.match(setup, /flexDirection: compact \? 'column' : 'row'/);
});

test('akses cepat Insight memakai slug modul yang terdaftar', () => {
  const home = source('../src/app/(tabs)/index.tsx');
  const moduleRoute = source('../src/app/module/[slug].tsx');
  assert.match(home, /router\.push\('\/module\/insight'\)/);
  assert.doesNotMatch(home, /router\.push\('\/module\/assistant'\)/);
  assert.match(moduleRoute, /insight: \{ title: 'Financial Insight'/);
});

test('komposisi pengeluaran tidak membatasi kategori hanya lima item', () => {
  const home = source('../src/app/(tabs)/index.tsx');
  const charts = source('../src/components/finance/charts.tsx');
  assert.match(home, /expenseByCategory\(snapshot!, selectedMonth\)/);
  assert.doesNotMatch(home, /expenseByCategory\(snapshot!\)\.slice\(0, 5\)/);
  assert.doesNotMatch(charts, /items\.slice\(0, 5\)/);
});
