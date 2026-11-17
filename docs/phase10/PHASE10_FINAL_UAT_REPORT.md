# MFMS Phase 10 — Final UAT & Local Pilot Readiness Report

- **Tanggal Verifikasi:** 18 November 2026 (WIB / `Asia/Jakarta`)
- **Repository:** `Vluuuu/Mutiara-Florist-Management-System`
- **Branch Utama (`main`):** `c50ca1f3eff76bc924a3b81141bee1a3a0d243fb` (PR #6–#10 ter-merge)
- **Branch Dokumentasi Phase 10:** `chore/phase10-final-uat-readiness`
- **Desain Final Terkunci:** Botanical Studio Workspace (`docs/DESIGN.md`)
- **Keputusan Kesiapan Pilot:** **CONDITIONAL** *(Seluruh gate teknis & integrasi MariaDB PASS, namun masih menunggu eksekusi/persetujuan UAT manusia, penyediaan media backup eksternal, penonaktifan akun demo, dan setelan `APP_DEBUG=false` oleh pemilik sebelum pencatatan transaksi nyata).*

---

## 1. Stage 0 — Verifikasi Lingkungan & Baseline Operasional (Read-Only)

### 1.1 Komponen Runtime Windows/XAMPP
| Komponen | Hasil Pemeriksaan |
| --- | --- |
| PHP CLI | `8.2.12` (`D:\xampp\php\php.exe`) |
| Composer | `2.10.3` |
| Node.js / npm | `v24.16.0` / `10.9.8` |
| Laravel Framework | `12.72.0` |
| MariaDB Operasional | `10.4.32-MariaDB` pada `127.0.0.1:3307` (`d:\xampp\mysql\bin\mysqld.exe`, PID `18500`) |
| Production Assets | `public/build/manifest.json` tersedia (`True`); `public/hot` tidak aktif (`False`) |
| Kapasitas Drive `D:\` | ~453.5 GB ruang kosong |

### 1.2 Konfigurasi Aplikasi (Tanpa Eksposur Rahasia)
| Parameter | Nilai Terukur | Catatan |
| --- | --- | --- |
| `APP_ENV` / `APP_DEBUG` | `local` / `true` | Wajib diubah ke `APP_DEBUG=false` sebelum penggunaan transaksi nyata |
| `APP_TIMEZONE` | `Asia/Jakarta` | WIB konsisten |
| `APP_KEY` | Terkonfigurasi (`true`) | Tidak dirotasi |
| `BACKUP_ENCRYPTION_KEY` | Belum diset terpisah (`false`) | `BackupService` fallback ke `APP_KEY` |
| `SESSION_DRIVER` / `LIFETIME` | `database` / `120` menit (`http_only=true`, `same_site=lax`) | Aman untuk sesi lokal |
| `LOG_CHANNEL` / `AUTH_GUARD` | `stack` / `web` | Tidak ada registrasi publik |
| `DB_CONNECTION` (Operasional) | `mysql` -> `127.0.0.1:3307` (`mutiara_florist`) | Tidak dimodifikasi selama verifikasi |
| `mariadb_testing` | `127.0.0.1:3307` (`mfms_testing`, `is_testing => true`) | Terisolasi untuk seluruh uji mutasi |

### 1.3 Verifikasi Baseline Database Operasional (Read-Only Pra & Pasca Pengujian)

Untuk menjaga privasi repository publik, rincian jumlah record dan nominal finansial database operasional tidak dipublikasikan. Pemeriksaan dilakukan secara read-only sebelum Stage 1 dan diulang setelah Stage 5 selesai:

| Cakupan Audit Operasional (`mutiara_florist`) | Metode Verifikasi | Konsistensi Pra vs Pasca Uji | Status |
| --- | --- | --- | --- |
| Seluruh 9 tabel inti (`users`, `customers`, `orders`, `order_items`, `payments`, `expense_categories`, `expenses`, `audit_logs`, `migrations`) | Query `COUNT(*)` read-only | Identik `100%` (`0` baris berubah) | **PASS** |
| Invarian finansial (`orders.total_amount`, `payments POSTED`, `expenses POSTED`, piutang berjalan) | Query agregasi read-only | Identik `100%` (`Rp0` selisih) | **PASS** |
| Audit akun pengguna | Pemeriksaan metadata akun (tanpa kredensial) | Teridentifikasi `1` akun operator utama resmi (identitas dianonimkan) dan `1` akun demo/pengujian (`@example.test`) yang menunggu persetujuan penghapusan pemilik | **CONDITIONAL (Gate Pemilik)** |

---

## 2. Stage 1 — Automated Regression Gate & Audit 5 Viewport

### 2.1 Isolasi Pengujian & Hasil Build/Test
- `phpunit.xml` dikonfigurasi ke `DB_CONNECTION=sqlite` (`:memory:`), dengan `DB_TEST_HOST=127.0.0.1`, `DB_TEST_PORT=3307`, `DB_TEST_DATABASE=mfms_testing`. Tidak ada test yang menargetkan mutasi ke `mutiara_florist`.
- `npm run typecheck` (`tsc --noEmit`): **PASS** (0 error).
- `npm run build` (`vite build` v8.3.5): **PASS** (`2.23s`, `public/build/manifest.json` `0.49 kB`).
- `php artisan test`: **PASS — 170 passed (2075 assertions)** dalam `11.77s`, 0 skipped, 0 failure (termasuk 20 test pada `PaymentConcurrencyLockTest` & `DatabaseBackupTest` yang juga memverifikasi paralelisme & snapshot pada `mariadb_testing`).
- Anti-Slop Contrast Checker (`.agents/skills/antislop-human/contrast-check.py`):
  - `--selftest`: **PASS** (`9 reference pairs OK`).
  - Botanical Studio palette check: `#1E2420` vs `#FBF9F6` (`15.04:1`), `#525B54` vs `#FBF9F6` (`6.70:1`), `#F6F4EF` vs `#143326` (`12.48:1`), `#C6D7CE` vs `#143326` (`9.15:1`), `#143326` vs `#E6EFEA` (`11.69:1`), `#8C3B4A` vs `#FDF2F4` (`6.76:1`), dan border input `#858E87` vs `#FFFFFF` (`3.38:1`, memenuhi threshold UI component WCAG 1.4.11 >= `3.0:1`).

### 2.2 Browser Audit 5 Viewport, Modal Focus, & Anti-419 (`agent-browser` pada `127.0.0.1:8010` -> `mfms_testing`)
Diuji pada **35 kombinasi** (`5 viewport` x `7 rute`: `/ui-dashboard`, `/ui-customers`, `/ui-orders`, `/ui-orders/create`, `/ui-payments`, `/ui-expenses`, `/ui-reports`):
- Viewport: `360x780`, `390x844`, `768x1024`, `1024x768`, `1440x900`.
- Horizontal overflow (`scrollWidth > innerWidth`): **0 pelanggaran**.
- Error JavaScript (`agent-browser errors`): **0 error (`[]`)**.
- Em-dash (`U+2014`) di teks DOM UI: **0 temuan**.
- Kebocoran kode enum/SQL mentah (`POSTED`, `VOIDED`, `SEPARATE`, `INCLUDED`, `UNPAID`, `PARTIAL`, `PAID`, `order_date`) di teks DOM UI: **0 temuan**.
- Modal focus handling (`PaymentModal`): `role="dialog"` + `aria-modal="true"` aktif, fokus awal masuk ke `#payment-modal-amount`, `15x Tab` tetap terperangkap di dalam dialog (`true`), `Escape` menutup modal bersih.
- Login -> Logout (`Keluar Akun` -> `Keluar Sekarang`) -> Re-login: berhasil tanpa HTTP 419.
- Kesesuaian visual terhadap `docs/DESIGN.md` (Botanical Studio): terverifikasi secara visual melalui tangkapan layar pada `docs/phase10/screenshots/`.

---

## 3. Stage 2 — Integrasi MariaDB Terisolasi (`mfms_testing` Port 3307) & Rekonsiliasi

Dijalankan terhadap server uji terisolasi `http://127.0.0.1:8010` yang tersambung khusus ke `mariadb_testing` (`mfms_testing` pada MariaDB `10.4.32-MariaDB` port `3307`):

| No | Skenario Pengujian | Hasil Terverifikasi |
| --- | --- | --- |
| 1 | Membuat pelanggan & pencarian karakter khusus | `Toko Melati %_!B\C` (`081234567890` nol depan utuh) & `Ibu Sinta Wijaya` tersimpan; pencarian `?q=%25` cocok tepat |
| 2 | Pesanan multi-item | Order #1 (2 item) & Order #2 (1 item) tersimpan; Order #1 dimajukan linear `Baru -> Diproses -> Siap kirim -> Terkirim` menjadi `Selesai` |
| 3 | Ongkir `INCLUDED` & `SEPARATE` | Item 1 (`1 x Rp1.000.000`, included `Rp0`) + Item 2 (`2 x Rp250.000`, separate `Rp50.000`) = `Rp1.550.000` |
| 4 | DP, cicilan, pelunasan | Order #1 DP `Rp500.000`, cicilan `Rp600.000`, revisi `Rp500.000`, `Rp450.000`, pelunasan akhir `Rp100.000`; Order #2 DP `Rp100.000` |
| 5 | Penolakan overpayment | Nominal `Rp500.000` ditolak saat sisa tagihan lebih kecil; modal tetap terbuka dengan pesan penolakan |
| 6 | Idempotency retry | Pemanggilan ulang `PaymentService::record` dengan `idempotency_key` & payload identik mengembalikan `payment_id: 6` yang sama (tanpa duplikasi) |
| 7 | Konflik idempotency & riwayat | Pengiriman `idempotency_key` sama dengan nominal berbeda (`Rp50.000` vs `Rp100.000`) melempar `ValidationException` (`Identitas transaksi sudah digunakan dengan data berbeda. Muat ulang halaman.`) dan riwayat tetap utuh |
| 8 | Pembatalan catatan bayar (Void) | Payment #2 (`Rp600.000`, `TRF_BCA%99!1\X`) di-void lewat UI dengan alasan `Salah input nominal DP uji UAT fase 10`; langsung dikecualikan dari saldo |
| 9 | Pengeluaran & pembatalannya | Pengeluaran `Rp200.000` (`POSTED`) & `Rp150.000` (`VOIDED`, alasan `Koreksi pengeluaran uji UAT fase 10`) tercatat akurat |
| 10 | Kategori aktif/nonaktif | Kategori `Perlengkapan Sementara` dinonaktifkan lewat modal konfirmasi, tidak muncul di dropdown `/ui-expenses/create` |
| 11 | Pencarian literal `%`, `_`, `!`, `\` | `?q=%25`, `?q=_`, `?q=!`, `?q=%5C` pada `/ui-payments` seluruhnya menemukan `TRF_BCA%99!1\X` dan **tidak** mencocokkan `DP-ORDER2` (`falsePosOrder2: false`) |
| 12 | Rekonsiliasi penuh antar modul | Nilai 100% identik antara query SQL langsung, `DashboardService::stats()`, `PaymentService::getReceivables()`, `Expenses`, dan `ReportService::getFinancialReport()` |

### Tabel Rekonsiliasi Akhir `mfms_testing`
| Metrik Keuangan | SQL `mfms_testing` | Dashboard | Payments | Reports |
| --- | ---: | ---: | ---: | ---: |
| Total Nilai Pesanan (`2` pesanan) | `Rp1.950.000` | `Rp1.950.000` | - | `Rp1.950.000` |
| Kas Masuk Sah (`POSTED`) | `Rp1.650.000` | `Rp1.650.000` | - | `Rp1.650.000` |
| Kas Masuk Dibatalkan (`VOIDED`, dikecualikan) | `Rp600.000` | Dikecualikan | - | Dikecualikan |
| Kas Keluar Sah (`POSTED`) | `Rp200.000` | `Rp200.000` | - | `Rp200.000` |
| Kas Keluar Dibatalkan (`VOIDED`, dikecualikan) | `Rp150.000` | Dikecualikan | - | Dikecualikan |
| Selisih Kas | `Rp1.450.000` | `Rp1.450.000` | - | `Rp1.450.000` |
| Sisa Piutang Berjalan (`1` nota) | `Rp300.000` | `Rp300.000` | `Rp300.000` | `Rp300.000` |

---

## 4. Stage 3 — Backup & Restore Disaster Recovery

- **Audit Kode:** `BackupService` (`app/Services/BackupService.php`) dan `routes/console.php` menerapkan snapshot konsisten `REPEATABLE READ` + `START TRANSACTION WITH CONSISTENT SNAPSHOT`, enkripsi terotentikasi `AES-256-GCM` dengan `AAD`, checksum `SHA-256`, penulisan atomik `.tmp`, izin file `0600`, dan guard keras yang menolak restorasi ke database operasional (`mutiara_florist`, `mfms`, `laravel`, `default`).
- **Eksekusi Backup Operasional Read-Only (`php artisan mfms:backup`):**
  - Sepasang arsip terenkripsi baru (`mfms_backup_<timestamp>.enc` dan `.meta.json`, ukuran terenkripsi `9,127 bytes`, sandi `AES-256-GCM` + `AAD` + `SHA-256`) terbentuk di `storage/app/backups/` tanpa menimpa arsip sebelumnya maupun mengubah database operasional.
- **Eksekusi Uji Pemulihan Terisolasi (`php artisan mfms:restore-test <arsip>.enc --connection=mariadb_testing`):**
  - Checksum SHA-256: **VALID**
  - Rekonsiliasi Baris Seluruh 9 Tabel Inti (`users`, `customers`, `orders`, `order_items`, `payments`, `expense_categories`, `expenses`, `audit_logs`, `migrations`): **VALID (100% identik dengan snapshot)**
  - Integritas Metrik Keuangan (`orders_total_amount`, `payments_posted_amount`, `expenses_posted_amount`): **VALID (100% identik dengan snapshot)**
  - Relasi Foreign Key (No Orphans): **VALID**
- **Gate Penyimpanan Off-Site (Belum Lulus):** Pemeriksaan `Win32_LogicalDisk` hanya mendeteksi disk lokal `C:` dan `D:` (`DriveType = 3`), tanpa media eksternal USB maupun folder sinkronisasi off-site yang terpasang/terverifikasi. Gate backup off-site dicatat sebagai **BELUM LULUS** sampai pemilik menyalin `.enc`, `.meta.json`, dan salinan kunci enkripsi ke media eksternal.

---

## 5. Stage 4 — Verifikasi Skrip Startup & Shutdown Windows

Diperiksa terhadap `scripts/Start-MFMS.bat`, `scripts/Stop-MFMS.bat`, `scripts/start-mfms.ps1`, dan `scripts/stop-mfms.ps1`:

| Skenario | Metode Verifikasi | Hasil |
| --- | --- | --- |
| 1. MariaDB belum menyala | Audit kode (`start-mfms.ps1:108-138`) | Menyalakan `mysqld.exe` sekali & menunggu port `3307` hingga 15 dtk *(tidak dimatikan paksa pada sesi live agar `mysqld.exe` XAMPP PID 18500 tetap aman)* |
| 2. MariaDB sudah menyala | Uji live | Exit `0`, deteksi `[OK] MariaDB sudah aktif di port 3307.` |
| 3. Port 3307 bentrok | Audit kode (`start-mfms.ps1:142-146`) | Tidak menyalakan instance ganda; gagal aman pada pengecekan PDO Laravel |
| 4. Port 8000 sudah dipakai MFMS | Uji live | Exit `0`, deteksi `[OK] Server MFMS sudah berjalan aktif... (tidak menjalankan instance ganda).` |
| 5. Port 8000 dipakai aplikasi lain | Uji live (server dummy Python pada `127.0.0.1:8000`) | `start-mfms.ps1` exit `1` (`[GAGAL] Port 8000 sudah dipakai oleh aplikasi lain`); `stop-mfms.ps1` membiarkan proses lain tetap hidup |
| 6. Asset React tidak tersedia | Uji live (rename sementara `public/build/manifest.json`) | Exit `1` (`[GAGAL] Asset tampilan React... belum tersedia`), file dipulihkan segera |
| 7. Koneksi database gagal | Audit kode (`start-mfms.ps1:142-146`) | Exit `1` tanpa migrasi/seeding/reset |
| 8. Startup berhasil | Uji live | Bind eksklusif ke `127.0.0.1:8000`, state tercatat di `mfms_laravel.state.json`, `/login` merespons HTTP `200` |
| 9. Shutdown aman | Uji live | Menghentikan hanya listener PHP milik MFMS, membersihkan state, MariaDB PID `18500` tetap berjalan utuh |
| 10. Pemulihan pasca restart Windows | Simulasi live (state file PID usang `999999`) | `stop-mfms.ps1` membersihkan state usang tanpa mengganggu proses lain; `start-mfms.ps1` kembali menyala normal |

---

## 6. Stage 5 — Verifikasi Microsoft Excel Desktop

- File `.xlsx` diekspor langsung dari endpoint tombol **Unduh Excel (.xlsx)** pada `/ui-reports` (`preset=30d&from=2026-10-20&to=2026-11-18`, `HTTP 200`, `7,315 bytes`).
- **Uji Engine Microsoft Excel Terpasang (`C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE` versi `16.0.20527.20196`) melalui COM Automation (`DisplayAlerts = $true`, read-only):**
  - Terbuka bersih tanpa pesan error file rusak maupun dialog perbaikan workbook.
  - Memverifikasi 4 worksheet:
    1. `Ringkasan` (`29 x 4`): `Total Nilai Pesanan` = `1950000` (`Rp #.##0`), `Kas Masuk` = `1650000`, `Kas Keluar` = `200000`, `Selisih Kas` = `1450000`, `Piutang Berjalan` = `300000`.
    2. `Pesanan` (`6 x 9`): Total `1950000` | `1650000` | `300000`.
    3. `Kas Masuk (POSTED)` (`10 x 8`): `5` transaksi sah, total `1650000`, pembayaran `VOIDED` tidak disertakan, prefix apostrof `'` untuk proteksi formula injection aktif.
    4. `Kas Keluar (POSTED)` (`6 x 5`): `1` transaksi sah, total `200000`, pengeluaran `VOIDED` tidak disertakan.
  - Seluruh nilai cocok 100% dengan `/ui-reports` dan query SQL `mfms_testing`.
  - Workbook ditutup tanpa menyimpan perubahan terhadap file sumber.
- **Catatan Batasan:** Eksekusi melalui COM berjalan headless (`Visible = $false`). Inspeksi visual GUI interaktif langsung pada layar Excel oleh operator manusia tetap ditandai **PENDING MANUAL EXCEL GUI CHECK** dalam UAT Operator (Skenario #8).

---

## 7. Stage 6, Stage 7, & Public Documentation Privacy Gate

- Simulasi UAT teknis oleh agent telah selesai dengan data sintetis di `mfms_testing`. **Penerimaan operator manusia tidak boleh dipalsukan** dan disiapkan pada `docs/phase10/PHASE10_OPERATOR_ACCEPTANCE.md` serta `docs/PILOT_UAT_ACCEPTANCE_AND_RISKS.md`.
- Bukti tangkapan layar Botanical Studio tersimpan di `docs/phase10/screenshots/` (**seluruhnya berasal dari data sintetis `mfms_testing`**, tanpa data pelanggan nyata maupun kredensial/rahasia):
  - `dashboard-1440.png`, `dashboard-1024.png`, `dashboard-768.png`, `dashboard-360.png`, `dashboard-empty-1440.png`
  - `orders-1440.png`, `orders-360.png`, `order-detail-1440.png`
  - `payments-1440.png`, `expenses-1440.png`, `categories-1440.png`
  - `reports-1440.png`, `reports-360.png`
- **Audit Privasi Publik (PATCH-01):**
  - Identitas email/nama personal operator serta angka transaksi dan jumlah record dari database operasional telah direduksi/dianonimkan dari dokumen pada HEAD saat ini.
  - Tidak ada file `.env`, token, encryption key, maupun file backup (`.enc`/`.meta.json`) yang dimasukkan ke Git.
  - **Catatan Riwayat Git:** Data yang sempat tercatat pada commit publik sebelumnya (`ae748955e9708bf49903b31da7d9e8c586a0a2a5`) **tidak otomatis terhapus** oleh commit redaksi baru pada Git history. Evaluasi penanganan riwayat commit publik (misal squash/rewrite sebelum atau sesudah review oleh pemilik repository) perlu diputuskan secara terpisah tanpa force-push atau rewrite otomatis oleh agent.

### Keputusan Akhir Phase 10: **CONDITIONAL**
Aplikasi aman secara arsitektur, perhitungan keuangan, enkripsi backup, pemulihan MariaDB, dan tata letak responsif Botanical Studio. Status pilot tetap **CONDITIONAL** dan akan naik menjadi **PILOT READY** setelah seluruh item owner-gate pada `docs/phase10/PHASE10_RELEASE_READINESS_CHECKLIST.md` diselesaikan dan ditandatangani oleh operator & pemilik toko.
