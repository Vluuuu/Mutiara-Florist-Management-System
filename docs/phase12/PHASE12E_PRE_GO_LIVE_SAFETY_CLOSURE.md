# MFMS — Phase 12E: Pre-Go-Live Safety Closure Report

**Mutiara Florist Management System (MFMS)**  
**Tanggal Audit & Penyusunan:** 19 November 2026 (WIB / `Asia/Jakarta`)  
**Baseline Git Main:** `45d3b7e411e16ba2f45ca3b367a9addadbb722c2`  
**Status Saat Ini:** **OWNER APPROVAL PENDING (RELEASE NOT AUTHORIZED)**

---

## 1. Tujuan Dokumen

Dokumen ini disusun sebagai panduan penutupan keselamatan operasional tahap akhir (*Pre-Go-Live Safety Closure*) berdasarkan temuan audit Phase 12D. Seluruh instruksi dan prosedur di bawah ini dirancang untuk:
1. Menjamin kesiapan pemulihan bencana (*disaster recovery*) tanpa mengekspos rahasia sistem.
2. Menyediakan prosedur terkontrol untuk mengunci akun demo (User ID 2) secara permanen tanpa merusak integritas foreign key dan log audit.
3. Memastikan pemisahan yang jelas antara hasil uji teknis, bukti pencadangan, pemahaman batasan arsitektur (non-RBAC), dan persetujuan resmi pemilik toko.
4. **Menjaga zero-mutation pada basis data operasional** sampai pemilik toko secara eksplisit memberikan otorisasi tertulis.

---

## 2. Bagian A — Backup & Recovery Readiness

### 2.1 Audit Arsip Backup Operasional Terbaru
Pemeriksaan dilakukan terhadap folder `storage/app/backups/`:
- **Total Arsip Terdeteksi:** 5 pasang file `.enc` dan `.meta.json`.
- **Arsip Terbaru:** `mfms_backup_2026-11-18_132339_819052_efcfd405.enc` (9.139 bytes).
- **Pasangan Metadata:** `mfms_backup_2026-11-18_132339_819052_efcfd405.meta.json` (1.354 bytes).
- **Waktu Pembuatan:** `2026-11-18 13:23:39 WIB`.
- **Sandi Kriptografi:** `AES-256-GCM` dengan Authenticated Additional Data (`AAD`).
- **Checksum SHA-256 (Integritas Plaintext):** `a6e0c490918bdbc193f0a4fb1d975ed9ec67389e24ef4b65803e3009302a17f1`.
- **Sidik Jari Kunci (*Key Fingerprint*):** `3afe4eed7ab7dc6f` (cocok 100% dengan turunan `APP_KEY` aktif).

### 2.2 Verifikasi Rekonsiliasi Database vs Backup Terbaru
Pemeriksaan agregasi read-only terhadap database operasional `mutiara_florist` membuktikan bahwa data operasional saat ini **100% identik** dengan snapshot backup terbaru:
- `users`: 2 baris (Match)
- `customers`: 2 baris (Match)
- `orders`: 2 baris (Match) & Total Nilai: Rp1.600.000 (Match)
- `order_items`: 4 baris (Match)
- `payments`: 2 baris (Match) & Kas Masuk Sah: Rp1.300.000 (Match)
- `expense_categories`: 1 baris (Match)
- `expenses`: 1 baris (Match) & Kas Keluar Sah: Rp100.000 (Match)
- `audit_logs`: 17 baris (Match)
- `migrations`: 6 baris (Match)

*Perubahan data operasional sejak snapshot dibuat:* **0 baris, Rp0 perubahan**.

### 2.3 Investigasi Kritis Sinkronisasi Off-Site (OneDrive & USB)
Pemeriksaan mendalam terhadap status sinkronisasi cloud:
1. **Temuan Folder OneDrive (`C:\Users\dewog\OneDrive\MFMS-Backups`):**
   - File yang ada di folder tersebut adalah arsip lama: `mfms_backup_2026-11-18_101440...`.
   - Arsip terbaru (`18 Nov 13:23:39`) **belum disalin** ke folder OneDrive.
2. **Status Sinkronisasi Shell Windows (StorageProviderState):**
   - Properti Shell Windows [311] untuk folder `MFMS-Backups` melaporkan status: **`Availability status = Error`**.
   - Ini membuktikan bahwa file yang berada di folder lokal OneDrive **belum tentu berhasil terunggah ke Cloud Microsoft**. Adanya file di folder lokal komputer kasir tidak menjamin tersedianya cadangan off-site jika komputer kasir rusak.
3. **Penyimpanan Fisik Eksternal (USB):**
   - Tidak ada media USB / removable disk yang terpasang pada komputer saat audit.

### 2.4 Petunjuk Pengamanan Rahasia `APP_KEY` untuk Pemilik Toko
Karena `BackupService` menggunakan fallback ke `APP_KEY`, file cadangan `.enc` **mustahil didekripsi** jika komputer kasir rusak tanpa adanya salinan kunci ini di luar komputer.

**Panduan Langkah Pemilik (Lakukan Secara Mandiri & Pribadi):**
1. Buka terminal PowerShell pada komputer kasir (pastikan tidak ada pihak luar yang melihat).
2. Jalankan perintah untuk melihat kunci aplikasi:
   ```powershell
   Get-Content .env | Select-String "APP_KEY="
   ```
3. Catat nilai string `APP_KEY=base64:...` tersebut ke dalam salah satu media aman di luar PC kasir:
   - **Password Manager Pribadi Pemilik** (Bitwarden, 1Password, KeePass, atau Apple Keychain) dengan judul: `MFMS Operational Key & Backup Decryption Key`.
   - Atau simpan pada catatan terenkripsi / brankas fisik pribadi pemilik.
4. **DILARANG KERAS:**
   - Membagikan atau mengirim teks `APP_KEY` melalui aplikasi chat publik, email, atau repository Git.
   - Menjalankan perintah `php artisan key:generate` pada komputer toko (akan merusak kemampuan dekripsi seluruh backup historis).
   - Mengubah `BACKUP_ENCRYPTION_KEY` tanpa rencana migrasi kunci terstruktur.

### 2.5 Rencana Pembuatan Backup Baru & Penyalinan Off-Site Terverifikasi
Sebelum tindakan penonaktifan akun demo atau operasional perdana:
1. Jalankan pembuatan backup baru dari snapshot konsisten:
   ```powershell
   php artisan mfms:backup
   ```
2. Salin pasangan `.enc` dan `.meta.json` baru tersebut ke 2 tujuan:
   - Folder OneDrive: `C:\Users\dewog\OneDrive\MFMS-Backups`
   - Flashdisk USB toko (misal drive `E:\MFMS-Backups\`)
3. Periksa ikon tray OneDrive di pojok kanan bawah Windows:
   - Pastikan status sinkronisasi berubah menjadi tanda centang hijau (*Up to date / Available on this device*), dan tidak ada notifikasi error.

---

## 3. Bagian B — Demo Account Lock (Approval-Gated Plan)

**Target:** Akun User ID 2 (`disabled-qa-2@disabled.invalid`) pada basis data `mutiara_florist`.

### 3.1 Profil Akun & Dependensi Data
- **ID:** `2`
- **Nama:** `Nonaktif - Eks Akun Pengujian`
- **Email:** `disabled-qa-2@disabled.invalid`
- **Terkait pada Transaksi:**
  - `orders`: Pembuat Order #2 (dikunci oleh Foreign Key `restrictOnDelete`)
  - `payments`: Pencatat Payment #1 dan #2 (dikunci oleh Foreign Key `restrictOnDelete`)
  - `expenses`: Pencatat Expense #1 (dikunci oleh Foreign Key `restrictOnDelete`)
  - `audit_logs`: Pelaku pada 14 catatan log historis (dikunci oleh Foreign Key `nullOnDelete`)

### 3.2 Alasan Mutlak Larangan `DELETE`
Menghapus baris akun ID 2 akan memicu pelanggaran integritas referensial (MariaDB Error 1451). Memaksakan penghapusan dengan menonaktifkan foreign key akan memutus rantai pertanggungjawaban transaksi (*audit trail*) dan membuat relasi finansial menjadi tidak valid. Oleh karena itu, pendekatan yang digunakan adalah **Akun Tombstone Terkunci Permanen**.

### 3.3 Spesifikasi Prosedur Penguncian Akun (Menunggu Otorisasi Pemilik)
Setelah pemilik toko memberikan persetujuan tertulis, prosedur teknis dieksekusi dengan urutan yang ketat:

1. **Pembuatan Rahasia Acak Kriptografis Sekali Pakai (In-Memory Unrecoverable Hash):**
   - Menghasilkan string acak berkekuatan tinggi:
     `$secret = bin2hex(random_bytes(32));` (256-bit entropy).
   - Menghasilkan hash bcrypt:
     `$hash = Hash::make($secret);`
   - Menghapus variabel `$secret` dari memori segera setelah hash terbentuk (`unset($secret)`).
   - Secret acak tersebut **tidak pernah dicatat, tidak pernah ditampilkan di layar, dan tidak pernah disimpan di disk**.
2. **Pencabutan Kredensial & Token:**
   - Menimpa nilai `password` pada User ID 2 dengan hash tak terbalikkan di atas.
   - Mengosongkan kolom `remember_token` (`remember_token = NULL`).
   - Memastikan email tetap `@disabled.invalid`.
3. **Invalidasi Sesi Aktif:**
   - Karena MFMS menggunakan driver sesi database (`SESSION_DRIVER=database`), seluruh sesi yang terasosiasi dengan User ID 2 dihapus seketika:
     ```php
     DB::table('sessions')->where('user_id', 2)->delete();
     ```
4. **Verifikasi Penolakan Login Akun Demo:**
   - Melakukan uji coba login pada form `/login` menggunakan email `disabled-qa-2@disabled.invalid` dan sembarang password.
   - Hasil yang wajib terpenuhi: Sistem merespons pesan validasi standar (*"Email atau kata sandi tidak cocok."*) dengan kode HTTP 302/200, **tanpa error internal HTTP 500**.
5. **Verifikasi Login Operator Resmi:**
   - Menguji login akun resmi operator utama (User ID 1) untuk memastikan akses harian toko tetap lancar 100%.
6. **Verifikasi Integritas Transaksi Pasca Tindakan:**
   - Memverifikasi ulang bahwa `orders` (2 nota, Rp1.600.000), `payments` (2 pembayaran, Rp1.300.000), `expenses` (1 pengeluaran, Rp100.000), dan `audit_logs` (17 baris) tidak mengalami perubahan nilai atau baris.
7. **Prosedur Rollback Terkontrol:**
   - Karena User ID 2 adalah akun uji coba historis yang tidak boleh digunakan lagi, pembatalan penguncian (*rollback*) **tidak diperkenankan secara otomatis**. Jika dalam skenario pemulihan bencana darurat akun ini perlu diakses kembali di database testing, pengelola hanya boleh melakukannya melalui perintah CLI terisolasi atas persetujuan tertulis pemilik toko.

---

## 4. Bagian C — Final Acceptance Package (Terpisah)

### 4.1 Bukti Pengujian Fungsional Operator (12 Skenario Human UAT)
| No | Skenario Uji Operasional | Hasil Uji Operator Manusia |
| --- | --- | :---: |
| 1 | Menyalakan sistem dengan `Start-MFMS.bat` (MariaDB port 3307 & web 127.0.0.1:8000) | **PASS** |
| 2 | Login dengan akun operator resmi | **PASS** |
| 3 | Tambah & cari pelanggan (`/ui-customers`) | **PASS** |
| 4 | Buat pesanan multi-item (`INCLUDED` & `SEPARATE`) | **PASS** |
| 5 | Catat DP, cicilan, pelunasan, & tolak overpay | **PASS** |
| 6 | Progres item bunga (`Mulai Proses` &rarr; `Siap kirim` &rarr; `Terkirim` & konfirmasi) | **PASS** |
| 7 | Catat pengeluaran operasional toko (`/ui-expenses`) | **PASS** |
| 8 | Buka Laporan & klik **Unduh Excel (.xlsx)** lalu buka di GUI Microsoft Excel | **PASS** |
| 9 | Akses tampilan pada layar smartphone / layar sempit | **PASS** |
| 10 | Klik **Keluar Akun** lalu konfirmasi **Keluar Sekarang** (tanpa error 419) | **PASS** |
| 11 | Jalankan `php artisan mfms:backup` & verifikasi arsip | **PASS** |
| 12 | Matikan sistem dengan `Stop-MFMS.bat` secara bersih | **PASS** |

### 4.2 Bukti Evaluasi Usability Operator (5/5)
- Operator dapat menemukan tombol yang diperlukan tanpa panduan teknis: **YA (PASS)**
- Istilah menu Botanical Studio mudah dipahami: **YA (PASS)**
- Perbedaan nilai pesanan, kas masuk sah, dan piutang dipahami: **YA (PASS)**
- Prosedur pembatalan catatan (*void*) dipahami: **YA (PASS)**
- Penanganan saat peringatan konflik idempotensi dipahami: **YA (PASS)**

### 4.3 Bukti Pencadangan & Kesiapan Pemulihan
- Enkripsi `AES-256-GCM` dengan Authenticated Additional Data (`AAD`): **TERVERIFIKASI**
- Checksum integritas plaintext `SHA-256`: **VALID**
- Snapshot read-only tidak mengubah data toko: **TERVERIFIKASI**
- Uji restorasi terisolasi ke database testing `mariadb_testing`: **VALID (100% rekonsiliasi data & metrik)**
- Kesiapan sinkronisasi off-site ke OneDrive & USB: **MENUNGGU PENYELESAIAN OLEH PEMILIK (STATUS ERROR PADA ONEDRIVE)**

### 4.4 Status Penonaktifan Akun Demo
- Akun demo User ID 2 dialihkan ke domain RFC non-routable `.invalid`: **SELESAI**
- Rencana penguncian permanen hash password & sesi: **SIAP DIEKSEKUSI (APPROVAL PENDING)**
- Jaminan proteksi foreign key transaksi & audit log: **TERPELIHARA (TIDAK ADA RECORD DIHAPUS)**

### 4.5 Pengakuan Batasan Sistem (Non-RBAC Acknowledged)
- **Status:** **DIKONFIRMASI OLEH OPERATOR & PENGELOLA**.
- Disepakati bahwa seluruh akun terdaftar saat ini memiliki hak akses setara terhadap seluruh fitur (pelanggan, pesanan, kas masuk, pengeluaran, pembatalan catatan, dan laporan keuangan).
- Disepakati SOP pengamanan fisik PC kasir dan kewajiban menekan **Keluar Akun** setiap kali operator meninggalkan komputer.

---

## 5. Checklist Kesiapan Pra-Go-Live & Otorisasi Pemilik

| No | Item Checklist | Status Saat Ini | Otorisasi Pemilik Diperlukan? |
| --- | --- | :---: | :---: |
| 1 | 12/12 Skenario Human UAT Lulus | **LULUS** | Tidak (Sudah diverifikasi operator) |
| 2 | 5/5 Evaluasi Usability Lulus | **LULUS** | Tidak (Sudah diverifikasi operator) |
| 3 | Pemahaman batasan Non-RBAC | **DIKONFIRMASI** | Ya (Tandatangan pengakuan) |
| 4 | `APP_DEBUG=false` & Localhost 127.0.0.1 | **LULUS** | Tidak (Sudah aktif & terverifikasi) |
| 5 | Salinan rahasia `APP_KEY` tersimpan di password manager pemilik | **MENUNGGU TINDAKAN** | **YA (Tindakan Mandiri Pemilik)** |
| 6 | Sinkronisasi backup terbaru ke OneDrive & Flashdisk toko | **MENUNGGU TINDAKAN** | **YA (Tindakan Mandiri Pemilik)** |
| 7 | Eksekusi Penguncian Sandi & Sesi Akun Demo ID 2 | **TERKUNCI / GATED** | **YA (Menunggu Otorisasi Pemilik)** |
| 8 | Penandatanganan Formulir Penerimaan Akhir Go-Live | **PENDING** | **YA (Keputusan Pemilik)** |

---

## 6. Formulir Keputusan Penerimaan Akhir Pemilik (Owner Acceptance Form)

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
*Laporan ini dipersiapkan secara obyektif tanpa memalsukan tanda tangan atau memodifikasi data operasional apa pun.*
