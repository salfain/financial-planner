# Financial Planner Mobile

Aplikasi Android dan iOS berbasis Expo SDK 57, React Native, Expo Router, dan TypeScript. Mobile memakai dataset Google Sheets serta router Apps Script yang sama dengan web; mobile tidak mengakses Google Sheets secara langsung.

## Autentikasi pribadi

Aplikasi memakai Personal Access Key untuk satu pemilik. Tidak diperlukan Google OAuth, Firebase, client ID, SHA-1, consent screen, atau file `.env`.

Saat pertama dibuka, masukkan URL deployment Apps Script `/exec` dan access key yang dibuat melalui:

```powershell
npm run mobile:access-key
```

Backend hanya menyimpan hash SHA-256. Key mentah dimasukkan satu kali dan disimpan di SecureStore pada Android/iOS; key tidak ditanam dalam APK atau bundle JavaScript.

## Persyaratan

- Node.js 22.13 atau lebih baru.
- Deployment API-only dari `npm run build:mobile-api` di root repository.
- URL deployment `https://script.google.com/macros/s/.../exec`.
- Personal Access Key minimal 32 karakter.

## Menjalankan dengan Expo Go

```powershell
cd mobile
npm install
npm run check
npx expo start
```

Pindai QR menggunakan Expo Go. Untuk pengujian native/store atau saat Expo Go tidak menyediakan modul yang diperlukan, gunakan development build:

```powershell
eas build --profile development --platform android
eas build --profile development --platform ios
npx expo start --dev-client
```

Build iOS lokal membutuhkan macOS; EAS Build dapat digunakan dari Windows.

## Perintah verifikasi

```powershell
npm run typecheck
npm run lint
npm test
npm run check
npx expo config --type public
npx expo export --platform all
```

`npm run brand:render` merender ulang icon, adaptive icon, splash, dan favicon dari source SVG pada `assets/brand/`.

## Batas keamanan

- URL dibatasi ke host resmi `script.google.com` dan wajib berakhir dengan `/exec`.
- Personal Access Key disimpan di SecureStore dan tidak dimigrasikan ke perangkat lain.
- Snapshot cache menghapus merchant, catatan, tag, lokasi, lampiran, dan detail audit, serta dibatasi 100 transaksi.
- Mutasi dinonaktifkan saat offline dan memakai UUID v4 yang sama ketika status request belum pasti.
- OCR hanya mengisi draft; transaksi selalu disimpan melalui konfirmasi pengguna.
- API key AI hanya dikirim ke backend saat pengaturan dan tidak pernah dibaca kembali ke mobile.
- Menu **Putuskan perangkat** menghapus key, cache, dan draft lokal tanpa menghapus backend.

Panduan backend: [PANDUAN-MOBILE-API.md](../docs/PANDUAN-MOBILE-API.md). Checklist rilis: [CHECKLIST-RILIS-MOBILE.md](../docs/CHECKLIST-RILIS-MOBILE.md).
