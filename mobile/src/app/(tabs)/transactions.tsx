import { useFocusEffect, useRouter } from 'expo-router';
import { Filter, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionRow } from '@/components/finance/rows';
import { CsvImporter } from '@/components/finance/csv-importer';
import { AppButton, IconButton } from '@/components/ui/buttons';
import { AppBottomSheet } from '@/components/ui/dialogs';
import { DateField, SelectField } from '@/components/ui/forms';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState } from '@/components/ui/state-view';
import { fontFamily, radius, spacing } from '@/constants/theme';
import { normalizeTransactionList } from '@/domain/normalize';
import type { Transaction } from '@/domain/types';
import { useApp } from '@/providers/app-provider';
import { usePreferences } from '@/providers/preferences-provider';

type Filters = { type: string; status: string; accountId: string; category: string; dateFrom: string; dateTo: string };
const EMPTY_FILTERS: Filters = { type: '', status: '', accountId: '', category: '', dateFrom: '', dateTo: '' };

export default function TransactionsScreen() {
  const router = useRouter();
  const { snapshot, selectedMonth, read, isOnline } = useApp();
  const { colors } = usePreferences();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Transaction[]>(() => snapshot?.transactions.filter((item) => !item.deletedAt) ?? []);
  const itemsRef = useRef(items);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(!snapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshot || itemsRef.current.length) return;
    const local = snapshot.transactions.filter((item) => !item.deletedAt);
    itemsRef.current = local;
    setItems(local);
    setLoading(false);
  }, [snapshot]);

  const load = useCallback(async (nextPage = 1, append = false, force = false) => {
    if (!snapshot) return;
    if (!isOnline) {
      const local = snapshot.transactions.filter((item) => !item.deletedAt);
      itemsRef.current = local;
      setItems(local);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    if (append) setLoadingMore(true);
    else if (!itemsRef.current.length) setLoading(true);
    else if (force) setRefreshing(true);
    setError(null);
    try {
      const payload = Object.fromEntries(Object.entries({
        page: nextPage, pageSize: 25, month: selectedMonth, query: submittedQuery.trim(), ...filters,
      }).filter(([, value]) => value !== ''));
      const result = normalizeTransactionList(await read<unknown>('listTransactions', payload, { force, cacheTtlMs: 5 * 60_000 }));
      setItems((current) => {
        const next = append ? [...current, ...result.transactions] : result.transactions;
        itemsRef.current = next;
        return next;
      });
      setPage(result.page);
      setTotalPages(result.totalPages);
    } catch (cause) {
      if (!itemsRef.current.length) setError(cause instanceof Error ? cause.message : 'Transaksi tidak dapat dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [filters, isOnline, read, selectedMonth, snapshot, submittedQuery]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const accountNames = useMemo(() => new Map(snapshot?.accounts.map((item) => [item.id, item.name])), [snapshot?.accounts]);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const applySearch = () => setSubmittedQuery(query.trim());

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm }}>
        <ScreenHeader title="Transaksi" subtitle="Cari dan kelola ledger" />
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <View style={{ flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.sm }}>
            <Search size={19} color={colors.textMuted} />
            <TextInput
              accessibilityLabel="Cari transaksi"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={applySearch}
              returnKeyType="search"
              placeholder="Merchant, catatan, tag, akun…"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              selectionHandleColor={colors.primary}
              underlineColorAndroid="transparent"
              style={{ flex: 1, minHeight: 46, paddingHorizontal: spacing.xs, color: colors.text, fontFamily: fontFamily.regular }}
            />
            {query ? <IconButton icon={X} label="Hapus pencarian" onPress={() => { setQuery(''); setSubmittedQuery(''); }} /> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Filter transaksi${activeFilterCount ? `, ${activeFilterCount} aktif` : ''}`}
            onPress={() => { setDraftFilters(filters); setFilterOpen(true); }}
            style={({ pressed }) => ({ width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: activeFilterCount ? colors.primary : pressed ? colors.surfaceAlt : colors.surface, borderWidth: 1, borderColor: activeFilterCount ? colors.primary : colors.border })}
          >
            <Filter size={20} color={activeFilterCount ? '#fff' : colors.text} />
          </Pressable>
        </View>
        <CsvImporter kind="transactions" />
      </View>

      {loading ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>
        : error ? <ErrorState message={error} onRetry={() => void load(1, false, true)} />
          : <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 104 + Math.min(insets.bottom, 34), flexGrow: items.length ? undefined : 1 }}
            renderItem={({ item }) => <TransactionRow transaction={item} accountName={accountNames.get(item.accountId)} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.transferGroupId || item.id } })} />}
            ListEmptyComponent={<EmptyState title="Belum ada transaksi" message="Tambahkan transaksi pertama melalui tombol + di bawah." />}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: spacing.md }} /> : page < totalPages ? <AppButton tone="secondary" fullWidth onPress={() => void load(page + 1, true)}>Muat berikutnya</AppButton> : null}
            refreshing={refreshing}
            onRefresh={() => void load(1, false, true)}
          />}
      <AppBottomSheet
        visible={filterOpen}
        title="Filter transaksi"
        onClose={() => setFilterOpen(false)}
        footer={<View style={{ flexDirection: 'row', gap: spacing.xs }}><AppButton tone="ghost" onPress={() => setDraftFilters(EMPTY_FILTERS)}>Reset</AppButton><AppButton fullWidth style={{ flex: 1 }} onPress={() => { setFilters(draftFilters); setFilterOpen(false); }}>Terapkan</AppButton></View>}
      >
        <SelectField label="Tipe" value={draftFilters.type} onChange={(type) => setDraftFilters((value) => ({ ...value, type }))} options={[{ label: 'Semua tipe', value: '' }, { label: 'Pemasukan', value: 'income' }, { label: 'Pengeluaran', value: 'expense' }, { label: 'Transfer', value: 'transfer' }, { label: 'Refund', value: 'refund' }]} />
        <SelectField label="Status" value={draftFilters.status} onChange={(status) => setDraftFilters((value) => ({ ...value, status }))} options={[{ label: 'Semua status', value: '' }, { label: 'Selesai', value: 'completed' }, { label: 'Pending', value: 'pending' }]} />
        <SelectField label="Akun" value={draftFilters.accountId} onChange={(accountId) => setDraftFilters((value) => ({ ...value, accountId }))} options={[{ label: 'Semua akun', value: '' }, ...(snapshot?.accounts ?? []).map((item) => ({ label: item.name, value: item.id }))]} />
        <SelectField label="Kategori" value={draftFilters.category} onChange={(category) => setDraftFilters((value) => ({ ...value, category }))} options={[{ label: 'Semua kategori', value: '' }, ...(snapshot?.categories.filter((item) => item.active).map((item) => ({ label: item.name, value: item.name })) ?? [])]} />
        <DateField label="Dari tanggal" value={draftFilters.dateFrom || `${selectedMonth}-01`} onChange={(dateFrom) => setDraftFilters((value) => ({ ...value, dateFrom }))} />
        <DateField label="Sampai tanggal" value={draftFilters.dateTo || `${selectedMonth}-28`} onChange={(dateTo) => setDraftFilters((value) => ({ ...value, dateTo }))} />
      </AppBottomSheet>
    </SafeAreaView>
  );
}
