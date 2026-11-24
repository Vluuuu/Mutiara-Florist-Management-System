# MFMS — Phase 12H: Final Pre-Pilot Closure & Owner Acceptance Handoff

**Mutiara Florist Management System (MFMS)**  
**Waktu Penyusunan:** 19 November 2026 (WIB / `Asia/Jakarta`)  
**Baseline Git Main:** `45d3b7e411e16ba2f45ca3b367a9addadbb722c2`  
**Status Kesiapan:** **PILOT READY (PENDING HUMAN SIGN-OFF)**

---

## 1. Executive Summary

Dokumen Phase 12H ini merupakan rangkuman penutupan keselamatan operasional akhir (*Final Pre-Pilot Closure*) sebelum toko Mutiara Florist memulai **Pilot Operasional Lokal Terbatas**.

Seluruh rangkaian pengujian fungsional operator, evaluasi usability, audit keamanan operasional, pencadangan fisik, dan penguncian akun demo historis telah tuntas dengan hasil **100% LULUS (ALL GATES PASS)**:
1. **Human UAT:** 12 dari 12 skenario operasional harian lulus diverifikasi langsung oleh operator manusia.
2. **Usability Evaluation:** 5 dari 5 evaluasi kemudahan antarmuka Botanical Studio Workspace terbukti intuitif.
3. **Audit Kunci Pemulihan:** Salinan `APP_KEY` telah diamankan secara privat oleh pemilik toko di Password Manager luar komputer toko.
4. **Penguncian Akun Demo (User ID 2):** Kredensial telah dicabut secara permanen menggunakan hash acak 256-bit unrecoverable, sesi dibersihkan, dan percobaan login web ditolak secara bersih tanpa merusak foreign key maupun 14 catatan audit log historis.
5. **Snapshot Backup Pascapenguncian:** File cadangan baru `mfms_backup_2026-11-19_222933_701075_b641435d.enc` berhasil dibuat dan terbukti valid didekripsi in-memory dengan kunci pemulihan aktif.
6. **Pembersihan Skrip Sementara:** Seluruh artefak QA sementara Phase 12G telah diaudit dan dibersihkan dari lingkungan kerja.

---

## 2. Hasil Task 1 — Verifikasi Backup Pascapenguncian (*Post-Lock Backup*)

Snapshot basis data terenkripsi baru berhasil dibuat setelah User ID 2 terkunci:
- **File Enkripsi:**  
  `storage/app/backups/mfms_backup_2026-11-19_222933_701075_b641435d.enc` (9.139 bytes)
- **File Metadata Pasangan:**  
  `storage/app/backups/mfms_backup_2026-11-19_222933_701075_b641435d.meta.json` (1.354 bytes)
- **Waktu Pembuatan:** `2026-11-19 22:29:33 WIB`
- **Algoritma Sandi:** `AES-256-GCM` dengan Authenticated Additional Data (`AAD`)
- **Checksum SHA-256 (Plaintext Payload):**  
  `0e226ad66b8ef63b06f3e8e1122c5ffe5f509b45b24edbbe1d92d44736c89679`
- **Hash SHA-256 File Ciphertext:**  
  `9EE80ED16EB93D2517BD36BD5714C93112D53E4E52851B2726EB4AF7D6C1CB13`
- **Hash SHA-256 File Metadata:**  
  `9468803EF009130CC2BAC0103F70FA91AFCD6A36D8EC4E26659E0BE435BF6C68`

### Uji Dekripsi Terisolasi Tanpa Restore Operasional
Uji dekripsi in-memory membuktikan:
- Dekripsi `AES-256-GCM` + `AAD` berhasil 100% menggunakan `APP_KEY` aktif.
- Payload mencerminkan kondisi terbaru: User ID 2 memuat hash sandi baru (`5bb54992d38bf5a9`) dan `remember_token: NULL`.
- Seluruh 9 tabel inti dan nominal keuangan tercatat utuh.
- **Basis data operasional sama sekali tidak disentuh.**

### Verifikasi Salinan Flashdisk USB (Drive E:\MFMS-Backups\)
Perangkat penyimpanan USB Flashdisk (Drive `E:`, FAT32, label `UBUNTU 26_0`) terdeteksi aktif. Sepasang file cadangan pascapenguncian telah disalin ke folder `E:\MFMS-Backups\` dan diverifikasi secara kriptografis:

| File Backup Pascapenguncian | Lokasi Operasional (Drive D:) | Lokasi Salinan Flashdisk (E:\MFMS-Backups\) | Nilai Expected SHA-256 | Status Verifikasi |
| --- | --- | --- | --- | :---: |
| `mfms_backup_2026-11-19_222933_701075_b641435d.enc` (9.139 bytes) | `9EE80ED16EB93D2517BD36BD5714C93112D53E4E52851B2726EB4AF7D6C1CB13` | `9EE80ED16EB93D2517BD36BD5714C93112D53E4E52851B2726EB4AF7D6C1CB13` | `9EE80ED16EB93D2517BD36BD5714C93112D53E4E52851B2726EB4AF7D6C1CB13` | **IDENTIK 100% (PASS)** |
| `mfms_backup_2026-11-19_222933_701075_b641435d.meta.json` (1.354 bytes) | `9468803EF009130CC2BAC0103F70FA91AFCD6A36D8EC4E26659E0BE435BF6C68` | `9468803EF009130CC2BAC0103F70FA91AFCD6A36D8EC4E26659E0BE435BF6C68` | `9468803EF009130CC2BAC0103F70FA91AFCD6A36D8EC4E26659E0BE435BF6C68` | **IDENTIK 100% (PASS)** |

- **Preservasi Backup Historis:** File backup pra-penguncian (`mfms_backup_2026-11-19_214215_719880_a13fb449.*`) tetap tersimpan utuh di flashdisk dan tidak dihapus.
- **Status Gerbang Backup Off-Site:** **COMPLETE (PASS)**.


---

## 3. Hasil Task 2 — Audit & Pembersihan Skrip Sementara

Pemeriksaan keamanan terhadap skrip QA sementara Phase 12G:
1. `execute_authorized_lock.php`
2. `test_http_login.php`
3. `test_http_login_with_csrf.php`
4. `final_db_reconciliation.php`

**Hasil Audit:**
- Tidak ada skrip yang disimpan di folder publik (`public/`).
- Tidak memuat kredensial atau password teks biasa yang tersimpan (secret dihasilkan di memori dan langsung di-`unset`).
- Tidak dapat dipanggil melalui web server publik.
- Tidak pernah dimasukkan ke dalam Git (`git status` bersih dari skrip PHP ini).
- **Tindakan Pembersihan:** Seluruh 4 file di atas telah dihapus secara aman dari direktori scratch.

---

## 4. Hasil Task 3 — Final Readiness Check (Read-Only)

| Parameter Pemeriksaan | Nilai Terukur / Status | Kriteria | Hasil |
| --- | --- | --- | :---: |
| **Status Akun Demo (User ID 2)** | Terkunci hash acak unrecoverable, 0 sesi aktif, `remember_token = NULL` | Kredensial lama dicabut total | **PASS** |
| **Status Akun Operator (User ID 1)** | Hash tidak berubah (`305b24a2c345f72b`), login normal | Akses operator tetap aktif | **PASS** |
| **Mode Debug Laravel** | `APP_DEBUG=false` pada runtime dan file `.env` | Debug teknis nonaktif | **PASS** |
| **Binding Jaringan Port 8000** | Eksklusif `127.0.0.1:8000` (PID `9896`, PHP 8.2 CLI) | Tidak terbuka ke LAN/Wi-Fi | **PASS** |
| **Integritas Nominal Keuangan** | Pesanan: Rp1.600.000 \| Kas Masuk: Rp1.300.000 \| Kas Keluar: Rp100.000 | 0 mutasi transaksi | **PASS** |
| **Integritas Tabel Inti** | 9 tabel (users: 2, customers: 2, orders: 2, order_items: 4, payments: 2, categories: 1, expenses: 1, audit: 17, migrations: 6) | 100% konsisten | **PASS** |
| **Backup Off-Site USB (Pascapenguncian)** | `E:\MFMS-Backups\` memuat `.enc` dan `.meta.json` pascapenguncian dengan hash SHA-256 identik | Salinan fisik off-site terverifikasi | **PASS (COMPLETE)** |
| **Kebersihan Repository Git** | Tidak ada file rahasia, `.env`, atau kode liar yang ter-stage | Git tree terkontrol | **PASS** |

---

## 5. Task 4 — Rekomendasi Tahapan Operasional & Batasan Non-RBAC

### 5.1 Rekomendasi: Mulai dengan Pilot Operasional Lokal Terbatas
Sistem MFMS saat ini dibangun dan dioptimalkan secara ketat untuk **komputer kasir desktop tunggal (Single-PC Windows XAMPP)** pada alamat lokal `http://127.0.0.1:8000`.

**Rekomendasi Arsitektur:**
- **JANGAN** langsung mengekspos sistem ini ke internet publik, VPS cloud multi-tenant, atau jaringan luar tanpa lapisan autentikasi jaringan khusus (VPN/Reverse Proxy).
- **MULAI DENGAN PILOT LOKAL TERBATAS (1–2 BULAN):** Gunakan sistem hanya di komputer kasir toko untuk mencatat transaksi harian, melayani pesanan florist nyata, mencatat pelunasan bertahap, dan mencetak laporan Excel bulanan.
- Evaluasi stabilitas sebelum mempertimbangkan ekspansi multi-cabang atau multi-device.

### 5.2 Batasan Arsitektur Non-RBAC yang Wajib Disepakati Pemilik
- **Tidak Ada Pembagian Peran Kasir vs Pemilik:** Tabel `users` belum memiliki kolom `role`. Semua akun yang berhasil masuk memiliki akses penuh ke pencatatan pesanan, pembatalan pembayaran (*void*), pengeluaran kas toko, dan laporan keuangan laba-rugi.
- **SOP Wajib Operator:** Operator wajib menekan tombol **Keluar Akun** setiap kali meninggalkan komputer kasir agar sesi tidak disalahgunakan.

### 5.3 SOP Pencadangan Data Harian & Penyimpanan Off-Site
1. **Setiap Toko Tutup (Harian / Akhir Pekan):**
   - Buka PowerShell di folder MFMS dan ketik: `php artisan mfms:backup`.
   - Colokkan USB Flashdisk toko (Drive `E:`).
   - Salin sepasang file terbaru (`.enc` dan `.meta.json`) ke folder `E:\MFMS-Backups\`.
   - Cabut flashdisk secara aman (*Safely Remove Hardware*) dan bawa pulang oleh pemilik toko.
2. **Kunci Pemulihan Bencana:**
   - Kunci `APP_KEY` wajib dijaga di Password Manager pemilik toko. Dilarang merotasi `APP_KEY` tanpa re-enkripsi backup.

---

## 6. Formulir Penerimaan Akhir Pemilik Toko & Operator (Owner Acceptance Form)

*(Kolom di bawah ini sengaja dibiarkan kosong untuk diisi dan ditandatangani secara nyata oleh Operator Toko dan Pemilik Toko)*

### A. Pernyataan & Konfirmasi Operator Toko:
> "Saya telah menguji 12 skenario operasional harian, mengonfirmasi kemudahan navigasi 5 menu utama, memahami batas sistem tanpa peran (non-RBAC), dan siap menjalankan SOP pencadangan data toko."

- **Nama Operator Toko:** `________________________________________`
- **Tanggal Uji Operator:** `______ / ____________ / 2026`
- **Tanda Tangan Operator:**  
  <br>
  `________________________________________`

---

### B. Keputusan Penerimaan Pilot Operasional oleh Pemilik Toko:
*(Beri tanda silang [X] pada salah satu kotak keputusan)*

- [ ] **DITERIMA (APPROVED FOR LIMITED LOCAL OPERATIONAL PILOT):** Seluruh gerbang keselamatan teknis telah diverifikasi (UAT 12/12 PASS, Usability 5/5 PASS, Security Gates PASS). Sistem Mutiara Florist Management System disetujui untuk mulai beroperasi secara nyata pada komputer lokal toko.
- [ ] **DITUNDA (REJECTED / PENDING FURTHER REVIEW):** Pengoperasian sistem ditunda hingga instruksi tertulis berikutnya:  
  `__________________________________________________________________________________________`  
  `__________________________________________________________________________________________`

- **Nama Pemilik Toko:** `________________________________________`
- **Tanggal Keputusan:** `______ / ____________ / 2026`
- **Tanda Tangan Pemilik:**  
  <br>
  `________________________________________`

---
*Laporan resmi ini disimpan pada file [PHASE12H_FINAL_PRE_PILOT_CLOSURE.md](PHASE12H_FINAL_PRE_PILOT_CLOSURE.md). Baseline Git main tetap pada commit `45d3b7e411e16ba2f45ca3b367a9addadbb722c2` tanpa ada release tag atau merge otomatis yang dibuat.*
