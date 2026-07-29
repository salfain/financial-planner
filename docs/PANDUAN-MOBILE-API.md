# Financial Planner — Panduan API Mobile Pribadi

API mobile memakai project Google Apps Script dan Spreadsheet yang sama dengan aplikasi web. Web tetap owner-only dan memuat `doGet`; deployment mobile bersifat publik tetapi hanya memuat `doPost` yang memverifikasi Personal Access Key sebelum router bisnis dipanggil.

Mode ini ditujukan untuk penggunaan pribadi. Tidak diperlukan Google OAuth, Firebase, consent screen, client ID, SHA-1 Android, atau biaya layanan autentikasi.

## Keputusan deployment yang aman

- Jangan pernah mengubah deployment web yang memuat `Main.gs`, `Index.html`, atau `Frontend.html` menjadi **Anyone**.
- Buat versi API mobile dari `npm run build:mobile-api`; paket ini sengaja tidak berisi `doGet` atau HTML.
- Deploy versi mobile pada project Apps Script container-bound yang sama agar Spreadsheet dan `LockService.getDocumentLock()` tetap sama dengan web.
- Deployment API menunjuk version API-only yang immutable. Setelah membuat version, pulihkan working source ke source web lengkap.
- Access key mentah hanya disimpan oleh pemilik dan perangkat. Apps Script hanya menyimpan hash SHA-256.

## 1. Buat Personal Access Key

Jalankan dari root repository:

```powershell
npm run mobile:access-key
```

Perintah menampilkan dua nilai:

1. Personal Access Key mentah untuk dimasukkan satu kali ke aplikasi.
2. `VINN_MOBILE_ACCESS_KEY_SHA256` untuk Script Properties.

Simpan key mentah di password manager. Jangan menaruhnya dalam source, `.env`, screenshot, chat, atau execution log. Jika terminal sedang direkam atau dibagikan, hentikan perekaman sebelum membuat key.

## 2. Isi Script Properties

Buka **Apps Script → Project Settings → Script Properties**, lalu tambahkan:

| Property | Nilai |
|---|---|
| `VINN_MOBILE_API_ENABLED` | `true` |
| `VINN_MOBILE_ACCESS_KEY_SHA256` | Hash 64 karakter dari perintah generator |

Backend gagal secara tertutup:

- property hilang/rusak menghasilkan `MOBILE_API_NOT_CONFIGURED`;
- kill switch `false` menghasilkan `MOBILE_API_DISABLED`;
- key kosong menghasilkan `AUTH_REQUIRED`;
- key lemah atau salah menghasilkan `AUTH_INVALID`.

## 3. Buat deployment API mobile

1. Jalankan `npm run build:mobile-api`.
2. Buka `outputs/financial-planner-mobile-api` dan salin `.clasp.json.example` menjadi `.clasp.json`.
3. Isi `scriptId` dengan project Apps Script yang sama dengan deployment web.
4. Push paket, buat version baru, lalu deploy version itu sebagai Web app: **Execute as me** dan **Who has access: Anyone**.
5. Salin URL deployment yang berakhir dengan `/exec`.
6. Segera push kembali source `apps-script/` lengkap agar working version kembali memuat web owner-only.
7. Pastikan deployment web lama tetap **Only myself/akun berwenang**.

Jangan mengarahkan deployment publik ke head/working version. Aplikasi hanya menerima URL resmi berbentuk `https://script.google.com/macros/s/.../exec`.

## 4. Hubungkan perangkat

Buka aplikasi, lalu masukkan:

- URL `/exec` dari deployment API mobile;
- Personal Access Key mentah dari langkah 1.

Aplikasi memvalidasi bootstrap sebelum membuka workspace. Pada Android/iOS, URL dan key disimpan menggunakan SecureStore dengan akses `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Key tidak berada di bundle aplikasi.

## 5. Uji penolakan sebelum digunakan

- URL selain `script.google.com` ditolak oleh aplikasi.
- Request tanpa key, key pendek, dan key salah ditolak sebelum router.
- Action di luar allowlist ditolak dengan `ACTION_NOT_ALLOWED`.
- Mutation dengan UUID v4 yang sama hanya dijalankan satu kali.
- Deployment publik tidak menyajikan UI web melalui GET.
- Access key dan payload finansial tidak muncul pada execution log.
- `VINN_MOBILE_API_ENABLED=false` langsung menutup akses mobile.

## 6. Rotasi dan pemulihan

Jika perangkat hilang atau key diduga bocor:

1. Ubah `VINN_MOBILE_API_ENABLED` menjadi `false`.
2. Jalankan `npm run mobile:access-key` untuk membuat key baru.
3. Ganti `VINN_MOBILE_ACCESS_KEY_SHA256` dengan hash baru.
4. Aktifkan kembali API.
5. Masukkan URL dan key baru pada perangkat yang dipercaya.

Key lama langsung tidak berlaku setelah hash diganti. Rotasi tidak mengubah Spreadsheet atau data finansial.
