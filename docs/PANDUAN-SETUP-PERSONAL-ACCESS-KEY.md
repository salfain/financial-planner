# Panduan Setup Personal Access Key Mobile

Panduan ini digunakan untuk menghubungkan aplikasi Financial Planner Mobile ke Google Apps Script milik pribadi. Proses ini gratis dan tidak membutuhkan Google OAuth, Firebase, client ID, atau SHA-1 Android.

## Bedakan tiga jenis kode

| Nilai | Contoh | Kegunaan |
|---|---|---|
| ID instalasi | `inst-811e...` | Identitas instalasi untuk lisensi produk |
| Kode lisensi | `FP1...` | Mengaktifkan paket Pro/Premium |
| Personal Access Key | `vfp_...` | Menghubungkan aplikasi mobile ke API Apps Script |

ID instalasi dan kode lisensi **bukan** Personal Access Key. Jangan memasukkannya ke kolom access key pada aplikasi mobile.

## 1. Buat Personal Access Key

Buka PowerShell, lalu jalankan:

```powershell
cd "C:\Users\VINN_\Documents\finance planner"
npm run mobile:access-key
```

Terminal akan menampilkan dua nilai:

```text
Personal Access Key baru:
vfp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

VINN_MOBILE_ACCESS_KEY_SHA256=abcdef1234567890...
```

Gunakan nilainya sebagai berikut:

- Simpan nilai mentah `vfp_...` di password manager. Nilai ini nanti ditempel ke aplikasi mobile.
- Simpan hash setelah `VINN_MOBILE_ACCESS_KEY_SHA256=` ke Script Properties Apps Script.
- Jangan memasukkan hash ke kolom aplikasi.
- Jangan menyimpan key mentah di source code, `.env`, screenshot, chat, atau execution log.

## 2. Konfigurasi Script Properties

1. Buka project Google Apps Script Financial Planner.
2. Pilih **Project Settings**.
3. Buka bagian **Script Properties**.
4. Tambahkan dua property berikut:

| Property | Value |
|---|---|
| `VINN_MOBILE_API_ENABLED` | `true` |
| `VINN_MOBILE_ACCESS_KEY_SHA256` | Hash 64 karakter dari generator |

Contoh:

```text
VINN_MOBILE_API_ENABLED=true
VINN_MOBILE_ACCESS_KEY_SHA256=abcdef1234567890...
```

Jangan menyimpan nilai `vfp_...` mentah di Script Properties. Backend hanya membutuhkan hash-nya.

## 3. Siapkan paket API mobile

Dari root repository jalankan:

```powershell
npm run build:mobile-api
```

Paket akan dibuat di:

```text
outputs/financial-planner-mobile-api
```

Paket ini hanya berisi endpoint `doPost` dan service backend. Paket tidak berisi `doGet`, `Main.gs`, atau halaman web sehingga aman dijadikan deployment API-only.

## 4. Deploy API Apps Script

Gunakan project Apps Script yang sama dengan aplikasi web dan Spreadsheet utama.

1. Push isi `outputs/financial-planner-mobile-api` ke project Apps Script.
2. Buat version Apps Script baru.
3. Pilih **Deploy → New deployment → Web app**.
4. Atur:
   - **Execute as:** Me
   - **Who has access:** Anyone
5. Selesaikan deployment.
6. Salin URL Web App yang berakhir dengan `/exec`.

Contoh URL:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Penting:

- Jangan mengubah deployment web utama menjadi **Anyone**.
- Deployment publik harus menunjuk version API-only, bukan working/head version web.
- Setelah membuat version API, pulihkan working source Apps Script ke source web lengkap.

## 5. Jalankan aplikasi mobile

Buka PowerShell:

```powershell
cd "C:\Users\VINN_\Documents\finance planner\mobile"
npx expo start
```

Buka aplikasi melalui Expo Go atau development build.

Pada layar **Hubungkan perangkat**, isi:

### URL API Apps Script

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

### Personal access key

```text
vfp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Tekan **Hubungkan perangkat**. Tombol baru aktif jika URL telah diisi dan key memiliki minimal 32 karakter.

## 6. Pengujian singkat

Setelah terhubung, pastikan:

- dashboard dapat memuat data;
- akun dan transaksi sama dengan aplikasi web;
- membuat satu transaksi berhasil;
- refresh tidak membuat transaksi ganda;
- mode offline hanya menampilkan cache dan menolak perubahan;
- menu **Putuskan perangkat** menghapus key serta cache lokal tanpa menghapus data backend.

Uji keamanan dasar:

1. Ubah satu karakter pada key: backend harus menolak.
2. Gunakan URL selain `script.google.com`: aplikasi harus menolak.
3. Ubah `VINN_MOBILE_API_ENABLED=false`: seluruh akses mobile harus berhenti.
4. Aktifkan kembali dengan `true` setelah pengujian.

## 7. Jika key hilang atau bocor

1. Ubah `VINN_MOBILE_API_ENABLED` menjadi `false`.
2. Jalankan kembali `npm run mobile:access-key`.
3. Simpan key mentah baru di password manager.
4. Ganti `VINN_MOBILE_ACCESS_KEY_SHA256` dengan hash baru.
5. Ubah `VINN_MOBILE_API_ENABLED` menjadi `true`.
6. Putuskan lalu hubungkan ulang aplikasi menggunakan key baru.

Key lama langsung tidak berlaku setelah hash pada Script Properties diganti.

## Troubleshooting

### Tombol Hubungkan perangkat tidak aktif

- Pastikan URL sudah diisi.
- Pastikan key mentah `vfp_...` memiliki minimal 32 karakter.
- Pastikan perangkat memiliki koneksi internet.

### `MOBILE_API_NOT_CONFIGURED`

- Periksa kedua Script Properties.
- Hash harus tepat 64 karakter hexadecimal.
- Pastikan tidak memasukkan key mentah ke property hash.

### `MOBILE_API_DISABLED`

Ubah property berikut menjadi:

```text
VINN_MOBILE_API_ENABLED=true
```

### `AUTH_INVALID`

- Pastikan aplikasi memakai key mentah `vfp_...`, bukan hash.
- Pastikan hash berasal dari key mentah yang sama.
- Jika ragu, buat dan pasang key baru.

### URL ditolak aplikasi

Gunakan URL deployment resmi yang bentuknya persis:

```text
https://script.google.com/macros/s/.../exec
```

URL editor Apps Script, URL `/dev`, dan domain lain tidak diterima.

## Checklist cepat

- [ ] Jalankan `npm run mobile:access-key`.
- [ ] Simpan `vfp_...` di password manager.
- [ ] Isi `VINN_MOBILE_ACCESS_KEY_SHA256` dengan hash.
- [ ] Isi `VINN_MOBILE_API_ENABLED=true`.
- [ ] Jalankan `npm run build:mobile-api`.
- [ ] Deploy version API-only sebagai Web App.
- [ ] Salin URL `/exec`.
- [ ] Jalankan aplikasi mobile.
- [ ] Tempel URL `/exec` dan key mentah `vfp_...`.
- [ ] Uji dashboard dan satu transaksi.
