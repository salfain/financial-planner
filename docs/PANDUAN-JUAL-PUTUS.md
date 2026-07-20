# Financial Planner — Panduan Instalasi Pelanggan

Paket ini adalah edisi **single-owner**. Setiap pembeli harus memakai Google Spreadsheet dan deployment Google Apps Script miliknya sendiri. Paket tidak berisi transaksi, saldo, API key, backup, atau konfigurasi deployment milik penjual.

## Yang diperlukan

- Akun Google milik pembeli.
- Google Spreadsheet kosong.
- Folder `apps-script` dari paket pelanggan.

## Instalasi pertama

1. Masuk ke akun Google pembeli.
2. Buat Google Spreadsheet kosong dengan nama `Financial Planner`.
3. Dari Spreadsheet, buka **Extensions → Apps Script**.
4. Buat atau salin semua file dari folder `apps-script` ke project Apps Script tersebut. Nama file harus dipertahankan.
5. Pastikan manifest memakai `executeAs: USER_DEPLOYING` dan akses `MYSELF`.
6. Pilih fungsi `setupFinancialPlanner`, tekan **Run**, lalu setujui izin yang diminta.
7. Kembali ke Spreadsheet dan pastikan menu **Financial Planner** muncul. Pilih **Periksa Struktur** bila ingin memeriksa semua sheet.
8. Di Apps Script pilih **Deploy → New deployment → Web app**.
9. Jalankan sebagai pemilik dan batasi akses hanya untuk akun pembeli.
10. Buka URL deployment. Isi nama pemilik, nama workspace, mata uang, zona waktu, serta minimal satu akun pada setup awal.

Setelah langkah ini, database pembeli adalah Spreadsheet tersebut. Lampiran, laporan, dan backup dibuat di Google Drive pembeli.

## Checklist sebelum diserahkan

- URL dibuka menggunakan akun pembeli.
- Dashboard baru masih kosong dan tidak menampilkan data penjual.
- Nama pemilik dapat diubah dari **Pengaturan → Profil pemilik**.
- Menu **Pengaturan → Penyimpanan utama** menampilkan Google Sheets terhubung.
- Backup manual berhasil dibuat di Google Drive pembeli.
- Deployment tidak diatur menjadi publik atau “Anyone”.
- Penjual tidak menyimpan salinan API key Gemini milik pembeli.

## Pembaruan aplikasi

1. Minta pembeli membuat backup dari aplikasi.
2. Ganti file source Apps Script dengan versi paket terbaru; jangan menghapus Spreadsheet pelanggan.
3. Jalankan `setupFinancialPlanner()` sekali. Fungsi ini aman dijalankan ulang dan mempertahankan data yang ada.
4. Buat versi deployment baru dari menu **Manage deployments**.
5. Jalankan **Periksa Struktur** dan buka kembali aplikasi.

## Pemulihan

Jika pemasangan gagal, jangan menghapus sheet yang sudah berisi transaksi. Simpan backup, periksa hasil **Periksa Struktur**, lalu jalankan ulang `setupFinancialPlanner()`. Untuk memindahkan data ke instalasi baru, gunakan fitur **Backup dan Migrasi** dari dalam aplikasi.
