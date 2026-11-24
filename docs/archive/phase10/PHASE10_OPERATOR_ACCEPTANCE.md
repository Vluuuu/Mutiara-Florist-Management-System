# MFMS Phase 10 — Form Penerimaan UAT Operator (Botanical Studio UI)

Dokumen ini memisahkan **Simulasi Teknis Agent** (yang sudah lulus pada `mfms_testing`) dari **Penerimaan Operator Manusia & Pemilik Toko** (yang wajib diisi langsung oleh pengguna nyata di komputer kasir).

- **Tanggal Uji Coba Operator:** `____ / ____ / 2026`
- **Nama Operator Penguji:** `______________________________`
- **Nama Pemilik / Penyetuju:** `______________________________`

---

## 1. Skenario Uji Operasional (12 Skenario Wajib)

| No | Skenario Operasional | Hasil Simulasi Teknis (Agent) | Hasil Uji Operator Manusia | Catatan Operator |
| --- | --- | --- | --- | --- |
| 1 | Jalankan `scripts\Start-MFMS.bat` | **PASS (Teknis)** | [ ] Lulus / [ ] Gagal | |
| 2 | Login dengan akun operator resmi | **PASS (Teknis)** | [ ] Lulus / [ ] Gagal | |
| 3 | Tambah & cari pelanggan (`/ui-customers`) | **PASS (Teknis)** | [ ] Lulus / [ ] Gagal | |
| 4 | Buat pesanan multi-item (`Sudah termasuk harga bunga` & `Ditagih terpisah`) | **PASS (Teknis)** | [ ] Lulus / [ ] Gagal | |
| 5 | Catat DP, cicilan, pelunasan, & cek tolak overpay | **PASS (Teknis)** | [ ] Lulus / [ ] Gagal | |
| 6 | Majukan status item (`Mulai Proses` -> `Tandai Siap Kirim` -> `Tandai Terkirim` + konfirmasi) hingga `Selesai` | **PASS (Teknis)** | [ ] Lulus / [ ] Gagal | |
| 7 | Catat pengeluaran operasional toko (`/ui-expenses`) | **PASS (Teknis)** | [ ] Lulus / [ ] Gagal | |
| 8 | Cek Piutang (`/ui-payments`) & Laporan -> klik **Unduh Excel (.xlsx)** lalu buka di GUI Microsoft Excel | **PASS (COM Engine)** / **PENDING MANUAL EXCEL GUI** | [ ] Lulus / [ ] Gagal | |
| 9 | Cek tampilan responsif pada layar sempit / HP | **PASS (Teknis)** | [ ] Lulus / [ ] Gagal | |
| 10 | Klik **Keluar Akun** lalu **Keluar Sekarang** | **PASS (Teknis)** | [ ] Lulus / [ ] Gagal | |
| 11 | Jalankan `php artisan mfms:backup` & salin file ke media eksternal | **PASS (Lokal)** / **PENDING OFF-SITE MEDIA** | [ ] Lulus / [ ] Gagal | |
| 12 | Jalankan `scripts\Stop-MFMS.bat` | **PASS (Teknis)** | [ ] Lulus / [ ] Gagal | |

---

## 2. Evaluasi Usability Sederhana (Diisi Operator)

| No | Pertanyaan Evaluasi | Jawaban | Catatan Perbaikan / Penjelasan |
| --- | --- | --- | --- |
| 1 | Apakah operator menemukan tombol yang diperlukan tanpa diarahkan? | [ ] Ya / [ ] Perlu Bantuan | |
| 2 | Apakah istilah menu (`Hari Ini`, `Pesanan`, `Piutang & Bayar`, `Pengeluaran`, `Kategori Biaya`, `Laporan`) mudah dipahami? | [ ] Ya / [ ] Kurang Jelas | |
| 3 | Apakah operator memahami perbedaan **Total Nilai Pesanan**, **Kas Masuk (Sah)**, dan **Piutang Berjalan**? | [ ] Ya / [ ] Perlu Penjelasan | |
| 4 | Apakah operator dapat memperbaiki salah input (**Batalkan Catatan** / edit pesanan) tanpa bingung? | [ ] Ya / [ ] Bingung | |
| 5 | Apakah operator mengetahui langkah saat status pembayaran belum pasti / muncul peringatan konflik idempotensi (buka detail nota & muat ulang halaman)? | [ ] Ya / [ ] Belum | |

---

## 3. Pernyataan & Keputusan Penerimaan Pilot

- [ ] Kami memahami seluruh akun aktif saat ini memiliki hak akses penuh (belum ada pembatasan peran/RBAC).
- [ ] **DITERIMA** untuk operasional pilot harian lokal di komputer kasir toko.
- [ ] **DITUNDA** (jelaskan kendala pada kolom catatan di atas).

Tanda Tangan Operator: `____________________` &nbsp;&nbsp;&nbsp; Tanda Tangan Pemilik: `____________________`
