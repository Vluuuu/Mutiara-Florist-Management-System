# MFMS Phase 13H: Laporan Pembersihan Repositori & Persiapan Rilis Akademik

**Tanggal:** 24 November 2026  
**Repositori:** [https://github.com/Vluuuu/Mutiara-Florist-Management-System](https://github.com/Vluuuu/Mutiara-Florist-Management-System)  
**Baseline Rilis Produksi:** Branch `release/phase13-ui-bi`, commit `0b436a9bc8e53328f633ee21a0666eaa6b3cbe6d`  
**Branch Pembersihan Lokal:** `chore/phase13h-repo-cleanup` *(dibuat dari `0b436a9`, belum di-push, belum di-merge, tanpa perubahan runtime)*  
**Produksi:** [https://admin.mutiaraflorist.id](https://admin.mutiaraflorist.id)  
**Figma UI (Phase 13):** [https://www.figma.com/design/tgjOozJg6XHMossb5IK4px](https://www.figma.com/design/tgjOozJg6XHMossb5IK4px)

---

## 1. Ringkasan Struktur Repositori (Sebelum & Sesudah)

Pekerjaan Phase 13H berfokus penuh pada penataan dokumentasi, penyegaran `README.md`, audit konfigurasi deployment, pembersihan pelacakan AI skills, dan audit keamanan repositori publik tanpa mengubah kode aplikasi, migrasi database, dependensi, maupun perilaku container produksi.

### Sebelum Pembersihan (`0b436a9`)

- Root repositori memuat dokumen perencanaan historis (`PHASE15_FULL_CLOUD_MIGRATION_PLAN.md`) serta konfigurasi eksperimental Railway (`railway.json`, `nixpacks.toml`) bercampur dengan berkas aktif.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/LOCAL_SETUP.md`, `docs/TEST_PLAN.md`, dan `docs/HANDOVER_OPERATOR_GUIDE.md` masih memuat klaim lama (Phase 1 sampai 3.2, Blade + Alpine.js + Chart.js, MySQL lokal saja, 65 tes).
- Direktori `docs/` mencampur 30+ dokumen aktif dan laporan fase lama di tingkat akar tanpa indeks terpadu, serta mengandung tautan `file:///d:/xampp/...` lokal.
- 14 berkas vendor keterampilan AI di `.agents/skills/` dilacak langsung dalam repositori publik.
- Sejumlah laporan historis fase 12/14/15 dan skrip bantu `scripts/staging-supabase-runner.ps1` memuat metadata operasional privat (alamat email pemilik, path profil Windows lokal, sidik jari kunci/tag GCM backup, serta project ref staging).

### Sesudah Pembersihan (`chore/phase13h-repo-cleanup`)

- **Root repositori bersih:** hanya menyimpan kode sumber/konfigurasi runtime & build aktif, `README.md` Phase 13, `AGENTS.md`, `Dockerfile`, `docker/`, `scripts/`, dan `render.yaml` *(diusulkan untuk verifikasi pemilik sebelum dihapus/diarsipkan)*.
- **Struktur `docs/` terbagi tiga lapisan jelas:**
  1. `docs/*.md` (11 dokumen aktif termasuk indeks baru [docs/README.md](../README.md) dan panduan produksi [docs/DEPLOYMENT.md](../DEPLOYMENT.md)).
  2. `docs/phase13/` (dipertahankan utuh di tempat beserta seluruh tangkapan layar QA sintetis untuk kestabilan rujukan laporan akademik dan `README.md`).
  3. `docs/archive/` (`planning/`, `early-phases/`, `phase7/`, `phase8/`, `phase9/`, `phase10/`, `phase12/`, `phase14/`, `phase15/`, `deployment-experiments/`).
- **AI skills:** 14 berkas lokal di `.agents/skills/` tetap utuh di disk, tidak lagi dilacak Git (`git rm -r --cached`), dikecualikan pada `.gitignore` dan `.dockerignore`, serta didokumentasikan secara transparan pada `AGENTS.md`.
- **Tautan Markdown:** 0 tautan rusak dan 0 tautan lokal `file:///` pada seluruh 63 berkas Markdown yang dilacak.

### Klasifikasi Audit Repositori

| Kategori | Cakupan Utama | Tindakan Phase 13H |
| --- | --- | --- |
| Kode sumber aplikasi | `app/`, `resources/`, `routes/`, `database/`, `public/`, `bootstrap/` | Tidak diubah (diff 0 baris). |
| Konfigurasi runtime & build | `config/`, `composer.json`, `composer.lock`, `package.json`, `package-lock.json`, `vite.config.js`, `tsconfig.json`, `components.json`, `phpunit.xml`, `Dockerfile`, `docker/` | Tidak diubah (diff 0 baris); `.gitignore` & `.dockerignore` diperkuat. |
| Dokumentasi aktif | `README.md`, `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/BUSINESS_RULES.md`, `docs/PRICING_AND_SHIPPING.md`, `docs/DESIGN.md`, `docs/LOCAL_SETUP.md`, `docs/DEPLOYMENT.md`, `docs/HANDOVER_OPERATOR_GUIDE.md`, `docs/TEST_PLAN.md`, `docs/BACKUP_RESTORE.md` | Diperbarui penuh ke Phase 13, bahasa Indonesia ringkas, bebas em dash. |
| Bukti QA Phase 13 | `docs/phase13/` (laporan 13A sampai 13E, `screenshots*`) | Dipertahankan di tempat; tautan `file:///` dikonversi menjadi tautan relatif. |
| Dokumentasi historis | `PHASE15_FULL_CLOUD_MIGRATION_PLAN.md`, laporan Phase 2 sampai 15, `design-options/`, `phase8-2/`, `screenshots/phase7/` | Dipindahkan via `git mv` ke `docs/archive/*` (riwayat rename terjaga). |
| Skrip alat bantu | `scripts/start-mfms.ps1`, `stop-mfms.ps1`, `Start-MFMS.bat`, `Stop-MFMS.bat`, `staging-supabase-runner.ps1` | Dipertahankan; `staging-supabase-runner.ps1` disanitasi menjadi parameter/env runtime. |
| AI agent skills | `.agents/skills/` (14 berkas), `AGENTS.md` | Dihapus dari indeks Git saja (`--cached`), salinan lokal utuh, `AGENTS.md` diperbarui. |
| Eksperimen deployment | `railway.json`, `nixpacks.toml`, `render.yaml` | `railway.json` & `nixpacks.toml` dipindah ke `docs/archive/deployment-experiments/`; `render.yaml` diusulkan untuk konfirmasi pemilik. |
| Referensi pihak ketiga (lokal) | `docs/phase13/references/` (tidak terlacak) | Tetap lokal-only dan ditambahkan ke `.gitignore`. |

---

## 2. Daftar Dokumentasi yang Diperbarui & Ditambahkan

1. [README.md](../../README.md) (ditulis ulang): ringkasan bisnis, fitur Phase 13, 5 tangkapan layar desktop sintetis `1440px` dari `docs/phase13/screenshots-phase13e/`, stack aktual (Laravel 12, PHP 8.3 Docker / `^8.2`, React 19, TypeScript, Inertia.js 3, Tailwind CSS 4, PostgreSQL/Supabase, Docker Ubuntu, Cloudflare Tunnel), arsitektur, instalasi lokal, panduan database, rujukan 236 tes lulus Phase 13E, deployment, tautan produksi & Figma, pembedaan commit aplikasi `0b436a9` vs commit dokumentasi, keamanan, dan keterbatasan.
2. [docs/README.md](../README.md) (baru): indeks terstruktur untuk dokumentasi aktif, bukti QA Phase 13, dan arsip historis.
3. [docs/DEPLOYMENT.md](../DEPLOYMENT.md) (baru): panduan deployment produksi Ubuntu + Docker PHP 8.3 FPM/Nginx/Supervisord + Supabase PostgreSQL + Cloudflare Tunnel + kebijakan non-auto-migration.
4. [docs/ARCHITECTURE.md](../ARCHITECTURE.md): diperbarui dari v0.5 Blade/MySQL menjadi arsitektur penuh Phase 13 React/Inertia, PostgreSQL/Supabase, Docker, dan Zero Trust.
5. [docs/DATABASE.md](../DATABASE.md): diperbarui untuk paritas PostgreSQL/MariaDB/SQLite, `ILIKE`/`LIKE`, sinkronisasi sequence `setval`, dan keamanan RLS Supabase.
6. [docs/LOCAL_SETUP.md](../LOCAL_SETUP.md): diperbarui untuk PHP 8.2/8.3, Node 20+, PostgreSQL & MariaDB lokal, Vite 8, dan pengujian SQLite terisolasi.
7. [docs/HANDOVER_OPERATOR_GUIDE.md](../HANDOVER_OPERATOR_GUIDE.md): diselaraskan dengan UI *Calm Botanical Workspace V2*, URL produksi `admin.mutiaraflorist.id`, Dashboard BI, filter *Semua Waktu* di Laporan, dan SOP `VOIDED`.
8. [docs/TEST_PLAN.md](../TEST_PLAN.md): diperbarui ke bukti 236 tes lulus Phase 13E lintas SQLite, PostgreSQL 17, dan MariaDB 10.11 sambil mempertahankan matriks T-01 sampai T-38.
9. [docs/BACKUP_RESTORE.md](../BACKUP_RESTORE.md): diperbarui mencakup adapter snapshot `REPEATABLE READ` PostgreSQL, restorasi topologis, sinkronisasi sequence `setval`, dan catatan Supabase Free.
10. [docs/DESIGN.md](../DESIGN.md): ditambahkan tautan Figma Phase 13 dan diperbarui jalur rujukan arsip Phase 8.
11. [docs/BUSINESS_RULES.md](../BUSINESS_RULES.md) & [docs/PRICING_AND_SHIPPING.md](../PRICING_AND_SHIPPING.md): seluruh invarian bisnis dan rumus harga dipertahankan utuh; header dan tautan internal diselaraskan dengan struktur `docs/archive/planning/`.
12. [AGENTS.md](../../AGENTS.md): aturan teknik proyek dan invarian bisnis dipertahankan; referensi file `.agents/skills/` yang tidak lagi terlacak diganti dengan dokumentasi instalasi opsional dan atribusi lisensi hulu.

---

## 3. Berkas yang Dipindahkan, Di-untrack, dan Diusulkan

### A. Dipindahkan via `git mv` (Riwayat Git Terjaga)

- `PHASE15_FULL_CLOUD_MIGRATION_PLAN.md` -> `docs/archive/phase15/PHASE15_FULL_CLOUD_MIGRATION_PLAN.md`
- `railway.json` -> `docs/archive/deployment-experiments/railway.json`
- `nixpacks.toml` -> `docs/archive/deployment-experiments/nixpacks.toml`
- `docs/{PRD,WORKFLOWS,DECISIONS,ROADMAP,PILOT_GO_LIVE_OPERATIONS,PILOT_UAT_ACCEPTANCE_AND_RISKS}.md` -> `docs/archive/planning/`
- `docs/{CUSTOMERS_PHASE2,ORDERS_PHASE2,PAYMENTS_PHASE3,EXPENSES_PHASE3,PHASE3_3_*,PHASE4_REPORTS_DATA_SAFETY}.md` -> `docs/archive/early-phases/`
- `docs/PHASE7_*.md` & `docs/screenshots/phase7/` -> `docs/archive/phase7/`
- `docs/PHASE8*.md`, `docs/design-options/`, `docs/phase8-2/` -> `docs/archive/phase8/`
- `docs/PHASE9_IMPLEMENTATION_PLAN.md` & `docs/phase9/*` -> `docs/archive/phase9/`
- `docs/phase10/`, `docs/phase12/`, `docs/phase14/`, `docs/phase15/` -> `docs/archive/{phase10,phase12,phase14,phase15}/`

### B. Dihapus dari Indeks Git Saja (`git rm -r --cached`, Tetap Ada di Disk Lokal)

- `.agents/skills/` (14 berkas keterampilan Anti-Slop).

### C. Diusulkan untuk Keputusan Pemilik (Belum Dihapus/Diubah)

1. **`render.yaml` (di root):** Saat ini menunjuk ke branch lama `feat/phase15a-postgres-compatibility` (bukan `release/phase13-ui-bi`). Sengaja dipertahankan agar tidak mengganggu blueprint Render apabila lingkungan staging masih terhubung ke Render. Jika pemilik mengonfirmasi bahwa seluruh staging dan produksi berjalan penuh di Ubuntu Docker, `render.yaml` dapat dipindahkan ke `docs/archive/deployment-experiments/` atau dihapus.
2. **Tiga temuan kode/config/test non-dokumentasi pada audit keamanan** (lihat Bagian 5.C): sengaja tidak diubah pada Phase 13H demi menjaga aturan *zero runtime/config diff*, dan direkomendasikan untuk PR perbaikan kode terpisah sebelum repositori dipublikasikan secara terbuka.

---

## 4. Pembersihan AI Agent Skills, Preservasi Lokal, & Atribusi Lisensi

- **Tindakan:** Menjalankan `git rm -r --cached .agents/skills/`, menambahkan `/.agents/skills/` ke `.gitignore`, dan menambahkan `.agents/` ke `.dockerignore`.
- **Verifikasi Preservasi Lokal:** Seluruh **14 berkas** di `.agents/skills/` (`antislop` v3.2.30, `antislop-ui`, `antislop-human`, `antislop-layoutmobile`, `antislop-copywriting`, beserta skrip `contrast-check.py` dan referensi WCAG/CWV) terverifikasi **100% masih utuh di disk lokal**, sedangkan `git ls-files .agents/` bernilai **0 berkas**.
- **Atribusi & Lisensi Hulu:**
  - Kumpulan aturan Anti-Slop berasal dari proyek `miqdadbadjuber/anti-slop` (versi lokal `3.2.30`).
  - Komponen `antislop-ui` dan `antislop-human` menyertakan materi dari `web-quality-skills` berlisensi **MIT License** (`Copyright (c) 2026 Addy Osmani`).
  - `AGENTS.md` mencatat atribusi ini secara transparan beserta perintah instalasi opsional (`npx antislop-ai` / `npx skills add miqdadbadjuber/anti-slop`) tanpa menyembunyikan penggunaan pengembangan berbantuan AI.

---

## 5. Hasil Audit Keamanan Repositori Publik

Audit dilakukan pada seluruh berkas terlacak di HEAD serta pemeriksaan riwayat Git untuk ekstensi dan pola sensitif. Sesuai kebijakan keamanan, **tidak ada nilai rahasia, email pribadi, password, atau metadata kriptografis yang dicetak dalam laporan ini**.

### A. Area Terverifikasi Bersih

- **0 berkas rahasia/arsip terlacak** (`.env`, `.sql`, `.sqlite`, `.key`, `.pem`, `.enc`, `.bak`, `.zip`, `.dump`) pada HEAD maupun riwayat Git (`git log --all`).
- **0 private key, JWT asli, token AWS/GitHub/OpenAI, atau URI database berpassword** pada berkas terlacak.
- **0 data pelanggan nyata dan 0 catatan keuangan operasional asli:** seluruh tangkapan layar Phase 13 dan fixture pengujian menggunakan entitas sintetis (`PT Nusantara Prima`, `CV Harmoni Sejahtera`, `Rina Sari (Operator Uji)`, nomor telepon uji pola `08120001xxxx`).
- **Aset referensi visual pihak ketiga (`docs/phase13/references/`):** tidak terlacak di Git dan kini dilindungi aturan `/docs/phase13/references/` di `.gitignore`.

### B. Temuan Dokumentasi & Skrip yang Disanitasi pada HEAD (`chore/phase13h-repo-cleanup`)

| Kategori Temuan | Berkas Terdampak | Risiko | Tindakan pada HEAD |
| --- | --- | --- | --- |
| Alamat email pribadi pemilik | `docs/archive/phase14/PHASE14{A,A1,C0,C1,C2}_*.md`, `docs/archive/phase15/PHASE15A_*.md` | Eksposur identitas login admin & target OTP Cloudflare Access. | Diganti menjadi `[REDACTED_OWNER_EMAIL]`. |
| Path profil pengguna Windows lokal | `docs/archive/phase12/PHASE12{D,E,F}_*.md`, `docs/archive/phase14/PHASE14{C1,C2}_*.md` | Eksposur nama akun OS lokal. | Diganti menjadi `<USER_HOME>`. |
| Metadata kriptografis snapshot backup lokal (tag GCM, sidik jari kunci, checksum SHA-256) | `docs/archive/phase12/PHASE12F_BACKUP_RECOVERY_GATE_CLOSURE.md` | Eksposur metadata turunan `APP_KEY` operasional lokal lama. | Diganti menjadi `[REDACTED_GCM_TAG]`, `[REDACTED_KEY_FINGERPRINT]`, `[REDACTED_SHA256_CHECKSUM]`. |
| Kata sandi default staging PostgreSQL lokal (port 5433) | `docs/archive/phase15/PHASE15A_POSTGRES_COMPATIBILITY_REPORT.md` | Eksposur kredensial uji lokal di dokumentasi. | Diganti menjadi `[REDACTED_LOCAL_STAGING_PASSWORD]`. |
| Referensi proyek Supabase eksternal | `docs/archive/phase15/PHASE15B_CLOUD_STAGING_REPORT.md` | Eksposur pengenal proyek eksternal di luar MFMS. | Diganti menjadi `[REDACTED_EXTERNAL_PROJECT_REF]`. |
| Hardcoded project ref & host pooler Supabase staging | `scripts/staging-supabase-runner.ps1` | Eksposur infrastruktur staging pribadi di skrip repositori. | Diubah membaca parameter `-ProjectRef` / `-PoolerHost`, environment variable, atau input interaktif. |

Hasil pemindaian ulang pasca-sanitasi terhadap 75 berkas non-biner pada `docs/`, `scripts/`, `README.md`, dan `AGENTS.md`: **0 alamat email pribadi**, **0 path profil lokal**, **0 project ref staging/eksternal**, **0 kata sandi staging**, dan **0 sidik jari kunci backup**.

### C. Temuan pada Berkas Runtime/Konfigurasi/Tes (Tidak Diubah pada Phase 13H) & Remediasi

Demi menjaga aturan *zero runtime/config diff* pada Phase 13H, tiga berkas berikut **tidak dimodifikasi**, namun dicatat agar diperbaiki pada PR kode terpisah sebelum repositori diubah menjadi publik:

1. **`config/database.php` (baris 136 & 151):** Fallback default password koneksi `pgsql_staging` dan `pgsql_testing` masih memuat string kata sandi lokal non-kosong.
   - *Remediasi:* Ubah fallback menjadi `env('DB_STAGING_PASSWORD', '')` dan `env('DB_TEST_PGSQL_PASSWORD', '')` serta sediakan nilainya melalui `.env` / environment CI.
2. **`app/Support/DatabaseTargetGuard.php` (baris 15) & `tests/Feature/StagingMigrationAndAdminCommandTest.php`:** Konstanta `BLOCKED_PROJECT_REFS` memuat string pengenal proyek Supabase eksternal secara eksplisit.
   - *Remediasi:* Muat daftar blokir dari variabel lingkungan (`env('DB_BLOCKED_PROJECT_REFS', '')`) dan gunakan string dummy (misalnya `blocked-foreign-ref-example`) pada test suite.
3. **`tests/Feature/CloudflareAccessMiddlewareTest.php` (baris 457 & 466):** Fixture uji klaim JWT `email` menggunakan alamat email pribadi pemilik alih-alih email contoh RFC 2606.
   - *Remediasi:* Ganti fixture menjadi `operator@example.test`.

### D. Catatan Riwayat Git (*Git History*)

- Sesuai mandat Phase 13H, **riwayat Git tidak ditulis ulang** (*no history rewrite*, *no force-push*).
- Commit terdahulu (sebelum branch pembersihan ini) masih menyimpan versi lama dokumen fase 12/14/15 dan skrip `staging-supabase-runner.ps1`, serta commit keamanan sebelumnya (`d8f11da`) telah merotasi kredensial uji lama.
- *Rekomendasi sebelum memublikasikan repositori secara terbuka (jika sebelumnya bersifat privat):*
  1. Selesaikan 3 remediasi kode/test pada Bagian 5.C.
  2. Pastikan `APP_KEY` dan `BACKUP_ENCRYPTION_KEY` produksi saat ini unik dan berbeda dari nilai komputer kasir lokal lama (Phase 12).
  3. Apabila pemilik menghendaki kebersihan riwayat Git penuh dari email pribadi dan project ref staging sebelum publikasi publik, lakukan pembersihan riwayat terkontrol (misalnya `git filter-repo`) hanya setelah persetujuan eksplisit pemilik dan koordinasi reset branch remote.

---

## 6. Verifikasi Integritas Kode, Tautan, Build, & Pengujian

| Pemeriksaan | Perintah / Metode | Hasil |
| --- | --- | --- |
| Imutabilitas kode runtime, dependensi, migrasi, & Docker | `git diff 0b436a9 -- app/ resources/ routes/ database/ bootstrap/ config/ composer.json composer.lock package.json package-lock.json Dockerfile docker/` | **PASS (0 baris perubahan)** |
| Validasi seluruh tautan internal Markdown | Skrip pemeriksa pada 63 berkas `.md` terlacak (`README.md`, `AGENTS.md`, `docs/*.md`, `docs/phase13/*.md`, `docs/archive/**/*.md`) | **PASS (0 tautan rusak, 0 `file:///` tersisa)** |
| Pemeriksaan em dash (`U+2014`) pada dokumen aktif | Skrip pemeriksa pada `README.md`, `AGENTS.md`, dan seluruh `docs/*.md` | **PASS (0 kemunculan)** |
| Verifikasi tangkapan layar `README.md` | 5 berkas PNG `1440px` di `docs/phase13/screenshots-phase13e/` | **PASS (seluruhnya ada & memakai data sintetis)** |
| Verifikasi AI skills lokal | `git ls-files .agents/` & pengecekan disk `.agents/skills/` | **PASS (0 terlacak di Git, 14 berkas utuh di disk)** |
| Pemeriksaan tipe TypeScript | `npm run typecheck` (`tsc --noEmit`) | **PASS (0 error)** |
| Build produksi frontend | `npm run build` (`vite build`) | **PASS (selesai dalam 4,43 detik)** |
| Pengujian otomatis lokal terisolasi | `php artisan test` (`phpunit.xml`: SQLite `:memory:`) | **228 PASSED** (3.942 assertions), **3 skipped**, **5 failed** *(rincian di bawah)* |

### Penjelasan Faktual Hasil `php artisan test` Lokal

Seluruh **228 tes berbasis aplikasi dan SQLite `:memory:` lulus 100%**. Adapun 5 kegagalan dan 3 tes yang dilewati semata-mata disebabkan oleh layanan database uji terpisah yang sedang tidak menyala pada mesin kerja saat verifikasi ini dijalankan (bukan kerusakan kode, karena kode aplikasi tidak berubah 1 baris pun dari `0b436a9`):

- **1 gagal** pada `DatabaseBackupTest::test_snapshot_transaction_is_always_closed_on_success_and_exception`: membutuhkan koneksi MariaDB uji lokal (`127.0.0.1:3307`, `Connection refused`).
- **4 gagal** pada `StagingMigrationAndAdminCommandTest` (`migrate_staging`, `create_admin`, `seed_staging`, `verify_staging`): membutuhkan koneksi PostgreSQL uji lokal `pgsql_testing` (`127.0.0.1:5433`, `Connection refused`).
- **3 dilewati (skipped):** tes paritas/konkurensi PostgreSQL/MariaDB yang otomatis dilewati ketika daemon DB uji tidak aktif.

Bukti lengkap eksekusi **236/236 PASS** saat daemon SQLite + PostgreSQL 17 (`5433`) + MariaDB 10.11 (`3307`) aktif terdokumentasi pada [PHASE13E_FULL_REGRESSION_AND_RELEASE_READINESS_REPORT.md](PHASE13E_FULL_REGRESSION_AND_RELEASE_READINESS_REPORT.md).

---

## 7. Status Git, Keterbatasan, & Langkah Lanjutan

- **Status Git saat ini:** Semua perubahan Phase 13H berada di branch lokal terpisah `chore/phase13h-repo-cleanup` yang dibuat dari commit produksi `0b436a9`.
- **Kepatuhan Batasan Operasi:** Tidak ada `git push`, tidak ada merge ke `main` atau `release/phase13-ui-bi`, tidak ada `force-push`, tidak ada penulisan ulang riwayat Git, tidak ada pembuatan tag rilis, tidak ada perubahan default branch, dan tidak ada deployment ke produksi/staging.
- **Berkas lokal tidak terlacak yang dipertahankan apa adanya:** `docs/phase13/references/` (diabaikan `.gitignore`), serta laporan lokal pra-Phase 13H (`PHASE13F1_RELEASE_CANDIDATE_HANDOFF.md`, `PHASE13F2_PUBLICATION_HANDOFF.md`, `PHASE13G_FIGMA_SYNCHRONIZATION_REPORT.md`) tidak diotak-atik dan tidak diikutsertakan dalam commit tanpa persetujuan pemilik.
- **Langkah selanjutnya setelah tinjauan pemilik:**
  1. Tinjau `git status` dan `git diff 0b436a9..chore/phase13h-repo-cleanup`.
  2. Putuskan nasib `render.yaml` (pertahankan atau pindahkan ke `docs/archive/deployment-experiments/`).
  3. Putuskan apakah 3 item remediasi keamanan kode/test (Bagian 5.C) akan dikerjakan dalam PR terpisah sebelum publikasi repositori publik.
  4. Setelah disetujui, pemilik dapat melakukan merge/push branch pembersihan ke repositori GitHub.
