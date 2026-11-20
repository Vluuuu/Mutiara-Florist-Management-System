# MFMS — Phase 13: Immediate Local Operational Go-Live Report

**Mutiara Florist Management System (MFMS)**  
**Waktu Aktivasi Go-Live:** 19 November 2026 (WIB / `Asia/Jakarta`)  
**Baseline Git Main:** `45d3b7e411e16ba2f45ca3b367a9addadbb722c2`  
**Keputusan Pemilik Toko:** **GO-LIVE APPROVED (OPERATIONAL READY)**

---

## 1. Pernyataan Aktivasi Go-Live

Berdasarkan keputusan resmi Pemilik Toko (*Owner*) Mutiara Florist yang menyetujui pengoperasian langsung sistem untuk transaksi nyata (tanpa masa uji coba pilot 30 hari), dan setelah seluruh gerbang pra-penerbangan (*Final Preflight*) serta pengujian asap non-destruktif (*Smoke Test*) dinyatakan **100% LULUS (ALL PASS)**:

> **STATUS SISTEM: GO-LIVE READY (SIAP DIGUNAKAN UNTUK TRANSAKSI NYATA)**

Aplikasi Mutiara Florist Management System kini resmi aktif beroperasi pada komputer kasir lokal toko Mutiara Florist di alamat:
**`http://127.0.0.1:8000`**

---

## 2. Hasil Task 1 — Final Preflight (Read-Only)

Pemeriksaan menyeluruh sebelum sistem dinyatakan aktif untuk operasional:

| Komponen Preflight | Hasil Pemeriksaan / Nilai Terukur | Kriteria Keamanan | Status |
| --- | --- | --- | :---: |
| **Baseline Git Main** | `45d3b7e411e16ba2f45ca3b367a9addadbb722c2` | Clean working tree (tanpa modifikasi liar) | **PASS** |
| **Mode Debug Laravel** | `APP_DEBUG=false` pada runtime dan `.env` | Detail error teknis tertutup | **PASS** |
| **Basis Data Operasional** | `mutiara_florist` pada MariaDB port `3307` | Koneksi `mysql`, `is_testing: FALSE` | **PASS** |
| **Akun Operator Resmi (ID 1)** | Sidik jari sandi utuh (`305b24a2c345f72b`), login normal | Kredensial operator aman & aktif | **PASS** |
| **Akun Demo (User ID 2)** | Hash acak `5bb54992d38bf5a9`, `remember_token: NULL`, 0 sesi | Kredensial lama dicabut permanen | **PASS** |
| **Status Backup Terbaru** | `mfms_backup_2026-11-19_222933_701075_b641435d.enc` | Tersimpan di storage & Flashdisk `E:` | **PASS** |
| **Flashdisk Eksternal** | Drive `E:` (FAT32, label `UBUNTU 26_0`, 15.6 GB) | Flashdisk fisik terverifikasi | **PASS** |
| **Pengakuan Non-RBAC** | Pemilik mengakui seluruh akun memiliki hak setara | Disepakati kepatuhan SOP logout | **PASS** |

### Baseline Keuangan Awal (Historical Invariants Preserved)
Basis data operasional saat ini mempertahankan transaksi historis yang telah terekam sebelumnya tanpa reset atau penghapusan:
- **Total Nota Pesanan:** `2 nota` &rarr; Total Nilai: **Rp1.600.000**
- **Total Kas Masuk Sah (`POSTED`):** **Rp1.300.000**
- **Total Kas Keluar Sah (`POSTED`):** **Rp100.000**
- **Saldo Kas Awal Toko (*Net Cash*):** **Rp1.200.000**
- **Jumlah Baris 9 Tabel Inti:** users (2), customers (2), orders (2), order_items (4), payments (2), categories (1), expenses (1), audit_logs (17), migrations (6).

---

## 3. Hasil Task 2 — Status Server Operasional Lokal

- **Launcher Resmi:** Dikelola melalui `scripts/Start-MFMS.bat` (proses terdaftar pada `storage/framework/mfms_laravel.state.json`).
- **Pencegahan Instance Ganda:** Server terdeteksi sudah berjalan aktif pada port 8000; sistem tidak menjalankan instance ganda (*duplicate instance rejected*).
- **Binding Jaringan:** Eksklusif terikat pada `127.0.0.1:8000` (PID `9896`, PHP 8.2 CLI).
- **Proteksi Jaringan Luar:** **0 eksposur ke LAN / Wi-Fi / Internet**.
- **Asset Tampilan:** Menggunakan asset produksi (`public/build/manifest.json` tersedia; `public/hot` tidak aktif).
- **Integritas Skema:** Tidak ada `migrate:fresh`, `db:seed`, reset database, atau restore yang dijalankan.

---

## 4. Hasil Task 3 — Non-Destructive Smoke Test

Pengujian non-destruktif terhadap 8 alur antarmuka tanpa membuat data dummy baru:

| No | Modul / Halaman yang Diuji | Endpoint Rute | Hasil Respon | Status |
| --- | --- | --- | :---: | :---: |
| 1 | Halaman Masuk (Login) | `GET /login` | HTTP 200 OK | **PASS** |
| 2 | Dashboard Utama | `GET /ui-dashboard` | HTTP 200 OK | **PASS** |
| 3 | Kelola Pelanggan | `GET /ui-customers` | HTTP 200 OK | **PASS** |
| 4 | Kelola Pesanan | `GET /ui-orders` | HTTP 200 OK | **PASS** |
| 5 | Pembayaran & Piutang | `GET /ui-payments` | HTTP 200 OK | **PASS** |
| 6 | Pengeluaran Toko | `GET /ui-expenses` | HTTP 200 OK | **PASS** |
| 7 | Laporan Keuangan | `GET /ui-reports` | HTTP 200 OK | **PASS** |
| 8 | Keluar Akun (Logout) | `POST /logout` | HTTP 302 (Redirect `/login`) | **PASS** |

*Selama uji coba smoke test, 0 baris transaksi termutasi dan data keuangan tetap konsisten 100%.*

---

## 5. Task 4 — Panduan Operasional Harian Operator (*Operator Handbook*)

Dokumen ringkas ini diperuntukkan bagi kasir dan staf florist Mutiara Florist untuk pengoperasian harian:

### 1. Membuka Sistem (Saat Toko Buka Pagi Hari)
1. Nyalakan komputer toko.
2. Buka folder aplikasi dan klik dua kali file **`scripts\Start-MFMS.bat`** (atau shortcut di Desktop).
3. Tunggu hingga muncul tulisan hijau: `[OK] SISTEM SIAP DIGUNAKAN!`.
4. Buka browser (Google Chrome atau Microsoft Edge) dan akses alamat:
   **`http://127.0.0.1:8000`**
5. Masuk menggunakan email dan password operator resmi.

### 2. Mencatat Pesanan Nyata Pelanggan
1. Buka menu **Pesanan** &rarr; klik tombol **+ Pesanan Baru** (atau via Dashboard).
2. Pilih nama pelanggan yang sudah ada atau klik **+ Tambah Pelanggan Baru** jika pelanggan pertama kali bertransaksi.
3. Masukkan item bunga (jenis rangkaian, nama penerima, nama pengirim di kartu ucapan, tanggal pengiriman, dan alamat tujuan).
4. Tentukan skema ongkir:
   - **Sudah termasuk harga bunga:** Ongkir dihitung Rp0 pada tagihan tambahan.
   - **Ditagih terpisah:** Masukkan nominal ongkos kirim.
5. Klik **Simpan Pesanan**. Nota baru tercatat dengan status *Belum bayar*.

### 3. Memperbarui Pengerjaan Rangkaian Bunga
Di halaman Detail Pesanan atau antrean Dashboard:
- Klik **Mulai Proses** saat florist mulai merangkai bunga.
- Klik **Tandai Siap Kirim** saat bunga selesai dirangkai dan siap diberangkatkan kurir.
- Klik **Tandai Terkirim** lalu konfirmasi modal saat bunga telah diterima di lokasi. Nota otomatis berstatus *Selesai* jika seluruh item telah terkirim.

### 4. Mencatat Pembayaran (DP, Cicilan, atau Lunas)
1. Buka nota pesanan terkait &rarr; klik **+ Catat Pembayaran** (atau via menu **Piutang & Bayar**).
2. Pilih metode pembayaran: `Tunai`, `Transfer bank`, `QRIS`, atau `Lainnya`.
3. Masukkan nominal yang diterima (sistem otomatis menolak jika nominal melebihi sisa tagihan).
4. Klik **Simpan Pembayaran**.
5. *Jika salah input nominal:* Jangan edit database! Klik **Batalkan Catatan** pada baris transaksi yang salah, isi alasan pembatalan minimal 10 karakter, lalu buat catatan pembayaran baru dengan nominal yang benar.

### 5. Mencatat Biaya Pengeluaran Toko
1. Buka menu **Pengeluaran** &rarr; klik **+ Catat Pengeluaran**.
2. Pilih kategori (bunga segar, pita/kertas, styrofoam, ongkir kurir, operasional harian).
3. Masukkan nominal dan keterangan pembelian &rarr; klik **Simpan Pengeluaran**.

### 6. Melihat Laporan & Rekap Harian
1. Buka menu **Laporan**.
2. Pilih preset periode: **Hari Ini**, **7 Hari**, **Bulan Ini**, atau rentang kustom.
3. Periksa kartu ringkasan: Total Nilai Pesanan, Kas Masuk (Sah), Kas Keluar (Sah), Selisih Kas, dan Piutang Berjalan.
4. Klik **Unduh Excel (.xlsx)** jika ingin menyimpan rekapitulasi file Excel.

### 7. Melakukan Backup Setiap Tutup Toko (Wajib Harian)
1. Tancapkan **Flashdisk Khusus MFMS** ke komputer kasir.
2. Buka jendela PowerShell di folder aplikasi, lalu ketik perintah:
   ```powershell
   php artisan mfms:backup
   ```
3. Tunggu hingga muncul pesan hijau `Backup berhasil dibuat dan dienkripsi!`.
4. Buka folder `storage\app\backups\` &rarr; salin 2 file terbaru (`.enc` dan `.meta.json`) ke folder `MFMS-Backups` di flashdisk toko.
5. Cabut flashdisk secara aman (*Safely Remove Hardware*) dan bawa pulang oleh pemilik toko.

### 8. Menutup Aplikasi dengan Aman (Saat Toko Tutup Malam Hari)
1. Pastikan seluruh staf telah menekan tombol **Keluar Akun** (*Logout*) di aplikasi web.
2. Tutup tab browser.
3. Klik dua kali file **`scripts\Stop-MFMS.bat`** di folder proyek.
4. Tunggu hingga muncul konfirmasi server web telah berhenti aman.
5. Matikan komputer toko.

### 9. Prosedur Pelaporan Kendala / Bug
Jika operator menemukan tampilan tidak sesuai atau tombol macet:
1. Ambil tangkapan layar (*screenshot*) yang menampilkan pesan kendala (`Windows + Shift + S`).
2. Catat langkah yang dilakukan sebelum error terjadi (misal: "Saat klik simpan pembayaran BCA").
3. Catat waktu kejadian (tanggal dan jam WIB).
4. Laporkan kepada pemilik / pengelola teknis.
5. **DILARANG KERAS** meminta pihak lain mengedit database MySQL secara manual melalui phpMyAdmin tanpa persetujuan pemilik toko.

---

## 6. Prinsip Pengoperasian Pasca-Go-Live

1. **Integritas & Keselamatan Data Transaksi Utama:** Basis data operasional `mutiara_florist` adalah rekaman finansial resmi toko. Segala bentuk pengujian fitur baru, perubahan skema, atau uji coba tampilan **DILARANG** dilakukan langsung pada database operasional.
2. **Isolasi Perbaikan Bug:** Jika di kemudian hari ditemukan bug perangkat lunak, perbaikan wajib diuji terlebih dahulu pada koneksi pengujian terisolasi (`mariadb_testing` / `DB_CONNECTION=sqlite`) sebelum diterapkan ke komputer toko.
3. **Disiplin Kunci Pemulihan:** File `.env` dan nilai `APP_KEY` dilarang dirotasi atau diubah selama toko beroperasi tanpa prosedur migrasi kunci arsip backup terencana.

---
*Laporan resmi ini menandai tuntasnya seluruh rangkaian persiapan Phase 1 hingga Phase 13. Sistem Mutiara Florist Management System kini berstatus **OPERASIONAL PENUH (LIVE)**.*
