# MFMS Phase 13D: Financial Reports & Analytics Enhancement Report

**Project:** Mutiara Florist Management System (MFMS)  
**Branch:** `feat/phase13-ui-bi-enhancement`  
**Phase 13B Checkpoint Commit:** `ae22cbb` (`feat(ui): refine MFMS design system and application shell`)  
**Phase 13C Checkpoint Commit:** `e252e51` (`feat(dashboard): add operational business intelligence and cash flow insights`)  
**Phase 13D Status:** Implementation & Verification Complete (Uncommitted, Pending Review; Not Pushed)  
**Design Direction:** Calm Botanical Workspace V2 (`ENERGY 2 / RHYTHM 3 / MOTION 1`)  
**Anti-Slop Mode:** Mode 1 (DURING the project)  
**Report Date:** 2026-11-24 (WIB / Asia/Jakarta)

---

## 1. Phase 13C Checkpoint Commit & Cleanup Verification

Before starting Phase 13D implementation:

1. **Phase 13C Cleanup Command Investigation:** Investigated the Phase 13C final QA check command that exited with code 1. Confirmed it was solely PowerShell `Get-NetTCPConnection -LocalPort 8193,8194,8195,8196` signaling an empty-result error because zero listeners were bound (`QA_PORT_LISTENERS: 0`, `RUNNING_PHP_PROCS: 0`). No server or cleanup failure occurred.
2. **Branch & Diff Verification:** Confirmed active branch `feat/phase13-ui-bi-enhancement` branched from `ae22cbb` (Phase 13B checkpoint), reviewed the complete Phase 13C diff, verified zero secrets, zero real operational data, zero scratch SQLite databases, and zero unintended artifacts.
3. **Local Phase 13C Checkpoint Commit:** Created local commit **`e252e51`** with message `feat(dashboard): add operational business intelligence and cash flow insights`. Nothing was pushed to any remote and no production or staging deployment configuration was modified.

---

## 2. Implementation Summary

Phase 13D transforms `/ui-reports` (`Laporan Usaha`) into a professional, Sparkpixel-inspired financial analytics workspace under the Calm Botanical Workspace V2 design system while preserving every MFMS accounting rule, WIB timezone boundary, `.xlsx` export calculation, and Instant Navigation V2 performance characteristic.

### Key Deliverables Implemented

- **A. Compact Header & Verified 8-Preset Period Toolbar (`Reports/Index.tsx`):**
  - Standardized `<PageHeader>` displaying the active period label, WIB date span, explicit `Zona waktu WIB (Asia/Jakarta)` indicator, and a synchronized `Unduh Excel (.xlsx)` action bound to the active preset and custom range.
  - Exposed all 8 backend-verified presets in `ReportService`: `Hari Ini` (`today`), `7 Hari` (`7d`), `30 Hari` (`30d`), `Bulan Ini` (`this_month`), `Bulan Lalu` (`last_month`), `Tahun Ini` (`this_year`), **`Semua Waktu` (`all_time`)**, and `Kustom` (`custom`).
  - Eliminated duplicate mobile period controls: `< 640px` renders a single `<Select id="mobile-report-preset">`, while `>= 640px` renders the desktop/tablet `<SegmentedTabs>` track. Custom date inputs (`Dari Tanggal`, `Sampai Tanggal`, `Terapkan`) remain responsive and accessible.
- **B. Period Financial Summary Strip & Live Snapshot Context Bar (`Reports/Index.tsx`):**
  - Four balanced period KPI cards with tabular numerals (`tabular-nums`), explicit Rupiah formatting, and clear accounting terminology:
    1. `Nilai Pesanan` (with `Bunga` and `Ongkir` sub-breakdown).
    2. `Kas Masuk Sah` (`POSTED` cash receipts in period).
    3. `Kas Keluar Sah` (`POSTED` operational expenses in period).
    4. `Selisih Kas` (`Kas masuk dikurangi kas keluar (bukan laba bersih)`, styled in terracotta `#9A3B22` when negative and cypress `#1B3B2B` when positive).
  - Distinct secondary context strip separating period volume (`Volume periode: X pesanan (rata-rata RpY)`) from the current-date live snapshot (`Piutang berjalan (snapshot saat ini): RpZ (N nota terbuka)`) with a direct `Kelola Piutang >` link to `/ui-payments`.
- **C. Interactive Trend Chart & Code-Split Lazy Analytics (`report-charts.tsx`):**
  - Lazy-loaded `report-charts.tsx` via `React.lazy` in parallel with Inertia's deferred `details` group (`reportBreakdowns`, `reportTrends`), removing legacy chart code from the eager `inertia-*.js` bundle.
  - Added interactive floating Sparkpixel-style tooltip (`data-testid="report-chart-tooltip"`) clamped strictly within the chart container bounds, triggered by hover, click, and keyboard focus (`Tab`, `ArrowLeft`, `ArrowRight`, `Home`, `End`, `Escape`).
  - Added a toggleable straight data-connected `Garis Selisih Kas` net cash-flow line (`#193F66` dashed stroke with `#FFFDF9` halo, no artificial curve smoothing), terracotta `#9A3B22` markers for negative net cash flow, and an accurate `Rp0` zero baseline whenever negative values exist.
  - Preserved `Harian | Mingguan | Bulanan | Tahunan` granularity controls (`only: ['reportTrends']`), `Masuk vs Keluar` / `Pesanan vs Masuk` mode switch, compact active-only bucket filtering with `Tampilkan Rentang Penuh`, and a dedicated `< 640px` mobile tap bar view.
- **D. Payment Method Breakdown & True-Proportion Expense Breakdown (`ReportService.php`, `report-charts.tsx`):**
  - Implemented `ReportService::buildPaymentMethodBreakdown()` returning `Transfer Bank`, `Tunai`, `QRIS`, and `Lainnya` (`TRANSFER`, `CASH`, `QRIS`, plus legacy/unknown methods folded cleanly into `OTHER` / `Lainnya`) using a single grouped `POSTED`-only SQL query reconciling 100% with `summary.cash_in`.
  - Closed **AUD-07** by scaling every `Pengeluaran per Kategori` bar strictly against total `POSTED` cash outflows (`amount / total_cash_out * 100`), never by max category, while retaining a subtle `1.5%` minimum visibility floor for tiny nonzero categories (`< 1.5%`) and exposing `percent_exact` (`0.1%` precision) for small shares.
  - Refined `Status Pengerjaan Pesanan` and `Status Pembayaran Pesanan` distribution cards with valid drill-down links (`/ui-orders`, `/ui-payments`).
- **E. Expandable Reconciled Period Table (`Reports/Index.tsx`):**
  - Collapsible `Rincian Tabel` with `<SegmentedTabs>` (`Ada Transaksi` / `Semua`), `tabletColumns={2}` responsive density, zero raw database enums (re-verifying **AUD-09** closure), and a reconciled `Total Periode Terpilih` footer (`data-testid="report-table-total-footer"`) matching period KPI totals and Excel export.
- **F. Query-Count Optimization (`UiReportController.php`, `ReportService.php`):**
  - Memoized lazy `'report'` prop closure so deferred `'details'` and `'reportTrends'` partial reloads do not re-execute the 5-way core summary query.
  - Consolidated `ReportService::findEarliestRecordDate()` from 3 separate `MIN(...)` queries into 1 combined SQL query.

---

## 3. Visual Design Decisions

Visual composition synthesizes both inspected third-party references (`reference-a-syncro.png` and `reference-b-sparkpixel.png`, retained locally and not publicly distributed) within MFMS's Calm Botanical Workspace V2 tokens (`docs/DESIGN.md`):

1. **Sparkpixel Analytical Hierarchy:**
   - Compact single-row filter toolbar with restrained sunken container (`--bg-sunken`) and crisp white active pill (`--bg-surface`).
   - Floating high-contrast analytical tooltip (`bg-[#FFFDF9]`, hairline border, tabular figures, colored series dots, date span header, and net-flow summary divider) rather than static legend-only readouts.
   - Clean horizontal dashed gridlines (`#D8D2C6`) and subtle selected-column highlight band (`#EFEAE0`).
2. **Syncro Shell & Modular Card Composition:**
   - Two-column desktop analytics grid pairing `Metode Pembayaran` and `Pengeluaran per Kategori`, followed by paired operational status distribution panels and a full-width expandable ledger table.
   - Balanced 4-card KPI strip with restrained corner badges, zero decorative gradients, and consistent `14px` card radii.
3. **Botanical Palette & WCAG 1.4.11 Compliance (AUD-08):**
   - Verified via `.agents/skills/antislop-human/contrast-check.py` against `#FFFDF9` surface:
     - Cash In (`Kas Masuk Sah`): Deep Cypress `#1B3B2B` (`12.11:1` vs `#FFFDF9`).
     - Cash Out (`Kas Keluar Sah`): Warm Marigold `#C07624` (`3.53:1` vs `#FFFDF9`; **`3.43:1` vs `#1B3B2B`**, resolving AUD-08's previous `1.87:1` violation).
     - Order Value (`Nilai Pesanan`): Stone Slate `#858980` (`3.51:1` vs `#FFFDF9`; `3.45:1` vs `#1B3B2B`).
     - Net Cash Flow Line (`Selisih Kas`): Deep Slate Blue `#193F66` (`10.63:1` vs `#FFFDF9`; `3.01:1` vs `#C07624`; `3.03:1` vs `#858980`) with white `#FFFDF9` outer halo and `strokeDasharray="5 3"`.
     - Negative Net Flow Markers & Negative KPI Value: Terracotta `#9A3B22` (`6.84:1` vs `#FFFDF9`).
4. **Mobile Typography & Touch Ergonomics (`segmented-tabs.tsx`):**
   - Refined mobile track tab horizontal padding (`px-2.5 text-[13px] sm:px-3.5 sm:text-sm`) so all 4 granularity buttons (`Harian`, `Mingguan`, `Bulanan`, `Tahunan`) fit completely inside a `390px` phone viewport without horizontal clipping while preserving `>= 44px` touch targets.

---

## 4. Changed Files

| File | Change Type | Summary |
| :--- | :--- | :--- |
| [app/Services/ReportService.php](../../app/Services/ReportService.php) | Modified | Added `buildPaymentMethodBreakdown()`, added `percent_exact` on expense categories, passed `cash_in` into `getBreakdowns()`, consolidated `findEarliestRecordDate()` into 1 SQL query. |
| [app/Http/Controllers/UiReportController.php](../../app/Http/Controllers/UiReportController.php) | Modified | Memoized lazy `'report'` prop closure so deferred `details` and granularity partial reloads skip redundant core summary queries; passed `payment_method_breakdown` inside `reportBreakdowns`. |
| [resources/js/types.ts](../../resources/js/types.ts) | Modified | Added `PaymentMethodBreakdownItem`, optional `percent_exact` on `ExpenseBreakdownItem`, and `payment_method_breakdown` on `ReportBreakdownsData` / `FinancialReportData`. |
| [resources/js/components/report-charts.tsx](../../resources/js/components/report-charts.tsx) | Modified | Rebuilt SVG trend chart with AUD-08 accessible palette, clamped floating tooltip, keyboard navigation, net-flow dashed polyline + `Rp0` negative baseline, `PaymentMethodCard`, true-proportion `ExpenseCategoryCard` (AUD-07), and refined `StatusDistributionPanel`. |
| [resources/js/pages/Reports/Index.tsx](../../resources/js/pages/Reports/Index.tsx) | Modified | Redesigned Reports page with `<PageHeader>`, all 8 verified presets including `Semua Waktu`, single mobile `<Select>`, 4-card period KPI strip + live receivable context strip, `React.lazy` chart split, and reconciled expanded table footer. |
| [resources/js/components/ui/segmented-tabs.tsx](../../resources/js/components/ui/segmented-tabs.tsx) | Modified | Adjusted mobile track tab padding/font size (`px-2.5 text-[13px] sm:px-3.5 sm:text-sm`) to eliminate `390px` granularity label clipping while preserving `min-h-[44px]`. |
| [tests/Feature/Phase13DFinancialReportsTest.php](../../tests/Feature/Phase13DFinancialReportsTest.php) | Added | 6 feature tests covering payment method reconciliation + legacy methods + voids, AUD-07 expense proportion accuracy, all 8 presets + WIB midnight boundaries, empty/negative/large formatting & table totals, Dashboard-vs-Report parity, query counts, and `.xlsx` export integrity. |

---

## 5. AUD-07 and AUD-08 Closure Evidence

| Audit ID | Finding Summary | Status | Concrete Verification Evidence |
| :--- | :--- | :--- | :--- |
| **AUD-07** | `ExpenseCategoryCard` previously scaled bar width by `item.amount / maxAmount * 100`, rendering a 64% top category as a 100% full-width bar. | **CLOSED** | 1. **Unit/Feature Test:** `Phase13DFinancialReportsTest::test_expense_breakdown_uses_true_proportion_of_total_cash_out_and_preserves_tiny_categories` (**PASS**): verifies `Rp3.200.000` (64%), `Rp1.280.000` (26%), `Rp500.000` (10%), and tiny `Rp20.000` (`0.4%`, `percent_exact: 0.4`) against `total_cash_out = Rp5.000.000`.<br>2. **Live DOM Audit (`1440x900`):** `[data-testid="expense-category-bar"]` computed inline widths: `63.843%`, `11.3636%`, `10.7438%`, `9.29752%`, `4.75207%` (sum = `100.00%`, matching labels `64%`, `11%`, `11%`, `9%`, `5%`; top category stops at ~64%, not 100%).<br>3. **Visual Proof:** [01-reports-normal-desktop-1440.png](screenshots-phase13d/01-reports-normal-desktop-1440.png) and [05-reports-negative-flow-desktop-1440.png](screenshots-phase13d/05-reports-negative-flow-desktop-1440.png) (`84%` / `16%`). |
| **AUD-08** | Adjacent chart bars `Kas Masuk` (`#1D3B2A`) and `Kas Keluar` (`#8F4B1E`) had only `1.87:1` luminance contrast (below WCAG 1.4.11 `3:1` requirement). | **CLOSED** | 1. **Contrast Checker (`contrast-check.py`):** Verified `#1B3B2B` vs `#FFFDF9` = `12.11:1` (PASS), `#C07624` vs `#FFFDF9` = `3.53:1` (PASS), **`#1B3B2B` vs `#C07624` = `3.43:1` (PASS >= 3:1)**, `#858980` vs `#FFFDF9` = `3.51:1` (PASS), `#1B3B2B` vs `#858980` = `3.45:1` (PASS), `#193F66` vs `#FFFDF9` = `10.63:1` (PASS), `#193F66` vs `#C07624` = `3.01:1` (PASS), `#9A3B22` vs `#FFFDF9` = `6.84:1` (PASS).<br>2. **Visual Proof:** [01-reports-normal-desktop-1440.png](screenshots-phase13d/01-reports-normal-desktop-1440.png), [02-reports-tooltip-desktop-1440.png](screenshots-phase13d/02-reports-tooltip-desktop-1440.png), and [05-reports-negative-flow-desktop-1440.png](screenshots-phase13d/05-reports-negative-flow-desktop-1440.png). |

---

## 6. Final AUD-01 Through AUD-10 Audit Closure Matrix

All 10 findings recorded in `docs/phase13/PHASE13A_UI_UX_AND_BUSINESS_INTELLIGENCE_AUDIT.md` are now closed and verified:

| ID | Severity | Finding | Closed In | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **AUD-01** | P0 | Broken Expense Recorder Attribution (`recorded_by` vs `recorded_by_user`) | Phase 13B (`ae22cbb`) | **CLOSED (PASS)** (`Phase13BFoundationRegressionTest`) |
| **AUD-02** | P0 | Customer Detail Table Action Column Clipping on `1440x900` | Phase 13B (`ae22cbb`) | **CLOSED (PASS)** (`Phase13BFoundationRegressionTest` + 4-viewport QA) |
| **AUD-03** | P1 | Tablet `768px` Topbar Cramming & Brand Wrapping | Phase 13B (`ae22cbb`) | **CLOSED (PASS)** (4-viewport shell QA) |
| **AUD-04** | P1 | Triple Duplicate Primary CTA Across Sidebar, Topbar, and Page Header | Phase 13B (`ae22cbb`) | **CLOSED (PASS)** (4-viewport shell QA) |
| **AUD-05** | P1 | Raw 36-Char ULID Order Codes Leaking in Dashboard & Payments | Phase 13B (`ae22cbb`) & Phase 13C (`e252e51`) | **CLOSED (PASS)** (`rawUlidCount: 0` across Dashboard & Payments) |
| **AUD-06** | P1 | Ambiguous Duplicate Repeat Customers in Dashboard Open Receivables | Phase 13C (`e252e51`) | **CLOSED (PASS)** (`Phase13CDashboardBiTest` + multi-invoice picker QA) |
| **AUD-07** | P1 | Misleading Max-Normalized Expense Category Bar Scaling | Phase 13D (pending review) | **CLOSED (PASS)** (`Phase13DFinancialReportsTest` + live DOM width audit) |
| **AUD-08** | P1 | Chart Neighbor Contrast Below 3:1 (WCAG 1.4.11 / R-25) | Phase 13D (pending review) | **CLOSED (PASS)** (`contrast-check.py` `3.43:1` + visual proof) |
| **AUD-09** | P1 | Raw Database Enum `VOIDED` Leaking in Expanded Report Table | Phase 13B (`ae22cbb`) & Re-verified Phase 13D | **CLOSED (PASS)** (`hasVoided: false` in Phase 13D live expanded table) |
| **AUD-10** | P1 | Semantic Color Inversion on Expenses Summary (`#1D3B2A` on Cash Out) | Phase 13B (`ae22cbb`) | **CLOSED (PASS)** (Warm ochre `#8F4B1E` / neutral ink verified) |

---

## 7. Financial Calculation Definitions & Invariants

All financial numbers on `/ui-reports` originate strictly from `ReportService` integer Rupiah queries (zero client-side financial re-computation):

1. **Timezone Boundary:** Every period (`today`, `7d`, `30d`, `this_month`, `last_month`, `this_year`, `all_time`, `custom`) resolves start/end instants in `Asia/Jakarta` (WIB, UTC+7) (`00:00:00` to `23:59:59`) and converts timestamps (`paid_at`) to UTC for DB filtering while comparing date columns (`order_date`, `expense_date`) directly against WIB calendar dates. Verified with a `23:30 WIB` / `00:30 WIB` midnight-boundary test.
2. **Nilai Pesanan (`summary.gross_order_value`):** Sum of `orders.total_amount` for orders with `order_date` in range (`subtotal_amount` = `Bunga`, `shipping_fee` = `Ongkir`; `shipping_type = INCLUDED` keeps `shipping_fee = 0`). Distinct from actual cash received.
3. **Kas Masuk Sah (`summary.cash_in`):** Sum of `payments.amount` where `status = 'POSTED'` and `paid_at` falls within the WIB period. `VOIDED` payments are strictly excluded.
4. **Kas Keluar Sah (`summary.cash_out`):** Sum of `expenses.amount` where `status = 'POSTED'` and `expense_date` falls within the WIB period. `VOIDED` expenses are strictly excluded.
5. **Selisih Kas (`summary.net_cash_flow`):** Exact integer `cash_in - cash_out`. Explicitly labeled `Kas masuk dikurangi kas keluar (bukan laba bersih)` so cash flow is never misrepresented as accrual net profit.
6. **Piutang Berjalan (`summary.outstanding_receivables`):** Live current-date snapshot (`SUM(orders.total_amount) - SUM(POSTED payments.amount)` for orders where `payment_status IN ('UNPAID', 'PARTIAL')`), visually separated from the 4 period KPI cards and explicitly labeled `(snapshot saat ini)`.
7. **Dashboard vs Reports Parity:** Automated regression (`Phase13DFinancialReportsTest::test_dashboard_and_report_metrics_stay_consistent_across_30d_and_all_time`) confirms identical `cash_in`, `cash_out`, `net_cash_flow`, and `outstanding_receivables` values between `/ui-dashboard` (`insights` 30-day series + all-time totals) and `/ui-reports` (`preset=30d` and `preset=all_time`).

---

## 8. Payment Method Reconciliation Verification

`ReportService::buildPaymentMethodBreakdown()` executes a single grouped query on `payments` filtered by `status = 'POSTED'` and the active WIB `paid_at` bounds, returning four consistent channels:

- `TRANSFER` -> `Transfer Bank`
- `CASH` -> `Tunai`
- `QRIS` -> `QRIS`
- `OTHER` -> `Lainnya` (explicitly folds `OTHER`, `NULL`, empty string, or any legacy/unexpected method string such as `EWALLET_LEGACY` or lowercase `transfer` cleanly without data loss).

### Reconciliation Evidence

- **Automated Test (`Phase13DFinancialReportsTest::test_payment_method_breakdown_reconciles_with_cash_in_and_excludes_voided_and_handles_legacy_methods`):**
  - Seeded `POSTED` payments: `Transfer Bank` (`Rp2.500.000` + lowercase `transfer` `Rp500.000` = `Rp3.000.000`, 2x, 60%), `Tunai` (`Rp1.000.000`, 1x, 20%), `QRIS` (`Rp750.000`, 1x, 15%), `Lainnya` (`EWALLET_LEGACY` `Rp250.000`, 1x, 5%), plus 1 `VOIDED` `TRANSFER` (`Rp4.000.000`, excluded).
  - Verified `SUM(payment_method_breakdown[].amount) === summary.cash_in === Rp5.000.000` and `SUM(count) === 5` (**PASS**).
- **Live Synthetic Audit Dataset (`30d`, `01-reports-normal-desktop-1440.png`):**
  - `Transfer Bank (9x)`: `Rp9.055.000` (`83%`)
  - `QRIS (2x)`: `Rp1.085.000` (`10%`)
  - `Tunai (1x)`: `Rp740.000` (`7%`)
  - `Lainnya (0x)`: `Rp0` (`0%`)
  - Total: `Rp9.055.000 + Rp1.085.000 + Rp740.000 + Rp0 = Rp10.880.000` (100% match with `Kas Masuk Sah` KPI card `Rp10.880.000`).
- **Empty Dataset (`04-reports-empty-desktop-1440.png`):** Renders `Total Rp0` with calm Indonesian empty state `Belum ada pembayaran masuk` and zero `NaN` or division errors.

---

## 9. Expense Proportion Verification (AUD-07)

- **Formula:** `truePercent = totalCashOut > 0 ? (item.amount / totalCashOut) * 100 : 0`.
- **Bar Width Rendering:** `width = item.amount > 0 ? Math.min(100, Math.max(truePercent, 1.5)) : 0` (exact true proportion for every category `>= 1.5%`, tiny `1.5%` floor solely so nonzero sub-1.5% categories stay visible without exaggerating share).
- **Label Precision:** Categories with `0 < percent_exact < 1` display 1-decimal exact percentage (e.g., `0,4%` via `id-ID` formatting) rather than misleading `0%`.
- **Live Audit Dataset (`30d`, `Total Rp4.840.000`):**
  - `Belanja Bunga Segar (4x)`: `Rp3.090.000` (`64%`, DOM bar `63.843%`)
  - `Perlengkapan & Pita (2x)`: `Rp550.000` (`11%`, DOM bar `11.3636%`)
  - `Listrik & Operasional Toko (1x)`: `Rp520.000` (`11%`, DOM bar `10.7438%`)
  - `Papan & Kerangka Styrofoam (1x)`: `Rp450.000` (`9%`, DOM bar `9.29752%`)
  - `Kurir & Transportasi (2x)`: `Rp230.000` (`5%`, DOM bar `4.75207%`)
  - Sum of amounts: `Rp4.840.000` (100% reconciled with `Kas Keluar Sah`); sum of true DOM bar widths: `100.00%`.

---

## 10. Initial and Deferred Query-Count Comparison

Measured via `DB::enableQueryLog()` in `Phase13DFinancialReportsTest::test_report_query_counts_stay_lean_and_excel_export_stays_intact` (excluding Laravel session/auth user lookup queries):

| Request / Operation | Pre-Phase 13D Baseline | Phase 13D Measured | Delta | Status |
| :--- | :---: | :---: | :---: | :---: |
| Initial `GET /ui-reports?preset=30d` (core summary only) | 1 SQL query | **1 SQL query** | `0` | **PASS** |
| Deferred `details` reload (`reportBreakdowns, reportTrends`) | 7 SQL queries (incl. redundant `report` summary; 6 without payment method query) | **6 SQL queries** (`orderCounts` + `expenseBreakdown` + NEW `paymentMethodBreakdown` + 3 `fetchDailyActivityMap` queries) | **`-1` vs baseline** (`0` net overhead for payment breakdown) | **PASS** |
| Granularity partial reload (`only: ['reportTrends']`) | 4 SQL queries (incl. redundant `report` summary) | **3 SQL queries** (`fetchDailyActivityMap` only) | **`-1`** | **PASS** |
| `all_time` earliest record lookup (`findEarliestRecordDate`) | 3 SQL queries (`orders`, `payments`, `expenses` MIN) | **1 SQL query** (consolidated scalar subqueries) | **`-2`** | **PASS** |

*Caveat:* Query-count measurements were collected on local SQLite in PHPUnit. Local SQLite timing does **not** prove Supabase PostgreSQL production latency; production timing verification on Supabase remains part of Phase 13E / staging rollout.

---

## 11. Eager, Lazy, and Total Bundle Size Comparison

Measured directly from `npm run build` (Vite 8.3.5 / Rolldown, 0 new JavaScript dependencies):

| Asset / Group | Pre-Phase 13 (Baseline) | Phase 13B (`ae22cbb`) | Phase 13C (`e252e51`) | **Phase 13D (Final)** | Budget / Target | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Eager Inertia JS (Raw)** (`inertia` + shared `segmented-tabs` + `rolldown-runtime`) | `641.69 kB` | `652.53 kB` | `659.75 kB` | **`647.81 kB`** (`252.61` + `394.48` + `0.72`) | `<= 670 kB` ceiling | **PASS (`-11.94 kB` vs 13C)** |
| **Eager Inertia JS (Gzip)** | N/A | `180.32 kB` | `182.19 kB` | **`180.59 kB`** (`56.75` + `123.42` + `0.42`) | Lightweight | **PASS (`-1.60 kB` vs 13C)** |
| **Lazy `dashboard-insights-*.js` (Raw / Gzip)** | N/A | N/A | `11.01 kB` / `3.66 kB` | **`11.09 kB` / `3.71 kB`** | Loaded only on `/ui-dashboard` | **PASS** |
| **Lazy `report-charts-*.js` (Raw / Gzip)** | Bundled eagerly | Bundled eagerly | Bundled eagerly | **`20.75 kB` / `5.73 kB`** | Loaded only on `/ui-reports` | **PASS** |
| **Lazy Async Chunks Subtotal (Raw / Gzip)** | `0 kB` | `0 kB` | `11.01 kB` / `3.66 kB` | **`31.84 kB` / `9.44 kB`** | On-demand code split | **PASS** |
| **Total Inertia JS (Eager + Lazy) (Raw / Gzip)** | `641.69 kB` | `652.53 kB` | `670.76 kB` / `185.85 kB` | **`679.65 kB` / `190.03 kB`** | Transparently tracked | **PASS (`+8.89 kB` total)** |
| **`app-*.css` (Raw / Gzip)** | `60.38 kB` | `69.46 kB` | `70.82 kB` / `14.08 kB` | **`70.97 kB` / `14.11 kB`** | Clean token stylesheet | **PASS** |
| **Legacy Blade `app-*.js` (Raw / Gzip)** | N/A | N/A | `55.54 kB` / `19.68 kB` | **`55.54 kB` / `19.68 kB`** | Unchanged | **PASS** |

*Architecture Note:* Splitting `report-charts.tsx` into a lazy async chunk loaded alongside Inertia's deferred `details` props reduced eager JS loaded on every page navigation (`Dashboard`, `Orders`, `Payments`, `Customers`, `Expenses`) by **`11.94 kB` raw** below Phase 13C, leaving **`22.19 kB`** of headroom below the `670 kB` Phase 13 eager ceiling.

---

## 12. Automated Regression Results

### Targeted Verification Suites Executed (SQLite Test Harness)

| Verification Command / Suite | Result | Details |
| :--- | :---: | :--- |
| `npm run typecheck` (`tsc --noEmit`) | **PASS** | 0 TypeScript errors |
| `npm run build` (`vite build`) | **PASS** | Clean production build in `4.35s` |
| `tests/Feature/Phase13DFinancialReportsTest.php` | **PASS** | 6 tests passed (payment methods, AUD-07 proportions, 8 presets + WIB midnight, negative/empty/large + table reconciliation, Dashboard parity, query counts + `.xlsx` export) |
| `tests/Feature/UiReportTest.php` | **PASS** | All existing report & Excel export regression tests passed |
| `tests/Feature/Phase13CDashboardBiTest.php` | **PASS** | Dashboard BI & open-receivable tests passed |
| `tests/Feature/Phase13BFoundationRegressionTest.php` | **PASS** | AUD-01 & AUD-02 foundation regression tests passed |
| `tests/Feature/UiNavigationPerformanceTest.php` | **PASS** | Instant Navigation V2 performance & deferred prop tests passed |
| `tests/Feature/UiDashboardTest.php` | **PASS** | Operational dashboard workflow tests passed |
| `tests/Feature/Phase9Sprint3FinancialTest.php` | **PASS** | Financial invariants & ledger integrity tests passed |
| **Combined Targeted PHPUnit Run (7 Suites)** | **PASS** | **47 passed (2,257 assertions) in `32.63s`** |

### Full-Suite Local Infrastructure Disclosure (Unchanged Since Phase 13B)

The full unfiltered `php artisan test` suite is **NOT** reported as passing on this local Windows workstation. Five database/backup integration tests remain **BLOCKED / FAIL** and three remain **SKIPPED** due to absent local MariaDB (`127.0.0.1:3306`) and local PostgreSQL (`127.0.0.1:5433`) daemons:

- `Tests\Feature\DatabaseBackupTest` (local `mysqldump` / MariaDB dependency) - **BLOCKED (FAIL locally)**
- `Tests\Feature\StagingMigrationAndAdminCommandTest` (PostgreSQL staging migration dependency) - **BLOCKED (FAIL locally)**
- `Tests\Feature\PaymentConcurrencyTest` (PostgreSQL row-level locking concurrency tests) - **SKIPPED locally**

These remain a mandatory Phase 13E / Docker-PostgreSQL verification gate prior to any staging or production deployment.

---

## 13. Accessibility & Chart Interaction Verification

Verified via `agent-browser` live DOM scripts and `.agents/skills/antislop-human/contrast-check.py`:

- **WCAG AA Contrast & 1.4.11 Non-Text Contrast:** All chart series, axes, tooltips, badges, and text colors meet or exceed WCAG AA (`>= 4.5:1` text, `>= 3:1` adjacent chart fills and graphical objects; `contrast-check.py` confirmed `#1B3B2B` vs `#C07624` = `3.43:1`).
- **Keyboard Focus & Navigation (`svg[role="img"] g[role="button"]`):**
  - Focusing first bucket opened floating tooltip cleanly clamped inside chart bounds (`TOOLTIP_FOCUS => visible: true, inBounds: true, hasNetPolyline: true`).
  - Pressing `ArrowRight` shifted active bucket from `26/10 - 01/11` to `02/11 - 08/11` while keeping the tooltip within bounds (`TOOLTIP_ARROW_RIGHT => visible: true, inBounds: true`).
  - `Home`, `End`, and `Escape` keyboard handlers verified in `report-charts.tsx`.
- **Net Cash Flow Toggle (`Garis Selisih Kas`):** Confirmed live SVG polyline count toggles cleanly between `0` (off) and `2` (halo + dashed line on) (`NET_LINE_TOGGLE => off=0 on=2`).
- **Touch Targets & Semantic Structure:** `h1Count: 1`, `smallTargetCount: 0` (every visible interactive control `>= 44x44px`), `emDashes: 0`, `rawEnums: []`, `pendingNavs: 0`, `0` browser console/JS errors across all tested viewports and scenarios.

---

## 14. Four-Viewport & Multi-Scenario Browser QA

Executed via `agent-browser` against isolated synthetic SQLite datasets (`phase13a_audit.sqlite`, `phase13c_empty.sqlite`, `phase13c_high_neg.sqlite`) with clean server teardown (`REMAINING_PHP_PROCS => 0`):

| Scenario / Viewport | Overflow | Em Dashes | Raw Enums | Small Targets (< 44px) | Key Checks | Status |
| :--- | :---: | :---: | :---: | :---: | :--- | :---: |
| Normal Dataset - Desktop `1440x900` | `false` | `0` | `0` | `0` | Payment methods, AUD-07 true bars, tooltip, `all_time`, expanded table footer (`hasVoided: false`) | **PASS** |
| Normal Dataset - Laptop `1366x768` | `false` | `0` | `0` | `0` | Balanced 4-KPI strip, 2-col breakdowns, zero chart clipping | **PASS** |
| Normal Dataset - Tablet `768x1024` | `false` | `0` | `0` | `0` | Clean 2x2 KPI grid, single-row period tabs, tablet table columns | **PASS** |
| Normal Dataset - Mobile `390x844` | `false` | `0` | `0` | `0` | Single `<Select>` preset control, all 4 granularity tabs (`Harian`/`Mingguan`/`Bulanan`/`Tahunan`) unclipped, mobile tap bars | **PASS** |
| Empty Business Dataset - Desktop `1440x900` | `false` | `0` | `0` | `0` | `emptyChart: true`, `emptyPay: true`, `emptyExp: true`, zero `NaN` | **PASS** |
| Negative Net Cash Flow Dataset (`7d`) - Desktop `1440x900` | `false` | `0` | `0` | `0` | `hasNegDiff: true` (`-Rp4.000.000`), `hasZeroTick: true` (`Rp0`), `hasNegTick: true` (`-Rp2,5 jt`, `-Rp5 jt`), `hasNegDot: true` (`#9A3B22`) | **PASS** |
| SPA Navigation Regression (`/ui-reports` -> `/ui-dashboard`) | `false` | `0` | `0` | `0` | `hasChart: true`, `pending: 0`, lazy `dashboard-insights` chunk loads cleanly | **PASS** |

---

## 15. Before / After Screenshot Evidence

### Phase 13A Baseline (Before)
- Desktop `1440x900`: [03-reports-desktop-1440.png](screenshots/03-reports-desktop-1440.png)
- Laptop `1366x768`: [03-reports-laptop-1366.png](screenshots/03-reports-laptop-1366.png)
- Tablet `768x1024`: [03-reports-tablet-768.png](screenshots/03-reports-tablet-768.png)
- Mobile `390x844`: [03-reports-mobile-390.png](screenshots/03-reports-mobile-390.png)

### Phase 13D Redesigned Financial Reports (After - Synthetic Data Only)
- Desktop `1440x900` (Normal): [01-reports-normal-desktop-1440.png](screenshots-phase13d/01-reports-normal-desktop-1440.png)
- Laptop `1366x768` (Normal): [01-reports-normal-laptop-1366.png](screenshots-phase13d/01-reports-normal-laptop-1366.png)
- Tablet `768x1024` (Normal): [01-reports-normal-tablet-768.png](screenshots-phase13d/01-reports-normal-tablet-768.png)
- Mobile `390x844` (Normal, post-polish): [01-reports-normal-mobile-390.png](screenshots-phase13d/01-reports-normal-mobile-390.png)
- Interactive Tooltip & Net Cash Flow Line (`1440x900`): [02-reports-tooltip-desktop-1440.png](screenshots-phase13d/02-reports-tooltip-desktop-1440.png)
- Expanded Reconciled Table & Footer (`1440x900`): [03-reports-expanded-table-desktop-1440.png](screenshots-phase13d/03-reports-expanded-table-desktop-1440.png)
- Empty Business State (`1440x900`): [04-reports-empty-desktop-1440.png](screenshots-phase13d/04-reports-empty-desktop-1440.png)
- Negative Net Cash Flow & `Rp0` Baseline (`1440x900`): [05-reports-negative-flow-desktop-1440.png](screenshots-phase13d/05-reports-negative-flow-desktop-1440.png)

---

## 16. Remaining Risks & Blockers

1. **Blocked Local Full-Suite DB Tests (Carried from Phase 13B):** `DatabaseBackupTest`, `StagingMigrationAndAdminCommandTest`, and `PaymentConcurrencyTest` require local MariaDB / PostgreSQL instances not running on this workstation. They must be executed in an isolated Docker / PostgreSQL environment during Phase 13E before merging or deploying.
2. **Production Supabase Latency Not Yet Measured:** Query counts on SQLite improved (`-1` on deferred `details`, `-1` on granularity reloads, `-2` on `all_time`), and eager JS dropped by `11.94 kB`, but actual wall-clock latency on PostgreSQL Supabase (`staging-admin.mutiaraflorist.id`) has not yet been measured and must not be assumed from SQLite timings.
3. **Independent Visual Review Pending:** All 8 Phase 13D synthetic screenshots are archived in `docs/phase13/screenshots-phase13d/` for independent human visual review before Phase 13D commit approval.

---

## 17. Recommended Final Phase 13E Verification Scope

Upon approval of Phase 13D (and after committing Phase 13D locally), Phase 13E should serve as the final cross-application polish, regression, and release-readiness gate:

1. **Cross-Page Visual & Responsive Sweep:** Verify all remaining Inertia modules (`/ui-orders`, `/ui-orders/create`, `/ui-orders/{id}`, `/ui-payments`, `/ui-customers`, `/ui-customers/{id}`, `/ui-expenses`, `/ui-expense-categories`) across `1440`, `1366`, `768`, and `390px` to confirm zero regressions from shared component updates (`SegmentedTabs`, `AppLayout`, tokens).
2. **PostgreSQL & Full-Suite Regression Gate:** Execute the full PHPUnit suite (including `PaymentConcurrencyTest`, `StagingMigrationAndAdminCommandTest`, and `DatabaseBackupTest` where supported) against an isolated PostgreSQL environment to clear the conditional regression status.
3. **Staging Verification & Production Parity Check:** Deploy `feat/phase13-ui-bi-enhancement` only to staging (`staging-admin.mutiaraflorist.id`) when explicitly authorized, measure real Supabase network timings against the `9e601d6` baseline, verify `.xlsx` download in browser, and compile the final Phase 13 sign-off package for the November 26, 2026 academic milestone.

---

## Anti-Slop Mode 1 Delivery Gate

- **R-01 to R-40 & Visual Direction Compliance:** Calm Botanical Workspace V2 (`ENERGY 2 / RHYTHM 3 / MOTION 1`), restrained florist palette, zero decorative gradients, zero generic template clutter, zero em dashes (`U+2014`) in any Phase 13D code, UI text, or documentation. -> **PASS**
- **Contrast & Accessibility (`contrast-check.py` + Live DOM):** WCAG AA text contrast and `>= 3:1` chart neighbor contrast (`#1B3B2B` vs `#C07624` = `3.43:1`), `>= 44x44px` tap targets (`smallTargetCount: 0`), keyboard chart navigation (`Tab` / `ArrowLeft` / `ArrowRight` / `Home` / `End` / `Escape`). -> **PASS**
- **Responsive Reflow (`1440`, `1366`, `768`, `390px`):** `overflow: false`, single mobile preset `<Select>`, zero clipped granularity tabs on `390px`, mobile tap bars functional. -> **PASS**
- **Business & Accounting Invariants:** Integer Rupiah arithmetic, WIB boundaries, `POSTED`-only cash flows, `Selisih Kas` explicitly disclaimed as not net profit, `Piutang Berjalan` separated as live snapshot, `Payment Method` 100% reconciled with `cash_in`, `Expense Category` true proportions reconciled with `cash_out`, `.xlsx` export preserved. -> **PASS**
- **Evidence Honesty & Safety:** Explicit `PASS / FAIL / BLOCKED / SKIPPED` labels, SQLite-vs-Supabase caveat stated, 5 failed / 3 skipped DB-dependent tests transparently disclosed, zero production/staging changes, zero Phase 13D commit or push performed. -> **PASS**
