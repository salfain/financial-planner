# VINN STORE — Financial OS

**VINN STORE Financial OS** adalah aplikasi pengelolaan keuangan terpadu dengan ledger persisten untuk transaksi, anggaran, investasi, laporan, backup, migrasi, reminder, dan analisis berbasis AI.

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
- Transaksi lanjutan: duplikasi terkonfirmasi, split hingga 20 kategori, waktu/catatan/tag/lokasi, lampiran struk privat, pencarian dan filter server-side, pagination, bulk import CSV dengan preview, serta undo aksi terakhir yang tervalidasi ledger.
- Rekonsiliasi saldo aset maupun kewajiban melalui transaksi `adjustment_in/out`; penyesuaian tidak masuk cashflow atau anggaran.
- Kategori pemasukan/pengeluaran dinamis: tambah, ubah, arsipkan, dan gunakan langsung pada form transaksi, anggaran, serta tagihan.
- Audit trail aktivitas terbaru pada halaman Pengaturan.
- Perhitungan rekening aset dan kewajiban.
- Realisasi budget; refund mengurangi realisasi.
- Kontribusi target finansial.
- Pembayaran tagihan dan pencatatan transaksi terkait.
- Portofolio investasi persisten: asset master, buy/sell, unit pecahan, weighted average cost, fee, pajak, realized/unrealized P/L, serta harga manual dengan fallback harga transaksi terakhir.
- Setiap buy/sell terhubung ke ledger akun secara logis sehingga saldo kas, cost basis, dan histori dapat direkonstruksi tanpa masuk ke arus kas operasional.
- Laporan PDF A4 lengkap dengan pilihan bagian, privacy mask, riwayat file, penyimpanan permanen, serta ekspor CSV yang aman dari formula injection.
- Backup lengkap manual dan otomatis dengan histori unduhan; versi web menyimpan file pada object storage, versi Apps Script menyimpan salinan pada folder Google Drive khusus.
- Migrasi backup JSON dengan preview jumlah baris, pemeriksaan relasi, rekonsiliasi saldo, deteksi aset duplikat, backup pra-migrasi, konfirmasi eksplisit, pembatalan preview, dan laporan hasil.
- Notification center persisten untuk tagihan rutin, batas anggaran, deadline target, backup lama, dan harga investasi yang belum tersedia; status baca/arsip serta ambangnya dapat diatur.
- Tagihan bulanan memakai jatuh tempo berulang dan pilihan reminder H-7, H-3, H-1, atau hari H.
- Dark mode, privacy mode, UI responsif, reduced-motion, dan label aksesibilitas.
- Harga investasi menampilkan sumber dan timestamp; harga manual maupun fallback transaksi terakhir tidak diklaim sebagai harga real-time.
- VINN Insight berbasis Gemini dengan mode read-only, context builder minimal, manifest data yang dikirim, disclaimer, histori persisten, dan kontrol hapus histori.
- OCR struk berbasis Gemini: gambar dikompresi di perangkat, tidak disimpan, hasil divalidasi, dan baru mengisi form setelah pengguna menekan konfirmasi. Transaksi tetap harus dikonfirmasi manual.
- API key Gemini tersimpan terenkripsi pada D1 atau di User Properties Apps Script; key tidak pernah dikirim kembali ke browser, histori, maupun audit log.

## Menyiapkan Google Sheets + Apps Script

1. Buat Google Spreadsheet kosong bernama `VINN STORE Finance`.
2. Buka **Extensions → Apps Script**.
3. Jalankan `npm run build:gas`, lalu salin file di folder `apps-script/` ke project Apps Script, atau gunakan `clasp`.
4. Untuk `clasp`, salin `.clasp.json.example` menjadi `.clasp.json`, lalu isi `scriptId` dari Apps Script Project Settings.
5. Jalankan `setupVinnStore()` satu kali dan izinkan akses yang diminta.
6. Pastikan semua sheet terbentuk tanpa menghapus data yang sudah ada.
7. Pilih **Deploy → New deployment → Web app**. Jalankan sebagai pemilik dan batasi akses ke akun yang berwenang.

API key Gemini dapat ditambahkan dari halaman **Pengaturan → AI & OCR Gemini**. Pada Apps Script key disimpan melalui User Properties dan tidak pernah dikirim kembali ke browser. Apps Script menggunakan document lock, request ID untuk idempotency, soft delete, audit log, cache dashboard, backup ke Google Drive, dan time-driven trigger untuk backup otomatis.

## Struktur penting

```text
app/                 React UI dan design system
lib/                 kalkulasi finansial dan adapter Apps Script
apps-script/         backend Google Apps Script
tests/               unit test untuk aturan ledger
public/               favicon dan social preview VINN STORE
```

## Cakupan produk

Core Finance, transaksi lanjutan, Investment, AI Assistant, OCR, Reports, Backup, Migration, dan in-app Reminder terhubung ke UI, D1/R2, serta backend Google Sheets/Drive. Reminder tersedia langsung di dalam aplikasi, sedangkan pembayaran tagihan tetap menggunakan konfirmasi manual agar setiap perubahan saldo berada dalam kendali pengguna.
