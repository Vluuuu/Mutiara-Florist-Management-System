# MFMS Phase 10 — Residual Risk Register

Daftar risiko yang masih tersisa pasca verifikasi teknis Phase 10 beserta tingkat dampak dan mitigasinya sebelum & selama pilot lokal:

| ID | Risiko | Tingkat | Status Saat Ini | Mitigasi Operasional |
| --- | --- | --- | --- | --- |
| RSK-01 | Belum adanya penyimpanan backup off-site/eksternal yang terverifikasi | **Tinggi (P1 Gate)** | Terbuka — hanya ada disk internal `C:` dan `D:` saat audit | Wajib sediakan flashdisk khusus toko atau sinkronisasi cloud terenkripsi; salin `.enc` + `.meta.json` setiap selesai backup |
| RSK-02 | Akun pengujian `QA Dashboard Temp` (`qa-dashboard-temp@example.test`) masih ada di `mutiara_florist` | **Tinggi (P1 Gate)** | Terbuka — belum dihapus tanpa izin pemilik | Pemilik meninjau dan menghapus akun `@example.test` sebelum transaksi nyata dimulai |
| RSK-03 | `APP_DEBUG=true` masih aktif pada `.env` lokal | **Sedang (P1 Gate)** | Terbuka — tidak diubah tanpa persetujuan pemilik | Ubah `APP_DEBUG=false` di `.env` sebelum go-live agar jejak stack trace tidak tampil di layar kasir |
| RSK-04 | Belum ada pembatasan peran pengguna (No RBAC) & CLI `mfms:create-admin` hanya 1x saat `users` kosong | **Sedang** | Diterima dalam batasan MVP | Batasi akses PC kasir hanya untuk staf tepercaya, biasakan **Keluar Akun**, dan kelola akun lewat pemilik/teknisi |
| RSK-05 | `BACKUP_ENCRYPTION_KEY` belum dipisah dari `APP_KEY` | **Sedang** | Terbuka — fallback ke `APP_KEY` aktif | Jangan jalankan `php artisan key:generate`; simpan salinan `.env` di luar komputer kasir (password manager/brankas pemilik) |
| RSK-06 | Uji Microsoft Excel baru diverifikasi via engine COM (`Visible = $false`), belum interaksi GUI manusia | **Rendah-Sedang** | Pending Operator UAT #8 | Operator membuka langsung `.xlsx` di jendela Excel saat UAT manusia |
| RSK-07 | Operasional tunggal pada 1 PC Windows (`127.0.0.1:8000`) | **Rendah** | Desain pilot lokal | Gunakan UPS untuk mencegah korup saat listrik padam mendadak; jangan membuka host ke LAN/internet tanpa hardening |
| RSK-08 | Backup masih dijalankan secara manual (`php artisan mfms:backup`) | **Rendah-Sedang** | Sesuai kebijakan SOP | Terapkan checklist tutup toko harian/mingguan untuk backup dan salin off-site |
