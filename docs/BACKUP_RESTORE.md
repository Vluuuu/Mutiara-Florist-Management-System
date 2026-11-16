# Prosedur Backup & Restore Terenkripsi — Mutiara Florist Management System (MFMS)

Dokumen ini mendefinisikan arsitektur, mekanisme keamanan, dan panduan operasional untuk pencadangan (backup) dan pemulihan (restore) data Mutiara Florist Management System (MFMS) yang telah ditingkatkan pada Phase 4 Hardening.

---

## 1. Prinsip Keamanan & Integritas Data

1. **Authenticated Encryption Kriptografis (AES-256-GCM):**
   - Seluruh payload data diserialisasi secara kanonikal bertipe dan dienkripsi menggunakan sandi terotentikasi **AES-256-GCM**.
   - Nonce / Inisialisasi vektor (IV) 12-byte acak kriptografis (`random_bytes(12)`) dihasilkan unik untuk setiap operasi pencadangan.
   - Tag autentikasi 16-byte (`$tag`) dihasilkan langsung oleh OpenSSL GCM dan diverifikasi saat dekripsi. Jika terdapat manipulasi ciphertext 1 bit sekalipun, dekripsi langsung gagal dan melempar eksepsi.
2. **Snapshot Transaksional Konsisten (ACID Consistency):**
   - Proses pembacaan tabel dibungkus dalam transaksi isolasi snapshot konsisten (`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ` dan `START TRANSACTION WITH CONSISTENT SNAPSHOT` pada MariaDB/MySQL InnoDB, serta `BEGIN TRANSACTION` pada SQLite).
   - Menjamin bahwa kombinasi data antar-tabel (pesanan, pembayaran, pengeluaran, audit log) yang dicadangkan adalah titik waktu (*point-in-time*) yang 100% sinkron, bahkan jika ada transaksi kasir yang berlangsung bersamaan.
3. **Pemisahan Kunci Enkripsi (Key Separation):**
   - Kunci enkripsi backup dipisahkan dari `APP_KEY` melalui environment variable `BACKUP_ENCRYPTION_KEY` (fallback aman ke `APP_KEY` jika tidak didefinisikan).
   - Opsi CLI `--ask-key` disediakan untuk memasukkan passphrase secara interaktif tanpa terekspos pada proses list OS (`ps`, `tasklist`).
4. **Penulisan Atomik (Atomic Write):**
   - File `.enc` dan `.meta.json` pertama kali ditulis sebagai file sementara (`.tmp`).
   - File hanya di-*rename* menjadi file backup final setelah seluruh proses enkripsi, checksum, dan penulisan metadata selesai dengan sukses.
   - Mencegah file parsial atau interupsi sistem dianggap sebagai backup valid.
5. **Serialisasi Data Kanonikal & Preservasi Tipe:**
   - Tidak menggunakan pemecahan string SQL manual atau pemisahan baris/titik koma yang rentan terpotong oleh input teks multiline pengguna.
   - Mempertahankan tipe data secara eksak:
     - Nomor telepon berawalan nol (misal: `08123456789`) tetap tersimpan sebagai string utuh, tidak pernah terkonversi menjadi angka tanpa nol depan.
     - Karakter Unicode dan emoji (🌸, 🌹, 💐) tersimpan secara native UTF-8.
     - Tanda kutip tunggal (`'`), kutip ganda (`"`), dan backslash (`\`) tersimpan tanpa distorsi.
     - Teks multiline dengan titik koma (`;`) di tengah kalimat tidak merusak struktur data.
     - Nilai `NULL` tersimpan sebagai null asli.
6. **Perlindungan Ketat Database Operasional (Safety Guard):**
   - Restorasi **dilarang keras** dijalankan pada database operasional (`default`, `mutiara_florist`, `mfms`, `laravel`).
   - Koneksi target harus merupakan koneksi pengujian eksplisit yang terdaftar dengan flag `is_testing => true` atau nama berakhiran `test`/`testing`.
   - Nama database target harus memiliki penanda `test` atau `:memory:`.
7. **Isolasi Pengujian Bersih (No Wildcard Cleanup):**
   - Pengujian otomatis menggunakan direktori pengujian sementara yang unik dan terisolasi (`storage/framework/testing/backups_test_*`).
   - Cleanup pengujian hanya menghapus file yang dibuat oleh sesi pengujian itu sendiri. Folder backup operasional (`storage/app/backups/`) tidak pernah disentuh atau dihapus oleh test runner.

---

## 2. Cakupan Tabel yang Dicadangkan

Pencadangan mencakup 9 tabel inti MFMS:

| Tabel | Keterangan |
| --- | --- |
| `users` | Akun operator admin |
| `customers` | Data master pelanggan dan riwayat soft-delete |
| `orders` | Pesanan bunga, tanggal, total tagihan, status pengerjaan |
| `order_items` | Rincian item bunga, penerima, pengirim, lokasi, ongkir |
| `payments` | Transaksi penerimaan kas (POSTED dan VOIDED) |
| `expense_categories` | Kategori biaya operasional toko |
| `expenses` | Catatan pengeluaran kas (POSTED dan VOIDED) |
| `audit_logs` | Jejak rekam perubahan data sensitif bisnis |
| `migrations` | Riwayat migrasi skema database Laravel |

---

## 3. Format dan Struktur File Cadangan

Setiap operasi backup menghasilkan sepasang file di direktori backup:

### A. File Biner Terenkripsi: `mfms_backup_YYYY-MM-DD_HHmmss.enc`
Berisi payload data snapshot kanonikal yang dienkripsi penuh menggunakan AES-256-GCM.

### B. File Metadata: `mfms_backup_YYYY-MM-DD_HHmmss.meta.json`
Berisi metadata verifikasi integritas kriptografis:
```json
{
  "backup_file": "mfms_backup_2026-11-16_223000.enc",
  "created_at": "2026-11-16T22:30:00+07:00",
  "cipher": "AES-256-GCM",
  "iv": "3d9f...==",
  "tag": "k8X1...==",
  "checksum_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "size_plain": 45120,
  "size_encrypted": 45136,
  "tables": {
    "users": 1,
    "customers": 24,
    "orders": 18,
    "order_items": 26,
    "payments": 19,
    "expense_categories": 6,
    "expenses": 14,
    "audit_logs": 42,
    "migrations": 6
  },
  "metrics": {
    "orders_count": 18,
    "orders_total_amount": 15450000,
    "payments_posted_amount": 11200000,
    "expenses_posted_amount": 3450000
  },
  "key_fingerprint": "a1b2c3d4e5f60718"
}
```

---

## 4. Panduan Eksekusi Perintah Artisan

### A. Membuat Cadangan Terenkripsi Baru
```bash
php artisan mfms:backup
```

Opsi tambahan:
- `--ask-key` : Memasukkan passphrase enkripsi secara interaktif tanpa terlihat pada proses list CLI.
- `--key="passphrase-khusus"` : Menggunakan passphrase eksplisit (hanya disarankan di lingkungan CI/CD aman).
- `--connection="mysql"` : Menentukan koneksi database sumber yang dicadangkan.
- `--dir="path/ke/folder"` : Menentukan folder penyimpanan khusus.

### B. Menguji Pemulihan ke Database Pengujian Terisolasi
```bash
php artisan mfms:restore-test --connection=testing
```
atau pada MariaDB testing:
```bash
php artisan mfms:restore-test --connection=mariadb_testing
```

---

## 5. Prosedur Disaster Recovery (Pemulihan Bencana)

1. Siapkan database target baru kosong (misal: mesin server baru dengan MariaDB terpasang).
2. Salin file `.enc` dan `.meta.json` dari penyimpanan cadangan terpisah (off-site storage).
3. Pastikan kunci enkripsi (`BACKUP_ENCRYPTION_KEY`) tersedia.
4. Jalankan verifikasi integritas menggunakan `BackupService::restoreTest` terhadap koneksi pengujian terlebih dahulu.
5. Setelah status `SUCCESS` (Checksum VALID, Baris Tabel VALID, Metrik Keuangan VALID, Foreign Key VALID), data siap dialihkan ke operasional baru.
