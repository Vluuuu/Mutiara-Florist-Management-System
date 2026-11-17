# Panduan Operasional Harian & Kesiapan Pilot Lokal
**Mutiara Florist Management System (MFMS) — Phase 6 Go-Live Readiness**

Dokumen ini disiapkan untuk operator harian dan pemilik toko Mutiara Florist pada komputer Windows (XAMPP + MariaDB port `3307` + Laravel 12 + React/Inertia).

---

## 1. Panduan Mulai & Berhenti Menjalankan Sistem

### A. Menyalakan Sistem (Saat Toko Buka)
1. Buka folder proyek: `D:\xampp\htdocs\Mutiara-Florist-Management-System\scripts\` (atau gunakan shortcut desktop ke `Start-MFMS.bat`).
2. Klik dua kali **`Start-MFMS.bat`**.
3. Skrip akan otomatis:
   - Memeriksa apakah MariaDB sudah aktif di port `3307`. Jika belum, skrip menyalakan MariaDB XAMPP secara aman tanpa membuat instance ganda.
   - Memastikan file konfigurasi `.env` dan hasil build React (`public/build/manifest.json`) tersedia.
   - Memeriksa koneksi ke database operasional `mutiara_florist` (tanpa menjalankan migrasi/reset otomatis).
   - Menyalakan server web MFMS hanya di alamat lokal `127.0.0.1:8000`.
4. Jika muncul pesan **`SISTEM SIAP DIGUNAKAN!`**, buka Google Chrome atau Microsoft Edge dan akses:
   **`http://127.0.0.1:8000`**

> **Catatan:** Jangan menutup jendela hitam `php artisan serve` yang terbuka saat aplikasi sedang dipakai. Anda boleh me-minimize jendela tersebut.

### B. Mematikan Sistem (Saat Toko Tutup)
1. Pastikan seluruh operator sudah menekan tombol **Keluar** (Logout) dan tidak ada transaksi yang sedang disimpan.
2. Klik dua kali **`Stop-MFMS.bat`** di folder `scripts\`.
3. Skrip akan menghentikan server web pada port `8000` secara aman. Jika MariaDB dijalankan oleh `Start-MFMS.bat`, skrip juga akan mematikannya dengan `mysqladmin shutdown`. Jika MariaDB dijalankan via **XAMPP Control Panel**, hentikan melalui tombol **Stop** di XAMPP Control Panel sebelum mematikan komputer.

---

## 2. Checklist Pemeriksaan Sebelum Toko Mulai Beroperasi (Pre-Opening)

Lakukan pemeriksaan singkat berikut setiap pagi sebelum melayani pelanggan:

| No | Pemeriksaan | Cara Cek | Target |
|----|-------------|----------|--------|
| 1 | MariaDB Port 3307 Aktif | Jalankan `Start-MFMS.bat` atau cek XAMPP Control Panel | Status `[OK] MariaDB sudah aktif di port 3307` |
| 2 | Server Web Lokal Aktif | Akses `http://127.0.0.1:8000` di browser | Halaman Login MFMS tampil cepat tanpa error |
| 3 | Login Operator Berhasil | Masuk dengan akun operator masing-masing | Masuk ke Dashboard React (`/ui-dashboard`) |
| 4 | Jam & Tanggal Komputer Akurat | Cek jam Windows kanan bawah | Tanggal hari ini & zona waktu WIB (`Asia/Jakarta`) benar |
| 5 | Saldo & Piutang Kemarin Sesuai | Cek kartu ringkasan Dashboard | Angka kas masuk/keluar & piutang sesuai catatan kemarin |
| 6 | Ruang Penyimpanan Tersedia | Cek kapasitas drive `D:\` | Minimal 1 GB ruang kosong untuk backup & laporan |

---

## 3. Panduan Singkat Operator Sehari-hari

1. **Masuk (Login):** Buka `http://127.0.0.1:8000`, masukkan email dan password operator.
2. **Pelanggan Baru (`/ui-customers`):** Simpan nama dan nomor HP pelanggan sebelum membuat pesanan agar riwayat transaksi terekam rapi.
3. **Buat Pesanan (`/ui-orders/create`):**
   - Pilih pelanggan dan tanggal pesan.
   - Tambahkan 1 hingga 20 item bunga dalam satu pesanan.
   - Isi penerima, pengirim di kartu/papan, tanggal kirim, lokasi kirim, jumlah, harga satuan, serta mode ongkir (**Termasuk** atau **Terpisah**).
   - Simpan pesanan. Jika belum ada DP, biarkan status pembayaran *Belum bayar*.
4. **Pantau & Majukan Pengerjaan (`/ui-orders/{id}`):**
   - Langsung di halaman Detail Pesanan, klik tombol progres pada masing-masing item bunga secara berurutan:
     - **`Rangkai / Proses Bunga →`** (`NEW` → `PROCESSING`)
     - **`Bunga Siap Kirim →`** (`PROCESSING` → `READY`)
     - **`Konfirmasi Terkirim di Lokasi ✓`** (`READY` → `DELIVERED`)
   - Jika seluruh item pada pesanan sudah `Terkirim`, status pesanan otomatis menjadi **Selesai (`COMPLETED`)**.
5. **Catat Pembayaran & Pelunasan (`/ui-orders/{id}` atau `/ui-payments`):**
   - Klik **Catat Pembayaran**, pilih metode (Tunai/Transfer/QRIS), isi nominal DP, cicilan, atau pelunasan.
   - Jika terjadi salah ketik nominal setelah disimpan, gunakan fitur **Void** dengan alasan minimal 10 karakter (pembayaran lama tidak dihapus demi jejak audit, lalu catat ulang nominal yang benar).
6. **Catat Pengeluaran Toko (`/ui-expenses`):**
   - Catat pembelian bunga segar, pita, styrofoam, ongkos kurir, atau biaya operasional harian sesuai kategori.
7. **Tutup Hari & Laporan (`/ui-reports`):**
   - Buka menu **Laporan**, pilih periode **Hari Ini** atau **30 Hari Terakhir**, periksa total kas masuk, kas keluar, selisih kas, dan piutang berjalan.
   - Klik **Ekspor Excel (.xlsx)** jika perlu menyimpan rekap harian/bulanan.
8. **Keluar (Logout):** Klik **Keluar** pada menu samping kiri setelah selesai bekerja.

---

## 4. Manajemen Akun Operator & Keterbatasan Sistem

- **Keterbatasan Saat Ini (Belum Ada RBAC):**
  Saat ini tabel `users` belum memiliki kolom `role` / hak akses bertingkat. **Seluruh akun yang dapat login memiliki akses penuh** terhadap data pelanggan, pesanan, pembayaran, pengeluaran, dan laporan. Jangan claim atau anggap ada pembatasan kasir vs pemilik.
- **Akun Testing/Demo:**
  Akun demo/pengujian (seperti pola email `@example.test`) **tidak aman untuk operasional** dan wajib dihapus sebelum toko mulai beroperasi penuh dengan data nyata.
- **Membuat Akun Operator Baru (Tanpa Password Hardcoded):**
  Buka terminal PowerShell di folder `D:\xampp\htdocs\Mutiara-Florist-Management-System`, lalu jalankan:
  ```powershell
  php artisan mfms:create-admin
  ```
  Ikuti prompt interaktif untuk memasukkan Nama, Email unik operator, dan Password kuat yang unik (minimal 12 karakter, jangan gunakan ulang password demo).

---

## 5. SOP Backup Manual & Pemulihan Darurat

### A. Membuat Backup Terenkripsi Manual (Harian/Mingguan)
Sistem menggunakan enkripsi **AES-256-GCM** dengan checksum integritas **SHA-256** dan snapshot transaksi read-only (tidak mengubah data operasional).
1. Buka PowerShell di `D:\xampp\htdocs\Mutiara-Florist-Management-System`.
2. Jalankan:
   ```powershell
   php artisan mfms:backup
   ```
3. File hasil backup (`.enc` dan `.meta.json`) tersimpan di `storage\app\backups\` dengan nama unik berbasis waktu (tidak menimpa file backup lama).

### B. Penyimpanan Backup di Luar Komputer Utama (Wajib)
Menyimpan backup hanya di harddisk komputer kasir **tidak melindungi data jika komputer rusak, terkena ransomware, atau dicuri**.
1. Setiap selesai backup (minimal akhir hari/akhir pekan), salin file `.enc` dan `.meta.json` terbaru ke **minimal 1 media eksternal**:
   - Flashdisk khusus toko (disimpan terpisah saat toko tutup), **atau**
   - Folder sinkronisasi Cloud pribadi pemilik (Google Drive / OneDrive) yang hanya berisi file `.enc` terenkripsi.
2. **Kunci Enkripsi Backup:**
   - Saat ini jika `BACKUP_ENCRYPTION_KEY` belum diset terpisah di `.env`, enkripsi menggunakan `APP_KEY` di `.env`.
   - Simpan salinan `.env` (atau kunci enkripsi backup) secara terpisah di pengelola kata sandi / brankas pemilik toko (**jangan pernah dikirim lewat chat publik atau di-commit ke GitHub**). Tanpa kunci ini, file `.enc` tidak dapat didekripsi.

### C. Uji Restorasi & Pemulihan Darurat
- **Uji Restorasi Aman (Hanya ke Database Testing):**
  Untuk memverifikasi file backup masih sehat tanpa menyentuh database operasional:
  ```powershell
  php artisan mfms:restore-test NAMA_FILE_BACKUP.enc --connection=testing
  ```
  Pastikan keempat status integritas tampil **VALID**: Checksum SHA-256, Rekonsiliasi Baris Tabel, Integritas Metrik Keuangan, dan Relasi Foreign Key.
- **Pemulihan Darurat pada Komputer Baru / Setelah Kerusakan:**
  1. Pasang XAMPP (PHP 8.2+ & MariaDB port 3307) dan clone/salin folder aplikasi MFMS.
  2. Pulihkan file `.env` yang berisi `APP_KEY` (dan `BACKUP_ENCRYPTION_KEY` jika digunakan) yang sama dengan saat backup dibuat.
  3. Buat database kosong `mutiara_florist` di MariaDB dan jalankan `php artisan migrate --force`.
  4. Lakukan verifikasi file backup terlebih dahulu ke koneksi testing (`mfms:restore-test`), lalu jalankan prosedur restorasi resmi oleh pengelola teknis dengan menargetkan database baru yang telah diverifikasi.

---

## 6. Prosedur Menangani Gangguan Umum

### A. Gangguan MariaDB / Database Tidak Terhubung
- **Gejala:** Muncul pesan gagal koneksi database atau error `SQLSTATE[HY000] [2002]` / `Connection refused`.
- **Penanganan:**
  1. Jalankan `scripts\Stop-MFMS.bat`, tunggu 3 detik.
  2. Buka **XAMPP Control Panel**, pastikan tidak ada port bentrok, lalu klik **Start** pada **MySQL**. Pastikan port menunjukkan `3307`.
  3. Jika MySQL gagal menyala di XAMPP, periksa log di `D:\xampp\mysql\data\mysql_error.log`. **Jangan pernah menghapus file `ibdata1` atau folder `mysql\data\mutiara_florist`!**
  4. Jalankan kembali `scripts\Start-MFMS.bat`.

### B. Gangguan Server Laravel (Halaman `127.0.0.1:8000` Tidak Bisa Dibuka)
- **Gejala:** Browser menampilkan *This site can't be reached* atau *ERR_CONNECTION_REFUSED*.
- **Penanganan:**
  1. Periksa apakah jendela terminal Laravel tertutup tidak sengaja.
  2. Jalankan `scripts\Stop-MFMS.bat` untuk membersihkan proses port `8000` yang tersisa.
  3. Jalankan `scripts\Start-MFMS.bat` kembali dan refresh browser (`Ctrl + R`).
  4. Jika tampilan berantakan / halaman kosong, pastikan `public\build\manifest.json` ada (jika hilang, jalankan `npm run build`).

### C. Gangguan Login / Session / HTTP 419
- **Gejala:** Tidak bisa masuk, atau muncul halaman *419 Page Expired* setelah komputer lama ditinggal (*idle* > 120 menit).
- **Penanganan:**
  1. Tekan refresh browser (`F5` atau `Ctrl + R`) pada halaman login `http://127.0.0.1:8000/login` agar sesi baru dimuat, lalu login kembali.
  2. Jika tetap gagal, periksa apakah ruang disk penuh atau folder `storage\framework\sessions` bisa ditulis.
  3. Jika operator lupa password, pemilik/pengelola dapat membuat akun baru lewat `php artisan mfms:create-admin` atau memperbarui hash password akun tersebut secara aman.
