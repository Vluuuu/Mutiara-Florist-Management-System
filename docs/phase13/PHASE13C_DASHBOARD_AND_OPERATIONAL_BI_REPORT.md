# MFMS Phase 13C Implementation Report: Dashboard Redesign & Operational Business Intelligence

**Project:** Mutiara Florist Management System (MFMS)
**Phase:** Phase 13C (Dashboard Redesign & Operational BI)
**Design Direction:** Calm Botanical Workspace V2 (`ENERGY 2 / RHYTHM 3 / MOTION 1`)
**Anti-Slop Mode:** Mode 1 (DURING the project)
**Date:** 24 November 2026
**Status:** COMPLETE (Pending User Review Before Commit or Phase 13D)

---

## 1. Phase 13B Checkpoint Commit & Branch State

| Field | Value |
| :--- | :--- |
| Active Branch | `feat/phase13-ui-bi-enhancement` |
| Phase 13B Local Checkpoint Commit | `ae22cbb` (`feat(ui): refine MFMS design system and application shell`) |
| Phase 13C Commit / Push Status | Uncommitted working tree only (no Phase 13C commit, no `git push`) |
| Production / Staging Impact | Zero (no deployment config, Docker, Cloudflare, schema migration, or remote DB changes) |
| QA Datasets | Isolated synthetic SQLite databases only (`phase13a_audit.sqlite`, `phase13c_empty.sqlite`, `phase13c_high_neg.sqlite`; 0 real customer/financial data) |

---

## 2. Dashboard Implementation Summary

Phase 13C transformed `/dashboard` (`/ui-dashboard`) into a dual-audience workspace serving both daily florist operators (urgent deliveries, active fulfillment status, rapid payment recording) and business owners (daily cash position, 7-day/30-day cash flow pulse, open receivables, and recent verified business activity):

- **A. Primary KPI Strip (4 Balanced Modular Cards):**
  1. `Kas Masuk Hari Ini` (POSTED payments today WIB, count of valid payments)
  2. `Kas Keluar Hari Ini` (POSTED expenses today WIB, with signed `Selisih kas` explicitly distinct from net profit)
  3. `Piutang Berjalan` (live open receivable snapshot + count of unpaid/partial orders)
  4. `Kiriman & Pesanan Hari Ini` (today's scheduled delivery items + today's new order count/billed value + overdue callout)
- **B. Operational Workspace (`Pekerjaan & Pengiriman`):** Prioritized directly beneath the KPI strip above secondary analytics; upgraded to `<SegmentedTabs>` filter track, compact `<OrderCodeBadge compact />` (closing **AUD-05**), urgency dividers, per-item linear status transitions, existing `DeliveryConfirmModal`, and a clean overflow footer when total active items exceed the 12-item queue cap.
- **C. Open Receivables (`Piutang Terbuka`):** Closed **AUD-06** by displaying customer name, compact `<OrderCodeBadge compact />`, order date (`Nota dd/mm/yyyy`), payment status badge (`Belum Lunas` / `Dibayar Sebagian`), exact remaining balance, and an individual `Catat Bayar` action per invoice (both in the panel and inside the `Pilih Nota untuk Pembayaran` picker modal).
- **D. Active Fulfillment Pipeline (`Status Pengerjaan Aktif`):** Added a proportional horizontal `<PipelineBar>` showing `Baru`, `Diproses`, and `Siap Kirim` across **all active `order_items` in the database** (accurate denominator not limited to the 12 visible queue rows), with a calm empty state when total active items is `0`.
- **E. Cash Flow Pulse (`Arus Kas Harian` 7 Hari / 30 Hari):** Built a zero-dependency custom SVG grouped bar chart (`CashFlowChart`) reusable in Phase 13D, backed by a single deferred 30-day WIB query so switching between `7 Hari` and `30 Hari` occurs purely in-memory (**0 HTTP requests**, **0 full reloads**). Includes period totals, keyboard/mouse interactive daily readout bar, accessible legend, negative cash-difference handling, and explicit cash-basis disclaimer.
- **F. Recent Business Activity (`Aktivitas Bisnis Terbaru`):** Added a concise deferred feed of up to 6 recent real business records (`Pesanan Baru`, `Pembayaran Masuk` POSTED, `Pengeluaran` POSTED), explicitly labeled as recent business activity (`bukan log audit penuh`) with zero sensitive identifiers exposed.
- **G. Quick Operational Actions & Collapsible Cumulative Footer:** Added `Catat Pengeluaran` and `Catat Pembayaran` (or `Piutang & Bayar` when zero receivables) in the page header without duplicating the global `+ Pesanan Baru` CTA, and converted the all-time cumulative summary into a calm collapsible `<details>` disclosure strip.

---

## 3. Visual Design Decisions

Grounded in both inspected third-party visual references (`reference-a-syncro.png` and `reference-b-sparkpixel.png`, retained locally and not publicly distributed) while preserving MFMS's Calm Botanical Workspace V2 palette:

- **Syncro Principles Applied:** Asymmetric 2-column operational workspace (`1.65fr : 1fr` on desktop), modular KPI cards with restrained semantic icon chips, compact right-rail pipeline distribution card (`Status Pengerjaan Aktif`), and highlight bands on active chart columns.
- **Sparkpixel Principles Applied:** Precision chart readout bar above the SVG plot (avoiding floating tooltip clipping on 390px mobile), hairline dashed horizontal gridlines, compact Rupiah Y-axis ticks (`Rp0`, `Rp1,3 jt`, `Rp2,5 jt`), track-based `7 Hari / 30 Hari` toggle, and refined tabular typography (`tabular-nums`).
- **Color & WCAG Contrast Verification (`contrast-check.py`):**
  - `Kas Masuk` bar (`#1B3B2B` vs `#FFFDF9`): `12.11:1` (PASS AA)
  - `Kas Keluar` bar (`#C07624` vs `#FFFDF9`): `3.53:1` (PASS WCAG 1.4.11 UI graphics); `#C07624` vs `#1B3B2B`: `3.43:1` (PASS 1.4.11 adjacent series distinction)
  - `Kas Keluar` text (`#8F4B1E` vs `#FFFDF9`): `6.47:1` (PASS AA)
  - Urgent / Negative `Selisih Kas` text (`#9A3B22` vs `#FFFDF9`): `6.84:1` (PASS AA)
  - Pipeline segments vs `#FFFDF9`: `Baru` (`#6A716A`, `4.94:1` PASS AA), `Diproses` (`#C07624`, `3.53:1` PASS 1.4.11; text `#8F4B1E` `6.47:1` PASS AA), `Siap Kirim` (`#193F66`, `10.63:1` PASS AA).
- **Responsive Composition:** Desktop (`1440x900` / `1366x768`) uses asymmetric 2-column grids; Tablet (`768x1024`) stacks into balanced full-width operational panels with 2x2 KPI strip; Mobile (`390x844`) keeps daily operations (`Pekerjaan & Pengiriman` -> `Pipeline` -> `Piutang Terbuka`) above secondary analytics (`Arus Kas Harian` -> `Aktivitas Bisnis Terbaru`) with non-wrapping Rupiah readouts.

---

## 4. Changed & Added Files

### Backend & Tests
- **Modified:** `app/Services/DashboardService.php` (added `pipeline_new`, `pipeline_processing`, `pipeline_ready`, `pipeline_total`, `cash_diff` inside existing `todayStats()` query; added `cashFlowPulse()` and `recentActivity()`)
- **Modified:** `app/Http/Controllers/UiDashboardController.php` (memoized lazy closures for initial props so deferred reloads skip initial 3 queries; registered deferred `'insights'` group for `cashFlowPulse` & `recentActivity` with `rescue: true`)
- **Added:** `tests/Feature/Phase13CDashboardBiTest.php` (8 feature/unit regression tests)

### Frontend
- **Added:** `resources/js/components/charts/cash-flow-chart.tsx` (reusable zero-dependency SVG grouped bar chart + `formatCompactRupiah`, ready for Phase 13D)
- **Added:** `resources/js/components/charts/pipeline-bar.tsx` (reusable proportional distribution bar, ready for Phase 13D)
- **Added:** `resources/js/components/dashboard-insights.tsx` (lazy-loaded secondary BI panels: Cash Flow Pulse + Recent Business Activity)
- **Modified:** `resources/js/pages/Dashboard.tsx` (full Phase 13C redesign)
- **Modified:** `resources/js/lib/format.ts` (added `formatSignedRupiah`)
- **Modified:** `resources/js/lib/navigation-state.ts` (registered `'cashFlowPulse'` and `'recentActivity'` in `DEFERRED_PROP_KEYS`)
- **Modified:** `resources/js/types.ts` (added `CashFlowPoint`, `CashFlowWindow`, `DashboardCashFlowPulse`, `DashboardActivityItem`, and extended `DashboardTodayStats`)

### Evidence & Documentation
- **Added:** `docs/phase13/screenshots-phase13c/` (9 verified screenshots across 4 viewports and 5 synthetic scenarios)
- **Added:** `docs/phase13/PHASE13C_DASHBOARD_AND_OPERATIONAL_BI_REPORT.md` (this report)

---

## 5. Financial Metric Definitions & Invariants

| Metric | Source Definition | Invariants Preserved |
| :--- | :--- | :--- |
| `Kas Masuk Hari Ini` | `SUM(payments.amount)` where `status = 'POSTED'` and `payment_date` within today `Asia/Jakarta` (WIB) | Integer Rupiah, excludes `VOIDED`, never confused with order value |
| `Kas Keluar Hari Ini` | `SUM(expenses.amount)` where `status = 'POSTED'` and `expense_date` within today WIB | Integer Rupiah, excludes `VOIDED` |
| `Selisih Kas` | `cash_in - cash_out` (signed integer Rupiah, may be negative, zero, or positive) | Explicitly labeled `Selisih Kas` and disclaimed as `bukan laba bersih` |
| `Piutang Berjalan` | `MAX(SUM(orders.total_amount) - SUM(POSTED payments.amount), 0)` live snapshot | Never negative; per-invoice balance shown independently in `Piutang Terbuka` |
| `Kiriman & Pesanan Hari Ini` | Count of `order_items` with `delivery_date` = today WIB + count & `SUM(total_amount)` of `orders` with `order_date` = today WIB | Order value (`Nilai nota`) explicitly separated from cash receipts |
| `Status Pengerjaan Aktif` | Counts of all `order_items` in `NEW`, `PROCESSING`, `READY` across entire DB | Full-DB denominator (`pipeline_total`), never capped by queue limit 12 |
| `Arus Kas Harian (7h / 30h)` | Daily `POSTED` payments vs `POSTED` expenses over `[today-6d..today]` and `[today-29d..today]` WIB | Calendar gaps filled with `Rp0`, exact reconciliation between daily points and period totals |

---

## 6. AUD-05 and AUD-06 Closure Evidence

| Audit ID | Requirement | Status | Verification Evidence |
| :--- | :--- | :---: | :--- |
| **AUD-05 (Dashboard)** | Replace raw 36-char ULID order strings in Dashboard queue headers with compact `OrderCodeBadge` while preserving full identifier access | **CLOSED** | Live DOM audit across all 4 viewports on `/ui-dashboard`: `rawUlidCount: 0`; compact `MF-261124 · #PHVWE7` rendered with full ID in `title` tooltip and `Detail Nota` link (`01-dashboard-normal-desktop-1440.png`) |
| **AUD-06 (Open Receivables)** | Every open receivable unambiguously identified (customer name, compact order code, order date, payment status, remaining balance, individual safe payment action), including repeated corporate customers | **CLOSED** | `Phase13CDashboardBiTest::test_multiple_outstanding_orders_for_same_corporate_customer_stay_unambiguous` (PASS); live DOM & screenshots confirm `CV Harmoni Sejahtera` (2 distinct invoices in normal DB) and `PT Sentosa Mandiri` (3 distinct invoices in high-activity DB) each have separate code, `Nota dd/mm/yyyy`, status badge, balance, and individual `Catat Bayar` button (`01-dashboard-normal-desktop-1440.png`, `03-dashboard-payment-picker-desktop-1440.png`, `05-scenario-high-negative-desktop-1440.png`) |

---

## 7. Query-Count Comparison (Baseline vs Phase 13C)

Measured programmatically via `DB::enableQueryLog()` (domain queries excluding framework auth/session lookup) in `Phase13CDashboardBiTest::test_initial_dashboard_keeps_baseline_three_domain_queries_and_defers_insights`:

| Request Type | Phase 13B Baseline (`ae22cbb`) | Phase 13C | Delta | Notes |
| :--- | :---: | :---: | :---: | :--- |
| Initial `GET /dashboard` | **3** (`stats`, `todayStats`, `activeDeliveryQueue`) | **3** (`stats`, `todayStats` + pipeline counts, `activeDeliveryQueue`) | **0** | Zero extra blocking round-trips on initial paint |
| Deferred `receivables` partial reload | **4** (re-ran 3 initial + 1 receivables) | **1** (`openReceivables` only) | **-3** | Memoized lazy closures skip initial 3 queries during partial reload |
| Deferred `insights` partial reload (`cashFlowPulse`, `recentActivity`) | N/A | **4** (1 `UNION ALL` 30d cash flow + 3 `LIMIT 6` activity queries) | +4 (async background) | Non-blocking background group; does not delay first paint |
| Switching `7 Hari` <-> `30 Hari` on Cash Flow Pulse | N/A | **0** HTTP / **0** SQL | **0** | Pure in-memory slice from single 30-day deferred payload (`resBefore=7, resAfter=7`) |

---

## 8. Deferred Loading & Instant Navigation Verification

1. **Initial Payload Exclusion:** `Phase13CDashboardBiTest` asserts `missing('receivables')`, `missing('cashFlowPulse')`, and `missing('recentActivity')` on initial `GET /dashboard`.
2. **Deferred Key Registration:** `resources/js/lib/navigation-state.ts` explicitly registers `'cashFlowPulse'` and `'recentActivity'` in `DEFERRED_PROP_KEYS`, ensuring background deferred requests never trigger foreground `data-nav-pending="true"` indicators.
3. **Graceful Failure Rescue:** `Phase13CDashboardBiTest::test_deferred_insights_rescue_on_failure_without_breaking_dashboard` verified HTTP 200 with `rescuedProps: ['cashFlowPulse']` when `cashFlowPulse()` throws, rendering `<DeferredSectionError>` with per-section retry while keeping operational tasks functional.
4. **Live SPA Round-Trip (`agent-browser`):** Navigating `Dashboard -> Pesanan -> Dashboard` via sidebar links settled cleanly with `pending: 0`, `hasChart: true`, `hasActivity: 6`, and `0` console errors.
5. **Cache Invalidation:** `navigation-state.ts` preserves `router.flushAll()` on successful mutations so recording a payment, expense, or status transition immediately refreshes Dashboard metrics on next visit.

---

## 9. Bundle Size & Dependency Comparison

| Asset / Metric | Phase 13A (`9e601d6`) | Phase 13B (`ae22cbb`) | Phase 13C Build | Target / Budget | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `inertia-*.js` (eager raw) | `641.69 kB` | `652.53 kB` | **`659.75 kB`** (`659,750 B`) | `<= 660 kB` (Phase 13C) / `<= 670 kB` (Phase 13 total) | **PASS** |
| `inertia-*.js` (eager gzip) | N/A | `180.32 kB` | **`182.19 kB`** | Lightweight | **PASS** |
| `dashboard-insights-*.js` (lazy async chunk) | N/A | N/A | **`11.01 kB`** raw / `3.66 kB` gzip | Loaded parallel to deferred `insights` | **PASS** |
| `app-*.css` (raw / gzip) | `60.38 kB` | `69.46 kB` | **`70.82 kB`** / `14.08 kB` | Clean CSS tokens | **PASS** |
| New JS / Chart Dependencies | `0` | `0` | **`0`** | `0` external libraries | **PASS** |

---

## 10. Automated Test Results Matrix

| Verification Suite | Status | Measured Result |
| :--- | :---: | :--- |
| `tests/Feature/Phase13CDashboardBiTest.php` | **PASS** | 8 passed (new Phase 13C suite) |
| `tests/Feature/UiDashboardTest.php` | **PASS** | 8 passed |
| `tests/Feature/DashboardTest.php` | **PASS** | 1 passed |
| `tests/Feature/UiNavigationPerformanceTest.php` | **PASS** | 5 passed |
| `tests/Feature/Phase13BFoundationRegressionTest.php` | **PASS** | 3 passed |
| Combined targeted PHPUnit run above | **PASS** | **25 passed (565 assertions)** in 1.95s |
| Full-suite MariaDB / PostgreSQL infrastructure tests (`DatabaseBackupTest`, `StagingMigrationAndAdminCommandTest`, `PaymentConcurrencyTest`) | **BLOCKED / NOT RE-RUN LOCALLY** | The 5 infrastructure-dependent failures and 3 skips documented in Phase 13B remain unresolved on this local Windows workstation (no local MariaDB/PostgreSQL running) and remain a mandatory gate in isolated PostgreSQL/staging CI before final release. Full suite is NOT represented as 100% passing. |
| TypeScript (`npm run typecheck`) | **PASS** | 0 errors |
| Production Build (`npm run build`) | **PASS** | Built cleanly in 2.85s (Vite 8.3.5) |
| Static Em-Dash Scan (`resources/js/**`) | **PASS** | `0` occurrences of `U+2014` |
| WCAG Contrast Check (`contrast-check.py`) | **PASS** | All chart & pipeline pairs verified (`>= 3.43:1` UI graphics, `>= 4.94:1` text) |

---

## 11. Four-Viewport & Five-Scenario Browser QA (`agent-browser`)

### Four Target Viewports (Normal + Repeated Corporate Dataset)
| Viewport | Overflow | Em Dashes | Raw Enums | Raw ULIDs | H1 Count | Targets `< 44px` | Stuck Pending | SVG Chart | JS Errors | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Desktop `1440x900` | `false` | `0` | `0` | `0` | `1` | `0` | `0` | `true` | `0` | **PASS** |
| Laptop `1366x768` | `false` | `0` | `0` | `0` | `1` | `0` | `0` | `true` | `0` | **PASS** |
| Tablet `768x1024` | `false` | `0` | `0` | `0` | `1` | `0` | `0` | `true` | `0` | **PASS** |
| Mobile `390x844` | `false` | `0` | `0` | `0` | `1` | `0` | `0` | `true` | `0` | **PASS** |

### Five Required Synthetic Scenarios
1. **Empty Business (`phase13c_empty.sqlite`):** `overflow: false`, `hasZeroPipeline: true` (`0 rangkaian aktif`), `hasEmptyCash: true`, `hasEmptyActivity: true`, `hasEmptyRec: true`, `0` JS errors -> **PASS**.
2. **Normal Daily Transactions (`phase13a_audit.sqlite`):** Verified across all 4 viewports + 7d/30d in-memory switch (`resBefore=7, resAfter=7`) + SPA round-trip -> **PASS**.
3. **High Activity (`phase13c_high_neg.sqlite`):** 18 active items across 3 statuses -> `Status Pengerjaan Aktif` shows `18 rangkaian aktif` (`Baru 5 (28%)`, `Diproses 7 (39%)`, `Siap Kirim 6 (33%)`), while `Pekerjaan & Pengiriman` shows `Menampilkan 12 dari 18 rangkaian aktif teratas` -> **PASS**.
4. **Negative Net Cash Flow (`phase13c_high_neg.sqlite`):** Today cash in `Rp1.350.000` vs cash out `Rp4.250.000` -> KPI card & chart readout clearly display `-Rp2.900.000` in Terracotta, period total `-Rp4.000.000` -> **PASS**.
5. **Repeated Corporate Customers (`phase13a_audit.sqlite` & `phase13c_high_neg.sqlite`):** `CV Harmoni Sejahtera` (2 open invoices) and `PT Sentosa Mandiri` (3 open invoices) each render with distinct compact order codes, `Nota dd/mm/yyyy`, status badges, balances, and individual `Catat Bayar` triggers -> **PASS**.

---

## 12. Before / After Screenshot Inventory

All 9 Phase 13C screenshots are stored in `docs/phase13/screenshots-phase13c/` for direct side-by-side comparison against Phase 13A (`docs/phase13/screenshots/`) and Phase 13B (`docs/phase13/screenshots-phase13b/`):

- `01-dashboard-normal-desktop-1440.png` (vs Phase 13B `02-dashboard-desktop-1440.png`)
- `01-dashboard-normal-laptop-1366.png` (vs Phase 13B `02-dashboard-laptop-1366.png`)
- `01-dashboard-normal-tablet-768.png` (vs Phase 13B `02-dashboard-tablet-768.png`)
- `01-dashboard-normal-mobile-390.png` (vs Phase 13B `02-dashboard-mobile-390.png`)
- `02-dashboard-pulse-30d-desktop-1440.png` (30-day Cash Flow Pulse SVG view, zero extra requests)
- `03-dashboard-payment-picker-desktop-1440.png` (AUD-06 unambiguous multi-invoice payment picker)
- `04-scenario-empty-desktop-1440.png` (Empty business zero states)
- `05-scenario-high-negative-desktop-1440.png` (High activity 18-item pipeline + `-Rp2.900.000` negative cash flow + 3 corporate invoices + mixed recent activity)
- `05-scenario-high-negative-mobile-390.png` (Mobile high-activity & negative cash flow verification)

---

## 13. Remaining Risks & Pre-Release Gates

1. **Database-Dependent Tests (Mandatory Final Gate):** The 5 MariaDB/PostgreSQL infrastructure tests (`DatabaseBackupTest`, `StagingMigrationAndAdminCommandTest`) remain blocked on this local Windows workstation and must pass in an isolated PostgreSQL / staging CI run before merging Phase 13 to production.
2. **Phase 13D Budget Headroom:** Eager `inertia-*.js` is `659.75 kB` raw (`10.25 kB` remaining under the `670 kB` Phase 13 ceiling). Phase 13D should reuse `CashFlowChart` and `PipelineBar` inside a lazy-loaded `report-charts` chunk so Financial Reports enhancements add near-zero bytes to the eager bundle.
3. **Uncommitted Working Tree:** Phase 13C changes are intentionally uncommitted pending user review.

---

## 14. Recommended Phase 13D Scope (Financial Reports Enhancement)

Upon approval of Phase 13C, Phase 13D should focus exclusively on `Reports/Index.tsx` (and read-only `UiReportController` / `ReportService` enhancements if needed):

1. **Close AUD-07 (Report Visualizations):** Replace the legacy CSS-only report bar chart with the shared lazy-loaded SVG `CashFlowChart` and `PipelineBar` primitives (supporting daily/weekly/monthly/yearly granularities, interactive keyboard/mouse readouts, negative `Selisih Kas` clarity, and expense category distribution bars).
2. **Close AUD-08 (Date Range Filter Ergonomics):** Upgrade report period presets (`Hari Ini`, `7 Hari`, `30 Hari`, `Bulan Ini`, `Bulan Lalu`, `Tahun Ini`, `Semua Waktu`, `Kustom`) and granularity selector using `<SegmentedTabs>` and a compact responsive filter bar while preserving existing `.xlsx` export functionality and deferred `reportBreakdowns` / `reportTrends` loading.
3. **Preserve Strict Financial Definitions & Performance:** Keep eager JS bundle `<= 670 kB` raw, zero external chart libraries, zero changes to `ReportService` accounting formulas, and verify across all 4 viewports.

---

## Anti-Slop Mode 1 Delivery Gate

- **Mode:** Mode 1 (DURING the project) applied end-to-end across Phase 13C.
- **Em-Dash Check (`R-02`):** `0` em dashes (`U+2014`) in `resources/js/**`, rendered DOM across all viewports/scenarios, and this report.
- **No Fabricated Metrics or Claims (`R-17`, `R-36`, `C-5`):** Zero fabricated growth percentages, zero fake events, transparent reporting of unresolved local DB test blockers, and exact tool-verified measurements for every query count, bundle size, and contrast ratio.
- **Accessibility & Contrast (`R-03`, `R-25`):** `0` overflow, `0` `< 44px` interactive targets across all 4 viewports, keyboard-navigable SVG chart columns with visible focus outline, WCAG AA/1.4.11 verified tokens.
- **Business Invariants Preserved:** Zero changes to `OrderService`, `PaymentService`, `ExpenseService`, `ReportService`, integer Rupiah math, linear fulfillment, idempotency, or POSTED/VOIDED audit integrity.
