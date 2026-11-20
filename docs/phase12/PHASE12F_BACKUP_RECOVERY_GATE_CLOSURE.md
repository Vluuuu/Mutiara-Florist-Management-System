# MFMS — Phase 12F: Backup & Recovery Gate Closure Report

**Mutiara Florist Management System (MFMS)**  
**Tanggal Verifikasi:** 19 November 2026 (WIB / `Asia/Jakarta`)  
**Baseline Git Main:** `45d3b7e411e16ba2f45ca3b367a9addadbb722c2`  
**Status Kesiapan:** **CONDITIONAL (GO-LIVE NOT AUTHORIZED)**

---

## 1. Executive Summary

Laporan Phase 12F mendokumentasikan hasil verifikasi teknis dan diagnostik mendalam terhadap seluruh celah keamanan pra-go-live yang teridentifikasi pada Phase 12E:
1. **Pembuatan Snapshot Baru Terenkripsi:** Snapshot database operasional terbaru berhasil dibuat secara konsisten (*consistent read-only snapshot*) dengan enkripsi `AES-256-GCM` dan rekonsiliasi data 100% cocok.
2. **Diagnosis Definitif Sinkronisasi OneDrive:** Ditemukan bukti teknis bahwa OneDrive lokal mengalami kendala kuota cloud (*Quota Wall / ItemCantFitInQuota*) sehingga folder `MFMS-Backups` berstatus `Error` dan file backup **tidak dapat terunggah ke Cloud Microsoft**.
3. **Status Kunci Pemulihan (*Recovery Key*):** Panduan handoff privat disusun untuk pemilik toko; status ditandai **PENDING** sampai pemilik mengonfirmasi ketersediaan salinan di luar komputer kasir.
4. **Status Akun Demo (User ID 2):** Akun tetap dipertahankan tanpa perubahan (*zero mutation*); checkpoint otorisasi formal disiapkan; status ditandai **PENDING**.
5. **Keputusan Go-Live:** **BELUM DIIZINKAN (NOT AUTHORIZED)**.

---

## 2. Task 1 — Verifikasi Backup Operasional Terbaru

Snapshot konsisten baru berhasil dieksekusi menggunakan perintah resmi tanpa mengubah basis data:
```powershell
php artisan mfms:backup
```

### 2.1 Spesifikasi Arsip Backup Baru
- **File Enkripsi:**  
  `storage/app/backups/mfms_backup_2026-11-19_214215_719880_a13fb449.enc` (9.139 bytes)
- **File Metadata Pasangan:**  
  `storage/app/backups/mfms_backup_2026-11-19_214215_719880_a13fb449.meta.json` (1.354 bytes)
- **Waktu Pembuatan:** `2026-11-19 21:42:15 WIB` (`Asia/Jakarta`)
- **Algoritma Sandi:** `AES-256-GCM` dengan Authenticated Additional Data (`AAD`)
- **Checksum Integritas (SHA-256 Plaintext):**  
  `89d6aff151047f7b876f72eda23a08b2da6b206a2074e377beb194b0623cce55`
- **Tag Autentikasi GCM:** `94Jcakg9AQjkHqhiSgtI6Q==`
- **Sidik Jari Kunci (*Key Fingerprint*):** `3afe4eed7ab7dc6f` (cocok 100% dengan turunan `APP_KEY` aktif)

### 2.2 Hasil Rekonsiliasi Read-Only dengan Database Operasional
| Tabel | Jumlah Baris di Database | Jumlah Baris di Backup Baru | Status Rekonsiliasi |
| --- | :---: | :---: | :---: |
| `users` | 2 | 2 | **IDENTIK (MATCH)** |
| `customers` | 2 | 2 | **IDENTIK (MATCH)** |
| `orders` | 2 | 2 | **IDENTIK (MATCH)** |
| `order_items` | 4 | 4 | **IDENTIK (MATCH)** |
| `payments` | 2 | 2 | **IDENTIK (MATCH)** |
| `expense_categories` | 1 | 1 | **IDENTIK (MATCH)** |
| `expenses` | 1 | 1 | **IDENTIK (MATCH)** |
| `audit_logs` | 17 | 17 | **IDENTIK (MATCH)** |
| `migrations` | 6 | 6 | **IDENTIK (MATCH)** |

**Metrik Keuangan:**
- Total Nilai Pesanan: `Rp1.600.000` (Identik)
- Kas Masuk Sah (`POSTED`): `Rp1.300.000` (Identik)
- Kas Keluar Sah (`POSTED`): `Rp100.000` (Identik)
- Selisih Kas: `Rp1.200.000` (Identik)

*Selama proses backup, 0 baris termutasi dan 0 transaksi diubah.*

---

## 3. Task 2 — Diagnosis Sinkronisasi Off-Site & Solusi Alternatif

### 3.1 Bukti Diagnostik Kegagalan Sinkronisasi OneDrive
Investigasi mendalam pada registri dan Shell Windows mengungkap penyebab definitif mengapa OneDrive berstatus error:
1. **Properti Shell Windows [311]:** Folder `C:\Users\dewog\OneDrive\MFMS-Backups` dan file di dalamnya berstatus **`Availability status = Error`**.
2. **Penyebab Utama (Bukti Registri Akun Personal):**
   - Kunci registri `HKCU:\Software\Microsoft\OneDrive\Accounts\Personal` mencatat parameter kritis:
     - `ItemCantFitInQuotaTimesShown: 2`
     - `QuotaWallTimestamp: 1795097153`
     - `LastShownQuotaToast: 60`
     - `LastKnownIsPaidUser: 0`
   - **Kesimpulan:** Akun OneDrive personal di komputer ini telah mencapai **batas maksimum kuota penyimpanan cloud (100% Full / Quota Wall)**.
   - **Dampak Keamanan:** Seluruh sinkronisasi cloud terhenti. Menyalin file ke folder `C:\Users\dewog\OneDrive\MFMS-Backups` **hanya menempatkan file di harddisk internal yang sama**, dan **sama sekali tidak terunggah ke Cloud Microsoft**.
3. **Status Verifikasi Off-Site Saat Ini:** **FAIL (BELUM TERSINKRONISASI OFF-SITE)**.

### 3.2 Rekomendasi Solusi Off-Site Mandiri (Metode Flashdisk USB)
Mengingat kuota OneDrive komputer kasir habis, solusi off-site tercepat, paling andal, dan tidak bergantung pada kuota internet adalah **Penyalinan Fisik ke Flashdisk Toko**:

**Prosedur SOP Harian Toko:**
1. Siapkan 1 unit flashdisk khusus (misal diberi label `MFMS BACKUP DRIVE`).
2. Tancapkan ke komputer kasir.
3. Buat folder di flashdisk: `E:\MFMS-Backups\` (sesuaikan huruf drive).
4. Salin sepasang file backup terbaru dari folder `storage\app\backups\`:
   - `mfms_backup_2026-11-19_214215_719880_a13fb449.enc`
   - `mfms_backup_2026-11-19_214215_719880_a13fb449.meta.json`
5. Lepas flashdisk secara aman (*Safely Remove Hardware*).
6. Simpan flashdisk di brankas toko atau bawa pulang oleh pemilik toko setiap toko tutup.

*Sebagai alternatif cloud:* Pemilik dapat mengunggah kedua file tersebut secara manual melalui browser ke Google Drive pribadi pemilik yang masih memiliki ruang kosong.

---

## 4. Task 3 — Prosedur Handoff Kunci Pemulihan (`APP_KEY`) untuk Pemilik Toko

Kunci enkripsi saat ini menggunakan `APP_KEY` yang tersimpan di file `.env` komputer kasir. Jika komputer kasir dicuri atau harddisk rusak total, file cadangan `.enc` (bahkan yang ada di flashdisk) **tidak dapat didekripsi tanpa kunci ini**.

### 4.1 Panduan Langkah Pemilik (Dilakukan Mandiri di Komputer Kasir)
1. Buka jendela terminal PowerShell pada komputer kasir (pastikan layar tidak terlihat oleh staf lain).
2. Ketik perintah berikut lalu tekan Enter:
   ```powershell
   Get-Content D:\xampp\htdocs\Mutiara-Florist-Management-System\.env | Select-String "APP_KEY="
   ```
3. Di layar akan muncul satu baris berformat: `APP_KEY=base64:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=`
4. Buka aplikasi **Password Manager** pada ponsel atau laptop pribadi pemilik toko (contoh: Bitwarden, 1Password, KeePass, Apple Keychain, atau Google Password Manager).
5. Buat entri baru:
   - **Judul:** `Mutiara Florist - Master Recovery & Backup Key`
   - **Tipe:** Secure Note / Password
   - **Isi Catatan:** Masukkan seluruh string `base64:...` tersebut.
   - **Keterangan Tambahan:** *"Kunci ini wajib disimpan untuk membuka file backup .enc Mutiara Florist jika komputer toko rusak. Dilarang merotasi kunci ini di .env toko."*
6. Bersihkan layar PowerShell dengan mengetik `Clear-Host` atau tutup jendela PowerShell.

### 4.2 Aturan Keamanan Mutlak:
- **JANGAN** pernah mengirimkan string `APP_KEY` ke obrolan chat AI, agen, atau pesan instan.
- **JANGAN** menyalin seluruh file `.env` ke folder publik atau penyimpanan bersama.
- **JANGAN** menjalankan `php artisan key:generate` di komputer toko.

*Status Kunci Pemulihan:* **PENDING** (Menunggu konfirmasi pemilik bahwa kunci telah berhasil disimpan di perangkat pribadi luar toko).

---

## 5. Task 4 — Status Akun Demo & Checkpoint Otorisasi

### 5.1 Status Terkini User ID 2
- **ID:** `2`
- **Nama Terdaftar:** `Nonaktif - Eks Akun Pengujian`
- **Email Terdaftar:** `disabled-qa-2@disabled.invalid`
- **Status Basis Data:** **ZERO MUTATION (TIDAK BERUBAH)**.
- Seluruh 4 relasi transaksi (`orders`, `payments`, `expenses`) dan 14 log audit historis tetap utuh dan terpelihara.

### 5.2 Checkpoint Otorisasi Penguncian Sandi
Ketika pemilik toko telah mengonfirmasi penyimpanan `APP_KEY` dan memberikan otorisasi tertulis, sistem akan menjalankan skrip penguncian terkontrol:
1. Menghasilkan secret acak 256-bit di memori tanpa pernah mencetaknya ke layar atau file.
2. Mengganti kolom `password` pada User ID 2 dengan hash bcrypt dari secret tersebut.
3. Menyetel `remember_token = NULL`.
4. Menghapus sesi aktif User ID 2 dari tabel `sessions`.
5. Menguji bahwa login menggunakan `disabled-qa-2@disabled.invalid` ditolak secara bersih dengan pesan *"Email atau kata sandi tidak cocok"* tanpa error HTTP 500.
6. Memverifikasi operator resmi (User ID 1) tetap dapat login lancar.

---

## 6. Ringkasan Status Gate & Keputusan Pemilik

| Gate Kesiapan Operasional | Status | Keterangan / Tindakan Pemilik |
| --- | :---: | --- |
| **1. Backup Baru Terenkripsi** | **PASS** | `mfms_backup_2026-11-19_214215...` (AES-256-GCM, rekonsiliasi 100%) |
| **2. Verifikasi Off-Site** | **FAIL / PENDING** | OneDrive kuota habis (*Error*); menunggu salinan ke Flashdisk toko |
| **3. Kunci Pemulihan (`APP_KEY`)** | **PENDING** | Menunggu konfirmasi pemilik telah menyimpan kunci di password manager |
| **4. Otorisasi Akun Demo ID 2** | **PENDING** | Menunggu otorisasi tertulis pemilik untuk penguncian hash acak |
| **5. Status Go-Live** | **NOT AUTHORIZED** | Belum diizinkan mencatat transaksi nyata sebelum Gate 2, 3, & 4 tuntas |

---

## 7. Formulir Otorisasi Pemilik Toko (Owner Sign-Off Form)

*(Kolom di bawah ini sengaja dibiarkan kosong untuk ditandatangani secara fisik oleh Pemilik Toko)*

### Checklist Otorisasi Pemilik Toko:
- [ ] Saya telah menyalin teks `APP_KEY` ke password manager pribadi di luar komputer kasir.
- [ ] Saya telah menyalin file cadangan `.enc` dan `.meta.json` terbaru ke media eksternal (Flashdisk toko / Google Drive pribadi).
- [ ] Saya menyetujui penguncian permanen kata sandi dan sesi akun demo User ID 2 tanpa menghapus baris datanya.
- [ ] Saya menyetujui sistem Mutiara Florist Management System mulai digunakan untuk operasional toko (*Go-Live*).

**Nama Pemilik Toko:** `________________________________________`  
**Tanggal Persetujuan:** `______ / ____________ / 2026`  
**Tanda Tangan Pemilik:**  
<br>
`________________________________________`

---
*Laporan ini disusun secara objektif dan faktual tanpa manipulasi status atau perubahan data operasional.*
