# Mode Pasangan — Fase 1

Fase 1 menambahkan manajemen maksimal dua anggota aktif pada satu instalasi Google Apps Script.

## Alur pemilik

1. Aktifkan lisensi Premium dan jalankan `enableCoupleMode()` satu kali dari editor Apps Script.
2. Salin PIN sementara pemilik dari hasil eksekusi.
3. Buka URL web app, pilih profil Pemilik, lalu masuk menggunakan PIN sementara.
4. Buat PIN pribadi 6 angka ketika layar pergantian PIN muncul.
5. Buka **Pengaturan → Anggota**, lalu pilih **Tambah anggota**.
6. Isi nama pasangan, email Google jika ingin memakai pencocokan akun otomatis, dan PIN awal 6 angka.
7. Kirim URL web app dan PIN awal kepada pasangan melalui jalur terpisah.

## Alur pasangan

1. Buka URL web app tanpa meminta akses ke spreadsheet.
2. Pilih profil pasangan dan masukkan PIN awal dari pemilik.
3. Ganti PIN awal dengan PIN pribadi sebelum data keuangan terbuka.
4. Setelah PIN tersimpan, sesi lama ditutup dan sesi baru dibuat otomatis.

## Aturan akses

- Hanya pemilik yang dapat menambah, mengedit, mengaktifkan, atau menonaktifkan anggota.
- Maksimal dua anggota dapat aktif pada saat yang sama.
- Pemilik tidak dapat menonaktifkan profilnya sendiri.
- Editor yang mencoba menambah anggota menerima `OWNER_ONLY`.
- Anggota nonaktif tidak dapat login dan seluruh sesinya dicabut.
- Semua perubahan anggota dan PIN dicatat pada AuditLog memakai ID anggota sebagai pelaku.

## Transparansi privasi

Pemisahan privasi berlaku di tingkat aplikasi, bukan di penyimpanan Google Sheets. Pemilik spreadsheet tetap dapat membaca baris mentah. Spreadsheet tidak dibagikan kepada pasangan; pasangan hanya memakai URL web app. Email Google bersifat opsional untuk membantu pencocokan profil dan bukan pengganti PIN aplikasi.

## Pengaturan deployment

Setelah alur owner berhasil diuji, gunakan deployment web app dengan **Execute as: Me** dan **Who has access: Anyone with Google account**. Jangan membagikan spreadsheet kepada anggota kedua.

## Verifikasi Fase 1

Pengujian otomatis mencakup login pertama, pergantian PIN wajib, login pasangan, penolakan anggota ketiga, penolakan editor saat menambah anggota, perlindungan pemilik dari nonaktif mandiri, dan actor ID pada audit log.
