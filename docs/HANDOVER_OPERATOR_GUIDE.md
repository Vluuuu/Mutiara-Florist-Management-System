# Panduan Operasional & Serah Terima Operator MFMS

**Versi Aplikasi:** Phase 13 (`release/phase13-ui-bi`, baseline rilis `0b436a9`)  
**Alamat Produksi:** [https://admin.mutiaraflorist.id](https://admin.mutiaraflorist.id)

Dokumen ini menjadi panduan penggunaan harian bagi operator dan pemilik toko Mutiara Florist, mencakup alur transaksi, koreksi pembukuan (`VOIDED`), pencadangan terenkripsi, dan batasan fitur saat ini.

---

## 1. Panduan Penggunaan Aplikasi Sehari-hari

### A. Masuk & Navigasi (`/login`, `/dashboard`)

1. Buka alamat sistem produksi di `https://admin.mutiaraflorist.id` (atau `http://127.0.0.1:8000` saat dijalankan secara lokal).
2. Jika Cloudflare Zero Trust Access aktif pada domain publik, selesaikan verifikasi akses tepi terlebih dahulu, lalu masukkan email dan kata sandi akun admin MFMS.
3. Halaman **Dashboard (`/dashboard`)** menampilkan ringkasan operasional dan keuangan:
   - **4 Kartu KPI Utama:** Nilai Pesanan, Kas Masuk (`POSTED`), Kas Keluar (`POSTED`), dan Piutang Berjalan.
   - **Grafik Arus Kas:** Opsi rentang **7 hari** dan **30 hari** untuk memantau perbandingan kas masuk dan kas keluar harian.
   - **Alur Pengerjaan Pesanan (Pipeline):** Ringkasan progres pengerjaan item (`Baru`, `Diproses`, `Siap Kirim`, `Terkirim`).
   - **Antrean Pengiriman Operasional:** Daftar kiriman mendesak/terjadwal beserta aksi cepat memajukan status item.
   - **Piutang per Nota:** Daftar nota dengan sisa tagihan terbuka beserta akses cepat mencatat pembayaran.
   - **Aktivitas Bisnis Terbaru:** Ringkasan transaksi terbaru pada sistem.

### B. Manajemen Pelanggan (`/ui-customers`)

- **Pencarian:** Cari pelanggan berdasarkan nama atau nomor telepon (pencarian tidak peka huruf besar/kecil dan aman terhadap karakter khusus).
- **Tambah & Ubah Pelanggan:** Nama wajib diisi; nomor telepon dan catatan bersifat opsional, dan nomor telepon tidak harus unik.
- **Detail Pelanggan:** Menampilkan informasi kontak serta riwayat pesanan pelanggan terkait.
- **Arsip Pelanggan (Soft Delete):** Pelanggan tanpa riwayat pesanan dapat diarsipkan dengan konfirmasi dialog. Pelanggan yang sudah memiliki pesanan tidak dapat diarsipkan demi menjaga integritas riwayat keuangan.

### C. Manajemen Pesanan Multi-Item (`/ui-orders`)

- **Buat Pesanan Baru (`/ui-orders/create`):**
  1. Pilih pelanggan aktif dari pencarian pelanggan (atau buat pelanggan baru dari formulir).
  2. Tentukan tanggal nota pesanan.
  3. Tambahkan 1 hingga 20 rangkaian bunga (item) dalam satu nota. Setiap item mencatat jenis bunga, penerima ("Untuk"), pengirim ucapan ("Dari"), tanggal kirim, lokasi kirim, jumlah (qty), harga satuan, dan mode ongkir (`Sudah termasuk` / `INCLUDED` atau `Ditagihkan terpisah` / `SEPARATE` dengan nominal ongkir sekali per item).
  4. Total tagihan dihitung oleh server dalam Rupiah bulat (tanpa diskon atau pajak).
  5. Pesanan dapat disimpan **tanpa DP atau pembayaran awal** (`UNPAID`).
- **Ubah Pesanan (`/ui-orders/{id}/edit`):**
  - Item yang sudah diproses (bukan `NEW`) tidak dapat dihapus.
  - Jika pesanan sudah memiliki pembayaran `POSTED`, pelanggan tidak dapat diganti dan total tagihan baru tidak boleh lebih kecil dari jumlah uang yang sudah diterima; perubahan nominal mewajibkan alasan revisi.
- **Alur Status Pengerjaan Item (Linier):**
  Setiap item bergerak maju satu tahap secara berurutan:
  `Baru (NEW)` -> `Diproses (PROCESSING)` -> `Siap Kirim (READY)` -> `Terkirim (DELIVERED)`.
  Status nota pesanan dihitung otomatis dari seluruh itemnya: `Baru` (semua `NEW`), `Diproses` (progres berjalan/campuran), `Siap Kirim` (semua `READY`), dan `Selesai (COMPLETED)` hanya jika seluruh item berstatus `DELIVERED`.

### D. Pembayaran & Piutang (`/ui-payments` & `/ui-orders/{id}`)

- Halaman **Piutang & Pembayaran (`/ui-payments`)** menampilkan daftar nota dengan sisa tagihan terbuka (`outstanding > 0`) dan riwayat pembayaran.
- **Catat Pembayaran:** Buka modal **Catat Pembayaran** dari halaman Piutang atau Detail Pesanan, isi tanggal bayar, metode (`Tunai`, `Transfer`, `QRIS`, `Lainnya`), referensi opsional, dan nominal (DP opsional, cicilan, atau pelunasan penuh).
- **Perlindungan Anti-Overpayment & Anti-Duplikasi:** Sistem menolak nominal yang melebihi sisa tagihan secara atomik (`lockForUpdate`) dan menggunakan kunci idempotensi UUID unik agar klik ganda tidak mencatat pembayaran dua kali.
- Status pembayaran (`Belum Lunas`, `Dibayar Sebagian`, `Lunas`) terpisah dari status pengerjaan; nota `Selesai` dapat tetap `Belum Lunas` hingga pembayaran diterima.

### E. Kategori Biaya & Pengeluaran (`/ui-expense-categories`, `/ui-expenses`)

- **Kategori Biaya (`/ui-expense-categories`):** Tambah kategori baru dengan nama unik, ubah nama kategori, atau aktifkan/nonaktifkan kategori melalui dialog konfirmasi. Kategori yang sudah pernah dipakai tidak dihapus agar riwayat pengeluaran tetap utuh.
- **Pengeluaran (`/ui-expenses`, `/ui-expenses/create`):** Catat kas keluar operasional (bahan bunga, pita, busa, ongkos kurir aktual, listrik/air, konsumsi) menggunakan kategori aktif, tanggal, nominal positif, dan keterangan. Pencatatan pengeluaran dilindungi kunci idempotensi UUID dan tidak memengaruhi nilai penjualan pesanan.

### F. Laporan Keuangan & Ekspor Excel (`/ui-reports`)

- Pilih preset periode (**Hari Ini**, **7 Hari**, **30 Hari**, **Bulan Ini**, **Bulan Lalu**, **Semua Waktu**, atau **Kustom**).
- Menampilkan kartu KPI keuangan, grafik arus kas masuk/keluar dengan garis arus kas bersih, rincian per metode pembayaran, rincian per kategori pengeluaran, dan tabel rincian transaksi (dengan *progressive disclosure*).
- **Ekspor Excel (`.xlsx`):** Klik tombol **Unduh Excel** untuk mengunduh laporan OpenXML multi-sheet dengan nilai numerik murni dan perlindungan terhadap *formula injection*.

---

## 2. Prosedur Koreksi Kesalahan Transaksi (Accounting VOID)

MFMS tidak menyediakan penghapusan fisik (*hard delete*) untuk pembayaran maupun pengeluaran demi integritas audit.

Jika terjadi kesalahan input nominal, metode, atau pesanan:

1. Buka baris transaksi terkait dan pilih aksi **Batalkan Catatan (Void)**.
2. Masukkan alasan pembatalan minimal **10 karakter** secara jelas.
3. Konfirmasi pembatalan:
   - Status transaksi berubah menjadi `VOIDED` (Dibatalkan) dengan waktu dan aktor pencatat di `audit_logs`.
   - Nominal transaksi langsung dikeluarkan dari total kas masuk/kas keluar dan otomatis mengembalikan sisa piutang pesanan (untuk pembayaran).
4. Setelah itu, catat ulang transaksi baru yang benar.

Catatan: mekanisme `VOIDED` adalah koreksi kesalahan pencatatan pembukuan, bukan pencatatan pengembalian dana (*refund*) kepada pelanggan.

---

## 3. Ringkasan Keamanan & Pemeliharaan Berkala

- **Autentikasi & Sesi:** Sesi HTTP-only dengan proteksi CSRF dan pembatasan 6 percobaan login per menit (`throttle:6,1`). Tidak ada registrasi publik.
- **Backup Rutin:** Jalankan `php artisan mfms:backup` secara berkala (lihat [BACKUP_RESTORE.md](BACKUP_RESTORE.md)), simpan salinan file `.enc` dan `.meta.json` di media terpisah, dan jaga salinan `BACKUP_ENCRYPTION_KEY`/`APP_KEY` di pengelola kata sandi pemilik toko.
- **Uji Pemulihan Berkala:** Jalankan `php artisan mfms:restore-test --connection=testing` (atau koneksi pengujian PostgreSQL/MariaDB terisolasi) untuk memastikan arsip backup valid.

---

## 4. Keterbatasan Rilis Saat Ini

1. **Satu Peran Admin:** Belum ada pemisahan hak akses bertingkat (RBAC); seluruh akun admin yang aktif memiliki akses penuh.
2. **Tanpa Diskon, Pajak, dan Pembatalan/Refund Order:** Sesuai aturan bisnis di [BUSINESS_RULES.md](BUSINESS_RULES.md).
3. **Audit Log & Backup via Backend/CLI:** Belum tersedia halaman antarmuka web khusus untuk melihat `audit_logs` atau memicu backup/restore.
4. **Pembayaran Dicatat Setelah Order Tersimpan:** Pembuatan nota dan pencatatan pembayaran dilakukan dalam dua langkah terpisah (simpan order, lalu catat pembayaran pada detail order atau halaman piutang).

Rujukan terkait: [BUSINESS_RULES.md](BUSINESS_RULES.md), [BACKUP_RESTORE.md](BACKUP_RESTORE.md), [DEPLOYMENT.md](DEPLOYMENT.md).
