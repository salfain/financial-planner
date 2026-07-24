# Financial Planner — Deployment Demo Publik

Edisi ini khusus calon pembeli: data contoh, semua menu Premium terbuka, seluruh fitur penyimpanan hanya-baca. Paket tidak memakai Google Sheets, Drive, API key, atau data pelanggan.

## Aturan utama

- Gunakan project Apps Script baru. Jangan memakai project ID pada `.clasp.json` produksi.
- Deployment demo boleh publik. Deployment pelanggan harus tetap `MYSELF`.
- Jangan menambahkan file `Router.gs` atau service dari paket pelanggan ke project demo.

## Build

```bash
npm run package:demo
```

Artefak tersedia di `outputs/financial-planner-demo` dan `outputs/Financial-Planner-Demo.zip`.

## Deploy

1. Buat project standalone baru di [script.google.com](https://script.google.com).
2. Salin lima file dari folder `apps-script` paket demo dengan nama yang sama.
3. Jalankan fungsi berikut sekali dari editor:

```javascript
configureFinancialPlannerDemo("https://wa.me/628xxxxxxxxxx");
```

4. Pilih **Deploy → New deployment → Web app**.
5. Jalankan sebagai pemilik. Pilih akses **Anyone**.
6. Buka URL deployment tanpa parameter tambahan.

## Checklist

- Banner menampilkan `Mode Demo Premium · hanya-baca`.
- CTA membuka WhatsApp yang dikonfigurasi.
- Dashboard, roadmap, forecast, dana darurat, utang, transaksi rutin, investasi, laporan, dan insight dapat dibuka.
- Percobaan menyimpan data menampilkan pesan read-only.
- Tidak ada Spreadsheet, file Drive, trigger, backup, atau histori AI yang dibuat.
- Menambahkan `?demo=1` pada deployment pelanggan tidak mengaktifkan demo.

## Pembaruan dan rollback

Build paket baru, salin file baru ke project demo, lalu buat versi deployment baru. Untuk rollback, pilih versi deployment sebelumnya dari **Manage deployments**. Jangan pernah menyalin `.clasp.json`, Script Properties, atau script ID antara demo dan pelanggan.
