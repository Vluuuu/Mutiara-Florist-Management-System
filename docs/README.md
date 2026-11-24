# Indeks Dokumentasi MFMS

Dokumentasi Mutiara Florist Management System (MFMS) dipisahkan menjadi tiga kelompok agar mudah dinavigasi: dokumentasi aktif yang mencerminkan rilis Phase 13 (`0b436a9`), bukti QA Phase 13, dan arsip historis pengembangan fase sebelumnya.

## 1. Dokumentasi Aktif (Phase 13)

| Topik | Dokumen | Ringkasan |
| --- | --- | --- |
| Arsitektur Sistem | [ARCHITECTURE.md](ARCHITECTURE.md) | Arsitektur Laravel 12 + React 19/Inertia.js 3, PostgreSQL/Supabase, Docker Ubuntu, dan Cloudflare Tunnel. |
| Desain Database | [DATABASE.md](DATABASE.md) | ERD 8 tabel inti, aturan Rupiah bulat `BIGINT`, portabilitas PostgreSQL/MariaDB, dan keamanan RLS. |
| Aturan Bisnis | [BUSINESS_RULES.md](BUSINESS_RULES.md) | Invarian order multi-item, status linier, pembayaran opsional, idempotency UUID, dan koreksi `VOIDED`. |
| Harga & Ongkir | [PRICING_AND_SHIPPING.md](PRICING_AND_SHIPPING.md) | Perhitungan subtotal bunga, ongkir `INCLUDED`/`SEPARATE` per item, dan batas tanpa diskon/pajak. |
| Desain Antarmuka | [DESIGN.md](DESIGN.md) | Sistem desain *Calm Botanical Workspace V2*, token warna WCAG AA, tipografi, dan tautan Figma. |
| Setup Lokal | [LOCAL_SETUP.md](LOCAL_SETUP.md) | Instalasi pengembangan lokal (PHP 8.2/8.3, Node 20+, PostgreSQL/MariaDB, Vite, dan PHPUnit). |
| Deployment | [DEPLOYMENT.md](DEPLOYMENT.md) | Arsitektur deployment produksi (Ubuntu, Docker PHP 8.3 FPM/Nginx, Supabase PostgreSQL, Cloudflare Tunnel). |
| Panduan Operator | [HANDOVER_OPERATOR_GUIDE.md](HANDOVER_OPERATOR_GUIDE.md) | Panduan penggunaan harian aplikasi bagi admin/operator dan SOP koreksi transaksi. |
| Pengujian | [TEST_PLAN.md](TEST_PLAN.md) | Matriks penerimaan T-01 sampai T-38 dan ringkasan 236 tes otomatis Phase 13E. |
| Backup & Recovery | [BACKUP_RESTORE.md](BACKUP_RESTORE.md) | Enkripsi AES-256-GCM, snapshot konsisten PostgreSQL/MariaDB/SQLite, dan uji restorasi terisolasi. |

## 2. Bukti QA & Rilis Phase 13

Seluruh laporan verifikasi dan tangkapan layar data sintetis untuk rilis aktif dipertahankan pada direktori [phase13/](phase13/PHASE13E_FULL_REGRESSION_AND_RELEASE_READINESS_REPORT.md):

- [PHASE13A_UI_UX_AND_BUSINESS_INTELLIGENCE_AUDIT.md](phase13/PHASE13A_UI_UX_AND_BUSINESS_INTELLIGENCE_AUDIT.md)
- [PHASE13B_FOUNDATION_SHELL_AND_CRITICAL_FIXES_REPORT.md](phase13/PHASE13B_FOUNDATION_SHELL_AND_CRITICAL_FIXES_REPORT.md)
- [PHASE13C_DASHBOARD_AND_OPERATIONAL_BI_REPORT.md](phase13/PHASE13C_DASHBOARD_AND_OPERATIONAL_BI_REPORT.md)
- [PHASE13D_FINANCIAL_REPORTS_AND_ANALYTICS_REPORT.md](phase13/PHASE13D_FINANCIAL_REPORTS_AND_ANALYTICS_REPORT.md)
- [PHASE13E_FULL_REGRESSION_AND_RELEASE_READINESS_REPORT.md](phase13/PHASE13E_FULL_REGRESSION_AND_RELEASE_READINESS_REPORT.md)
- [PHASE13_IMMEDIATE_LOCAL_GO_LIVE.md](phase13/PHASE13_IMMEDIATE_LOCAL_GO_LIVE.md)
- Tangkapan layar QA sintetis: `docs/phase13/screenshots-phase13e/` (dan tahapan `screenshots/`, `screenshots-phase13b/`, `screenshots-phase13c/`, `screenshots-phase13d/`).

## 3. Arsip Historis (`docs/archive/`)

Dokumen fase awal disimpan untuk keterlacakan akademik dan sejarah keputusan rekayasa tanpa bercampur dengan dokumentasi aktif:

- `docs/archive/planning/`: PRD awal, workflow awal, decision log, roadmap awal, dan dokumen pilot lokal.
- `docs/archive/early-phases/`: Laporan implementasi Phase 2 sampai Phase 4 (migrasi awal Blade ke React/Inertia).
- `docs/archive/phase7/`, `docs/archive/phase8/`, `docs/archive/phase9/`, `docs/archive/phase10/`: Eksplorasi desain, QA Anti-Slop, sprint UI, dan UAT pra-Phase 13.
- `docs/archive/phase12/`: Laporan gerbang keamanan dan persiapan pra-pilot lokal.
- `docs/archive/phase14/`: Audit reliabilitas lokal dan eksperimen publikasi origin awal.
- `docs/archive/phase15/`: Rencana migrasi cloud, laporan paritas PostgreSQL 15A, dan staging cloud 15B.
- `docs/archive/deployment-experiments/`: Konfigurasi eksperimental cloud PaaS (`railway.json`, `nixpacks.toml`, `render.yaml`) yang tidak dipakai pada produksi maupun staging Ubuntu Docker saat ini.
