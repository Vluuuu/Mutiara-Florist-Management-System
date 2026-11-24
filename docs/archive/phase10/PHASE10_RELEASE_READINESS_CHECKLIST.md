# MFMS Phase 10 — Release Readiness & Owner Gate Checklist

- **Baseline `main`:** `c50ca1f3eff76bc924a3b81141bee1a3a0d243fb`
- **Status Saat Ini:** **CONDITIONAL**

---

## A. Gate Teknis (Diverifikasi pada Sesi Phase 10)

| Gate | Status | Bukti / Catatan |
| --- | --- | --- |
| TypeScript check (`npm run typecheck`) | **PASS** | 0 errors |
| Production bundle (`npm run build`) | **PASS** | `public/build/manifest.json` terbentuk; `public/hot` tidak ada |
| Automated test suite (`php artisan test`) | **PASS** | **170 passed (2075 assertions)** dalam `11.77s`, 0 skipped |
| Contrast checker (`contrast-check.py --selftest` & palette) | **PASS** | `9 reference pairs OK`; seluruh pasangan UI Botanical Studio lulus WCAG AA |
| Audit 5 viewport & 0 horizontal overflow | **PASS** | `35/35` kombinasi (`360x780`, `390x844`, `768x1024`, `1024x768`, `1440x900`) = 0 overflow, 0 JS error, 0 em-dash, 0 raw enum leak |
| Modal focus trap, Escape, & login/logout anti-419 | **PASS** | Diuji interaktif di Chromium |
| MariaDB isolated E2E (`mfms_testing` port `3307`) | **PASS** | 12 skenario & rekonsiliasi 100% cocok antara UI, service, dan SQL |
| Backup terenkripsi AES-256-GCM dari DB operasional | **PASS** | Arsip `.enc` + `.meta.json` (`9,127 bytes`) dibuat read-only tanpa mengubah DB operasional |
| Uji restorasi ke koneksi testing (`mariadb_testing`) | **PASS** | Checksum SHA-256, jumlah baris seluruh 9 tabel inti, metrik finansial, dan foreign key seluruhnya **VALID** |
| Skrip startup & shutdown aman Windows | **PASS** | Hanya menyentuh proses milik MFMS di `127.0.0.1:8000`; menolak port bentrok; aman terhadap MariaDB |
| Microsoft Excel engine check (`EXCEL.EXE` 16.0.20527.20196) | **PASS (Engine COM)** | 4 sheet terbuka bersih tanpa corrupt alert; inspeksi GUI interaktif manusia masuk gate manual |
| Integritas database operasional `mutiara_florist` | **PASS** | 0 baris & Rp0 perubahan sebelum/sesudah seluruh pengujian |
| Kebersihan Git & Privacy Gate Publik | **CONDITIONAL (HEAD Redacted)** | Tidak ada `.env`, kunci enkripsi, password, atau file backup di Git; seluruh 13 screenshot berasal dari data sintetis `mfms_testing`; email personal & angka operasional telah direduksi pada HEAD (PATCH-01), namun jejak commit publik sebelumnya (`ae74895`) tetap ada di riwayat Git hingga dievaluasi terpisah oleh pemilik |

---

## B. Gate Operasional & Persetujuan Pemilik (Wajib Sebelum Transaksi Nyata)

| No | Syarat Wajib Go-Live | Status Saat Ini | Tindakan yang Diperlukan |
| --- | --- | --- | --- |
| 1 | Akun resmi operator tersedia | **TERSEDIA** | Akun operator resmi utama aktif pada database operasional (identitas & email dianonimkan dalam dokumentasi publik) |
| 2 | Akun demo/pengujian (`@example.test`) dinonaktifkan/dihapus | **BELUM** | Pemilik menyetujui dan menghapus akun pengujian/demo dari database operasional sebelum transaksi nyata |
| 3 | Pemahaman seluruh operator bahwa belum ada RBAC | **PENDING** | Operator dan pemilik menandatangani pemahaman akses penuh di `PHASE10_OPERATOR_ACCEPTANCE.md` |
| 4 | `APP_DEBUG=false` pada `.env` lokal sebelum transaksi nyata | **BELUM** | Saat ini `APP_DEBUG=true` (`APP_ENV=local`); ubah ke `APP_DEBUG=false` atas persetujuan pemilik |
| 5 | Kunci enkripsi backup tersimpan aman (dan terpisah bila diinginkan) | **CONDITIONAL** | `APP_KEY` aktif; `BACKUP_ENCRYPTION_KEY` belum dipisah; simpan salinan `.env` di luar PC kasir |
| 6 | Backup eksternal / off-site tersedia | **BELUM LULUS** | Belum ada flashdisk/media eksternal atau cloud sinkronisasi terpasang saat audit; salin `.enc` + `.meta.json` ke luar PC |
| 7 | Inspeksi GUI interaktif Microsoft Excel oleh manusia | **PENDING MANUAL EXCEL TEST** | Buka `.xlsx` hasil **Unduh Excel (.xlsx)** secara visual di layar Excel bersama operator |
| 8 | Persetujuan UAT Operator & Pemilik Toko | **PENDING** | Laksanakan 12 skenario & 5 evaluasi usability pada `PHASE10_OPERATOR_ACCEPTANCE.md` hingga ditandatangani |
