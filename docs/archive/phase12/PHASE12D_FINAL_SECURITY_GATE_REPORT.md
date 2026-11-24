# MFMS — Phase 12D: Final Operational Security Gates Report

**Mutiara Florist Management System (MFMS)**  
**Tanggal Audit:** 19 November 2026 (WIB / `Asia/Jakarta`)  
**Baseline Git Main:** `45d3b7e411e16ba2f45ca3b367a9addadbb722c2`  
**Status Saat Ini:**
- **Human UAT (Operator):** 12/12 PASS (Terkonfirmasi)
- **Usability Evaluation:** 5/5 PASS (Terkonfirmasi)
- **Pemahaman Non-RBAC:** CONFIRMED / ACKNOWLEDGED
- **Status Seluruh Security Gates:** CONDITIONAL (Menunggu tindakan pemilik)
- **Owner Acceptance:** PENDING (Belum Ditandatangani)
- **Release Status:** NOT AUTHORIZED (Belum Diizinkan untuk Transaksi Nyata)

---

## 1. Executive Summary

Laporan ini menyajikan hasil audit keamanan operasional tahap akhir (*Phase 12D Final Operational Security Gates*) sebelum Mutiara Florist Management System (MFMS) digunakan untuk transaksi nyata toko. Audit dilakukan secara **READ-ONLY** terhadap database operasional `mutiara_florist`, konfigurasi runtime Laravel, dan mekanisme pencadangan data (*disaster recovery*).

Sistem telah menyelesaikan seluruh uji teknis, uji regresi otomatis, 12 skenario UAT operasional operator manusia, serta 5 evaluasi kemudahan penggunaan (*usability*). Namun demikian, **toko belum diizinkan memulai operasional nyata** sebelum pemilik toko (*owner*) meninjau, menyetujui, dan menandatangani formulir penerimaan akhir ini serta mengotorisasi tindakan keamanan prasyarat.

---

## 2. Task 1 — Operational Demo Account Audit

Pemeriksaan dilakukan secara **READ-ONLY** terhadap tabel `users` dan seluruh relasi tabel dalam database operasional `mutiara_florist`. Password hash dan identitas pribadi operator resmi dirahasiakan (*redacted*).

### 2.1 Hasil Inventarisasi Akun
- **Total Akun Terdaftar:** 2 akun.
- **Akun 1 (Operator Utama / Pemilik):**
  - ID: `1`
  - Domain Email: `@gmail.com`
  - Waktu Registrasi: `2026-11-02 12:04:27`
  - Status: Akun resmi aktif untuk operasional toko.
- **Akun 2 (Eks Akun Pengujian / Demo QA):**
  - ID: `2`
  - Nama Terdaftar: `Nonaktif - Eks Akun Pengujian`
  - Alamat Email Saat Ini: `disabled-qa-2@disabled.invalid`
  - Waktu Dibuat: `2026-11-15 20:19:26`
  - Waktu Terakhir Diperbarui: `2026-11-18 10:19:59`
- **Pencarian Pola Email Demo (`@example.test`):**
  - Pemindaian menyeluruh terhadap 10 tabel (`users`, `customers`, `orders`, `order_items`, `payments`, `expense_categories`, `expenses`, `audit_logs`, `sessions`, `password_reset_tokens`) menghasilkan **0 baris** yang masih memuat teks `@example.test`. Akun demo lama telah dialihkan ke domain RFC `.invalid`.

### 2.2 Status Aktivasi & Celah Autentikasi Laten
- `email_verified_at`: `NULL`
- `remember_token`: `NULL`
- Sesi aktif pada tabel `sessions`: `0` sesi (tidak ada sesi login aktif untuk ID 2).
- **Temuan Celah Kritis Laten:** Kolom `password` pada User ID 2 masih memuat hash bcrypt valid (panjang 60 karakter, prefix `$2y$12$...`). Meskipun email beralamat di `@disabled.invalid`, jika pihak yang mengetahui sandi lama mencoba login menggunakan email `disabled-qa-2@disabled.invalid`, mekanisme otentikasi bawaan Laravel akan berhasil memvalidasi kredensial karena belum ada kolom status aktivasi akun (`is_active`).

### 2.3 Pemetaan Relasi Transaksi, Audit, dan Foreign Key
User ID 2 tercatat memiliki dependensi data operasional dan jejak audit sebagai berikut:
1. **Tabel `orders`:** Tercatat sebagai `created_by` pada **1 pesanan** (Order ID #2).  
   *Aturan Foreign Key:* `restrictOnDelete()`
2. **Tabel `payments`:** Tercatat sebagai `recorded_by` pada **2 pembayaran** sah bernilai total Rp1.300.000 (Payment ID #1 dan #2).  
   *Aturan Foreign Key:* `restrictOnDelete()`
3. **Tabel `expenses`:** Tercatat sebagai `recorded_by` pada **1 pengeluaran** operasional toko (Expense ID #1).  
   *Aturan Foreign Key:* `restrictOnDelete()`
4. **Tabel `audit_logs`:** Tercatat sebagai `actor_user_id` pada **14 catatan log audit** historis (pembuatan pelanggan, modifikasi nota pesanan, perubahan progres item bunga, penerbitan pembayaran, dan pencatatan pengeluaran).  
   *Aturan Foreign Key:* `nullOnDelete()`

### 2.4 Analisis Risiko Jika Akun Dihapus
1. **Risiko Penolakan Eksekusi (Query Failure):**  
   Perintah `DELETE FROM users WHERE id = 2` **akan gagal total** dan memicu error MariaDB `SQLSTATE[23000]: Integrity constraint violation: 1451 Cannot delete or update a parent row: a foreign key constraint fails` karena dikunci oleh 3 foreign key `RESTRICT` pada pesanan, pembayaran, dan pengeluaran.
2. **Risiko Kerusakan Jejak Audit (*Audit Trail Destruction*):**  
   Jika penghapusan dipaksakan (misalnya dengan mematikan pengecekan relasi via `SET FOREIGN_KEY_CHECKS=0`), maka:
   - Pesanan, pembayaran, dan pengeluaran terkait akan menjadi entitas yatim (*orphaned records*) tanpa penanggung jawab pencatatan.
   - 14 baris audit log akan kehilangan asosiasi pelakunya (`actor_user_id` menjadi `NULL`), merusak prinsip integritas pencatatan transaksi toko (*audit non-repudiation*).
3. **Risiko Perintah Pembuatan Admin CLI:**  
   Perintah `php artisan mfms:create-admin` memvalidasi `User::query()->exists()`. Selama User ID 1 tetap ada, penonaktifan User ID 2 tidak akan membuka celah pembuatan akun publik.

### 2.5 Rencana Tindakan yang Membutuhkan Otorisasi Pemilik
Untuk menutup celah akses User ID 2 secara permanen tanpa merusak integritas foreign key dan log audit:
- [ ] **Tindakan yang Direkomendasikan (Tombstone Security Lock):**
  1. Melakukan pembongkaran hash password User ID 2 menjadi nilai acak kriptografis tak terbalikkan atau format token terblokir (contoh: `!REVOKED_ACCOUNT_` + SHA-256 acak 64 karakter) sehingga tidak dapat diverifikasi oleh algoritma bcrypt mana pun.
  2. Menghapus sesi lama yang mungkin masih tersisa di tabel `sessions`.
  3. Memastikan domain tetap `@disabled.invalid` agar tautan reset sandi tidak dapat dikirim.
  4. **Jangan pernah menjalankan DELETE baris record User ID 2.**

---

## 3. Task 2 — APP_DEBUG & Operational Environment Verification

Verifikasi dilakukan terhadap konfigurasi aktif Laravel, penanganan error HTTP, serta pembatasan akses antarmuka jaringan.

### 3.1 Hasil Pemeriksaan Konfigurasi Efektif
| Parameter | Nilai Konfigurasi Terukur | Status Keamanan |
| --- | --- | --- |
| `app.debug` (Runtime Laravel) | `false` | **AMAN (PASS)** — Mode debug nonaktif |
| File `.env` (`APP_DEBUG`) | `APP_DEBUG=false` | **AMAN (PASS)** — Tidak mengaktifkan debug |
| `app.env` / `.env` (`APP_ENV`) | `local` | **SESUAI** — Konfigurasi desktop PC kasir |
| `app.url` | `http://localhost:8000` | **SESUAI** — Hanya menargetkan port lokal |
| Status Cache Konfigurasi | Tidak di-cache (`false`) | Membaca langsung dari `.env` lokal |

### 3.2 Uji Kebocoran Detail Sensitif pada HTTP Error
1. **Uji HTTP 404 (Halaman Tidak Ditemukan):**  
   Permintaan ke rute non-eksisten merespons kode HTTP `404 Not Found` dengan halaman minimal bawaan Laravel. Tidak ditemukan jejak path folder server, query database, maupun data environment.
2. **Uji Simulasi HTTP 500 (Unhandled Internal Server Error):**  
   Pengujian simulasi error sistem internal (melempar *unhandled exception* yang memuat kata kunci sensitif sintetis) melalui exception handler Laravel menghasilkan:
   - Status HTTP: `500 Server Error`.
   - Bocoran Kata Kunci Rahasia Sintetis: **0 temuan (SAFE - NOT FOUND)**.
   - Bocoran Pesan Internal Exception: **0 temuan (SAFE - NOT FOUND)**.
   - Bocoran Stack Trace / Baris Kode: **0 temuan (SAFE - NOT FOUND)**.
   - Tampilan di Layar Pengguna: Halaman statis generik `Server Error`.

### 3.3 Verifikasi Pembatasan Jaringan (Localhost Binding)
- **Status Port 8000:** Terbuka eksklusif pada antarmuka lokal `127.0.0.1:8000` (`TCP 127.0.0.1:8000 LISTEN`).
- **Proses Pengelola:** Dikelola oleh `scripts/Start-MFMS.bat` (Listener PID `9896`, PHP 8.2 CLI).
- **Eksposur Jaringan Luar:** **0 eksposur**. Aplikasi tidak melakukan *bind* ke alamat liar `0.0.0.0`, sehingga tidak dapat diakses dari perangkat lain pada jaringan Wi-Fi/LAN toko tanpa perantara khusus.

---

## 4. Task 3 — Backup Off-Site & Recovery Key Audit

Pemeriksaan dilakukan terhadap keberadaan arsip cadangan terenkripsi, pasangan metadata, status keterpisahan kunci pemulihan, dan media off-site di luar komputer utama.

### 4.1 Inventarisasi Backup Terenkripsi Terbaru
- **File Backup Enkripsi Lokal:**  
  `storage/app/backups/mfms_backup_2026-11-18_132339_819052_efcfd405.enc` (9.139 bytes)
- **Pasangan Metadata:**  
  `storage/app/backups/mfms_backup_2026-11-18_132339_819052_efcfd405.meta.json` (1.354 bytes)
- **Waktu Pembuatan:** `2026-11-18 13:23:39 WIB`
- **Algoritma Enkripsi:** `AES-256-GCM` dengan Authenticated Additional Data (`AAD`)
- **Checksum Integritas:** `SHA-256: a6e0c490918bdbc193f0a4fb1d975ed9ec67389e24ef4b65803e3009302a17f1`
- **Integritas Relasi Snapshot:** 9 tabel inti (`users`, `customers`, `orders`, `order_items`, `payments`, `expense_categories`, `expenses`, `audit_logs`, `migrations`) tercatat konsisten.

### 4.2 Status Kunci Pemulihan (*Recovery Key*)
- **Status Variabel Lingkungan:**  
  Variabel `BACKUP_ENCRYPTION_KEY` **BELUM DISET TERPISAH** di file `.env`.
- **Mekanisme Kunci:**  
  `BackupService` saat ini menggunakan mekanisme **fallback ke `APP_KEY`**.
- **Sidik Jari Kunci (*Key Fingerprint*):**  
  Sidik jari `[REDACTED_KEY_FINGERPRINT]` pada metadata backup cocok 100% dengan sidik jari turunan `APP_KEY` aktif saat ini.
- **Risiko Keterikatan Kunci:**  
  Jika pengelola menjalankan rotasi kunci aplikasi (`php artisan key:generate`) tanpa mencadangkan kunci lama atau menetapkan `BACKUP_ENCRYPTION_KEY` terpisah, file backup lama **tidak akan pernah bisa didekripsi kembali**.
- **Keberadaan Kunci di Luar PC Utama:**  
  **BELUM TERDOKUMENTASI DI MEDIA EKSTERNAL.** File konfigurasi `.env` atau kunci pemulihan belum tersimpan di pengelola kata sandi atau brankas aman milik pemilik di luar komputer toko.

### 4.3 Status Sinkronisasi Backup Off-Site
1. **Penyimpanan Cloud (OneDrive):**  
   - Folder sinkronisasi terdeteksi pada `<USER_HOME>\OneDrive\MFMS-Backups`.
   - File yang ada di Cloud: Versi lama (`mfms_backup_2026-11-18_101440_275008_39998ef3.enc` dan `.meta.json`).
   - File versi terbaru (`18 Nov 13:23:39`): **BELUM TERSALIN** ke folder sinkronisasi Cloud.
2. **Media Fisik Eksternal (Flashdisk / Harddisk Eksternal):**  
   - Pemeriksaan sistem menunjukkan drive penyimpanan yang terpasang hanya disk internal `C:` dan `D:` (`DriveType: Fixed`).
   - **Tidak ada media USB / removable disk yang terhubung saat audit.**
3. **Kesimpulan Gate Backup Off-Site:** **CONDITIONAL (BELUM LENGKAP)**.  
   Penyalinan file `.enc` terbaru serta pencatatan kunci enkripsi di luar PC utama mutlak diselesaikan sebelum transaksi nyata dimulai.

---

## 5. Task 4 — Final Acceptance Summary & Residual Risk Register

### 5.1 Matriks Status Gate Keamanan Operasional
| Gate Keamanan | Komponen yang Diperiksa | Status Evaluasi | Rekomendasi Tindakan |
| --- | --- | --- | --- |
| **Gate 1: Human UAT** | 12 skenario operasional harian oleh operator manusia | **PASS** | Terkonfirmasi lengkap oleh operator toko |
| **Gate 2: Usability** | 5 evaluasi kemudahan navigasi & penanganan kendala | **PASS** | Terkonfirmasi operator memahami sistem |
| **Gate 3: Pemahaman Non-RBAC** | Pengakuan seluruh akun memiliki hak akses setara | **CONFIRMED** | Operator memahami ketiadaan role kasir/owner |
| **Gate 4: Akun Demo** | Pemeriksaan akun `@example.test` di `mutiara_florist` | **CONDITIONAL** | Otorisasi penguncian password hash ID 2 |
| **Gate 5: APP_DEBUG** | Penonaktifan debug & proteksi kebocoran error | **PASS** | `APP_DEBUG=false`, localhost 127.0.0.1 terverifikasi |
| **Gate 6: Backup & Kunci** | Backup AES-256-GCM & salinan kunci di luar PC | **CONDITIONAL** | Salin file terbaru ke OneDrive/USB & simpan `APP_KEY` |
| **Gate 7: Owner Sign-Off** | Persetujuan resmi pemilik toko untuk go-live | **PENDING** | Menunggu keputusan dan tanda tangan pemilik |

---

### 5.2 Daftar Risiko Residual (*Residual Risk Register*)

Pemilik toko wajib memahami risiko tersisa berikut selama fase operasional pilot:

1. **Ketiadaan Pembatasan Peran Pengguna (No RBAC):**
   - *Kondisi:* Seluruh akun yang dapat masuk memiliki akses yang sama terhadap data pelanggan, pesanan, pembatalan pembayaran (*void*), pengeluaran, dan laporan keuangan.
   - *Mitigasi:* Hanya berikan akun kepada personel tepercaya. Pastikan operator selalu menekan tombol **Keluar Akun** setelah giliran kerja selesai.
2. **Ketergantungan Dekripsi Backup pada `APP_KEY`:**
   - *Kondisi:* Backup terenkripsi dibuat menggunakan fallback `APP_KEY` di file `.env`.
   - *Mitigasi:* Simpan salinan file `.env` di brankas terpisah di luar PC kasir. Dilarang keras menjalankan perintah `php artisan key:generate` di komputer toko tanpa prosedur migrasi kunci backup.
3. **Penyalinan Off-Site Masih Manual:**
   - *Kondisi:* Sistem belum melakukan upload otomatis terjadwal ke server cloud terpusat.
   - *Mitigasi:* Terapkan SOP harian/mingguan bagi operator untuk menyalin file `.enc` dan `.meta.json` ke flashdisk atau folder cloud pribadi pemilik saat toko tutup.
4. **Operasional pada Komputer Tunggal (Single-PC Localhost):**
   - *Kondisi:* Basis data dan aplikasi hanya berada pada 1 PC kasir Windows.
   - *Mitigasi:* Gunakan catu daya cadangan (UPS) untuk mencegah PC mati mendadak saat transaksi disimpan ke basis data MariaDB.

---

## 6. Tindakan yang Masih Membutuhkan Otorisasi Pemilik

Sebelum operasional transaksi nyata dinyatakan dimulai (*Go-Live*), pemilik toko diminta untuk:

1. [ ] **Menyetujui Penguncian Akun Pengujian ID 2:** Mengotorisasi pengubahan hash sandi User ID 2 menjadi hash terblokir permanen (tombstone) tanpa menghapus baris record.
2. [ ] **Mengonfirmasi Penyimpanan Kunci Pemulihan:** Menyimpan salinan rahasia `APP_KEY` di brankas kata sandi pemilik di luar PC kasir.
3. [ ] **Menyelesaikan Sinkronisasi Off-Site:** Menyalin pasangan backup terbaru (`mfms_backup_2026-11-18_132339...`) ke media USB atau Google Drive/OneDrive pribadi.
4. [ ] **Menandatangani Formulir Penerimaan Akhir:** Memutuskan penerimaan sistem pada Bagian 7 di bawah ini.

---

## 7. Formulir Keputusan Penerimaan Akhir Pemilik (Owner Acceptance Form)

*(Kolom di bawah ini sengaja dibiarkan kosong untuk diisi dan ditandatangani secara nyata oleh Operator Toko dan Pemilik Toko)*

### Pernyataan Operator Toko:
> "Saya telah menguji 12 skenario harian dan memahami alur kerja operasional, batas sistem tanpa peran (non-RBAC), serta SOP backup harian toko."

- **Nama Operator:** `________________________________________`
- **Tanggal Uji Operator:** `______ / ____________ / 2026`
- **Tanda Tangan Operator:**  
  <br>
  `________________________________________`

---

### Keputusan Penerimaan Pemilik Toko (Owner Decision):
*(Beri tanda silang [X] pada salah satu kotak keputusan)*

- [ ] **DITERIMA (APPROVED FOR LOCAL PILOT):** Sistem disetujui untuk digunakan mencatat transaksi operasional nyata toko Mutiara Florist dengan prosedur pengamanan yang telah diverifikasi.
- [ ] **DITUNDA (REJECTED / PENDING CORRECTIONS):** Penggunaan sistem ditunda hingga catatan temuan berikut diselesaikan:  
  `__________________________________________________________________________________________`  
  `__________________________________________________________________________________________`

- **Nama Pemilik Toko:** `________________________________________`
- **Tanggal Keputusan:** `______ / ____________ / 2026`
- **Tanda Tangan Pemilik Toko:**  
  <br>
  `________________________________________`

---
*Laporan ini disusun secara objektif dan akurat berdasarkan kondisi aktual sistem tanpa pemalsuan otorisasi atau modifikasi data operasional.*
