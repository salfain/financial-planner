# Mode Pasangan — Fase 3

Fase 2 menutup kebocoran pada akun dan transaksi. Fase 3 menutup sisa kebocoran pada entitas perencanaan yang menautkan akun, yaitu tagihan, tujuan, pos dana, transaksi rutin, dan aset investasi.

## Masalah yang ditutup

Setelah Fase 2, akun pribadi dan transaksinya sudah tersembunyi dari pasangan. Namun tagihan, pos dana, dan entitas sejenis masih ikut terkirim pada bootstrap walaupun terikat ke akun pribadi. Nama entitas, nominal, dan `account_id` yang dirujuk cukup untuk mengungkap keberadaan serta isi akun yang seharusnya tertutup.

## Aturan pewarisan scope

Entitas perencanaan tidak memiliki kolom scope sendiri. Scope-nya diturunkan dari akun yang ditautkan, mengikuti model yang sama dengan transaksi pada Fase 2.

| Sheet | Kolom akun yang dievaluasi |
| --- | --- |
| Goals | `account_id` |
| SinkingFunds | `account_id` |
| Bills | `account_id`, `liability_account_id` |
| Recurring | `account_id` |
| Assets | `account_id` |
| InvestmentTransactions | `account_id` |
| SinkingFundEntries | diturunkan dari akun pos dana induknya lewat `fund_id` |

Baris disembunyikan bila salah satu akun yang dirujuknya berada di luar scope anggota. Baris tanpa tautan akun tetap dianggap bersama. Berbeda dengan kaki transfer pada Fase 2, entitas ini disembunyikan penuh tanpa penyamaran karena tidak menjadi penopang saldo akun bersama, sehingga menghilangkannya tidak membuat angka berbeda antar anggota.

Budgets sengaja tidak ikut diberi scope. Anggaran terikat pada kategori dan bulan, bukan akun, dan secara produk merupakan rencana rumah tangga bersama.

## Jalur tulis

Karena `findById_` memakai pembacaan berscope, seluruh service yang memvalidasi akun sebelum menulis otomatis menolak penautan ke akun pribadi anggota lain dengan `NOT_FOUND` atau kode validasi masing-masing. Ini berlaku untuk tagihan, pos dana, transaksi rutin, dan aset investasi.

Satu celah ditutup pada fase ini: `apiCreateGoal` sebelumnya menerima `accountId` apa pun tanpa verifikasi. Sekarang akun penampung target divalidasi lewat pembacaan berscope dan menolak dengan `ACCOUNT_REQUIRED`.

Pemeriksaan idempotensi `requestId` pada SinkingFunds, SinkingFundEntries, Recurring, Assets, dan InvestmentTransactions dipindahkan ke `rowsAsObjectsUnscoped_`. Tanpa itu, dua anggota dapat memakai `requestId` yang sama tanpa terdeteksi. Jalur ini hanya dipakai untuk deteksi replay dan tidak pernah mengirim baris ke klien.

## Efek pada perhitungan

Kapasitas alokasi pos dana dihitung dari pos dana yang terlihat pada akun terkait. Pos dana pada akun pribadi hanya mengurangi saldo bebas akun pribadi itu sendiri, sehingga saldo bebas akun bersama tetap sama bagi kedua anggota.

## Yang belum termasuk Fase 3

- Anggaran tetap bersama sesuai keputusan di atas.
- Ekspor, backup, dan portabilitas masih beroperasi pada seluruh workspace dan sebaiknya dijalankan oleh pemilik.
- Privasi tetap berlaku di tingkat aplikasi. Pemilik spreadsheet masih dapat membaca seluruh baris mentah, jadi spreadsheet tidak boleh dibagikan kepada anggota kedua.
- Mode Pasangan belum boleh diserahkan sebagai fitur produksi sampai audit kebocoran Fase 4 selesai.

## Verifikasi Fase 3

Pengujian otomatis pada `scripts/smoke-gas-core.mjs` mencakup tagihan, pos dana, entri pos dana, transaksi rutin, dan tujuan pada akun pribadi yang tidak muncul di bootstrap anggota lain tetapi tetap muncul bagi pemiliknya; penolakan pembayaran tagihan dan penyesuaian pos dana lintas anggota; serta penolakan pembuatan tagihan dan tujuan yang ditautkan ke akun pribadi anggota lain.
