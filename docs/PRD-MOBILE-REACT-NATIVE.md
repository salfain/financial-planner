# PRD — Financial Planner Mobile

| Atribut | Nilai |
|---|---|
| Produk | Financial Planner Mobile |
| Platform | Android dan iOS |
| Framework | React Native + Expo + TypeScript |
| Backend | Google Apps Script |
| Database | Google Sheets |
| Penyimpanan file | Google Drive |
| Bahasa | Bahasa Indonesia |
| Mata uang awal | IDR |
| Zona waktu awal | Asia/Jakarta |
| Model pengguna | Single-owner per instalasi |
| Status | Draft untuk implementasi |
| Versi | 1.0 |
| Tanggal | 27 Juli 2026 |

## 1. Ringkasan

Financial Planner Mobile adalah versi native Android dan iOS dari aplikasi web Financial Planner. Aplikasi mempertahankan aturan bisnis, data, paket lisensi, visual identity, dan backend yang sudah ada. UI dibangun ulang dengan React Native agar nyaman digunakan pada layar sentuh kecil.

Google Sheets tetap menjadi sumber data utama. Google Apps Script tetap menangani validasi, perhitungan ledger, idempotensi, audit, AI/OCR, laporan, backup, migrasi, dan akses Google Drive. Mobile tidak mengakses Google Sheets secara langsung.

React Native tidak menggunakan Vite. Proyek mobile memakai Expo/Metro. Vite tetap digunakan oleh aplikasi web dan proses build frontend Apps Script yang sudah ada.

## 2. Latar belakang

Aplikasi web telah menyediakan pengelolaan transaksi, akun, anggaran, target, pos dana, tagihan, transaksi rutin, investasi, laporan, backup, migrasi, notifikasi, AI, OCR, dan perencanaan finansial. Kebutuhan berikutnya adalah pengalaman mobile native tanpa mengganti backend maupun memindahkan data pelanggan.

Bridge `google.script.run` yang dipakai web hanya tersedia di halaman HTML Apps Script. React Native membutuhkan transport HTTPS JSON baru yang tetap meneruskan request ke router dan service Apps Script yang sama.

## 3. Tujuan produk

1. Memberikan pengalaman pencatatan keuangan native yang cepat pada Android dan iOS.
2. Menjaga satu sumber kebenaran pada Google Sheets milik pemilik aplikasi.
3. Mempertahankan hasil perhitungan dan aturan ledger yang sama dengan aplikasi web.
4. Mengadaptasi desain web ke pola interaksi mobile tanpa mengubah identitas visual.
5. Memungkinkan web dan mobile memakai dataset yang sama tanpa duplikasi.
6. Menjaga data finansial, token, API key, lampiran, laporan, dan backup tetap aman.
7. Menyediakan paritas fitur secara bertahap tanpa menahan rilis fitur inti.

## 4. Non-tujuan

Versi 1 tidak mencakup:

- Backend baru selain Google Apps Script, Google Sheets, dan Google Drive.
- Migrasi ke Firebase, Supabase, D1, R2, atau database lain.
- Akses Google Sheets langsung dari aplikasi mobile.
- Multi-owner, kolaborasi real-time, atau role anggota tim.
- Sinkronisasi bank otomatis.
- Pembayaran tagihan otomatis.
- Pencatatan transaksi rutin otomatis tanpa konfirmasi pemilik.
- Harga investasi real-time.
- Mutasi ledger saat offline.
- Perubahan besar pada branding atau struktur aturan finansial.

## 5. Pengguna sasaran

### Pengguna utama

Pemilik tunggal yang ingin mencatat dan merencanakan keuangan pribadi melalui ponsel, dengan data tersimpan pada akun Google dan Spreadsheet miliknya sendiri.

### Kebutuhan utama

- Melihat posisi keuangan dengan cepat.
- Mencatat pemasukan atau pengeluaran dalam beberapa langkah.
- Memantau saldo, anggaran, target, tagihan, dan utang.
- Menjaga privasi nominal ketika memakai aplikasi di tempat umum.
- Mengakses data yang sama dari web dan mobile.
- Memiliki backup dan portabilitas data.

## 6. Prinsip produk

1. **Ledger sebagai sumber kebenaran.** Saldo tidak boleh dihitung dari state lokal mobile.
2. **Konfirmasi sebelum mutasi.** OCR, transaksi rutin, tagihan, investasi, dan rekonsiliasi tidak boleh mengubah saldo tanpa aksi eksplisit pengguna.
3. **Mobile-first, bukan web yang diperkecil.** Tabel menjadi list/card, modal besar menjadi full-screen atau bottom sheet, dan aksi utama mudah dijangkau ibu jari.
4. **Paritas aturan, bukan paritas layout.** Hasil dan kemampuan sama; tata letak mengikuti pola native.
5. **Privasi sejak awal.** Token dan secret tidak disimpan sembarang; privacy mode berlaku konsisten.
6. **Retry aman.** Semua mutasi menggunakan `requestId` unik agar request ulang tidak menggandakan data.
7. **Progressive disclosure.** Form transaksi menampilkan field utama dahulu; detail lanjutan tetap tersedia.

## 7. Indikator keberhasilan

- Pengguna dapat menyelesaikan transaksi standar dari FAB hingga sukses maksimal dalam lima input utama.
- Tidak ada transaksi ganda akibat retry, timeout, atau ketukan tombol berulang.
- Saldo, net worth, cashflow, anggaran, dan target pada mobile sama dengan web untuk dataset dan periode yang sama.
- Seluruh layar utama dapat dipakai pada lebar 320 dp tanpa konten penting terpotong.
- Semua nominal tersamarkan ketika privacy mode aktif.
- Crash-free session target minimal 99,5% setelah rilis stabil.
- Waktu tampil data cache awal target kurang dari 1 detik; refresh jaringan normal target kurang dari 4 detik, tidak termasuk cold start Apps Script.

## 8. Cakupan fitur

### 8.1 Fondasi dan onboarding — P0

- Splash dan pemeriksaan sesi.
- Hubungkan perangkat dengan URL deployment dan Personal Access Key satu kali.
- Validasi access key terhadap hash SHA-256 milik pemilik di backend.
- Bootstrap workspace dari Apps Script.
- Setup workspace baru: nama pemilik, nama workspace, mata uang, zona waktu, akun pertama, saldo awal.
- Status loading, empty, offline, timeout, error, dan retry.
- Putuskan perangkat tanpa menghapus data backend.
- Tampilan paket Free, Pro, atau Premium beserta status lisensi.

### 8.2 Ringkasan — P0

- Net worth, total aset, dan total kewajiban.
- Income, expense, cashflow, savings rate, dan financial health score.
- Grafik cashflow 14 hari.
- Komposisi pengeluaran per kategori.
- Ringkasan akun.
- Tagihan terdekat.
- Kemajuan target.
- Transaksi terbaru.
- Shortcut menuju transaksi, laporan, dan insight.
- Pull-to-refresh.
- Pemilih periode bulanan.

### 8.3 Transaksi — P0

- Daftar transaksi dengan pagination server-side.
- Pencarian merchant, catatan, tag, lokasi, akun, dan kategori.
- Filter tipe, status, akun, kategori, serta rentang tanggal.
- Tambah income, expense, transfer, dan refund.
- Status pending atau completed.
- Edit transaksi dengan proteksi stale-write.
- Duplikasi dengan konfirmasi.
- Soft delete dan undo aksi terakhir.
- Transfer atomik dua sisi dengan satu transfer group.
- Split 2–20 kategori; jumlah split wajib sama dengan nominal.
- Tanggal, waktu, merchant, catatan, maksimal 10 tag, dan lokasi.
- Lampiran JPG, PNG, WebP, atau PDF maksimal 5 MB.
- Import CSV maksimal 100 transaksi dengan preview dan validasi.
- OCR struk: pilih kamera/galeri, kompres gambar, validasi hasil, isi draft, simpan manual.
- Preview dampak saldo sebelum menyimpan transfer atau transaksi bernilai besar.

#### Alur transaksi cepat

1. Pengguna menekan FAB.
2. Pilih tipe transaksi.
3. Isi nominal.
4. Pilih akun.
5. Pilih kategori; untuk transfer pilih akun tujuan.
6. Tanggal otomatis hari ini dan dapat diubah.
7. Tekan Simpan.
8. UI menonaktifkan tombol, mengirim `requestId`, lalu menampilkan hasil final dari backend.

Field lanjutan berada di bagian **Detail tambahan** agar alur utama tetap singkat.

### 8.4 Akun dan saldo — P0

- Daftar Bank, E-Wallet, Cash, Investment, Credit Card, Paylater, Loan, dan Mortgage.
- Pemisahan aset dan kewajiban.
- Tambah dan ubah akun.
- Import maksimal 100 akun melalui CSV.
- Buka histori transaksi per akun.
- Rekonsiliasi saldo melalui transaksi `adjustment_in/out`.
- Arsip akun hanya ketika tidak melanggar relasi data.
- Pemeriksaan dan perbaikan integritas ledger dengan preview serta konfirmasi.

### 8.5 Anggaran — P0

- Anggaran per kategori dan bulan.
- Tambah, ubah, dan hapus anggaran.
- Opsi rollover sesuai kemampuan backend.
- Realisasi memasukkan split dan mengurangi refund.
- Status aman, peringatan, hampir penuh, dan terlampaui.
- Notifikasi ambang 75% atau 90% sesuai pengaturan.

### 8.6 Target finansial — P0

- Daftar dan detail target.
- Nama, nominal target, nominal terkumpul, deadline, akun, warna, dan ikon.
- Tambah, ubah, hapus, serta kontribusi target.
- Rekomendasi kontribusi bulanan berdasarkan sisa target dan deadline.
- Progress bar dengan label aksesibel.

### 8.7 Pos Dana / Sinking Fund — P1

- Tambah, ubah, arsip, dan lihat pos dana.
- Target, saldo alokasi, kontribusi bulanan, tanggal target, akun referensi, warna, dan tujuan.
- Penambahan atau pengurangan alokasi melalui entry tercatat.
- Alokasi tidak menghitung uang dua kali dan tidak mengubah saldo akun secara langsung.

### 8.8 Tagihan dan cicilan — P1

- Daftar tagihan aktif, lunas, dan jatuh tempo.
- Tambah, ubah, dan hapus tagihan.
- Jadwal bulanan, reminder H-7/H-3/H-1/hari H.
- Dukungan cicilan bertahap sesuai `installment_phases_json`.
- Bayar manual menghasilkan transaksi ledger dan memperbarui periode pembayaran.
- Tagihan kewajiban dibayar sebagai transfer ke akun kewajiban untuk mencegah expense ganda.
- Aksi bayar semua tetap meminta ringkasan dan konfirmasi.

### 8.9 Kalender keuangan — P1

- Kalender bulanan berisi pemasukan terjadwal, tagihan, cicilan, transaksi rutin, dan deadline target.
- Tampilan agenda sebagai fallback mobile.
- Ketuk item membuka detail atau aksi yang sesuai.
- Penanda status dibayar, akan datang, terlambat, dan selesai.

### 8.10 Transaksi rutin dan langganan — P1

- Template weekly, monthly, quarterly, dan yearly.
- Income atau expense; subscription hanya expense.
- Tambah, ubah, pause, dan resume template.
- Tidak mencatat saldo otomatis.
- Aksi **Catat ke ledger** membuat satu transaksi dan memajukan tanggal berikutnya secara atomik.

### 8.11 Roadmap — P1

- Proyeksi 12, 24, 36, dan 60 bulan.
- Skenario konservatif, utama, dan optimistis.
- Parameter perubahan income/expense, inflasi, imbal hasil, dan investasi bulanan.
- Proyeksi net worth, kesiapan target, dan bulan defisit.
- Disclaimer bahwa hasil adalah simulasi, bukan nasihat atau jaminan.

### 8.12 Cashflow Forecast — P1

- Horizon 30, 60, dan 90 hari.
- Starting balance, income bulanan/manual, tanggal income, dan buffer kas.
- Gabungan tagihan aktif dengan pola histori.
- Status aman, warning, dan kritis.
- Tanggal pertama di bawah buffer atau negatif.
- Skenario cautious dengan income lebih rendah.

### 8.13 Dana darurat — P1

- Target 3, 6, 9, atau 12 bulan biaya hidup.
- Pilihan akun likuid non-investasi dan non-liability.
- Pengeluaran otomatis atau manual.
- Coverage, gap, kontribusi bulanan, estimasi bulan tercapai, dan safety score.

### 8.14 Pelunasan utang — P1

- Data utang dari akun liability.
- Suku bunga tahunan, minimum payment, dan due day.
- Strategi avalanche dan snowball.
- Extra monthly payment.
- Estimasi tanggal lunas dan total bunga.
- Peringatan utang non-amortizing.

### 8.15 Investasi — P2/Premium

- Asset master: ticker, nama, class, exchange, currency, dan harga manual.
- Buy dan sell dengan unit hingga delapan desimal, fee, serta pajak.
- Weighted average cost.
- Realized dan unrealized profit/loss.
- Transaksi investasi terhubung secara logis dengan ledger.
- Harga manual atau fallback transaksi terakhir; tidak diberi label real-time.
- Aset dengan unit tersisa tidak dapat diarsipkan.

### 8.16 Review dan tutup buku — P1

- Ringkasan hasil bulan berjalan.
- Pemeriksaan transaksi, akun, anggaran, target, dan tagihan.
- Tutup buku dengan snapshot dan konfirmasi eksplisit.
- Buka kembali periode sesuai aturan backend.
- Periode tertutup menolak mutasi yang dilarang dan menampilkan pesan jelas.

### 8.17 Laporan — P2/Pro

- Preview laporan bulanan.
- Pilihan bagian: ringkasan, cashflow, kategori, akun, anggaran, tagihan, target, roadmap, forecast, dana darurat, utang, investasi, dan transaksi rutin.
- PDF A4 dengan opsi privacy mask.
- Simpan PDF ke Google Drive.
- Share atau download memakai native share sheet.
- Export CSV yang aman dari formula injection.
- Riwayat laporan.

### 8.18 Financial Insight — P2/Premium

- Konfigurasi penyedia API OpenAI-compatible, base URL, model, dan API key melalui backend.
- Persetujuan privasi eksplisit sebelum mengaktifkan AI.
- Chat read-only maksimal 600 karakter per pertanyaan.
- Context builder mengirim data minimum sesuai intent.
- Tampilkan manifest konteks yang dikirim.
- Histori dan hapus histori.
- Disclaimer: hasil bukan nasihat finansial profesional.
- API key tidak pernah dikirim kembali ke mobile.

### 8.19 OCR struk — P2/Premium

- Ambil gambar dari kamera atau galeri.
- Kompres di perangkat; JPEG maksimal 4 MB setelah kompresi.
- Gambar dipakai untuk request OCR dan tidak otomatis disimpan.
- Hasil ditolak ketika gambar tidak jelas, confidence di bawah batas backend, atau total tidak valid.
- Hasil hanya mengisi draft transaksi.
- Pengguna wajib memeriksa dan menekan Simpan.

### 8.20 Notifikasi — P1

- Notification center untuk tagihan, anggaran, target, backup, dan harga investasi.
- Status dibaca dan diarsipkan tersimpan di backend.
- Ketuk notifikasi membuka layar relevan.
- Pengaturan ambang dan jenis notifikasi.
- Push notification native tidak wajib pada rilis pertama; notifikasi in-app wajib.

### 8.21 Pengaturan, keamanan, dan portabilitas — P1/P2

- Profil pemilik dan workspace.
- Tema light/dark/system.
- Privacy mode.
- Tampilkan/sembunyikan fitur opsional.
- CRUD dan arsip kategori sesuai aturan backend.
- Status paket dan aktivasi lisensi.
- Pemeriksaan kesehatan penyimpanan dan ledger.
- Backup manual dan terjadwal.
- Histori backup dan download melalui Google Drive.
- Migrasi JSON: preview, validasi relasi, rekonsiliasi, backup pra-migrasi, konfirmasi, apply, cancel, dan report.
- Minimal 20 audit event terbaru.
- Hapus sesi lokal tanpa menghapus data finansial.

## 9. Arsitektur informasi dan navigasi

### 9.1 Bottom tabs

Empat tab utama mengikuti web mobile:

1. **Ringkasan**
2. **Transaksi**
3. **Anggaran**
4. **Target**

FAB berada di area bawah tengah dan membuka transaksi baru dari seluruh tab utama.

### 9.2 Menu lainnya

Layar **Menu** atau drawer menyediakan:

- Akun
- Pos Dana
- Roadmap
- Cashflow Forecast
- Dana Darurat
- Tagihan
- Kalender Keuangan
- Transaksi Rutin
- Pelunasan Utang
- Investasi
- Review Bulanan
- Laporan
- Insight
- Pengaturan

Item yang dinonaktifkan melalui preferensi fitur tidak tampil. Item yang tidak termasuk paket tetap tampil dengan badge Pro/Premium agar pengguna memahami batas paket.

### 9.3 Pola navigasi

- List ke detail memakai native stack.
- Create/edit kompleks memakai full-screen modal.
- Aksi singkat dan filter memakai bottom sheet.
- Aksi destruktif memakai confirm dialog.
- Filter transaksi memiliki layar/sheet khusus; pilihan tetap aktif sampai direset.
- Back gesture tidak boleh membatalkan form yang berubah tanpa konfirmasi.
- Deep link bukan syarat rilis pertama.

## 10. Adaptasi desain web ke mobile

### 10.1 Identitas visual

Mobile mempertahankan:

- Gaya bersih, tenang, dan berorientasi data.
- Primary hijau dan aksen kategori yang sama.
- Card putih/gelap dengan border tipis dan shadow lembut.
- Radius membulat.
- Tipografi Plus Jakarta Sans bila tersedia melalui bundle font.
- Ikon bergaya Lucide melalui implementasi React Native.
- Format nominal, tanggal, label, dan istilah Bahasa Indonesia yang sama.

### 10.2 Token warna

| Token | Light | Dark |
|---|---|---|
| Background | `#f3f6f4` | `#0e1512` |
| Surface | `#ffffff` | `#151f1b` |
| Text utama | `#15201b` | `#ecf4ef` |
| Primary | `#126b59` | `#43b997` |
| Positive | `#16876f` | gunakan padanan kontras dark |
| Negative | `#d65b67` | gunakan padanan kontras dark |
| Warning | `#d89832` | gunakan padanan kontras dark |
| Info | `#4e79c7` | gunakan padanan kontras dark |
| Border light | `#dfe7e2` | gunakan border dark yang setara |

Warna kategori mengikuti web, antara lain Makanan `#16876f`, Tempat Tinggal `#d4685c`, Tagihan `#da9a3a`, Transportasi `#4e79c7`, Hiburan `#aa67a6`, Investasi `#5574b8`, dan Kesehatan `#d26b7a`.

Sebelum implementasi final, token dark, contrast ratio, disabled state, chart series, dan pressed state diambil langsung dari design system web terbaru agar tidak terjadi drift.

### 10.3 Tipografi dan spacing

- Font utama: Plus Jakarta Sans.
- Body minimum 14–16 sp.
- Label sekunder minimum 12 sp.
- Nominal utama dapat memakai 28–36 sp sesuai lebar layar.
- Grid spacing dasar 4 dp; spacing umum 8, 12, 16, 20, 24, dan 32 dp.
- Radius card mengikuti karakter web pada kisaran 12–20 dp.
- Target sentuh minimum 44 × 44 dp; rekomendasi Android 48 × 48 dp.

### 10.4 Pemetaan layout

| Web | Mobile |
|---|---|
| Sidebar | Menu/drawer |
| Header global lebar | Screen header ringkas |
| Tabel | Card/list per baris |
| Modal tengah | Bottom sheet atau full-screen modal |
| Hover | Pressed/selected state |
| Tooltip hover | Tap info atau accessible hint |
| Multi-column dashboard | Section vertikal dan KPI 2 kolom |
| Toolbar horizontal | Search bar + filter sheet |
| Download browser | Native share sheet |
| Print layout | PDF backend/client yang disimpan ke Drive |

### 10.5 Komponen minimum

- `AppShell`, `ScreenHeader`, `BottomTabs`, `MoreMenu`, `FAB`.
- `Card`, `MetricCard`, `SectionHeader`, `Amount`, `EmptyState`, `ErrorState`.
- `PrimaryButton`, `SecondaryButton`, `IconButton`, `DangerButton`.
- `FormField`, `MoneyInput`, `SelectField`, `DateField`, `SegmentedControl`, `SwitchField`.
- `ProgressBar`, `StatusPill`, `PlanBadge`.
- `TransactionRow`, `AccountCard`, `BudgetCard`, `GoalCard`, `NotificationRow`.
- `AppBottomSheet`, `ConfirmDialog`, `Toast/Snackbar`, `Skeleton`.
- Bar chart cashflow, donut kategori, dan line chart untuk proyeksi.

Komponen tidak harus berbagi source dengan web. Token, isi, status, dan perilaku harus konsisten.

## 11. Backend dan API mobile

### 11.1 Arsitektur

```text
React Native / Expo
        |
        | HTTPS JSON + Personal Access Key + requestId
        v
Google Apps Script Web App API
        |
        | Router `api(action, payload)` yang sama
        v
Service Apps Script
        |
        +--> Google Sheets: data utama
        +--> Google Drive: lampiran, laporan, backup
        +--> Provider AI/OCR: request dari server
```

### 11.2 Perubahan backend wajib

1. Pertahankan `api(action, payload)` sebagai router bisnis bersama web dan mobile.
2. Tambahkan endpoint `doPost(e)` khusus JSON yang:
   - memvalidasi ukuran dan bentuk request;
   - memverifikasi Personal Access Key pemilik terhadap hash SHA-256;
   - membatasi action pada router yang diizinkan;
   - meneruskan `action` dan `payload` ke `api`;
   - selalu mengembalikan response envelope JSON;
   - tidak pernah mencatat access key atau secret.
3. Pertahankan `doGet()` untuk UI web.
4. Tambahkan Script Properties untuk kill switch dan hash SHA-256 Personal Access Key.
5. Tambahkan pengujian endpoint mobile tanpa menduplikasi business logic.

### 11.3 Request

```json
{
  "action": "createTransaction",
  "requestId": "uuid-v4",
  "accessKey": "personal-access-key",
  "payload": {
    "type": "expense",
    "amount": 50000
  }
}
```

`requestId` juga ditempatkan pada payload ketika router/service yang sudah ada membutuhkannya.

### 11.4 Response

```json
{
  "ok": true,
  "data": {},
  "requestId": "uuid-v4",
  "timestamp": "2026-07-27T10:00:00.000Z"
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Nominal harus lebih dari 0."
  },
  "requestId": "uuid-v4"
}
```

Karena Content Service Apps Script memiliki keterbatasan status HTTP dan header, mobile menentukan sukses/gagal dari envelope `ok`, bukan hanya status HTTP.

### 11.5 Transport

- Gunakan HTTPS saja.
- `Content-Type` dapat memakai `text/plain;charset=utf-8` bila dibutuhkan untuk kompatibilitas Apps Script; body tetap JSON.
- Timeout request harus menampilkan status tidak pasti, lalu memeriksa `mutationStatus` memakai `requestId` sebelum retry mutasi.
- Query read-only dapat di-retry otomatis dengan backoff terbatas.
- Mutation tidak boleh diulang dengan `requestId` baru setelah timeout yang belum diketahui statusnya.
- Pagination transaksi maksimal 100 item per halaman mengikuti backend.

### 11.6 Kompatibilitas web

- Web tetap memakai `google.script.run`.
- Mobile memakai HTTPS JSON.
- Kedua transport memanggil router dan service yang sama.
- Perubahan backend tidak boleh mengganti nama action atau response yang sudah dipakai web tanpa compatibility layer.
- Setelah mutasi dari satu client, client lain memperoleh data baru melalui refresh; real-time sync tidak diwajibkan.

## 12. Autentikasi dan keamanan

### 12.1 Model autentikasi

- Instalasi pribadi memakai Personal Access Key acak dengan entropi 256-bit; tidak memerlukan Google OAuth, Firebase, atau layanan identitas kedua.
- Backend hanya menyimpan hash SHA-256 key pada Script Properties melalui `VINN_MOBILE_ACCESS_KEY_SHA256`.
- Pemilik memasukkan URL deployment dan key mentah satu kali; mobile menyimpannya pada SecureStore dan tidak menanamnya dalam source, environment, atau bundle.
- Mobile mengirim access key pada body JSON melalui HTTPS; Apps Script menghitung hash dan membandingkannya sebelum router dipanggil.
- Client hanya menerima URL deployment resmi `https://script.google.com/macros/s/.../exec` untuk mengurangi risiko key dikirim ke host lain.
- Request tanpa key, key lemah, key salah, konfigurasi hash rusak, atau kill switch nonaktif ditolak sebelum router dipanggil.
- Rotasi dilakukan dengan membuat key baru, mengganti hash Script Properties, lalu menghubungkan ulang perangkat.

### 12.2 Deployment

Deployment API mobile memerlukan akses URL publik agar menerima request React Native, tetapi akses data tetap dikunci oleh verifikasi Personal Access Key. Deployment API dipisahkan secara konseptual dari deployment UI web yang saat ini `MYSELF`.

Sebelum rilis, lakukan security review khusus deployment Apps Script. Jangan mengubah deployment menjadi `Anyone` tanpa hash key yang valid, kill switch, pengujian penolakan key salah, dan dokumentasi rotasi.

### 12.3 Penyimpanan lokal

- URL dan Personal Access Key disimpan melalui SecureStore dengan akses hanya saat perangkat terbuka dan tidak dimigrasikan ke perangkat lain.
- Draft transaksi sensitif tidak disimpan permanen kecuali diperlukan untuk pemulihan form; bila disimpan, gunakan secure storage dan hapus setelah sukses/perangkat diputuskan.
- Tema, privacy mode, onboarding state, dan cache non-secret boleh disimpan lokal.
- API key AI, private key lisensi, access key mentah, dan credential Google Apps Script tidak boleh berada dalam bundle.
- Cache ledger bukan sumber kebenaran dan harus memiliki timestamp.

### 12.4 Perlindungan data

- Validasi seluruh input kembali di backend.
- Gunakan document lock untuk mutasi ledger.
- Pertahankan idempotensi dan stale-write protection.
- Sanitasi nama file dan CSV formula.
- Jangan masukkan access key, token, API key, isi struk, atau data finansial lengkap ke analytics/crash logs.
- Lampiran, laporan, dan backup dibuat pada Google Drive pemilik.
- Semua aksi sensitif tercatat pada audit log tanpa secret.

## 13. Aturan bisnis ledger

1. Hanya transaksi `completed` dan tidak memiliki `deleted_at` yang memengaruhi saldo.
2. Saldo berasal dari `opening_balance` ditambah seluruh transaksi aktif; mobile tidak menulis saldo hasil kalkulasi.
3. Income/refund dan expense mengikuti arah akun aset/kewajiban dari backend.
4. Transfer selalu dua row terhubung dan harus berhasil atau gagal seluruhnya.
5. Transfer, adjustment, dan investment buy tidak dihitung sebagai cashflow operasional.
6. Pending transaction tidak mengubah saldo.
7. Penghapusan transaksi bersifat soft delete; transfer dihapus sebagai pasangan.
8. Rekonsiliasi membuat adjustment transaction, bukan mengubah saldo awal.
9. Split hanya untuk tipe yang didukung, berjumlah 2–20, dan totalnya sama persis dengan nominal.
10. Validasi saldo cukup dilakukan backend sebelum expense/transfer yang membutuhkan dana.
11. Pembayaran tagihan idempotent untuk kombinasi tagihan dan periode.
12. Recurring hanya membuat transaksi setelah konfirmasi.
13. OCR hanya membuat draft.
14. Edit memakai `expectedUpdatedAt`; data usang harus ditolak.
15. Migrasi harus melalui preview, validasi, backup pra-migrasi, konfirmasi, dan laporan hasil.

## 14. Model data

Mobile memakai entitas backend yang sudah ada:

- `Settings`
- `Accounts`
- `Categories`
- `Transactions`
- `Budgets`
- `Goals`
- `SinkingFunds`
- `SinkingFundEntries`
- `Bills`
- `Recurring`
- `Assets`
- `InvestmentTransactions`
- `AIChat`
- `NotificationStates`
- `AuditLog`
- `Trash`

Mobile tidak mengubah header sheet secara langsung. Perubahan schema dilakukan melalui versi dan fungsi setup/migrasi Apps Script. Mobile harus memeriksa kompatibilitas minimum versi schema saat bootstrap dan meminta pengguna memperbarui backend jika tidak kompatibel.

## 15. Paket dan lisensi

Mobile mempertahankan entitlement backend yang sama:

### Free

- Pencatatan keuangan inti sesuai capability backend.

### Pro

- Advanced transactions.
- Import.
- Lampiran.
- Planning.
- Recurring.
- PDF reports.
- Scheduled backup.

### Premium

- Seluruh Pro.
- Investment.
- AI.
- OCR.

Backend tetap menjadi sumber keputusan entitlement. UI mobile boleh menyembunyikan atau mengunci action, tetapi tidak boleh menjadi satu-satunya pengaman akses paket.

## 16. Offline, cache, dan sinkronisasi

### Rilis pertama

- Cache snapshot terakhir untuk menampilkan data read-only ketika offline.
- Tampilkan label **Data terakhir diperbarui**.
- Pull-to-refresh saat online.
- Simpan draft form secara lokal bila pengguna berpindah layar.
- Jangan menyimpan mutation queue otomatis.
- Tombol Simpan dinonaktifkan saat offline dengan pesan yang menjelaskan data belum dikirim.

### Konflik

- Backend memakai `expectedUpdatedAt` untuk edit yang rentan konflik.
- Bila stale-write ditolak, UI menampilkan data terbaru dan opsi menyalin perubahan pengguna ke draft baru.
- Setelah mutasi sukses, refresh entitas terkait atau snapshot bootstrap.

## 17. Aksesibilitas

- Semua icon-only button mempunyai accessibility label.
- Semua field mempunyai label, hint, error, dan urutan fokus yang benar.
- Minimum touch target 44 × 44 dp.
- Warna bukan satu-satunya penanda status.
- Progress, grafik, nominal, dan badge mempunyai representasi teks untuk screen reader.
- Dynamic font didukung tanpa memotong CTA utama.
- Kontras teks mengikuti WCAG AA.
- Reduced motion dari OS mengurangi animasi non-esensial.
- Keyboard tidak menutupi field atau tombol Simpan.
- Safe area diterapkan pada notch, status bar, bottom tabs, FAB, dan bottom sheet.

## 18. Performa dan reliabilitas

- Bootstrap menampilkan cache dahulu lalu refresh jaringan.
- List transaksi memakai virtualization.
- Grafik merender data agregat, bukan seluruh ledger mentah.
- Gambar OCR dikompresi sebelum upload.
- Tombol mutation hanya dapat ditekan sekali selama request aktif.
- Timeout tidak langsung dianggap gagal untuk mutation; periksa status request.
- Backoff terbatas untuk read request.
- Pesan error memakai Bahasa Indonesia dan menyertakan tindakan: coba lagi, hubungkan ulang perangkat, perbarui backend, atau periksa koneksi.
- UI menangani Apps Script cold start dan quota error secara jelas.

## 19. Batas platform

Aplikasi harus mematuhi batas backend yang sudah ada:

- Page size transaksi maksimal 100.
- Import akun/transaksi maksimal 100 item per batch.
- Split maksimal 20 kategori.
- Tag maksimal 10.
- Lampiran maksimal 5 MB.
- OCR maksimal 4 MB setelah kompresi.
- Pertanyaan AI maksimal 600 karakter.
- Migrasi maksimal 5.000 row dan 12 MB JSON.
- PDF maksimal 100 halaman dan batas payload backend.
- Document lock dapat timeout.
- Apps Script, Sheets, Drive, triggers, dan outbound requests memiliki quota harian.

Ketika quota tercapai, aplikasi tidak boleh melakukan retry agresif. Tampilkan alasan dan waktu percobaan berikutnya jika tersedia.

## 20. Analytics dan observability

Analytics bersifat minimal dan tidak boleh memuat nilai finansial atau isi transaksi.

Event yang boleh dicatat:

- App opened.
- Device connection success/failure code.
- Screen viewed.
- Mutation success/failure code dan durasi.
- OCR flow started/completed tanpa gambar atau hasil nominal.
- Crash metadata teknis yang sudah disanitasi.

Event dilarang memuat nominal, merchant, catatan, kategori custom, email, access key, token, API key, isi AI, isi OCR, atau payload backend.

## 21. Acceptance criteria

### Fondasi

- [ ] Android dan iOS dapat terhubung dengan URL API dan Personal Access Key pemilik.
- [ ] Key kosong, pendek, atau salah ditolak sebelum dapat membaca bootstrap.
- [ ] Mobile memakai GAS/Sheets/Drive yang sama dengan web; tidak ada DB kedua.
- [ ] Semua action mobile melewati transport HTTPS dan router Apps Script bersama.
- [ ] Web tetap berfungsi melalui `google.script.run`.
- [ ] Setup baru menghasilkan workspace dan akun awal yang dapat dibuka dari web maupun mobile.

### Navigasi dan desain

- [ ] Bottom tabs berisi Ringkasan, Transaksi, Anggaran, dan Target.
- [ ] FAB membuka form transaksi dari tab utama.
- [ ] Seluruh modul web tersedia dari menu sesuai fase dan entitlement.
- [ ] Warna, tipografi, radius, format nominal, icon style, dan hierarchy mengikuti web.
- [ ] Layar 320 dp tidak mengalami overflow kritis.
- [ ] Tabel web telah diubah menjadi list/card yang dapat digunakan tanpa horizontal scroll.
- [ ] Light, dark, system theme, dan privacy mode bekerja konsisten.

### Ledger

- [ ] Income, expense, refund, pending, completed, dan transfer memberi hasil yang sama dengan web.
- [ ] Transfer menghasilkan dua row linked dan net operating cashflow nol.
- [ ] Retry dengan `requestId` sama tidak menghasilkan transaksi ganda.
- [ ] Timeout mutation diperiksa melalui status request sebelum retry.
- [ ] Stale edit ditolak dan pengguna dapat memuat data terbaru.
- [ ] Delete transfer memproses kedua sisi atau gagal seluruhnya.
- [ ] Rekonsiliasi menghasilkan adjustment, bukan edit saldo awal.
- [ ] Saldo dan net worth mobile cocok dengan bootstrap backend.

### Transaksi lanjutan

- [ ] Split 2–20 item hanya dapat disimpan ketika total cocok.
- [ ] Attachment type dan size divalidasi sebelum dan sesudah upload.
- [ ] Import CSV memiliki preview dan menolak batch invalid.
- [ ] OCR hanya mengisi draft dan tidak menyimpan transaksi otomatis.
- [ ] Tombol Simpan tidak dapat menghasilkan mutation paralel.

### Modul finansial

- [ ] Realisasi anggaran cocok dengan split dan refund.
- [ ] Tagihan hanya dibayar sekali per periode.
- [ ] Recurring tidak memengaruhi saldo sebelum konfirmasi.
- [ ] Kontribusi target dan pos dana konsisten dengan web.
- [ ] Investment buy/sell menghasilkan unit, cost basis, dan P/L yang sama dengan backend.
- [ ] Review bulanan menghormati status periode tertutup.
- [ ] Roadmap, forecast, dana darurat, dan debt planner memakai parameter backend yang sama.

### Privasi dan keamanan

- [ ] Privacy mode menyamarkan nominal pada card, list, grafik, detail, preview, notifikasi, dan laporan yang dipilih.
- [ ] Personal Access Key, AI key, private key lisensi, dan credential tidak berada di log atau bundle.
- [ ] API menolak key kosong, lemah, salah, konfigurasi hash rusak, dan kill switch nonaktif.
- [ ] Putuskan perangkat membersihkan access key dan cache sensitif lokal tanpa menghapus backend.
- [ ] Aksi sensitif tercatat dalam audit log tanpa secret.
- [ ] Security review deployment Apps Script lulus sebelum distribusi.

### Portabilitas

- [ ] PDF berhasil tersimpan ke Drive dan dapat dibuka/share dari mobile.
- [ ] CSV aman dari formula injection.
- [ ] Backup manual dan terjadwal tampil pada histori.
- [ ] Migrasi invalid tidak dapat diterapkan.
- [ ] Migrasi valid membuat backup pra-migrasi dan report hasil.

### Aksesibilitas dan reliabilitas

- [ ] Semua action icon terbaca screen reader.
- [ ] Seluruh alur P0 dapat diselesaikan dengan font scale besar yang didukung.
- [ ] Reduced motion OS dihormati.
- [ ] Keyboard dan safe area tidak menutupi input/CTA.
- [ ] Mode offline menampilkan snapshot bertimestamp dan menolak mutation secara jelas.
- [ ] Cold start, timeout, quota, dan auth expiry memiliki state pemulihan.

## 22. Strategi pengujian

### Unit

- Port atau gunakan kembali fixture aturan finance, ledger, recurring, installment, roadmap, debt, forecast, emergency fund, dan investment.
- Uji formatter IDR, privacy masking, validator form, mapping API, serta reducer/state penting.

### Integrasi

- Uji Personal Access Key benar, kosong, pendek, salah, rotasi, dan kill switch.
- Uji request/response envelope.
- Uji idempotensi, `mutationStatus`, stale-write, transfer atomic, dan document lock.
- Uji upload, OCR, laporan, backup, notifikasi, lisensi, dan migrasi.

### End-to-end

Minimal alur:

1. Hubungkan perangkat dengan URL/key dan muat bootstrap.
2. Setup workspace baru.
3. Buat expense lalu lihat perubahan saldo dan dashboard.
4. Buat transfer lalu pastikan cashflow tidak berubah.
5. Edit, delete, dan undo transaksi.
6. Buat anggaran dan capai ambang notifikasi.
7. Buat target dan kontribusi.
8. Bayar tagihan.
9. Konfirmasi recurring.
10. Aktifkan privacy mode.
11. Buat dan share laporan.
12. Putuskan perangkat dan hubungkan kembali.

### Regression

Backend tetap menjalankan baseline test web/GAS melalui `npm test`. Mobile menambahkan test sendiri tanpa menghapus smoke test Apps Script yang ada.

## 23. Tahapan rilis

### Fase 0 — Backend mobile foundation

- Personal Access Key owner-only dengan hash SHA-256.
- `doPost(e)` JSON transport.
- Konfigurasi deployment API.
- Idempotensi, mutation status, error mapping, dan security tests.
- Dokumentasi instalasi pelanggan untuk mobile.

### Fase 1 — Mobile core

- Onboarding.
- Ringkasan.
- Transaksi inti dan lanjutan penting.
- Akun serta rekonsiliasi.
- Anggaran.
- Target.
- Theme, privacy, notifications dasar, dan settings inti.

### Fase 2 — Planning dan kewajiban

- Pos Dana.
- Tagihan/cicilan.
- Kalender.
- Recurring.
- Roadmap.
- Forecast.
- Dana Darurat.
- Pelunasan Utang.
- Review bulanan.

### Fase 3 — Premium dan portabilitas

- Investment.
- Laporan PDF/CSV.
- Backup dan migrasi.
- Financial Insight.
- OCR struk.
- Settings dan audit lengkap.

### Fase 4 — Stabilization

- Accessibility audit.
- Security review.
- Performance profiling perangkat low-end.
- Regression web/mobile.
- Beta internal Android/iOS.
- Store readiness dan release.

## 24. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Apps Script cold start | Loading lambat | Cache read-only, skeleton, timeout jelas |
| Quota Apps Script/Sheets/Drive | Request gagal | Batasi request, pagination, backoff, pesan quota |
| Endpoint API terekspos | Kebocoran data | Key acak 256-bit, hash SHA-256, host pinning, kill switch, security tests |
| Retry mutation | Data ganda | `requestId`, `mutationStatus`, tombol single-flight |
| Web/mobile mengedit bersamaan | Data usang | `expectedUpdatedAt`, refresh dan conflict UI |
| Layout web dipindahkan mentah | UX buruk | Gunakan native list, stack, sheet, safe area, touch target |
| Cache dianggap data final | Saldo salah | Timestamp, refresh backend, backend source of truth |
| Offline mutation | Konflik ledger | Rilis pertama read-only offline |
| Secret masuk bundle/log | Insiden keamanan | Key dimasukkan satu kali, SecureStore, hash backend-only, log redaction |
| Paket web/mobile berbeda | Akses tidak konsisten | Entitlement selalu berasal dari backend |
| Schema backend lama | Crash/mapping salah | Minimum schema check saat bootstrap |

## 25. Dependensi keputusan sebelum coding

Keputusan berikut harus dikunci saat technical design, tanpa mengubah tujuan PRD:

1. Cara membuat, menyimpan, merotasi, dan mencabut Personal Access Key pemilik.
2. Cara memastikan key mentah tidak masuk source, bundle, screenshot, atau log.
3. Apakah deployment API mobile dipisah dari deployment web dalam project Apps Script yang sama.
4. Library navigation, secure storage, dan chart React Native yang paling minimum.
5. Strategi distribusi: internal build, Play Store, App Store, atau paket per pelanggan.
6. Dukungan minimum versi Android dan iOS.
7. Apakah push notification masuk rilis berikutnya atau cukup in-app notification.

Rekomendasi awal: Expo managed workflow, TypeScript, Expo Router, native `fetch`, secure storage platform, satu adapter API, serta tanpa state-management framework tambahan sampai kebutuhan nyata muncul.

## 26. Referensi source existing

- UI dan feature map: `app/FinanceApp.tsx`
- Design system dan responsive rules: `app/globals.css`
- Kalkulasi finansial: `lib/finance.ts`
- Transport web Apps Script: `lib/apps-script-client.ts`
- Client domain: `lib/finance-client.ts`
- Paket dan capability: `lib/plans.ts`
- Preferensi fitur: `lib/feature-preferences.ts`
- Router backend: `apps-script/Router.gs`
- Web entry point: `apps-script/Main.gs`
- Schema Google Sheets: `apps-script/Config.gs`
- Apps Script manifest: `apps-script/appsscript.json`
- Panduan instalasi pelanggan: `docs/PANDUAN-JUAL-PUTUS.md`
- Ringkasan produk: `README.md`

---

**Definition of done:** Financial Planner Mobile dapat dipakai owner pada Android dan iOS untuk mengakses dataset Google Sheets yang sama dengan web; seluruh mutasi aman, idempotent, tervalidasi backend; UI mempertahankan identitas web sambil mengikuti pola native mobile; seluruh acceptance criteria pada fase rilis terkait lulus.
