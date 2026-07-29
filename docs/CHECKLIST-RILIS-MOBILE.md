# Checklist Rilis Financial Planner Mobile

Checklist ini melengkapi PRD untuk mode Personal Access Key satu pemilik. Tidak diperlukan Google OAuth atau Firebase. Build store tetap membutuhkan credential Apple/Android signing dan perangkat nyata.

Status verifikasi repository per 27 Juli 2026 ditandai selesai. Item kosong membutuhkan deployment atau pengujian perangkat nyata.

## 1. Backend dan Personal Access Key

- [x] Generator key dan hash tersedia melalui `npm run mobile:access-key`.
- [x] Backend hanya menyimpan/membandingkan SHA-256 dan tidak meneruskan key ke router.
- [x] Jalankan `npm run build:mobile-api` dari root.
- [ ] Deploy `outputs/financial-planner-mobile-api` sebagai version API-only pada project Apps Script yang sama dengan web.
- [x] Pastikan paket publik tidak memuat `doGet`, `Main.gs`, atau HTML.
- [ ] Isi `VINN_MOBILE_API_ENABLED=true` dan `VINN_MOBILE_ACCESS_KEY_SHA256`.
- [x] Uji key kosong, pendek, salah, konfigurasi rusak, kill switch, action salah, dan replay `requestId`.
- [ ] Pastikan deployment web tetap owner-only.

## 2. Aplikasi dan build

- [x] URL dan key dimasukkan pada aplikasi, bukan melalui `.env` atau bundle.
- [x] URL dibatasi ke `https://script.google.com/macros/s/.../exec`.
- [x] Key disimpan melalui SecureStore dan dihapus saat perangkat diputuskan.
- [x] Jalankan `npm run check` di folder `mobile`.
- [x] Jalankan `npx expo config --type public` dan pastikan aplikasi tidak meminta izin mikrofon.
- [ ] Uji alur awal melalui Expo Go atau development build.
- [ ] Buat internal build Android/iOS untuk regression perangkat nyata.

## 3. Acceptance test perangkat

- [ ] Android minimum 7 dan iOS minimum 16.4 dapat membuka aplikasi.
- [ ] Layout 320 dp tidak memotong tombol, nominal, filter, atau bottom tab.
- [ ] URL/key benar membuka bootstrap; URL asing serta key salah ditolak.
- [ ] Rotasi hash langsung menolak key lama dan menerima key baru.
- [ ] Cold cache tampil kurang dari 1 detik dan refresh jaringan normal ditargetkan kurang dari 4 detik, di luar cold start Apps Script.
- [ ] Offline menampilkan cache read-only dan seluruh mutasi nonaktif.
- [ ] Privacy mode menyamarkan semua komponen `Amount`, laporan PDF, dan ringkasan.
- [ ] Create/edit/delete/undo transaksi, transfer, refund, pending, dan split 2–20 sama hasilnya dengan web.
- [ ] Timeout mutation tidak menghasilkan transaksi ganda.
- [ ] Rekonsiliasi akun membuat adjustment; saldo tidak dapat ditimpa langsung.
- [ ] Anggaran memasukkan split dan mengurangi refund.
- [ ] Kontribusi target tidak mengubah saldo akun.
- [ ] Pos Dana hanya mengubah alokasi virtual.
- [ ] Pembayaran kewajiban dibuat sebagai transfer, bukan expense ganda.
- [ ] Transaksi rutin tidak mengubah saldo sebelum **Catat ke ledger**.
- [ ] Tutup buku menolak mutasi periode sampai dibuka kembali.
- [ ] Lampiran 5 MB, import CSV 100 baris, OCR 4 MB, laporan, backup, dan migrasi diuji pada batas valid/tidak valid.
- [ ] Tautan Drive dan native share sheet bekerja.
- [ ] Tema light/dark/system, Dynamic Type, screen reader, reduced motion, dan target sentuh minimum 44 dp diperiksa.
- [ ] Putuskan perangkat menghapus URL/key/cache/draft tanpa mengubah backend.

## 4. Distribusi dan observability

- [ ] Periksa bundle identifier, version, build number, icon, splash, privacy copy, dan screenshot store.
- [ ] Lengkapi privacy disclosure untuk data finansial, Drive, kamera/foto, AI, OCR, dan penyimpanan credential lokal.
- [ ] Pastikan execution log tidak memuat access key, API key, gambar, atau payload finansial sensitif.
- [ ] Pantau error backend, latency, timeout, crash-free session, dan laporan duplikasi selama penggunaan.
- [ ] Simulasikan pencabutan akses dengan `VINN_MOBILE_API_ENABLED=false`.
- [ ] Simpan access key mentah hanya di password manager pemilik.

## 5. Hasil verifikasi otomatis terakhir

- `npm run test:unit`: 132 lulus, 0 gagal.
- `node --test tests/mobile-api.test.mjs`: 7 test Personal Access Key lulus.
- `npm run test:gas`: smoke test 24 source file, 19 transaksi, dan 49 audit row lulus.
- `mobile/npm run check`: typecheck, lint, dan 10 unit test mobile lulus.
- `npx expo export --platform all --clear`: bundle Android, iOS, dan web berhasil; 23 rute statis terbuat.
- `npx expo install --check`: seluruh versi dependensi sesuai Expo SDK 57.
- Konfigurasi publik: Android minimum SDK 24, iOS deployment target 16.4, dan izin mikrofon nonaktif.
- Audit production dependency tree: 13 moderate, 0 high, 0 critical; fix yang ditawarkan memerlukan downgrade Expo breaking sehingga tidak diterapkan.
- Audit artefak: tidak ditemukan OAuth/Nitro lama, credential statis, access key, private key, atau logging secret.
