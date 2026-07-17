# VINN STORE — Financial OS

Implementasi MVP berdasarkan `PRD_Keuangan_Finora.md`, dengan nama toko **VINN STORE**. Aplikasi menyediakan dashboard finansial responsif, ledger transaksi, multi-akun, anggaran, target, tagihan, investasi, laporan, privacy mode, dark mode, backup lokal, simulasi OCR, dan asisten finansial read-only.

## Menjalankan aplikasi

Persyaratan: Node.js 22 atau lebih baru.

```powershell
npm install
npm run dev
```

Buka URL lokal yang ditampilkan. Data demo disimpan di browser, sehingga transaksi, pembayaran tagihan, target, dan preferensi tetap tersedia setelah halaman dimuat ulang.

Untuk verifikasi lengkap:

```powershell
npm test
```

## Fitur yang sudah berfungsi

- Dashboard dengan net worth, income, expense, cashflow, savings rate, dan financial health score.
- Transaksi income, expense, dan transfer. Transfer memperbarui kedua akun tanpa masuk ke income/expense.
- Perhitungan rekening aset dan kewajiban.
- Realisasi budget; refund mengurangi realisasi.
- Kontribusi target finansial.
- Pembayaran tagihan dan pencatatan transaksi terkait.
- Portofolio dengan average cost, market value, dan unrealized P/L.
- Ekspor CSV, cetak/simpan PDF melalui browser, dan backup JSON.
- Dark mode, privacy mode, UI responsif, reduced-motion, dan label aksesibilitas.
- VINN AI dalam mode read-only dengan konteks agregat.
- Alur OCR berupa draft yang wajib dikonfirmasi sebelum disimpan.

## Menyiapkan Google Sheets + Apps Script

1. Buat Google Spreadsheet kosong bernama `VINN STORE Finance`.
2. Buka **Extensions → Apps Script**.
3. Salin file di folder `apps-script/` ke project Apps Script, atau gunakan `clasp`.
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

## Catatan MVP

Versi browser memakai local storage sebagai mode demo. Backend Google sudah disiapkan untuk setup sheet, transaksi atomik, health check, audit log, secret storage, dashboard bootstrap, soft delete, dan backup. Integrasi frontend hasil build ke template Apps Script memerlukan proses bundling statis pada tahap deployment final; versi demo yang dipublikasikan menggunakan hosting web agar dapat langsung ditinjau.
