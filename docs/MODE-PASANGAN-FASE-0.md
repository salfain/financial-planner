# Mode Pasangan — Fase 0

Fase 0 menambahkan fondasi identitas anggota dan sesi aman untuk deployment Google Apps Script. Mode ini hanya tersedia untuk lisensi Premium dan tetap nonaktif setelah pembaruan agar instalasi pengguna tunggal tidak terkunci mendadak.

## Memperbarui instalasi lama

1. Push source branch ini ke project Apps Script pelanggan.
2. Jalankan `setupFinancialPlanner()` satu kali dari editor Apps Script.
3. Pastikan pemeriksaan struktur menunjukkan schema `1.18.0` dan seluruh sheet sehat.
4. Jangan aktifkan Mode Pasangan sampai pemilik siap menyimpan PIN sementara.

Manifest tetap memakai akses **Only myself** agar instalasi pengguna tunggal tidak terbuka sebelum autentikasi anggota diaktifkan. Setelah Mode Pasangan aktif dan login pemilik berhasil diuji, ubah deployment web app menjadi **Execute as: Me** dan **Who has access: Anyone with Google account**. Spreadsheet tidak perlu dan tidak boleh dibagikan kepada anggota kedua.

Setup menambahkan sheet `Members`, `MemberSessions`, dan `MemberLoginAttempts`, serta kolom scope di paling kanan. Data akun lama tetap utuh dan dianggap sebagai data bersama karena `scope_member_id` kosong.

## Mengaktifkan Mode Pasangan

1. Pastikan lisensi Premium aktif.
2. Dari Google Sheets, buka menu **Financial Planner → Aktifkan Mode Pasangan**.
3. Buka log eksekusi dan simpan PIN sementara enam angka yang ditampilkan.
4. Buka kembali URL web app, pilih **Pemilik**, lalu masukkan PIN tersebut.
5. Untuk mengganti PIN, gunakan **Financial Planner → Atur PIN Pemilik**. Semua sesi lama akan dicabut.

Owner tidak pernah dibuat dari endpoint publik. Aktivasi hanya dapat dijalankan oleh pemilik dari project Apps Script atau menu spreadsheet.

## Menonaktifkan dengan aman

Gunakan **Financial Planner → Nonaktifkan Mode Pasangan**. Aplikasi kembali ke perilaku pengguna tunggal dan seluruh sesi anggota dicabut. Data anggota dan kolom scope tidak dihapus agar mode dapat diaktifkan kembali tanpa kehilangan konfigurasi.

## Batasan Fase 0

- Fase 0 baru melindungi pintu masuk API dengan sesi anggota.
- Penambahan anggota kedua dan pergantian PIN dari dalam aplikasi dikerjakan pada Fase 1.
- Pemisahan data pribadi dan bersama di setiap service dikerjakan pada Fase 2.
- Jangan menyerahkan Mode Pasangan sebagai fitur produksi sampai audit kebocoran Fase 4 selesai.
- Privasi berlaku di aplikasi. Pemilik spreadsheet tetap dapat membaca sheet mentah.

## Perilaku keamanan

- Token mentah hanya tersimpan di browser; sheet menyimpan hash token.
- Sesi aktif selama 30 hari, dengan batas absolut 90 hari.
- Aktivitas memperpanjang sesi paling sering setiap enam jam untuk mengurangi penulisan ke Sheets.
- Lima PIN salah dalam sepuluh menit mengunci login selama sepuluh menit.
- Pembatasan percobaan disimpan permanen di sheet; cache bukan sumber kebenaran.
- Pembersihan sesi kedaluwarsa berjalan melalui trigger harian khusus.
