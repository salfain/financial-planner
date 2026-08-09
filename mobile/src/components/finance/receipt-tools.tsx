import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Camera, FileUp, Image as ImageIcon, ScanLine, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import type { TransactionDraft, TransactionReceipt } from '@/domain/types';
import { useApp } from '@/providers/app-provider';
import { spacing } from '@/constants/theme';
import { AppText } from '../ui/app-text';
import { AppButton } from '../ui/buttons';
import { AppBottomSheet, ConfirmDialog } from '../ui/dialogs';
import { Card } from '../ui/card';

type OcrReceipt = { merchant: string; date: string; total: number; suggestedCategory: string; notes: string; confidence: number; warnings: string[]; items: Array<{ name: string; quantity?: number; amount?: number }> };

export function ReceiptOcrButton({ onDraft }: { onDraft: (patch: Partial<TransactionDraft>) => void }) {
  const { snapshot, mutate, isMutating, isOnline } = useApp();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowed = Boolean(snapshot?.entitlement.capabilities.ocr);
  const scan = async (source: 'camera' | 'gallery') => {
    try {
      setOpen(false); setError(null);
      const picked = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (picked.canceled) return;
      const compressed = await ImageManipulator.manipulateAsync(picked.assets[0].uri, [{ resize: { width: 1600 } }], { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG });
      const file = new File(compressed.uri);
      if (file.size > 4 * 1024 * 1024) throw new Error('Gambar masih lebih dari 4 MB setelah kompresi. Ambil ulang dengan resolusi lebih rendah.');
      const result = await mutate<{ receipt: OcrReceipt }>('ocrReceipt', { mimeType: 'image/jpeg', imageBase64: await file.base64() });
      const receipt = result.data?.receipt;
      if (!receipt) throw new Error('Hasil OCR kosong.');
      onDraft({ type: 'expense', amount: receipt.total, merchant: receipt.merchant, date: receipt.date, category: receipt.suggestedCategory, notes: [receipt.notes, receipt.items.map((item) => item.name).filter(Boolean).join(', ')].filter(Boolean).join(' · ') });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'OCR tidak dapat memproses gambar.'); }
  };
  return <>
    <AppButton tone="secondary" icon={ScanLine} disabled={!isOnline || !allowed} loading={isMutating} onPress={() => setOpen(true)}>{allowed ? 'Isi dari OCR struk' : 'OCR · Premium'}</AppButton>
    {error ? <Card style={{ borderColor: '#d65b67' }}><AppText style={{ color: '#d65b67' }}>{error}</AppText></Card> : null}
    <AppBottomSheet visible={open} title="Pilih gambar struk" onClose={() => setOpen(false)}><AppText muted>Gambar dikompres di perangkat, dikirim untuk ekstraksi, tidak disimpan otomatis, dan hanya mengisi draft.</AppText><View style={{ flexDirection: 'row', gap: spacing.xs }}><AppButton icon={Camera} onPress={() => void scan('camera')}>Kamera</AppButton><AppButton tone="secondary" icon={ImageIcon} onPress={() => void scan('gallery')}>Galeri</AppButton></View></AppBottomSheet>
  </>;
}
export function ReceiptAttachment({ transactionId, receipt }: { transactionId: string; receipt?: TransactionReceipt }) {
  const { snapshot, mutate, isMutating, isOnline } = useApp();
  const [error, setError] = useState<string | null>(null); const [deleteConfirm, setDeleteConfirm] = useState(false);
  const allowed = Boolean(snapshot?.entitlement.capabilities.attachments);
  const attach = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0]; const file = new File(asset.uri);
      if (file.size > 5 * 1024 * 1024) throw new Error('Lampiran maksimal 5 MB.');
      const contentType = asset.mimeType ?? file.type;
      if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(contentType)) throw new Error('Lampiran harus JPG, PNG, WebP, atau PDF.');
      await mutate('attachTransactionReceipt', { transactionId, filename: asset.name, contentType, contentBase64: await file.base64() });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Lampiran gagal diunggah.'); }
  };
  return <Card style={{ gap: spacing.sm }}><AppText variant="title">Lampiran</AppText>{receipt ? <><AppText>{receipt.filename}</AppText><AppText variant="caption" muted>{receipt.contentType} · {Math.ceil(receipt.sizeBytes / 1024)} KB</AppText><AppButton tone="danger" icon={Trash2} onPress={() => setDeleteConfirm(true)}>Hapus lampiran</AppButton></> : <AppButton tone="secondary" icon={FileUp} disabled={!isOnline || !allowed} loading={isMutating} onPress={() => void attach()}>{allowed ? 'Pilih lampiran' : 'Lampiran · Pro'}</AppButton>}{error ? <AppText style={{ color: '#d65b67' }}>{error}</AppText> : null}<ConfirmDialog visible={deleteConfirm} title="Hapus lampiran?" message="File struk akan dipindahkan ke trash Drive dan dilepas dari transaksi." destructive loading={isMutating} confirmLabel="Hapus" onCancel={() => setDeleteConfirm(false)} onConfirm={() => void mutate('deleteTransactionReceipt', { transactionId }).then(() => setDeleteConfirm(false)).catch((cause) => setError(cause instanceof Error ? cause.message : 'Gagal menghapus lampiran.'))} /></Card>;
}
