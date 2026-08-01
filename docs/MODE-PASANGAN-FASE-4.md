# Mode Pasangan — Fase 4

Fase 4 adalah audit kebocoran yang menutup rangkaian Mode Pasangan. Fase 2 dan 3 menutup data keuangan; Fase 4 menyisir permukaan yang tersisa, yaitu aksi tingkat workspace, riwayat percakapan AI, status notifikasi, dan riwayat berkas ekspor.

## Hasil audit permukaan API

Seluruh aksi router melewati `resolveMemberContext_` kecuali `health`, `whoami`, dan `memberLogin`. Ini termasuk `doPost` pada API mobile, yang memanggil `api()` sehingga ikut memakai konteks anggota yang sama. Tidak ditemukan jalur yang melewati penyaringan scope.

Yang ditemukan bocor adalah empat hal berikut.

## Aksi tingkat workspace kini terkunci untuk pemilik

Sejumlah aksi bekerja pada seluruh workspace, bukan pada data satu anggota. Membiarkannya terbuka untuk editor membuat pasangan dapat mengekspor, memigrasi, atau mengunci data anggota lain tanpa pernah melihatnya di layar. Penguncian dipasang terpusat di `Router.gs` lewat `OWNER_ONLY_ACTIONS` dan `assertActionAllowedForMember_`, sehingga daftarnya dapat diperiksa dalam satu tempat.

Aksi yang terkunci: `setup`, `setupWorkspace`, `upgradeWorkspace`, `activateLicense`, `deactivateLicense`, `backup`, `createBackup`, `backupOverview`, `updateBackupSchedule`, `migrationHistory`, `previewMigration`, `applyMigration`, `cancelMigration`, `repairLedger`, `closeMonthlyBook`, `reopenMonthlyBook`, dan `saveAiKey`.

Editor yang mencoba menjalankannya menerima `OWNER_ONLY`. Penguncian hanya berlaku saat Mode Pasangan aktif; instalasi pengguna tunggal tidak berubah.

## Riwayat AI menjadi milik anggota

Sheet `AIChat` sebelumnya dibagi seluruh workspace. Pertanyaan keuangan yang diketik seorang anggota, termasuk yang menyangkut akun pribadinya, terbaca oleh pasangan. Sheet ini kini memiliki kolom `member_id` yang dicap otomatis saat penulisan dan disaring saat pembacaan.

Menghapus riwayat juga ikut diperbaiki. Sebelumnya `apiClearAiHistory` mengosongkan seluruh sheet, sehingga satu anggota dapat menghapus percakapan anggota lain. Pada Mode Pasangan, penghapusan kini hanya mengenai baris milik anggota yang sedang masuk.

Perubahan ini menaikkan versi schema menjadi `1.19.0`. Jalankan `setupFinancialPlanner()` sekali agar kolom baru ditambahkan; data lama tetap utuh.

## Status notifikasi menjadi per anggota

Kolom `member_id` pada `NotificationStates` sudah ada sejak Fase 0 tetapi tidak pernah dipakai. Akibatnya satu anggota yang menutup notifikasi ikut menutupnya bagi pasangan, dan status baca saling terlihat. Kolom itu kini dicap dan disaring, sehingga setiap anggota memiliki barisnya sendiri untuk kunci notifikasi yang sama.

## Riwayat ekspor dan laporan menjadi per anggota

Berkas laporan dibuat dari snapshot milik satu anggota sehingga isinya dapat memuat akun pribadi. Riwayat portability kini menyimpan `memberId` dan disaring saat dibaca.

Satu jebakan ikut ditutup pada fase ini: `apiApplyMigration` dan `apiCancelMigration` membaca riwayat lalu menyimpannya kembali. Bila keduanya memakai daftar yang sudah tersaring, entri milik anggota lain akan terhapus diam-diam. Kedua jalur itu sekarang memakai `portabilityHistoryAll_()`, dan penyaringan hanya terjadi pada jalur baca.

## Penjaga regresi

`tests/couple-mode-scope-audit.test.mjs` memeriksa secara statis bahwa:

- setiap pemakaian `rowsAsObjectsUnscoped_` cocok dengan daftar izin beserta alasannya, sehingga pembacaan tanpa scope yang baru harus menjadi keputusan sadar;
- seluruh sheet bermuatan data anggota masih terdaftar pada `ScopeService`;
- daftar aksi khusus pemilik masih utuh;
- hanya tiga aksi yang terbuka tanpa sesi anggota;
- penolakan penulisan baris tersamar masih terpasang;
- kunci cache dashboard masih memuat scope anggota.

Pemeriksaan ini gagal ketika seseorang menambah jalur baru tanpa meninjau dampaknya, bukan hanya ketika ada kesalahan langsung.

## Batasan yang tetap berlaku

- Anggaran tetap data bersama karena terikat kategori dan bulan, bukan akun.
- Privasi berlaku di tingkat aplikasi, bukan penyimpanan. Pemilik spreadsheet tetap dapat membaca seluruh baris mentah, jadi spreadsheet tidak boleh dibagikan kepada anggota kedua. Ini sifat Google Sheets sebagai basis data dan tidak dapat dihilangkan oleh kode.
- Access key API mobile masih satu untuk seluruh workspace. Pemegangnya tetap wajib memiliki sesi anggota, sehingga scope tetap berlaku, tetapi kunci itu sendiri sebaiknya tidak dibagikan.

## Verifikasi Fase 4

Pengujian otomatis mencakup penolakan `OWNER_ONLY` untuk tujuh aksi tingkat workspace yang dicoba editor, keberhasilan aksi yang sama oleh pemilik, pemisahan riwayat AI termasuk perlakuan baris warisan yang hanya terlihat pemilik, penghapusan riwayat yang tidak menyentuh percakapan anggota lain, status notifikasi terpisah untuk kunci yang sama, serta enam pemeriksaan statis penjaga regresi.
