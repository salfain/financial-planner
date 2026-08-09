# Deploy frontend ke VPS dengan Coolify

Frontend dijalankan di VPS sebagai aplikasi Node.js. Data, login backend, dan seluruh mutasi tetap diproses oleh Google Apps Script + Google Sheets melalui deployment API-only. Jangan membuat spreadsheet atau project Apps Script kedua untuk instalasi ini.

## 1. Siapkan backend Apps Script

Gunakan project Apps Script produksi yang sudah terhubung ke spreadsheet `Financial Planner`.

1. Jalankan `npm run mobile:access-key` di komputer lokal. Simpan access key dan nilai SHA-256 yang dihasilkan.
2. Di **Apps Script → Project Settings → Script properties**, isi:

   - `VINN_MOBILE_API_ENABLED=true`
   - `VINN_MOBILE_ACCESS_KEY_SHA256=<hash 64 karakter>`

3. Jalankan `npm run build:mobile-api`.
4. Gunakan hasil paket API-only untuk deployment Apps Script baru pada **project yang sama**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Salin URL deployment yang berakhiran `/exec`.
6. Setelah deployment API-only selesai, pulihkan/deploy kembali source web Apps Script penuh bila sebelumnya source project sedang berisi paket API-only. Deployment web owner-only tetap dipakai untuk versi Google Sheets.

URL API-only dan access key inilah yang dipasang di Coolify. Jangan memakai URL web owner-only untuk frontend VPS.

## 2. Instal Coolify di VPS baru

Gunakan Ubuntu LTS 22.04 atau 24.04 yang masih kosong, login sebagai root, lalu jalankan:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Buka URL Coolify yang ditampilkan installer dan segera buat akun admin pertama.

## 3. Buat aplikasi frontend

Di Coolify:

1. Buat **Project → New Resource → Application**.
2. Hubungkan repository Git frontend dan pilih branch produksi.
3. Pilih build pack **Dockerfile**.
4. Isi **Base Directory** dengan `/` dan gunakan `Dockerfile` di root repository.
5. Isi **Ports Exposes** dengan `3000`.
6. Pasang domain frontend pada bagian **Domains** dan aktifkan HTTPS/Force HTTPS.

## 4. Isi environment variables

Tambahkan tiga variabel berikut di tab **Environment Variables**:

| Nama | Nilai | Tipe |
| --- | --- | --- |
| `NEXT_PUBLIC_FINANCE_BACKEND` | `apps-script` | Build variable |
| `APPS_SCRIPT_API_URL` | URL API-only `/exec` | Runtime variable |
| `APPS_SCRIPT_ACCESS_KEY` | access key dari langkah 1 | Runtime secret |

`NEXT_PUBLIC_FINANCE_BACKEND` harus tersedia saat build Docker. Dua variabel Apps Script cukup runtime dan jangan diberi tanda build variable; access key tidak pernah dimasukkan ke bundle browser.

Setelah menyimpan variabel, klik **Deploy**. Aplikasi akan listen pada `0.0.0.0:3000`.

## 5. Pemeriksaan setelah deploy

1. Buka domain frontend dan lakukan setup/login sesuai halaman aplikasi.
2. Buka Pengaturan → Diagnostik. Backend harus terbaca sebagai **Google Sheets**.
3. Uji baca data, tambah transaksi, dan tambah anggaran.
4. Jika muncul `Backend Apps Script belum dikonfigurasi`, pastikan nama variabel sama persis dan container sudah di-redeploy.
5. Jika muncul `URL atau access key pribadi tidak cocok`, periksa hash Script Properties dan pasangan URL/access key.

## Catatan keamanan

Proxy `/api/apps-script` menjaga access key tetap di server, tetapi siapa pun yang dapat memakai domain frontend tetap dapat memakai fitur aplikasi. Untuk aplikasi pribadi, lindungi domain dengan Cloudflare Access, basic auth pada reverse proxy, atau lapisan login VPS sebelum dibuka ke publik.
