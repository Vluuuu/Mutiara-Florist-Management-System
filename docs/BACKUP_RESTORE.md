# Prosedur Backup & Restore Terenkripsi — Mutiara Florist Management System (MFMS)

Dokumen ini mendefinisikan arsitektur, mekanisme keamanan, dan panduan operasional untuk pencadangan (backup) dan pemulihan (restore) data Mutiara Florist Management System (MFMS).

---

## 1. Prinsip Keamanan & Integritas Data

1. **Enkripsi Kriptografis Kuat (AES-256-CBC):**
   - Seluruh payload data mentah dienkripsi menggunakan sandi simetris AES-256-CBC sebelum ditulis ke disk penyimpanan.
   - Inisialisasi vektor (IV) 16-byte acak kriptografis (`random_bytes(16)`) dihasilkan unik untuk setiap file cadangan.
   - Kunci enkripsi diturunkan menggunakan fungsi hash SHA-256 (`hash('sha256', $key, true)`).
2. **Integritas Tak Terbantahkan (SHA-256 Checksum):**
   - Checksum SHA-256 dihitung langsung dari data SQL mentah sebelum dienkripsi.
   - Saat pemulihan, data didekripsi terlebih dahulu, lalu dihitung ulang hash SHA-256-nya dan dicocokkan secara `hash_equals()`. Jika terdapat manipulasi atau kerusakan 1 bit sekalipun, proses pemulihan dibatalkan secara otomatis sebelum menyentuh database.
3. **Kerahasiaan Kredensial Tanpa Bocor:**
   - Ekstraksi data dilakukan secara murni melalui koneksi PDO internal Laravel, bukan memanggil subproses shell `mysqldump` dengan password pada parameter CLI.
   - Tidak ada password database yang tampak pada process list OS (`ps`, Task Manager) ataupun file log.
4. **Isolasi Private Directory:**
   - Cadangan disimpan di direktori privat `storage/app/backups/`.
   - File berekstensi `.enc` dan `.meta.json` diabaikan oleh `.gitignore` sehingga tidak pernah bocor ke repository GitHub.
5. **Perlindungan Ketat Database Produksi (Safety Guard):**
   - Fitur restorasi diverifikasi dan **dilarang keras dijalankan pada database operasional utama (`default` / `mfms`)**.
   - Perintah pengujian pemulihan hanya diizinkan mengeksekusi ke koneksi pengujian terisolasi (`testing` / SQLite terisolasi).

---

## 2. Cakupan Tabel yang Dicadangkan

Mekanisme pencadangan mencakup 9 tabel operasional dan integritas bisnis MFMS secara konsisten:

| Tabel | Keterangan |
| --- | --- |
| `users` | Akun operator admin |
| `customers` | Data master pelanggan dan riwayat arsip |
| `orders` | Pesanan bunga, tanggal, dan status pengerjaan |
| `order_items` | Detail item bunga, penerima, pengirim, lokasi, ongkir |
| `payments` | Transaksi penerimaan kas (POSTED dan VOIDED) |
| `expense_categories` | Kategori biaya operasional toko |
| `expenses` | Catatan pengeluaran kas (POSTED dan VOIDED) |
| `audit_logs` | Jejak rekam perubahan data sensitif bisnis |
| `migrations` | Riwayat versi skema database Laravel |

---

## 3. Format dan Struktur File Cadangan

Setiap operasi backup menghasilkan sepasang file di `storage/app/backups/`:

### A. File Biner Terenkripsi: `mfms_backup_YYYY-MM-DD_HHmmss.enc`
Berisi payload SQL mentah yang dienkripsi secara penuh dengan AES-256-CBC. Tidak dapat dibaca sebagai teks biasa.

### B. File Metadata: `mfms_backup_YYYY-MM-DD_HHmmss.meta.json`
Berisi metadata verifikasi integritas:
```json
{
  "backup_file": "mfms_backup_2026-11-16_213500.enc",
  "created_at": "2026-11-16T21:35:00+07:00",
  "cipher": "AES-256-CBC",
  "iv": "3d9f...==",
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
  }
}
```

---

## 4. Panduan Eksekusi Perintah Artisan

### A. Membuat Cadangan Terenkripsi Baru
Jalankan perintah berikut di terminal:
```bash
php artisan mfms:backup
```

Opsi tambahan:
- `--key="kunci-rahasia-khusus"` : Menggunakan passphrase khusus selain `APP_KEY`.
- `--connection="mysql"` : Menentukan koneksi database sumber yang dicadangkan.

Contoh output:
```text
Memulai backup database terenkripsi (AES-256-CBC)...

✓ Backup berhasil dibuat dan dienkripsi!
+-------------------+---------------------------------------------------------------+
| Properti          | Nilai                                                         |
+-------------------+---------------------------------------------------------------+
| File Enkripsi     | storage/app/backups/mfms_backup_2026-11-16_213500.enc         |
| File Metadata     | storage/app/backups/mfms_backup_2026-11-16_213500.meta.json   |
| Waktu Pembuatan   | 2026-11-16T21:35:00+07:00                                     |
| Algoritma Sandi   | AES-256-CBC                                                   |
| Checksum SHA-256  | a7b9c...                                                      |
| Ukuran Enkripsi   | 45,136 bytes                                                  |
+-------------------+---------------------------------------------------------------+
```

### B. Menguji Pemulihan (Restore Test) pada Lingkungan Terisolasi
Jalankan perintah berikut untuk menguji pemulihan file cadangan terbaru:
```bash
php artisan mfms:restore-test
```
Atau uji file cadangan spesifik:
```bash
php artisan mfms:restore-test storage/app/backups/mfms_backup_2026-11-16_213500.enc
```

Verifikasi yang dilakukan otomatis oleh sistem:
1. Dekripsi payload menggunakan algoritma AES-256-CBC.
2. Validasi checksum SHA-256 payload hasil dekripsi terhadap metadata.
3. Impor data SQL ke database pengujian terisolasi (`testing`).
4. Rekonsiliasi jumlah baris setiap tabel (100% cocok).
5. Rekonsiliasi nilai metrik keuangan (`total_amount`, kas masuk POSTED, kas keluar POSTED).
6. Uji integritas relasi foreign key (0 orphan records).

Contoh output:
```text
Menjalankan uji restorasi pada database terisolasi: [testing]...

✓ UJI RESTORASI BERHASIL: Status SUCCESS
+------------------------------------+--------+
| Pemeriksaan Integritas             | Status |
+------------------------------------+--------+
| Checksum SHA-256                   | VALID  |
| Rekonsiliasi Baris Tabel           | VALID  |
| Integritas Metrik Keuangan         | VALID  |
| Relasi Foreign Key (No Orphans)    | VALID  |
+------------------------------------+--------+
```

---

## 5. Rencana Salinan Cadangan ke Cloud (Google Drive — Deferred)

Berdasarkan keputusan roadmap Phase 4:
- Penyimpanan lokal terenkripsi di `storage/app/backups/` menjadi fondasi utama MVP.
- Integrasi otomatis pengunggahan cadangan ke Google Drive (menggunakan Google Drive API / Service Account) ditunda ke fase rilis operasional mendatang (Phase 5 / Post-MVP) untuk menghindari ketergantungan API pihak ketiga dan credential token pada lingkungan pengujian lokal.
- Operator dapat mengunggah file berekstensi `.enc` dan `.meta.json` secara manual ke Google Drive yang aman karena seluruh payload sudah terenkripsi kuat dengan AES-256-CBC.
