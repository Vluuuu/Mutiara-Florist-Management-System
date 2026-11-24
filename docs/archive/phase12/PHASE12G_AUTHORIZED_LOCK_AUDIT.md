# MFMS — Phase 12G: Authorized Demo Account Security Lock Report

**Mutiara Florist Management System (MFMS)**  
**Waktu Eksekusi & Verifikasi:** 19 November 2026 (WIB / `Asia/Jakarta`)  
**Baseline Git Main:** `45d3b7e411e16ba2f45ca3b367a9addadbb722c2`  
**Status Eksekusi:** **ALL PASS (DEMO ACCOUNT LOCKED & FULL AUDIT INTACT)**

---

## 1. Executive Summary

Operasi pengamanan akun demo historis User ID 2 telah berhasil dieksekusi setelah seluruh gerbang prasyarat diverifikasi secara teknis:
1. **Verifikasi USB Flashdisk (PASS):** Perangkat penyimpanan fisik eksternal (Drive `E:`, Removable Disk, FAT32) terdeteksi. Sepasang file cadangan di flashdisk terbukti identik secara *byte-for-byte* melalui perbandingan hash SHA-256 terhadap file operasional dan file unggahan pemilik.
2. **Konfirmasi Kunci Pemulihan (CONFIRMED):** Pemilik toko mengonfirmasi bahwa nilai `APP_KEY` telah disimpan secara mandiri dan aman pada password manager pribadi di luar komputer kasir.
3. **Pemeriksaan Pra-Mutasi (PASS):** Basis data operasional `mutiara_florist`, target User ID 2 (`disabled-qa-2@disabled.invalid`), dan keterikatan seluruh transaksi historis diverifikasi utuh sebelum tindakan.
4. **Pencabutan Kredensial Terotorisasi (PASS):** Kata sandi User ID 2 diganti menggunakan hash bcrypt dari secret acak 256-bit di memori (*unrecoverable in-memory secret*), `remember_token` di-set `NULL`, dan seluruh sesi aktif dicabut.
5. **Verifikasi Pasca-Mutasi (PASS):** Percobaan login dengan akun demo ditolak secara bersih dengan respon HTTP 302 ("Email atau password tidak sesuai") tanpa error sistem. Akun operator resmi (User ID 1) tetap aktif normal.
6. **Integritas Transaksi & Audit (100% MATCH):** Seluruh 9 tabel inti dan nominal keuangan tidak mengalami perubahan apa pun.

---

## 2. Task 1 — Hasil Verifikasi Backup Flashdisk (PASS)

### 2.1 Deteksi Media Eksternal
- **Drive Letter:** `E:`
- **Tipe Media:** `Removable Disk` (`Win32_LogicalDisk DriveType: 2`)
- **Format File System:** `FAT32`
- **Volume Label:** `UBUNTU 26_0` (Kapasitas: ~15.6 GB)
- **Status:** Perangkat penyimpanan fisik eksternal (bukan disk internal dan bukan junction folder).

### 2.2 Perbandingan Hash Kriptografis SHA-256 (Byte-for-Byte Match)
| File yang Diverifikasi | Lokasi Operasional (Drive D:) | Salinan Flashdisk (Drive E:) | Salinan Unggahan Pemilik | Hasil Validasi |
| --- | --- | --- | --- | :---: |
| `mfms_backup_2026-11-19_214215_719880_a13fb449.enc` (9.139 bytes) | `D7C58375DEED70D71305902AB3D56B54E65C993272A96778137A6BC06A1AA14D` | `D7C58375DEED70D71305902AB3D56B54E65C993272A96778137A6BC06A1AA14D` | `D7C58375DEED70D71305902AB3D56B54E65C993272A96778137A6BC06A1AA14D` | **IDENTIK 100% (PASS)** |
| `mfms_backup_2026-11-19_214215_719880_a13fb449.meta.json` (1.354 bytes) | `ADE9918155372D3B78B134D61478B34C6F84330C6473F4ED792A4C7392DAC0A4` | `ADE9918155372D3B78B134D61478B34C6F84330C6473F4ED792A4C7392DAC0A4` | - | **IDENTIK 100% (PASS)** |

- Checksum plaintext pada metadata (`89d6aff15104...`) terverifikasi konsisten dengan payload internal sebelum enkripsi.
- Pasangan metadata di flashdisk memuat referensi nama file dan sidik jari kunci (`[REDACTED_KEY_FINGERPRINT]`) yang benar.

---

## 3. Task 2 — Hasil Pemeriksaan Keselamatan Pra-Mutasi (PASS)

- **Koneksi Database:** `mysql` &rarr; `127.0.0.1:3307`, basis data `mutiara_florist`, `is_testing: FALSE`.
- **Target Terverifikasi:** User ID 2 (`disabled-qa-2@disabled.invalid`), nama `Nonaktif - Eks Akun Pengujian`.
- **Operator Resmi Aman:** User ID 1 (`@gmail.com`) terkonfirmasi terpisah dan tidak tersentuh.
- **Relasi Foreign Key Terpetakan:**
  - `orders`: 1 pesanan (Order #2 / `MF-261117-01M7KRM9YA9KC8ZYRMK5DR9MFF`, Rp300.000).
  - `payments`: 2 pembayaran sah (Payment #1 Rp600.000, Payment #2 Rp700.000).
  - `expenses`: 1 pengeluaran sah (Expense #1 Rp100.000).
  - `audit_logs`: 14 baris catatan audit log historis.
- **Driver Sesi:** `database` (tabel `sessions`, metode pencabutan sesi tervalidasi).

---

## 4. Task 3 — Eksekusi Pencabutan Kredensial Terotorisasi (PASS)

Operasi dieksekusi dalam transaksi basis data atomik (`DB::beginTransaction()` &rarr; `DB::commit()`):
1. **Entropi Kriptografis:** Secret acak 256-bit dihasilkan di memori menggunakan `random_bytes(32)`.
2. **Pembuatan Hash:** Hash bcrypt dihasilkan melalui `Hash::make()`.
3. **Pembersihan Memori:** Variabel secret acak langsung di-`unset` dari memori seketika tanpa pernah disimpan atau dicatat.
4. **Pembaruan Kolom:** Menimpa kolom `password` pada User ID 2 dan menyetel `remember_token = NULL`.
5. **Pencabutan Sesi:** Menghapus sesi aktif milik `user_id = 2` pada tabel `sessions`.
6. **Invarian:** User ID 1, nama historis, alamat email, foreign key, pesanan, pembayaran, pengeluaran, dan audit log **sama sekali tidak diubah**.

---

## 5. Task 4 — Hasil Verifikasi Pasca-Mutasi (PASS)

| Pengujian Verifikasi | Nilai Sebelum | Nilai Sesudah | Status |
| --- | --- | --- | :---: |
| **Sidik Jari Hash Sandi User ID 2** | `f5d8ede268c9e979` | `5bb54992d38bf5a9` | **BERUBAH (PASS)** |
| **Kolom `remember_token` User ID 2** | `NULL` | `NULL` | **PASS** |
| **Sesi Aktif User ID 2 di Tabel `sessions`** | `0` | `0` | **TERCABUT (PASS)** |
| **Sidik Jari Hash Sandi Operator (User ID 1)** | `305b24a2c345f72b` | `305b24a2c345f72b` | **TIDAK BERUBAH (PASS)** |
| **Uji Login Web Akun Demo (`/login`)** | - | Respon HTTP 302, pesan *"Email atau password tidak sesuai"* | **DITOLAK BERSIH (PASS)** |
| **Keterikatan Transaksi User ID 2** | 1 order, 2 payments, 1 expense, 14 audit | 1 order, 2 payments, 1 expense, 14 audit | **UTUH 100% (PASS)** |

### Rekonsiliasi Finansial Pra vs Pasca Mutasi
- **Total Nilai Pesanan:** `Rp1.600.000` &rarr; `Rp1.600.000` (**100% MATCH**)
- **Total Pembayaran Sah (`POSTED`):** `Rp1.300.000` &rarr; `Rp1.300.000` (**100% MATCH**)
- **Total Pengeluaran Sah (`POSTED`):** `Rp100.000` &rarr; `Rp100.000` (**100% MATCH**)
- **Selisih Kas (*Net Cash*):** `Rp1.200.000` &rarr; `Rp1.200.000` (**100% MATCH**)
- **Jumlah Baris 9 Tabel Inti:** Seluruhnya identik 100%.

---

## 6. Task 5 — Laporan Status Akhir Gerbang Keamanan

| Gerbang Keamanan Operasional | Status | Catatan Verifikasi |
| --- | :---: | --- |
| **1. Verifikasi Backup USB** | **PASS** | Flashdisk `E:` FAT32 terdeteksi, hash SHA-256 cocok byte-for-byte |
| **2. Konfirmasi Recovery Key Pemilik** | **CONFIRMED** | Pemilik telah mengonfirmasi penyimpanan `APP_KEY` di Password Manager |
| **3. Penguncian Akun Demo (User ID 2)** | **PASS** | Sandi terkunci hash acak unrecoverable, remember token NULL |
| **4. Pencabutan Sesi (Session Invalidation)** | **PASS** | Sesi User ID 2 di database telah dibersihkan, login web ditolak |
| **5. Integritas Transaksi & Audit** | **PASS** | Seluruh transaksi, foreign key, dan 14 audit log terpelihara 100% |
| **6. Login Operator Resmi (User ID 1)** | **PASS** | Kredensial operator resmi utuh dan tetap aktif normal |
| **7. Status Go-Live** | **PENDING OWNER DECISION** | Seluruh gerbang teknis telah PASS; menunggu keputusan resmi pemilik |

---

## 7. Catatan Risiko Tersisa (*Residual Risks*)

1. **Non-RBAC:** Seluruh akun resmi yang aktif memiliki hak akses penuh ke menu, transaksi, dan laporan toko. Disiplin logout tetap wajib dijalankan.
2. **Ketergantungan Dekripsi pada `APP_KEY`:** Pemilik toko wajib menjaga salinan `APP_KEY` di Password Manager pribadi dan tidak merotasinya di komputer kasir.
3. **Disiplin Pencadangan Harian:** Operator toko wajib menjalankan pencadangan manual `php artisan mfms:backup` dan menyalin file ke flashdisk secara rutin.

---

## 8. Formulir Keputusan Penerimaan Pemilik Toko (Owner Sign-Off Form)

*(Kolom di bawah ini sengaja dibiarkan kosong untuk ditandatangani secara nyata oleh Pemilik Toko)*

### Keputusan Penerimaan Go-Live Pemilik Toko:
*(Beri tanda silang [X] pada salah satu kotak keputusan)*

- [ ] **DITERIMA (APPROVED FOR FULL GO-LIVE):** Seluruh gerbang keamanan telah terpenuhi. Mutiara Florist Management System disetujui untuk mulai digunakan mencatat transaksi operasional nyata toko.
- [ ] **DITUNDA (REJECTED / PENDING CORRECTIONS):** Penggunaan sistem ditunda hingga instruksi lebih lanjut:  
  `__________________________________________________________________________________________`

**Nama Pemilik Toko:** `________________________________________`  
**Tanggal Keputusan:** `______ / ____________ / 2026`  
**Tanda Tangan Pemilik:**  
<br>
`________________________________________`

---
*Laporan ini disusun secara faktual berdasarkan hasil audit teknis langsung. Tidak ada release tag yang dibuat, tidak ada merge otomatis, dan transaksi nyata belum dimulai.*
