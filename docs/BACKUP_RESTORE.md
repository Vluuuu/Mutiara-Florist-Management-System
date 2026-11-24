# Prosedur Backup & Restore Terenkripsi MFMS

**Versi Dokumen:** Phase 13 (`release/phase13-ui-bi`, baseline rilis `0b436a9`)

Dokumen ini menjelaskan mekanisme pencadangan (backup) dan uji pemulihan (restore) terenkripsi MFMS yang mendukung **PostgreSQL**, **MariaDB/MySQL**, dan **SQLite** melalui `App\Services\BackupService`.

---

## 1. Prinsip Keamanan & Integritas Data

1. **Enkripsi Terotentikasi (AES-256-GCM + AAD):**
   - Seluruh snapshot data diserialisasi secara kanonikal bertipe (JSON) dan dienkripsi menggunakan **AES-256-GCM** dengan nonce/IV 12-byte acak kriptografis (`random_bytes(12)`), Authenticated Additional Data (`AAD`), dan tag autentikasi 16-byte.
   - Manipulasi sekecil apa pun pada ciphertext atau metadata menyebabkan verifikasi gagal sebelum pemulihan dilakukan.
   - Checksum `SHA-256` atas payload terdekripsi diverifikasi ulang sebelum data dipulihkan.
2. **Snapshot Transaksional Konsisten (ACID):**
   - **PostgreSQL:** `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ`.
   - **MariaDB/MySQL (InnoDB):** `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ` diikuti `START TRANSACTION WITH CONSISTENT SNAPSHOT`.
   - **SQLite:** `BEGIN TRANSACTION`.
   - Menjamin seluruh tabel bisnis dicadangkan pada satu titik waktu konsisten meskipun ada transaksi yang sedang berlangsung.
3. **Pemisahan Kunci Enkripsi:**
   - Menggunakan environment variable `BACKUP_ENCRYPTION_KEY` (dengan fallback ke `APP_KEY` bila belum diset terpisah).
   - Opsi CLI `--ask-key` memungkinkan input passphrase secara interaktif tanpa terlihat di daftar proses OS.
4. **Penulisan Atomik & Preservasi Tipe:**
   - File `.enc` dan `.meta.json` ditulis terlebih dahulu ke berkas sementara (`.tmp`), diberi izin file ketat (`0600` pada Unix), lalu di-*rename* secara atomik setelah selesai.
   - Serialisasi bertipe menjaga string nomor telepon berawalan nol (`0812...`), karakter UTF-8, tanda kutip, teks multiline, dan nilai `NULL` tanpa kerusakan parsing SQL.
5. **Restorasi Topologis & Sinkronisasi Sequence PostgreSQL:**
   - Pembersihan dan pengisian ulang tabel dilakukan mengikuti urutan ketergantungan foreign key (`DELETE_ORDER` anak ke induk, `INSERT_ORDER` induk ke anak) tanpa perlu mematikan constraint FK.
   - Khusus PostgreSQL, `BackupService` menjalankan `setval(pg_get_serial_sequence(...))` untuk setiap tabel pasca-restorasi agar operasi insert baru tidak bentrok dengan primary key lama.
6. **Perlindungan Ketat Database Operasional (Safety Guard):**
   - Perintah `mfms:restore-test` menolak keras koneksi operasional (`default`, `mutiara_florist`, `mutiara_florist_prod`, `mfms`, `laravel`).
   - Target restorasi uji wajib berupa koneksi pengujian eksplisit (`is_testing => true` atau nama koneksi/database bertanda `test`/`testing` atau `:memory:`).
7. **Isolasi Pengujian Otomatis:**
   - Suite pengujian memakai folder sementara unik (`storage/framework/testing/backups_test_*`) dan tidak pernah menghapus folder backup operasional (`storage/app/backups/`).

---

## 2. Cakupan 9 Tabel yang Dicadangkan

| Tabel | Keterangan |
| --- | --- |
| `users` | Akun operator admin |
| `customers` | Data pelanggan termasuk riwayat `deleted_at` |
| `orders` | Header pesanan, tanggal nota, total tagihan, status ringkasan |
| `order_items` | Item bunga, penerima, pengirim, tanggal/lokasi kirim, ongkir |
| `payments` | Event penerimaan kas (`POSTED` dan `VOIDED`) |
| `expense_categories` | Kategori pengeluaran operasional |
| `expenses` | Catatan pengeluaran kas (`POSTED` dan `VOIDED`) |
| `audit_logs` | Jejak audit aksi kritis bisnis |
| `migrations` | Riwayat migrasi skema Laravel |

---

## 3. Struktur Berkas Cadangan

Setiap eksekusi backup menghasilkan sepasang berkas di `storage/app/backups/` (dikecualikan di `.gitignore`):

1. `mfms_backup_YYYY-MM-DD_HHmmss_<uniq>.enc`: payload biner terenkripsi AES-256-GCM.
2. `mfms_backup_YYYY-MM-DD_HHmmss_<uniq>.meta.json`: metadata verifikasi (nama berkas, waktu pembuatan WIB, cipher, IV, tag GCM, checksum SHA-256, jumlah baris per tabel, ringkasan metrik keuangan, dan sidik jari kunci).

Jangan pernah mengunggah berkas `.enc`, `.meta.json`, atau kunci enkripsi ke repository Git publik.

---

## 4. Perintah Artisan Backup & Uji Restore

### Membuat Backup Terenkripsi

```bash
php artisan mfms:backup
```

Opsi yang tersedia:
- `--ask-key`: meminta passphrase enkripsi secara interaktif di terminal.
- `--connection="pgsql"`: memilih koneksi database sumber secara eksplisit (misalnya `pgsql` atau `mysql`).
- `--dir="/path/backup"`: menentukan direktori output khusus.

### Menguji Pemulihan pada Database Uji Terisolasi

```bash
# Menggunakan koneksi SQLite testing
php artisan mfms:restore-test --connection=testing

# Menggunakan koneksi PostgreSQL testing terisolasi
php artisan mfms:restore-test --connection=pgsql_testing

# Menggunakan koneksi MariaDB testing terisolasi
php artisan mfms:restore-test --connection=mariadb_testing
```

Verifikasi dianggap berhasil apabila seluruh indikator melaporkan **VALID**: Checksum SHA-256, Rekonsiliasi Baris Tabel, Integritas Metrik Keuangan, Relasi Foreign Key, dan (pada PostgreSQL) sinkronisasi sequence.

---

## 5. Catatan Pemulihan Bencana (Disaster Recovery)

1. Pada paket Supabase Free, Point-in-Time Recovery (PITR) otomatis tidak tersedia secara bawaan sehingga backup mandiri melalui `php artisan mfms:backup` dan penyimpanan salinan off-site (penyimpanan terpisah milik pemilik toko) bersifat wajib.
2. Simpan salinan `BACKUP_ENCRYPTION_KEY` (atau `APP_KEY` bila dipakai sebagai fallback) secara terpisah di pengelola kata sandi terenkripsi milik pemilik. Tanpa kunci tersebut, arsip `.enc` tidak dapat didekripsi.
3. Sebelum melakukan pemulihan ke database baru, selalu jalankan verifikasi `mfms:restore-test` terlebih dahulu pada koneksi pengujian terisolasi.

Rujukan terkait: [DATABASE.md](DATABASE.md), [DEPLOYMENT.md](DEPLOYMENT.md), [HANDOVER_OPERATOR_GUIDE.md](HANDOVER_OPERATOR_GUIDE.md).
