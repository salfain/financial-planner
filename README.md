# VINN STORE — Financial OS

Implementasi bertahap berdasarkan `PRD_Keuangan_Finora.md`, dengan nama toko **VINN STORE**. Core Finance sudah memakai ledger persisten; aplikasi tidak mengisi akun atau transaksi dummy.

## Menjalankan aplikasi

Persyaratan: Node.js 22 atau lebih baru.

```powershell
npm install
npm run dev
```

Buka URL lokal yang ditampilkan, lalu selesaikan setup workspace satu kali. Data finansial disimpan di database D1 pada versi web atau Google Sheets pada bundle Apps Script; `localStorage` hanya dipakai untuk preferensi tema.

Untuk verifikasi lengkap:

```powershell
npm test
```

## Fitur yang sudah berfungsi

- Dashboard dengan net worth, income, expense, cashflow, savings rate, dan financial health score.
- Transaksi income, expense, dan transfer. Transfer memperbarui kedua akun tanpa masuk ke income/expense.
- Edit dan soft-delete transaksi dengan pembalikan serta penerapan ulang saldo secara atomik.
- Rekonsiliasi saldo aset maupun kewajiban melalui transaksi `adjustment_in/out`; penyesuaian tidak masuk cashflow atau anggaran.
- Kategori pemasukan/pengeluaran dinamis: tambah, ubah, arsipkan, dan gunakan langsung pada form transaksi, anggaran, serta tagihan.
- Audit trail aktivitas terbaru pada halaman Pengaturan.
- Perhitungan rekening aset dan kewajiban.
- Realisasi budget; refund mengurangi realisasi.
- Kontribusi target finansial.
- Pembayaran tagihan dan pencatatan transaksi terkait.
- Laporan operasional dan backup JSON.
- Dark mode, privacy mode, UI responsif, reduced-motion, dan label aksesibilitas.
- Halaman investasi, integrasi harga pasar, CSV, OCR, dan AI masih merupakan tahap lanjutan; UI tidak mengklaim data simulasi sebagai data nyata.

## Menyiapkan Google Sheets + Apps Script

1. Buat Google Spreadsheet kosong bernama `VINN STORE Finance`.
2. Buka **Extensions → Apps Script**.
3. Jalankan `npm run build:gas`, lalu salin file di folder `apps-script/` ke project Apps Script, atau gunakan `clasp`.
4. Untuk `clasp`, salin `.clasp.json.example` menjadi `.clasp.json`, lalu isi `scriptId` dari Apps Script Project Settings.
5. Jalankan `setupVinnStore()` satu kali dan izinkan akses yang diminta.
6. Pastikan semua sheet terbentuk tanpa menghapus data yang sudah ada.
7. Pilih **Deploy → New deployment → Web app**. Jalankan sebagai pemilik dan batasi akses ke akun yang berwenang.

API key Gemini disimpan melalui User Properties oleh `apiSaveAiKey()` dan tidak pernah dikirim kembali ke browser. Apps Script menggunakan document lock, request ID untuk idempotency, soft delete, audit log, cache dashboard, dan backup ke Google Drive.

## Struktur penting

```text
app/                 React UI dan design system
lib/                 kalkulasi finansial dan adapter Apps Script
apps-script/         backend Google Apps Script
tests/               unit test untuk aturan ledger
public/og.png         social preview VINN STORE
```

## Status tahap berikutnya

Core Finance sudah tersambung ke UI dan backend. Tahap berikutnya adalah modul investasi (aset, buy/sell, average cost, dan harga pasar), kemudian impor/ekspor lanjutan serta AI/OCR setelah alur finansial inti stabil.
