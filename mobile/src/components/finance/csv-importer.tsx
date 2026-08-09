import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { FileUp } from 'lucide-react-native';
import { useState } from 'react';
import { useApp } from '@/providers/app-provider';
import { mapAccountCsv, mapTransactionCsv, parseCsv } from '@/utils/csv';
import { AppText } from '../ui/app-text';
import { AppButton } from '../ui/buttons';
import { Card } from '../ui/card';
import { AppBottomSheet } from '../ui/dialogs';

export function CsvImporter({ kind }: { kind: 'accounts' | 'transactions' }) {
  const { snapshot, mutate, isMutating, isOnline } = useApp();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState<string | null>(null);
  const allowed = Boolean(snapshot?.entitlement.capabilities.imports);
  const open = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/csv'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if ((asset.size ?? 0) > 1_000_000) throw new Error('CSV maksimal 1 MB dan 100 baris.');
      const parsed = parseCsv(await new File(asset.uri).text());
      if (parsed.rows.length > 100) throw new Error('Impor maksimal 100 baris per proses.');
      const mapped = kind === 'accounts' ? mapAccountCsv(parsed.rows) : mapTransactionCsv(parsed.rows, snapshot?.accounts ?? []);
      setRows(mapped); setFilename(asset.name); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'CSV tidak dapat dibaca.'); }
  };
  const apply = async () => {
    try { await mutate(kind === 'accounts' ? 'importAccounts' : 'importTransactions', { [kind]: rows }); setRows([]); setFilename(''); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Impor gagal divalidasi backend.'); }
  };
  return <>
    <AppButton tone="secondary" icon={FileUp} disabled={!isOnline || !allowed} onPress={() => void open()}>{allowed ? 'Import CSV' : 'Import CSV · Pro'}</AppButton>
    {error && !rows.length ? <AppText style={{ color: '#d65b67' }}>{error}</AppText> : null}
    <AppBottomSheet visible={rows.length > 0} title={`Preview ${filename}`} onClose={() => setRows([])} footer={<AppButton fullWidth loading={isMutating} onPress={() => void apply()}>Import {rows.length} {kind === 'accounts' ? 'akun' : 'transaksi'}</AppButton>}>
      <AppText muted>Maksimal 100 baris. Backend memvalidasi seluruh baris secara atomik sebelum menulis data.</AppText>
      {rows.slice(0, 5).map((row, index) => <Card key={index} style={{ gap: 3 }}><AppText variant="label">Baris {index + 2}</AppText><AppText variant="caption" muted numberOfLines={3}>{JSON.stringify(row)}</AppText></Card>)}
      {rows.length > 5 ? <AppText variant="caption" muted>…dan {rows.length - 5} baris lainnya.</AppText> : null}
      {error ? <AppText style={{ color: '#d65b67' }}>{error}</AppText> : null}
    </AppBottomSheet>
  </>;
}
