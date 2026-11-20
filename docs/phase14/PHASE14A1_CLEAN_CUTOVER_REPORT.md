# MFMS — Laporan Pelaksanaan Cutover Database Bersih Resmi (Fase 14A.1)

**Dokumen Kontrol:** `docs/phase14/PHASE14A1_CLEAN_CUTOVER_REPORT.md`  
**Tanggal Eksekusi:** 20 November 2026  
**Status Pelaksanaan:** **CUTOVER SUKSES & TERVERIFIKASI (Baseline Operasional Bersih Aktif)**  
**Git Baseline Main:** `45d3b7e411e16ba2f45ca3b367a9addadbb722c2`  
**Database Operasional Aktif:** `mutiara_florist_prod` (MariaDB Port 3307)  
**Database Arsip Historis:** `mutiara_florist_archive_phase14` (MariaDB Port 3307)  
**Database Sumber Asli:** `mutiara_florist` (TETAP UTUH & TIDAK DIHAPUS)  

---

## 1. Executive Summary

Menindaklanjuti persetujuan resmi Pemilik Toko (*Owner Approval*) atas Dokumen Perencanaan Fase 14A ([PHASE14A_CLEAN_BASELINE_PLAN.md](file:///D:/xampp/htdocs/Mutiara-Florist-Management-System/docs/phase14/PHASE14A_CLEAN_BASELINE_PLAN.md)), seluruh tahapan pelaksanaan *cutover* terkontrol ke database operasional bersih telah **SELESAI DILAKSANAKAN DENGAN SUKSES 100% TANPA KENDALA**.

### Ringkasan Pencapaian Utama:
1. **Pengarsipan Penuh Tanpa Kehilangan Data:** Seluruh 16 tabel dari era pengujian (termasuk 2 pesanan, 4 item bunga, 2 pembayaran Rp1.300.000, 1 pengeluaran Rp100.000, dan 17 baris *audit logs*) telah disalin secara identik ke dalam database arsip `mutiara_florist_archive_phase14`. Database sumber asli `mutiara_florist` **tetap utuh dan tidak dihapus**.
2. **Penyediaan Baseline Operasional Bersih (`mutiara_florist_prod`):**
   - 6 migrasi skema resmi Laravel dieksekusi bersih.
   - Akun Operator Resmi User ID 1 (`Dewo`) disalin aman dengan hash password asli (fingerprint `305b24a2c345f72b`).
   - Akun demo User ID 2 **ditinggalkan sepenuhnya di arsip** dan tidak ada di database operasional baru.
   - Kedua pelanggan dummy (`test 2` dan `coba1`) **tidak disalin**; daftar pelanggan operasional dimulai dari **0 pelanggan**.
   - Kategori biaya operasional `spons` dibuat aktif sebagai master data awal.
3. **Rekonsiliasi Finansial Live Rp0:**
   - Total Nilai Pesanan: **Rp0** (0 pesanan)
   - Total Arus Kas Masuk: **Rp0** (0 pembayaran)
   - Total Arus Kas Keluar: **Rp0** (0 pengeluaran)
   - Sisa Piutang Usaha: **Rp0**
   - Log Audit Awal: **0 record**
4. **Pencadangan Ganda & Paritas Flashdisk USB:**
   - Snapshot final era testing dicadangkan terenkripsi AES-256-GCM dan disalin ke USB flashdisk (`E:\MFMS-Backups`).
   - Snapshot SQL penuh (36.182 bytes, SHA-256 `C51B548CE6F4C3884FE4F2BAB7FC569CBAAB020E7EB7BFC2D9FC2D405E548236`) disalin ke USB flashdisk.
   - Snapshot perdana *Clean Baseline V1* dicadangkan terenkripsi AES-256-GCM, diuji integritas dekripsinya secara terisolasi (100% lolos), dan disalin ke USB flashdisk dengan verifikasi hash byte-for-byte.

---

## 2. Status Preflight & Penghentian Akses Penulisan

Sebelum eksekusi mutasi dimulai, seluruh gerbang keselamatan (*preflight gates*) diverifikasi secara ketat:

- **Penghentian Akses Penulisan:** Skrip resmi `scripts\Stop-MFMS.bat` dieksekusi. Port HTTP `8000` diverifikasi tertutup rapat, memastikan tidak ada permintaan penulisan baru dari kasir fisik selama proses *cutover*.
- **Pemeriksaan Database Sumber (`mutiara_florist`):**
  - Tidak ada transaksi baru yang masuk sejak Fase 14.
  - Jumlah baris: 2 orders, 4 items, 2 payments, 1 expense, 17 audit logs, 2 users, 2 customers, 1 expense category.
  - Baseline finansial: Pesanan Rp1.600.000, Pembayaran Rp1.300.000, Pengeluaran Rp100.000, Piutang Rp300.000.
  - User ID 1 (`Dewo`) terverifikasi aktif; User ID 2 terverifikasi terkunci (`remember_token: NULL`, 0 sesi aktif).
- **Hasil Preflight:** **PASS (Semua Gerbang Memenuhi Syarat Eksekusi).**

---

## 3. Pencadangan Terakhir & Integritas Arsip Historis

### 3.1. Final Encrypted Backup Era Pengujian
Pencadangan resmi `php artisan mfms:backup` dieksekusi sesaat sebelum kloning database:
- **File Ciphertext:** `storage/app/backups/mfms_backup_2026-11-20_003716_417237_2b88afbc.enc` (9.139 bytes)
- **File Metadata:** `storage/app/backups/mfms_backup_2026-11-20_003716_417237_2b88afbc.meta.json` (1.354 bytes)
- **Tag Autentikasi GCM:** `gI90VCifOVgn4jJ4PiyzxQ==`
- **Checksum SHA-256 Ciphertext:** `A14277FF25B03AD5274FA025D5F306E65C1C00C36A4388BB3E161FFE7F8C2283`
- **Salinan Media Eksternal:** Disalin ke `E:\MFMS-Backups` dengan kecocokan hash SHA-256 **100% IDENTIK**.

### 3.2. Full SQL Snapshot (16 Tabel Lengkap)
Snapshot SQL mentah seluruh 16 tabel dan batasan referensial dihasilkan pada file:
- `storage/app/backups/full_archive_mutiara_florist_phase14.sql` (36.182 bytes)
- **SHA-256:** `C51B548CE6F4C3884FE4F2BAB7FC569CBAAB020E7EB7BFC2D9FC2D405E548236`
- **Salinan Media Eksternal:** Disalin ke `E:\MFMS-Backups` dengan kecocokan hash SHA-256 **100% IDENTIK**.

### 3.3. Database Arsip Historis (`mutiara_florist_archive_phase14`)
Database arsip dibuat di MariaDB port 3307 dengan konfigurasi `utf8mb4_unicode_ci`. Seluruh 16 tabel dan data disalin dengan rincian paritas baris:

```
+--------------------------+---------------------+-------------------------------+-------------+
| Nama Tabel               | Sumber (mutiara_fl) | Arsip (mutiara_florist_arch)  | Status      |
+--------------------------+---------------------+-------------------------------+-------------+
| users                    | 2 rows              | 2 rows                        | MATCH       |
| customers                | 2 rows              | 2 rows                        | MATCH       |
| expense_categories       | 1 row               | 1 row                         | MATCH       |
| orders                   | 2 rows              | 2 rows                        | MATCH       |
| order_items              | 4 rows              | 4 rows                        | MATCH       |
| payments                 | 2 rows              | 2 rows                        | MATCH       |
| expenses                 | 1 row               | 1 row                         | MATCH       |
| audit_logs               | 17 rows             | 17 rows                       | MATCH       |
| migrations               | 6 rows              | 6 rows                        | MATCH       |
| sessions                 | 23 rows             | 23 rows                       | MATCH       |
| cache                    | 2 rows              | 2 rows                        | MATCH       |
| cache_locks              | 0 rows              | 0 rows                        | MATCH       |
| jobs                     | 0 rows              | 0 rows                        | MATCH       |
| job_batches              | 0 rows              | 0 rows                        | MATCH       |
| failed_jobs              | 0 rows              | 0 rows                        | MATCH       |
| password_reset_tokens    | 0 rows              | 0 rows                        | MATCH       |
+--------------------------+---------------------+-------------------------------+-------------+
```
- **Integritas Relasi:** Tepat 8 *Foreign Keys* terverifikasi aktif pada database arsip.
- **Metrik Finansial Arsip:** Orders Rp1.600.000, Payments Rp1.300.000, Expenses Rp100.000, Receivables Rp300.000 (100% rekonsiliasi).

---

## 4. Penyediaan & Verifikasi Candidate Database (`mutiara_florist_prod`)

Database baru `mutiara_florist_prod` disiapkan secara independen di MariaDB port 3307:

1. **Eksekusi Migrasi Skema Murni:**
   - `0001_01_01_000000_create_users_table` (67.14ms)
   - `0001_01_01_000001_create_cache_table` (48.48ms)
   - `0001_01_01_000002_create_jobs_table` (59.57ms)
   - `2026_11_02_000001_create_mfms_core_tables` (587.76ms)
   - `2026_11_02_000002_add_deleted_at_to_customers_table` (5.74ms)
   - `2026_11_02_000003_add_idempotency_key_to_expenses` (11.75ms)
   - Total: 16 tabel skema terbentuk sempurna tanpa residual data lama.
2. **Migrasi Akun Operator Resmi (User ID 1):**
   - Nama: `Dewo`
   - Email: `dewoxxd6@gmail.com`
   - Password Hash: *Asli tidak berubah (Fingerprint `305b24a2c345f72b`)*
   - `remember_token`: `NULL`
   - User ID 2: **TIDAK ADA (0 baris)**.
3. **Inisialisasi Master Kategori Biaya:**
   - 1 kategori dibuat: `spons` (`is_active = 1`).
4. **Verifikasi Keadaan Bersih Pra-Cutover:**
   - `orders`: 0 | `order_items`: 0 | `payments`: 0 | `expenses`: 0 | `customers`: 0 | `audit_logs`: 0.
   - 8 Foreign Keys terverifikasi aktif dan konsisten.

---

## 5. Pelaksanaan Cutover Terkendali

Setelah seluruh gerbang Task 1 s.d. Task 4 berstatus PASS:

1. **Backup Konfigurasi `.env`:**
   - File `.env` disalin sebagai cadangan *rollback*: `.env.backup_pre_cutover_phase14a1`.
2. **Peralihan Parameter Database:**
   - Baris konfigurasi diperbarui secara atomik:
     ```ini
     DB_DATABASE=mutiara_florist_prod
     ```
3. **Penyegaran Cache Framework Laravel:**
   - `php artisan config:clear` -> Berhasil (*Configuration cache cleared*).
   - `php artisan cache:clear` -> Berhasil (*Application cache cleared*).
   - `php artisan route:clear` -> Berhasil (*Route cache cleared*).
   - `php artisan view:clear` -> Berhasil (*Compiled views cleared*).
4. **Pengaktifan Server Operasional:**
   - Server Laravel dinyalakan pada `http://127.0.0.1:8000` (PID Listener: 37516).
   - Metadata proses dicatat pada `storage/framework/mfms_laravel.state.json` agar terkelola penuh oleh [Stop-MFMS.bat](file:///D:/xampp/htdocs/Mutiara-Florist-Management-System/scripts/Stop-MFMS.bat).

---

## 6. Rekonsiliasi Finansial & Verifikasi Operasional Live

Pengujian live *end-to-end* dijalankan langsung pada sistem yang sedang aktif di `http://127.0.0.1:8000`:

```
+----------------------------------------------------------------------------------------------------+
|                                 REKONSILIASI BASELINE OPERASIONAL LIVE                             |
+--------------------------+---------------------+-----------------------------+---------------------+
| Modul / Indikator        | Data Historis Lama  | Kondisi Live Pasca-Cutover  | Status Evaluasi     |
+--------------------------+---------------------+-----------------------------+---------------------+
| Database Efektif         | mutiara_florist     | mutiara_florist_prod        | AKTIF & BENAR       |
| Total Pesanan            | 2 pesanan           | 0 pesanan                   | BERSIH (0)          |
| Total Nilai Pesanan      | Rp1.600.000         | Rp0                         | BERSIH (Rp0)        |
| Total Pembayaran Masuk   | Rp1.300.000         | Rp0                         | BERSIH (Rp0)        |
| Total Pengeluaran        | Rp100.000           | Rp0                         | BERSIH (Rp0)        |
| Total Piutang Usaha      | Rp300.000           | Rp0                         | BERSIH (Rp0)        |
| Log Audit Awal           | 17 logs             | 0 logs                      | BERSIH (0)          |
| Daftar Pelanggan         | 2 ("test 2","coba1")| 0 pelanggan                 | BERSIH (0)          |
| Kategori Pengeluaran     | 1 ("spons")         | 1 ("spons", Aktif)          | TERSEDIA            |
| Akun Pengguna Aktif      | 2 (1 demo terkunci) | 1 (Hanya Dewo)              | AMAN & MINIMALIS    |
| Respon HTTP Login        | 200 OK              | 200 OK ('Mutiara Florist')  | RESPONSIVE          |
+--------------------------+---------------------+-----------------------------+---------------------+
```

---

## 7. Status Pencadangan Baseline Bersih V1 (Flashdisk Parity)

Sesuai SOP keamanan, segera setelah sistem live dinyatakan bersih pada kondisi Rp0, dibuat snapshot pencadangan perdana era operasional bersih:

- **Perintah Eksekusi:** `php artisan mfms:backup`
- **File Ciphertext:** `storage/app/backups/mfms_backup_2026-11-20_004150_023676_9957b9ec.enc` (1.158 bytes)
- **File Metadata:** `storage/app/backups/mfms_backup_2026-11-20_004150_023676_9957b9ec.meta.json` (1.354 bytes)
- **Tag Autentikasi GCM:** `+SkoJJHBcUvGyb+vOiYwVg==`
- **Algoritma:** AES-256-GCM dengan AAD terautentikasi
- **Verifikasi Paritas USB Flashdisk (`E:\MFMS-Backups`):**
  - **ENC SHA-256:** `87F5EC2D3477D1A6E1EE4EDEAF9C8527DF5D572D589DFE94B533B3566272F746` (**MATCH 100%**)
  - **META SHA-256:** `AC49D21BCE5AF8CFC1463F5FF12A1C4000779C668217956C65395150FD8B4483` (**MATCH 100%**)
- **Uji Dekripsi Terisolasi (*Isolated Recovery Test*):**
  - File `.enc` berhasil didekripsi menggunakan kunci resmi.
  - Tag autentikasi dan data AAD valid.
  - Checksum SHA-256 plaintext terhitung `368b1e1125e01b15b781a92f1d0da831c79e0f45f4a4cc293847e3c1c013c3ea` cocok presisi dengan metadata.
  - Data yang dipulihkan terbukti memuat: 1 user (`Dewo`), 1 category (`spons`), 0 customer, 0 order, 0 payment, 0 expense, 0 audit log.

---

## 8. Protokol Proteksi Rollback & Pemulihan Darurat

Prosedur penanganan insiden ditetapkan dengan batasan waktu yang jelas:

### 8.1. Skenario Rollback (HANYA BERLAKU SEBELUM TRANSAKSI NYATA PERTAMA)
Jika sebelum toko melayani pembeli fisik pertama ditemukan kendala teknis yang menghalangi penggunaan:
1. Hentikan server: Jalankan `scripts\Stop-MFMS.bat`.
2. Kembalikan file `.env`: Ubah `DB_DATABASE=mutiara_florist` (atau gunakan `.env.backup_pre_cutover_phase14a1`).
3. Bersihkan cache: `php artisan config:clear`.
4. Nyalakan server: Jalankan `scripts\Start-MFMS.bat`.
5. Sistem kembali ke kondisi pra-cutover dalam waktu kurang dari 1 menit.

### 8.2. Skenario Pemulihan Darurat (SETELAH TRANSAKSI NYATA PERTAMA MASUK)
> [!CAUTION]
> **ATURAN MUTLAK KESELAMATAN KASIR:**  
> Begitu kasir toko mulai menginput transaksi penjualan nyata (misal: pesanan bunga asli dari pelanggan toko), **DILARANG KERAS MELAKUKAN ROLLBACK KE DATABASE HISTORIS `mutiara_florist` ATAU DATABASE ARSIP!**
> 
> Melakukan rollback akan **MEMUSNAHKAN** uang riil, nota pesanan, dan catatan pembayaran pelanggan nyata tersebut.
> 
> Jika terjadi masalah teknis setelah ada transaksi riil:
> 1. Eksekusi backup darurat: `php artisan mfms:backup` untuk mengamankan transaksi riil yang sudah ada.
> 2. Lakukan perbaikan aplikasi secara *fix forward* (memperbaiki bug pada level kode atau server) tanpa merusak atau mereset basis data `mutiara_florist_prod`.

---

## 9. Risiko Tersisa & Rekomendasi Langkah Selanjutnya

### Risiko Tersisa (*Residual Risks*):
1. **Server Masih Single-Threaded (`artisan serve`):** Saat ini server lokal dijalankan via internal PHP CLI. Jika kasir dan pemilik mengakses bersamaan saat penggelaran domain publik nanti, permintaan dapat antre (*request starvation*). *(Identifikasi Fase 14 - P1.1).*
2. **Ketiadaan UPS Fisik:** Komputer kasir yang mati mendadak saat listrik padam tetap bergantung pada kemampuan *InnoDB crash recovery*. Disarankan toko memasang mini-UPS fisik.

### Rekomendasi Langkah Selanjutnya:
1. **Fase 14B (Hardening Server Lokal & Trusted Proxies):** Menyiapkan Caddy Web Server lokal (multi-threaded) dan mengonfigurasi `trustProxies()` di [bootstrap/app.php](file:///D:/xampp/htdocs/Mutiara-Florist-Management-System/bootstrap/app.php).
2. **Fase 14C (Cloudflare Zero Trust Tunnel & Domain `admin.mutiaraflorist.id`):** Menghubungkan tunnel aman tanpa buka port router (*Zero Port Forwarding*) dengan proteksi email OTP untuk akses jarak jauh Pemilik Toko.
3. **Fase 14D (Pemeliharaan Rutin):** Menjadwalkan backup harian otomatis via Windows Task Scheduler dan mengaktifkan rotasi log harian (*daily logging*).

---

## 10. Pernyataan Penutup

Fase 14A.1 (*Authorized Clean Database Cutover*) dinyatakan **SELESAI DENGAN SUKSES PENUH (COMPLETE & PASS)**.

- **Status Database:** Baseline operasional bersih `mutiara_florist_prod` aktif pada port 3307.
- **Status Arsip:** Database arsip `mutiara_florist_archive_phase14` dan database asli `mutiara_florist` tersimpan utuh dan aman.
- **Status Finansial:** Pembukuan resmi Toko Mutiara Florist kini dimulai dari angka murni **Rp0**.
- **Kepatuhan:** Tidak ada merge otomatis, tidak ada git tag release, dan tidak ada pembukaan akses publik yang dilakukan pada fase ini.

Sistem siap diinspeksi secara independen oleh Pemilik Toko Mutiara Florist.
