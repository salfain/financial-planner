# Dashboard Penerbit Lisensi

Dashboard ini dipakai oleh penjual di komputer sendiri. Kunci privat tidak dikirim ke aplikasi pelanggan.

## Menjalankan

1. Buka terminal pada folder Financial Planner.
2. Jalankan `npm run license:studio`.
3. Buka `http://127.0.0.1:4179` jika browser tidak terbuka otomatis.
4. Tempel ID instalasi pelanggan, pilih paket Pro atau Premium, lalu terbitkan lisensi.
5. Kirim hanya kode lisensi hasil penerbitan kepada pelanggan.

Lisensi Premium otomatis membuka semua kemampuan Pro. Riwayat penerbitan disimpan lokal di folder profil pengguna dan tidak ikut ke paket pelanggan.

## Keamanan

- Jangan kirim atau mengunggah file `private.pem`.
- Backup folder `~/.financial-planner-license` ke media pribadi yang aman.
- Jika kunci privat hilang, lisensi lama tetap dapat diverifikasi, tetapi penerbitan baru memerlukan pasangan kunci yang sama.
