# Administrasi deployment Financial Planner

Terakhir diverifikasi: 30 Juli 2026, Asia/Jakarta.

## Project produksi tunggal

- Project Apps Script: `financial planner vin`
- Script ID: `18Ft_rL3vBDPzhFg1sod2zjh3H5PjjKoq6WwLYTJG8IIhp0bqf2_dy4TO`
- Spreadsheet induk: `Financial Planner Alvin`
- Spreadsheet ID: `1a0sgmWXmqIcwnBxSMvpLapEW-g9Tj19BfoEYJ6Jzuw8`
- Deployment produksi: `AKfycbwSak4_zqxab1vQzSCAsjEcTTlxcfylstzKhv8L9iV5Ch09AusrlAetikFFzDBhka6ZZw`
- Versi produksi aktif: `51`
- URL produksi: `https://script.google.com/macros/s/AKfycbwSak4_zqxab1vQzSCAsjEcTTlxcfylstzKhv8L9iV5Ch09AusrlAetikFFzDBhka6ZZw/exec`

Jangan membuat deployment produksi kedua. Pembaruan berikutnya harus memakai deployment ID yang sama dengan perintah `clasp redeploy`.

Deployment `AKfycbzDA8HXlu4qBk_wSskYox46L8FUvDMCOQym5eKS2buQ @HEAD` adalah deployment kepala yang bersifat read-only dari Google. `clasp` menolak penghapusannya. Deployment tersebut bukan deployment versi produksi dan tidak dipakai oleh source web atau aplikasi Android.

Jika dashboard Apps Script menampilkan dua project bernama sama, pertahankan project yang Script ID-nya sama persis dengan Script ID produksi di atas. Project lain boleh diubah namanya menjadi `ARSIP - financial planner vin` setelah Script ID-nya diperiksa.

## Hasil stress test Google Sheets nyata

Benchmark dijalankan langsung melalui Apps Script produksi pada 30 Juli 2026 pukul 20:42 WIB. Pengujian menggunakan satu sheet sementara berisi 10.000 transaksi sintetis. Sheet tersebut telah dihapus otomatis setelah pengujian dan tidak mengubah ledger finansial.

| Pengukuran | Hasil | Batas internal | Status |
|---|---:|---:|---|
| Bootstrap dingin | 5.481 ms | 10.000 ms | Lolos |
| Bootstrap hangat | 84 ms | 2.500 ms | Lolos |
| Pencarian server | 610 ms | 5.000 ms | Lolos |
| Tulis 10.000 baris | 8.781 ms | 30.000 ms | Lolos |
| Baca 10.000 baris | 1.513 ms | 15.000 ms | Lolos |
| Cari di 10.000 baris | 15 ms | 1.500 ms | Lolos |
| Simpan, ubah, dan hapus satu baris | 653 ms | 5.000 ms | Lolos |

Ukuran payload bootstrap saat tes adalah 75.238 byte dengan 14 akun dan 80 transaksi aktif. Hasil keseluruhan: `healthy`, tanpa peringatan ambang.

Fungsi admin `runFinancialPlannerPerformanceBenchmark()` disimpan di `PerformanceService.gs` agar tes dapat diulang dari editor Apps Script. Fungsi ini hanya memakai sheet sementara di workbook aktif dan selalu menghapusnya melalui blok pembersihan.
