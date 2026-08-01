# Mode Pasangan — Fase 2

Fase 2 memisahkan data pribadi dan data bersama di seluruh service. Fase 0 menyiapkan identitas dan sesi, Fase 1 menyiapkan manajemen anggota, dan Fase 2 menentukan siapa boleh membaca baris yang mana.

## Model scope

Sumber kebenaran adalah kolom `Accounts.scope_member_id`.

- Kosong berarti akun bersama dan terlihat oleh kedua anggota.
- Berisi ID anggota berarti akun pribadi dan hanya terlihat oleh anggota tersebut.
- Transaksi tidak memiliki scope sendiri. Transaksi mewarisi scope dari akun yang disentuhnya sehingga saldo akun tidak pernah bercabang antar anggota.
- Kolom `Transactions.created_by_member_id` diisi otomatis pada setiap penulisan sebagai atribusi, bukan sebagai penentu visibilitas.

Instalasi lama tetap aman karena seluruh akun yang sudah ada memiliki scope kosong dan dianggap bersama.

## Aturan visibilitas

| Data | Anggota pemegang scope | Anggota lain |
| --- | --- | --- |
| Akun bersama | Terlihat penuh | Terlihat penuh |
| Akun pribadi | Terlihat penuh | Tidak muncul sama sekali |
| Transaksi pada akun pribadi | Terlihat penuh | Tidak muncul sama sekali |
| Kaki transfer antara akun pribadi dan akun bersama | Terlihat penuh | Terlihat tersamar |
| AuditLog | Baris miliknya sendiri | Baris anggota lain disembunyikan |

Kaki transfer lintas batas sengaja tidak disembunyikan total. Jika baris itu ikut hilang, saldo akun bersama akan berbeda antara kedua anggota. Yang dikembalikan hanyalah tanggal, nominal, dan akun yang memang terlihat. Merchant, catatan, tag, lokasi, split, lampiran, akun tujuan, dan atribusi anggota dikosongkan, lalu merchant diganti menjadi `Transaksi pribadi anggota lain`.

## Cara kerja penyaringan

Penyaringan dipasang di lapisan repository, bukan satu per satu di setiap service, agar service baru ikut terlindungi tanpa perubahan tambahan.

- `rowsAsObjects_` menerapkan `applyScopeFilter_` untuk sheet Accounts dan Transactions.
- `rowsAsObjectsUnscoped_` adalah jalur keluar yang eksplisit dan hanya dipakai untuk pemeriksaan idempotensi `requestId`, cascade nama kategori, hitungan transaksi pending saat tutup buku, migrasi, dan perawatan internal. Jalur ini tidak pernah mengirim baris ke klien.
- Kunci cache dashboard menyertakan ID anggota sehingga bootstrap satu anggota tidak pernah tersaji ke anggota lain.
- Pemeriksaan ledger tetap memakai pembacaan berscope. Kaki transfer tersamar ditandai dan dilewati dari validasi akun tujuan agar status tidak salah menjadi `blocked`.

Karena `findById_` memakai pembacaan berscope, permintaan langsung ke ID milik anggota lain berakhir dengan `NOT_FOUND`, bukan bocor sebagian.

## Mengubah scope akun

Scope dikirim lewat payload `createAccount`, `updateAccount`, dan `importAccounts` dengan nilai `shared` atau `private`.

- Anggota hanya dapat menetapkan scope pribadi atas namanya sendiri.
- Mengubah akun bersama menjadi pribadi hanya dapat dilakukan pemilik workspace, karena tindakan ini menghilangkan visibilitas pasangan atas akun yang sebelumnya terbuka.
- Mengubah atau melepas akun pribadi hanya dapat dilakukan pemegang scope akun tersebut.
- Piutang mewarisi scope akun sumbernya agar dana pribadi tidak berubah menjadi bersama.

Setiap perubahan tercatat pada AuditLog melalui aksi `UPDATE` modul `accounts`.

## Yang belum termasuk Fase 2

- Tujuan, pos dana, tagihan, transaksi rutin, dan aset investasi masih berupa data bersama pada fase ini. Pewarisan scope-nya dikerjakan pada Fase 3. Lihat `MODE-PASANGAN-FASE-3.md`.
- Ekspor, backup, dan portabilitas masih beroperasi pada seluruh workspace dan sebaiknya dijalankan oleh pemilik.
- Privasi tetap berlaku di tingkat aplikasi. Pemilik spreadsheet masih dapat membaca seluruh baris mentah, jadi spreadsheet tidak boleh dibagikan kepada anggota kedua.
- Audit kebocoran dikerjakan pada Fase 4. Lihat `MODE-PASANGAN-FASE-4.md`.

## Verifikasi Fase 2

Pengujian otomatis pada `scripts/smoke-gas-core.mjs` mencakup akun bersama dan pribadi pada bootstrap, transaksi pribadi yang tidak muncul di daftar anggota lain, penolakan ubah dan hapus lintas anggota, saldo akun bersama yang tetap sama pada kedua anggota setelah transfer lintas batas, penyamaran kaki transfer, status ledger yang tetap sehat, audit log yang tidak bocor, dan seluruh aturan perubahan scope.
