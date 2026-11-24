# Form Penerimaan UAT Operator & Catatan Risiko Tersisa
**Mutiara Florist Management System (MFMS) — Phase 10 Local Pilot Readiness (Botanical Studio UI)**

---

## 1. Form Penerimaan UAT Operator (User Acceptance Testing)

Diisi oleh Operator Florist dan Pemilik Toko saat uji coba operasional di komputer toko sebelum penggunaan harian penuh (diperbarui sesuai UI **Botanical Studio Workspace**):

- **Tanggal Uji Coba:** `____ / ____ / 2026`
- **Nama Operator Penguji:** `______________________________`
- **Nama Pemilik / Penyetuju:** `______________________________`

| No | Skenario Uji Operasional | Hasil yang Diharapkan | Status (Lulus / Gagal) | Catatan Operator |
|----|--------------------------|------------------------|------------------------|------------------|
| 1 | Menyalakan sistem dengan `Start-MFMS.bat` | MariaDB port `3307` & web `127.0.0.1:8000` aktif tanpa error | [ ] Lulus / [ ] Gagal | |
| 2 | Login dengan akun operator resmi | Berhasil masuk ke Dashboard React (`/ui-dashboard`) | [ ] Lulus / [ ] Gagal | |
| 3 | Tambah & cari pelanggan | Pelanggan tersimpan dan muncul di pencarian (`/ui-customers`) | [ ] Lulus / [ ] Gagal | |
| 4 | Buat pesanan multi-item (`Sudah termasuk harga bunga` & `Ditagih terpisah`) | Total tagihan otomatis akurat sesuai perhitungan item + ongkir | [ ] Lulus / [ ] Gagal | |
| 5 | Catat DP, cicilan, dan pelunasan | Sisa piutang berkurang tepat; saat lunas menjadi Rp0; tidak bisa overpay | [ ] Lulus / [ ] Gagal | |
| 6 | Majukan status item (`Baru` -> `Diproses` -> `Siap kirim` -> `Terkirim`) | Tombol (`Mulai Proses`, `Tandai Siap Kirim`, `Tandai Terkirim` + modal konfirmasi) jelas dan pesanan otomatis `Selesai` | [ ] Lulus / [ ] Gagal | |
| 7 | Catat pengeluaran operasional toko | Saldo kas keluar dan selisih kas di Dashboard & Laporan ikut terbarui | [ ] Lulus / [ ] Gagal | |
| 8 | Buka Laporan & klik **Unduh Excel (.xlsx)** | File terunduh dan terbuka bersih di Microsoft Excel GUI (4 sheet lengkap tanpa peringatan rusak) | [ ] Lulus / [ ] Gagal | |
| 9 | Akses tampilan di layar smartphone / browser sempit | Navigasi bawah/drawer & kartu terbaca rapi tanpa terpotong | [ ] Lulus / [ ] Gagal | |
| 10 | Klik **Keluar Akun** lalu konfirmasi **Keluar Sekarang** | Keluar ke halaman login tanpa error HTTP 419 | [ ] Lulus / [ ] Gagal | |
| 11 | Jalankan `php artisan mfms:backup` & salin ke media eksternal | File `.enc` & `.meta.json` terbentuk tanpa mengubah data toko & tersimpan di luar PC kasir | [ ] Lulus / [ ] Gagal | |
| 12 | Matikan sistem dengan `Stop-MFMS.bat` | Server port `8000` berhenti dengan aman | [ ] Lulus / [ ] Gagal | |

### 1A. Penilaian Usability Operator

| No | Pertanyaan Evaluasi Operator | Jawaban | Catatan |
|----|------------------------------|---------|---------|
| 1 | Apakah operator menemukan tombol yang diperlukan tanpa diarahkan? | [ ] Ya / [ ] Perlu Bantuan | |
| 2 | Apakah istilah menu mudah dipahami? | [ ] Ya / [ ] Kurang Jelas | |
| 3 | Apakah operator memahami perbedaan nilai pesanan, kas masuk, dan piutang? | [ ] Ya / [ ] Perlu Penjelasan | |
| 4 | Apakah operator dapat memperbaiki salah input (**Batalkan Catatan** / edit nota) tanpa bingung? | [ ] Ya / [ ] Bingung | |
| 5 | Apakah operator mengetahui apa yang harus dilakukan jika status pembayaran belum pasti (konflik idempotensi / cek detail nota)? | [ ] Ya / [ ] Belum | |

**Keputusan Penerimaan Pilot:**
- [ ] **DITERIMA** untuk operasional pilot harian lokal
- [ ] **DITUNDA** (sebutkan temuan pada kolom catatan)

Tanda Tangan Operator: `____________________` &nbsp;&nbsp;&nbsp; Tanda Tangan Pemilik: `____________________`

---

## 1B. Checklist Wajib Sebelum Go-Live dengan Data Nyata (Owner Gate)

Sebelum toko mulai mencatat transaksi pelanggan nyata:
- [ ] **Akun demo dinonaktifkan/dihapus secara terkendali:** Pemilik telah menyetujui dan menghapus akun pengujian (`QA Dashboard Temp` / `@example.test`).
- [ ] **Pemahaman hak akses penuh (Tanpa RBAC):** Operator & pemilik memahami bahwa semua akun saat ini memiliki hak akses penuh karena RBAC belum tersedia.
- [ ] **`APP_DEBUG=false`:** Konfigurasi `.env` lokal telah diubah ke `APP_DEBUG=false` sebelum pilot dengan data nyata agar detail teknis tidak tampil ke layar kasir.
- [ ] **Backup & Encryption Key teruji pulih:** Salinan backup `.enc` + `.meta.json` dan kunci enkripsinya tersimpan di luar komputer utama dan terbukti dapat dipulihkan lewat `php artisan mfms:restore-test`.
- [ ] **Persetujuan UAT Manusia:** Form UAT Operator pada Bagian 1 di atas telah ditandatangani oleh operator dan pemilik toko.

---

## 2. Catatan Risiko yang Masih Tersisa (Residual Risks)

Pengelola dan pemilik toko wajib memahami risiko tersisa berikut selama masa pilot lokal:

1. **Belum Ada Pembatasan Hak Akses Peran (No RBAC):**
   - **Kondisi:** Tabel `users` saat ini belum memiliki kolom `role`. Semua akun yang berhasil login memiliki hak penuh untuk melihat laporan keuangan, mencatat pengeluaran, membatalkan (void) pembayaran, maupun mengubah pesanan.
   - **Mitigasi:** Hanya buat akun untuk staf yang benar-benar dipercaya, dan instruksikan setiap operator untuk selalu menekan **Keluar** setelah menggunakan komputer kasir.

2. **Akun Pengujian/Demo Masih Ada di Database Operasional:**
   - **Kondisi:** Hasil audit database `mutiara_florist` menemukan 1 akun pola pengujian (`QA Dashboard Temp` dengan email berakhiran `@example.test`) selain akun utama pemilik.
   - **Mitigasi:** Pemilik toko disarankan menghapus akun pengujian tersebut sebelum transaksi toko harian dimulai agar tidak menjadi celah akses.

3. **Kunci Enkripsi Backup Belum Dipisah dari `APP_KEY` di `.env`:**
   - **Kondisi:** Saat ini `BACKUP_ENCRYPTION_KEY` belum diisi terpisah di `.env`, sehingga `BackupService` menggunakan fallback ke `APP_KEY`.
   - **Mitigasi:** Jangan mengubah atau menjalankan `php artisan key:generate` di `.env` operasional tanpa terlebih dahulu menetapkan `BACKUP_ENCRYPTION_KEY` atau mencadangkan `APP_KEY` lama. Simpan salinan `.env` di tempat aman di luar komputer kasir.

4. **Backup Otomatis Belum Dijadwalkan:**
   - **Kondisi:** Pencadangan masih dilakukan secara manual dengan `php artisan mfms:backup` dan penyalinan manual ke flashdisk/cloud, sesuai kebijakan keamanan hingga prosedur manual terverifikasi rutin oleh operator.
   - **Mitigasi:** Terapkan disiplin SOP tutup toko harian/mingguan untuk menjalankan backup manual dan menyalinnya ke luar komputer utama.

5. **Mode `APP_DEBUG=true` pada Lingkungan Lokal:**
   - **Kondisi:** `.env` lokal saat ini menggunakan `APP_ENV=local` dan `APP_DEBUG=true`.
   - **Mitigasi:** Karena aplikasi hanya diakses secara lokal pada `127.0.0.1:8000` (tidak diekspos ke internet), risiko eksternal minim. Namun untuk kenyamanan operasional harian, pengelola dapat mengubah `APP_DEBUG=false` setelah pilot stabil.

6. **Single-PC Localhost Deployment (Belum Multi-Device / Cloud):**
   - **Kondisi:** Server berjalan hanya di `127.0.0.1:8000` pada satu komputer Windows XAMPP.
   - **Mitigasi:** Jika listrik padam mendadak saat penulisan database, gunakan UPS pada komputer kasir dan lakukan backup rutin di luar komputer utama.
