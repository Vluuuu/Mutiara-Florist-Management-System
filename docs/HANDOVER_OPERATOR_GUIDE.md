# Panduan Operasional & Dokumen Serah Terima (Handover)
## Mutiara Florist Management System (MFMS) — Phase 4 & Phase 5 Final Acceptance

---

## 1. Panduan Penggunaan Aplikasi Bagi Operator Florist

Aplikasi MFMS dirancang untuk menyederhanakan pencatatan pesanan karangan bunga, penagihan, pelunasan bertahap, dan pengeluaran harian toko bunga Mutiara Florist.

### A. Akses dan Navigasi
1. Buka browser dan arahkan ke alamat URL sistem (misal: `http://localhost:8000`).
2. Masukkan email admin dan password yang telah didaftarkan.
3. Halaman Dashboard menampilkan:
   - **Arus Kas Masuk (Hari Ini & Bulan Ini):** Dihitung murni dari pembayaran yang berstatus POSTED (bukan nilai pesanan).
   - **Arus Kas Keluar (Hari Ini & Bulan Ini):** Dihitung murni dari pengeluaran yang berstatus POSTED.
   - **Saldo Kas Bersih:** Selisih kas masuk dikurangi kas keluar.
   - **Total Piutang Berjalan:** Total sisa tagihan terbuka dari pesanan yang belum lunas.
   - **Daftar Pesanan Memerlukan Tindakan:** Pesanan dengan status NEW atau PROCESSING yang jatuh tempo pengiriman dalam waktu dekat.

### B. Manajemen Data Pelanggan (`/ui-customers`)
- **Pencarian:** Cari pelanggan berdasarkan nama atau nomor telepon (pencarian fleksibel dan kebal karakter khusus).
- **Tambah Pelanggan:** Klik tombol "Tambah Pelanggan", masukkan Nama dan Nomor Telepon (diawali 08...).
- **Riwayat Pelanggan:** Klik pada nama pelanggan untuk melihat seluruh riwayat pesanan, tanggal order, dan status pembayarannya.
- **Arsip/Hapus Pelanggan:** Pelanggan yang belum pernah memiliki pesanan dapat diarsipkan. Pelanggan yang telah memiliki transaksi pesanan tidak dapat dihapus demi menjaga integritas data keuangan historis.

### C. Manajemen Pesanan Bunga (`/ui-orders`)
- **Pembuatan Pesanan Baru:**
  1. Pilih pelanggan dari daftar atau buat baru secara cepat.
  2. Pilih Tanggal Pesanan.
  3. Masukkan item bunga (bisa multi-item hingga 20 jenis item bunga dalam 1 pesanan).
  4. Untuk setiap item bunga, isi:
     - Jenis Bunga (contoh: Papan Bunga Ucapan Selamat, Buket Mawar, Standing Flower).
     - Nama Penerima & Nama Pengirim (untuk ucapan di kartu/papan).
     - Tanggal & Waktu Pengiriman yang diminta.
     - Lokasi Pengiriman (Alamat lengkap gedung/rumah).
     - Jumlah (Qty) dan Harga Satuan.
     - Mode Ongkir: "Termasuk (Included)" atau "Terpisah (Separate)". Jika terpisah, isi nominal tarif ongkir.
  5. Sistem akan otomatis menghitung Total Tagihan secara real-time.
  6. Simpan pesanan. Status awal pesanan adalah `NEW`.
- **Alur Status Pengerjaan (Fulfillment Lifecycle):**
  Status harus bergerak maju secara berurutan:
  `NEW` (Baru Diterima) ➔ `PROCESSING` (Sedang Dirangkai) ➔ `READY` (Siap Kirim) ➔ `DELIVERED` (Telah Sampai di Lokasi) ➔ `COMPLETED` (Selesai).
  *Catatan: Sistem menolak lompatan status (misal dari NEW langsung ke DELIVERED).*

### D. Manajemen Pembayaran & Piutang (`/ui-payments`)
- Halaman **Piutang (Receivables)** menampilkan daftar pesanan yang masih memiliki sisa tagihan (`outstanding > 0`).
- **Pencatatan Pembayaran:**
  1. Klik "Catat Pembayaran" pada pesanan terkait.
  2. Pilih Tanggal Pembayaran, Metode (Tunai, Transfer BCA/Mandiri, QRIS), dan Nomor Referensi Transfer jika ada.
  3. Masukkan Nominal Bayar (bisa Uang Muka/DP, Cicilan, atau Pelunasan).
  4. Sistem menerapkan **Anti-Overpayment Guard**: Pembayaran yang melebihi sisa tagihan akan otomatis ditolak dengan pesan peringatan.
  5. Setelah tersimpan, status pesanan otomatis mencerminkan sisa tagihan yang berkurang.

### E. Manajemen Pengeluaran Kas Toko (`/ui-expenses`)
- Mencatat biaya operasional harian toko bunga seperti pembelian bahan baku bunga segar, pita, kertas wrapping, busa oasis, styrofoam, ongkos kurir, konsumsi, listrik/air, dan pemeliharaan.
- Pilih Kategori Pengeluaran (kategori dapat dikelola pada tab Kategori Biaya).
- Masukkan Tanggal, Nominal, dan Deskripsi kebutuhan secara jelas.

### F. Laporan Keuangan & Ekspor Excel (`/ui-reports`)
- Pilih preset periode: "Hari Ini", "7 Hari Terakhir", "Bulan Ini (30 Hari)", atau "Kustom (Pilih Rentang Tanggal)".
- Laporan menyajikan:
  - Ringkasan Arus Kas Masuk vs Kas Keluar.
  - Total Omzet Nilai Tagihan Pesanan dalam Periode.
  - Distribusi Status Pengiriman Item Bunga.
  - Distribusi Metode Pembayaran.
  - Tren Harian Arus Kas Masuk dan Keluar.
  - Saldo Piutang Berjalan Saat Ini.
- **Ekspor Excel (.xlsx):** Klik tombol "Ekspor Excel" untuk mengunduh laporan multi-sheet berstandar akuntansi dengan sel numerik yang siap diformulasikan dan dilindungi dari formula injection.

---

## 2. Standar Operasional Prosedur (SOP) Pencatatan Pesanan & Pembayaran

1. **Penerimaan Pesanan:**
   - Operator menerima pesanan via WhatsApp, telepon, atau walk-in.
   - Operator wajib memastikan nomor telepon pelanggan tercatat dengan benar.
   - Operator mencatat detail pesanan ke sistem MFMS sebelum bunga mulai dirangkai di workshop.
2. **Uang Muka (DP):**
   - Setiap pesanan wajib menyertakan uang muka (DP) minimal 50% atau pelunasan penuh sebelum pengiriman, terutama untuk karangan papan bunga duka cita atau pernikahan.
   - Pembayaran DP dicatat pada hari dana diterima dengan melampirkan nomor referensi mutasi bank.
3. **Penyelesaian & Pengiriman:**
   - Saat perangkai selesai merangkai, status pesanan dimajukan ke `READY`.
   - Kurir membawa surat jalan/tanda terima ke lokasi acara. Setelah foto tanda terima terverifikasi, status diubah menjadi `DELIVERED`.
   - Setelah tagihan lunas dan barang diterima, status diubah menjadi `COMPLETED`.

---

## 3. Prosedur Koreksi Kesalahan Transaksi (Accounting VOID)

Dalam sistem akuntansi MFMS, transaksi kas (Pembayaran atau Pengeluaran) yang telah diposting **TIDAK PERNAH DIHAPUS FISIK (NO PHYSICAL DELETE)** dari database. Hal ini untuk mencegah kecurangan (fraud) dan menjaga integritas audit jejak keuangan.

Jika terjadi kesalahan input (misal salah mengetik nominal Rp500.000 menjadi Rp5.000.000, atau salah memilih pesanan):
1. **Jangan mencari tombol Hapus**, gunakan fitur **VOID Transaksi**.
2. Klik tombol "VOID" pada baris transaksi yang salah.
3. Masukkan **Alasan Pembatalan Minimal 10 Karakter** (contoh: *"Salah input kelebihan satu nol, nominal asli Rp500.000"*).
4. Dampak Akuntansi VOID:
   - Transaksi yang di-VOID statusnya berubah menjadi `VOIDED` dan diberi cap waktu (`voided_at`) serta pencatat (`recorded_by`).
   - Nominal transaksi yang di-VOID seketika **dikeluarkan dari perhitungan kas masuk, kas keluar, dan saldo kas**.
   - Pada pesanan, sisa tagihan (*outstanding balance*) akan otomatis pulih kembali.
   - Rekam jejak transaksi yang salah tetap tersimpan di riwayat dan Audit Log untuk transparansi.
5. Operator kemudian mencatat ulang transaksi pembayaran yang benar dengan nominal yang sesuai.

---

## 4. Standar Operasional Prosedur (SOP) Backup & Pemulihan Data

### A. Jadwal Pencadangan
- **Harian:** Dilakukan setiap malam setelah jam operasional toko tutup (pukul 22.00 WIB).
- **Sebelum Pembaruan Sistem:** Wajib menjalankan backup manual sebelum ada pembaruan aplikasi atau migrasi server.

### B. Eksekusi Backup Manual
Jalankan perintah berikut di console server:
```bash
php artisan mfms:backup
```
Untuk memasukkan kunci enkripsi secara aman tanpa terekspos di log OS:
```bash
php artisan mfms:backup --ask-key
```

### C. Penyimpanan Kunci Enkripsi (`BACKUP_ENCRYPTION_KEY`)
- Kunci enkripsi cadangan didefinisikan pada file `.env` di baris `BACKUP_ENCRYPTION_KEY=...` atau menggunakan fallback `APP_KEY`.
- Salinan kunci enkripsi wajib disimpan di tempat yang aman (misal: password manager terenkripsi milik pemilik toko).
- **PENTING:** Jika file backup `.enc` dipindahkan ke komputer lain, file tersebut **TIDAK BISA DIBUKA** tanpa kunci enkripsi yang sama persis.

### D. Uji Restorasi Berkala (Disaster Recovery Drill)
Setiap awal bulan, lakukan uji coba restorasi ke database pengujian terisolasi untuk memastikan file cadangan tidak rusak:
```bash
php artisan mfms:restore-test --connection=testing
```
Pastikan status yang dilaporkan adalah:
- Checksum SHA-256: VALID
- Rekonsiliasi Baris Tabel: VALID
- Integritas Metrik Keuangan: VALID
- Relasi Foreign Key: VALID (No Orphans)

---

## 5. Checklist Keamanan & Deployment Produksi

- [x] **CSRF Protection:** Seluruh form dan request POST/PUT/DELETE dienkripsi dengan token CSRF Laravel.
- [x] **Session Security:** Session HTTP-only, proteksi regenerasi ID session saat login/logout.
- [x] **Rate Limiting Login:** Pembatasan maksimal 6 percobaan login per menit untuk mencegah brute-force attack.
- [x] **Tanpa Registrasi Publik:** Rute registrasi publik ditutup; pembuatan akun admin hanya melalui CLI lokal `php artisan mfms:create-admin`.
- [x] **Database Restore Safeguard:** Proteksi hardware/software level pada `BackupService` yang menolak keras perintah restorasi ke database operasional (`mutiara_florist`, `mfms`, koneksi default).
- [x] **Row-Level Concurrency Lock:** `SELECT ... FOR UPDATE` dalam transaksi ACID menjamin dua kasir yang memproses pesanan yang sama secara bersamaan tidak akan pernah menyebabkan overpayment.
- [x] **Excel Formula Injection Mitigation:** Seluruh input teks pengguna yang diawali simbol berbahaya (`=`, `+`, `-`, `@`) otomatis diberi prefix tanda petik tunggal (`'`).
- [x] **Hak Akses File Backup:** File cadangan `.enc` dan `.meta.json` otomatis diberi hak akses ketat `0600` (hanya dapat dibaca oleh user proses web/server).
- [x] **Isolasi Pengujian:** Test suite PHPUnit menggunakan direktori sementara yang terisolasi; tidak ada backup operasional yang terhapus saat testing.

---

## 6. Catatan Keterbatasan MVP (Phase 1–5 Scope)

1. **Single Operator Role:** MVP difokuskan untuk 1 akun operator toko (Admin). Sistem tidak memiliki role kasir bertingkat (misal supervisor vs junior cashier).
2. **Tidak Ada Diskon & Pajak Otomatis:** Perhitungan harga bersifat net per item bunga dan tarif ongkir flat/terpisah.
3. **Tidak Ada Fitur Pembatalan Sepihak/Refund:** Pengembalian dana atau pembatalan pesanan yang telah dibayar dilakukan secara manual di luar sistem; koreksi akuntansi di dalam sistem dilakukan melalui mekanisme VOID pembayaran.
4. **Urutan Pengerjaan Linier:** Perubahan status pengerjaan bunga harus mengikuti alur bertahap (tidak bisa melompati tahapan).

---

## 7. Bukti Pengujian Final & Ringkasan Masalah yang Telah Diselesaikan

| No | Temuan / Kebutuhan | Klasifikasi | Solusi yang Diterapkan | Status Verifikasi |
| --- | --- | --- | --- | --- |
| 1 | Risiko penghapusan backup pada `DatabaseBackupTest::tearDown()` | P0 Critical Safety | Menghapus wildcard `storage/app/backups/mfms_backup_*`. Pengujian dialihkan ke direktori sementara unik `storage/framework/testing/backups_test_*`. Ditambahkan pengujian eksplisit yang membuktikan file backup operasional tidak tersentuh. | **PASS** (10/10 tests) |
| 2 | Serialisasi `is_numeric` merusak nomor telepon berawalan nol (`0812...`) | P0 Data Integrity | Mengganti serialisasi string manual dengan format snapshot kanonikal bertipe (JSON v2) yang dipulihkan menggunakan PDO prepared statements. Mempertahankan string numerik dengan nol depan, emoji UTF-8, tanda kutip, backslash, dan teks multiline. | **PASS** (Verifikasi 100% identik) |
| 3 | Konsistensi snapshot saat backup | P1 Integrity | Menerapkan transaksi isolasi snapshot konsisten (`REPEATABLE READ` & `START TRANSACTION WITH CONSISTENT SNAPSHOT` pada MariaDB/MySQL InnoDB, `BEGIN TRANSACTION` pada SQLite). | **PASS** |
| 4 | Kriptografi autentikasi | P1 Security | Meng-upgrade enkripsi dari AES-256-CBC menjadi **AES-256-GCM** dengan tag autentikasi 16-byte yang memvalidasi keaslian ciphertext sebelum dekripsi, didukung SHA-256 checksum. | **PASS** (Tamper test gagal jika dimanipulasi) |
| 5 | Pemisahan kunci & CLI masking | P1 Security | Mendukung `BACKUP_ENCRYPTION_KEY` terpisah dari `APP_KEY`, penulisan atomik (`.tmp` ➔ rename), dan opsi CLI `--ask-key` agar rahasia tidak bocor ke process list. | **PASS** |
| 6 | Uji Konkurensi Pembayaran MariaDB Nyata | P1 Concurrency | Menguji konkurensi paralel nyata dengan 2 subproses independen secara simultan terhadap MariaDB 10.4 testing (`mfms_testing`). InnoDB row lock terbukti mencegah overpayment (tepat 1 pembayaran sukses, 1 pembayaran ditolak validasi melebihi sisa tagihan). | **PASS** (MariaDB port 3307 verified) |
| 7 | Full Quality Gate | Acceptance | - PHPUnit: **138 passed (1267 assertions)**.<br>- TypeScript: **0 errors (`tsc --noEmit`)**.<br>- Vite Build: **Sukses dibangun dalam 2.43s**.<br>- Excel Audit: **Valid OpenXML, tipe sel numerik `t="n"`, proteksi formula injection**.<br>- Agent-Browser: **Live navigasi & proteksi akses tamu terverifikasi**. | **100% READY** |
