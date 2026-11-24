# MFMS Phase 13A: UI/UX & Business Intelligence Audit and Design Plan

- **System:** Mutiara Florist Management System (MFMS)
- **Stage:** Phase 13A (Audit and Design Planning Only, No Application Code Modified)
- **Audit Date:** 24 November 2026 (WIB / `Asia/Jakarta`)
- **Active Anti-Slop Mode:** Mode 1 (DURING the project: planning, implementation, and final QA)
- **Development & Production Baseline:** Branch `feat/inertia-instant-navigation`, commit `9e601d6` (`fix(docker): allow nginx to traverse public web root`), running Instant Navigation V2
- **Academic Milestone Target:** Progress 3 Implementasi, due 26 November 2026, 23:59 WIB
- **Isolated Audit Runtime:** `http://127.0.0.1:8193` backed by a scratch SQLite database (`phase13a_audit.sqlite`) seeded with 100% synthetic data (10 customers, 13 orders, POSTED/VOIDED payments, 6 expense categories, 11 expenses). Operational databases and production were never touched.

---

## 1. Current Implementation Baseline

### 1.1 Git, Branch, and Stack Verification

| Dimension | Verified Baseline |
| --- | --- |
| Current Branch | `feat/inertia-instant-navigation` (tracking `origin/feat/inertia-instant-navigation`, clean working tree before Phase 13A doc/screenshots) |
| HEAD Commit | `9e601d6` (directly atop `62d6b32` and `2fe7b26` Instant Navigation V2 commits) |
| Diverged from `main` | 13 commits ahead of `main` (`2b8fa22` Phase 12B accessibility -> `6a86bef`..`7f636c1` Phase 15A/15B PostgreSQL & Cloud Staging -> `2fe7b26`..`9e601d6` Instant Navigation V2) |
| Correct Dev Base | All Phase 13B+ feature branches must branch from `feat/inertia-instant-navigation` (`9e601d6`), NOT from `main`, so Phase 12B modal top-layer fixes, Phase 15 PostgreSQL compatibility, and Instant Navigation V2 are preserved. |
| Backend Stack | PHP `8.2.12`, Laravel `12.x`, `inertiajs/inertia-laravel ^3.7`, PostgreSQL Supabase (prod/staging) + SQLite/MariaDB (local test) |
| Frontend Stack | React `19.2`, TypeScript `5.9.3`, `@inertiajs/react ^3.11.0`, Tailwind CSS `^4.0`, Vite `^8.0`, `lucide-react ^1.73`, `@radix-ui/react-slot`, `class-variance-authority`, local `@fontsource-variable/plus-jakarta-sans` & `@fontsource-variable/jetbrains-mono` |
| Charting Dependencies | Zero external chart libraries (pure custom SVG in `resources/js/components/report-charts.tsx`) |
| Production Bundle (`public/build/`) | `inertia-DAbgJ3xm.js`: `641.7 kB` raw (all pages eagerly bundled via `import.meta.glob('./pages/**/*.tsx', { eager: true })` to prevent chunk-fetch waterfall on instant visits); `app-B7XfTukO.css`: `60.4 kB` raw |
| Automated Checks | `npm run typecheck`: PASS (`0` errors). `php artisan test`: `133 passed, 3 skipped, 81 pending, 2 failed` (the 2 failures are `StagingMigrationAndAdminCommandTest` requiring an active local `pgsql_testing` Postgres instance; all SQLite/feature/reconciliation tests pass). |

### 1.2 Production Performance Baseline (Instant Navigation V2, Commit `9e601d6`)

Reported production response times (Ubuntu Docker + Supabase PostgreSQL + Cloudflare Tunnel/Access):

| Screen / Payload | Measured Production Latency | Instant Navigation V2 Mechanism in Code |
| --- | ---: | --- |
| Dashboard (`/dashboard`) | 792-863 ms | Single-round-trip `DashboardService::stats()` & `todayStats()`, `activeDeliveryQueue()` window functions, `receivables` via `Inertia::defer(..., 'receivables', true)` |
| Orders (`/ui-orders`) | 639 ms | `useScopedFilterLoading('/ui-orders')`, partial reload `only: ['orders', 'filters']`, hover prefetch `cacheFor="10s"` |
| Create Order (`/ui-orders/create`) | 627 ms | Persistent `AppLayout`, `useUnsavedChangesGuard`, prefetch cache tags `['customers', 'orders']` |
| Payments (`/ui-payments`) | 751-820 ms | Receivables immediate; `paymentHistory` via `Inertia::defer(..., 'history', true)` |
| Customers (`/ui-customers`) | 711 ms | Partial reload `only: ['customers', 'filters']`, prefetch cache tags `['customers']` |
| Expenses (`/ui-expenses`) | 786 ms | Partial reload `only: ['expenses', 'postedTotal', 'filters']` |
| Expense Categories (`/ui-expense-categories`) | 607 ms | Client-side status tab filtering on full category list |
| Reports (`/ui-reports`) | 774 ms (core) + 1.18 s (deferred) | `ReportService::getSummaryReport()` consolidated scalar SQL; `reportBreakdowns` & `reportTrends` deferred in group `'details'` |

### 1.3 What Phases 7-12 Already Completed (Do Not Re-Implement)

Auditing the actual source code prevented redundant work. The following Phase 7 audit defects are **already resolved** on `9e601d6`:
1. **Indonesian validation messages & attributes** across all 7 `FormRequest` classes.
2. **WIB (`Asia/Jakarta`) date integrity** via server `todayIso` + `getWibTodayIso()` and `formatDateWib()` / `formatDateTimeWib()`.
3. **Consistent Rupiah formatting** via `formatRupiah()` (`Rp1.500.000`, `-Rp55.000`, `tabular-nums`) and `<CurrencyInput>`.
4. **Blade fallback scaffolding removed** from React operational screens, sidebar, and login.
5. **Accessible top-layer `<Modal>` stack** (`resources/js/components/ui/modal.tsx`) with `createPortal`, `inert` background locking, `Escape` closing, and focus restoration (Phase 12B PATCH-01).
6. **Accessible `<SearchableSelect>`** with keyboard arrows, `Home`/`End`, `Escape`, and quick-create modals for Customers (inside `OrderForm`) and Expense Categories (inside `Expenses/Create`).
7. **Idempotency conflict lock** in `<PaymentModal>` (Phase 9 Sprint 3 PATCH-02) and **delivery finalization confirmation** in `<DeliveryConfirmModal>`.
8. **Zero horizontal overflow & zero sub-44px touch targets** verified live across 27 screen/viewport combinations in our Phase 13A automated telemetry (`scrollWidth === innerWidth`, `smallTargetCount === 0`, `emDashes === 0`, `h1Count === 1`, `console errors === 0`).

---

## 2. Evidence-Based UI/UX & Business Intelligence Audit

All findings below are backed by direct source inspection, automated DOM telemetry (`phase13a_dom_telemetry.jsonl`), WCAG AA calculations (`contrast-check.py`), and 30 live screenshots captured on `127.0.0.1:8193` across Desktop (`1440x900`), Laptop (`1366x768`), Tablet (`768x1024`), and Mobile (`390x844`).

### 2.1 Critical Functional & Visual Defects Found Live (P0 / P1)

| ID | Severity | Location (File & Evidence) | Observed Defect | Impact on Operator / Owner |
| --- | :---: | --- | --- | --- |
| **AUD-01** | **P0** | `UiExpenseController.php:44,61`, `Expenses/Index.tsx:173,510` (`10-expenses-index-desktop-1440.png`) | **Broken Expense Recorder Attribution:** Eloquent eager-loads `recordedBy`, which serializes in `$expense->toArray()` as `recorded_by` (colliding with the foreign-key integer column), while the frontend reads `exp.recorded_by_user?.name ?? 'Operator'`. Every single expense row displays **"Dicatat oleh Operator"** instead of the real staff member's name. | Breaks audit accountability on the Expenses ledger; owners cannot verify who recorded cash outflows. |
| **AUD-02** | **P0** | `Customers/Show.tsx:184,260` (`09-customers-show-desktop-1440.png`) | **Clipped Action Column on Desktop `1440x900`:** Placing a 6-column `ResponsiveDataList` table inside the left `2fr` column of a 2-column grid causes the `Aksi` (`Detail`) column to clip off the right edge of the card, while `Rangkaian & Tanggal` compresses into a 1-word-per-line vertical stack. | Operator on a 1440px desktop cannot see or click `Detail` in a customer's order history without hidden horizontal scrolling. |
| **AUD-03** | **P1** | `AppLayout` (`app-layout.tsx:143-235`) (`02-dashboard-tablet-768.png`, `04-orders-index-tablet-768.png`) | **Tablet `768px` Topbar Cramming & Brand Wrapping:** At `768px`, the topbar jams 5 items into one row (`Mutiara Florist` wraps onto 2 lines, `Cari Nota` touches `Menu` with almost zero separation, and `+ Pesanan Baru` duplicates `+ Buat Pesanan` directly below). | Topbar feels cramped and unstable at tablet width, violating R-03 middle-breakpoint polish. |
| **AUD-04** | **P1** | `app-sidebar.tsx:48-54`, `app-layout.tsx:219-233`, `Dashboard.tsx:300`, `Orders/Index.tsx:218`, `Orders/Create.tsx` (`02-dashboard-desktop-1440.png`, `05-orders-create-desktop-1440.png`) | **Triple Duplicate Primary CTA:** On Desktop Dashboard and Orders Index, "Create Order" appears three times above the fold simultaneously: Sidebar (`Buat Pesanan`), Topbar (`+ Pesanan Baru`), and Page Header (`+ Buat Pesanan`). Even inside `/ui-orders/create`, the topbar keeps displaying `+ Pesanan Baru`. | Dilutes focal hierarchy (Antislop Liveliness: one focal point per screen) and creates noisy shell chrome. |
| **AUD-05** | **P1** | `Dashboard.tsx:491`, `Payments/Index.tsx:533` (`02-dashboard-desktop-1440.png`, `02-dashboard-mobile-390.png`, `07-payments-index-mobile-390.png`) | **Raw 36-Char ULID Order Codes Leaking:** Dashboard queue groups and Payments mobile receivable cards render raw `MF-261124-01M86AZX9W9Y9EF2W6V0PHVWE7` instead of `<OrderCodeBadge compact />`, wrapping into 2-3 noisy lines on mobile and cluttering desktop headers. | Harder visual scanning and inconsistent identity compared to `Orders/Index` and `Payments` history. |
| **AUD-06** | **P1** | `Dashboard.tsx:662-705` (`02-dashboard-desktop-1440.png`) | **Ambiguous Duplicate Customers in Dashboard Receivables:** `Piutang Terbuka` shows customer name, balance, and payment badge, but omits compact order code and order date. When a repeat corporate customer (`CV Harmoni Sejahtera`) has 2 unpaid orders, both rows look identical except for balance. | Risk of clicking `Catat Bayar` on the wrong invoice for repeat B2B florist clients. |
| **AUD-07** | **P1** | `report-charts.tsx:696-718` (`03-reports-desktop-1440.png`) | **Misleading Expense Category Bar Scaling:** `ExpenseCategoryCard` calculates bar width as `(item.amount / maxAmount) * 100` instead of `(item.amount / totalCashOut) * 100`. Consequently, `Belanja Bunga Segar (64%)` renders as a **100% full-width bar**, contradicting the `(64%)` label right above it. | Visually exaggerates the top category share for business owners reviewing cost distribution. |
| **AUD-08** | **P1** | `report-charts.tsx:31-33,440-452` (`contrast-check.py`) | **Chart Neighbor Contrast Below 3:1 (WCAG 1.4.11 / R-25):** Adjacent grouped bars `Kas Masuk` (`#1D3B2A`) and `Kas Keluar` (`#8F4B1E`) have only **1.87:1** luminance contrast against each other. | Difficult to distinguish adjacent bars for low-vision users or on low-brightness shop monitors. |
| **AUD-09** | **P1** | `Reports/Index.tsx:618` | **Raw Enum Leak in Expanded Table:** Expanding `Rincian Tabel` displays `Catatan: Dibatalkan (VOIDED) otomatis dikecualikan.` containing raw database enum text `VOIDED`. | Breaks operator-friendly Bahasa Indonesia copy consistency. |
| **AUD-10** | **P1** | `Expenses/Index.tsx:294` (`10-expenses-index-desktop-1440.png`) | **Semantic Color Inversion on Expenses Summary:** `Total Pengeluaran Sah` (`Rp4.840.000`) uses botanical green `#1D3B2A` (the color reserved for Cash In / brand primary per `docs/DESIGN.md`) instead of warm ochre `#8F4B1E` or neutral ink `#1C211E`. | Confuses cash outflow with cash inflow across modules. |

### 2.2 Business Intelligence & Product Experience Gaps (Dashboard & Reports)

1. **Dashboard Serves Daily Operator Well, But Underserves the Business Owner:**
   - Currently, `Dashboard.tsx` shows 4 today-only KPIs (`Pesanan Masuk Hari Ini`, `Kiriman Hari Ini`, `Uang Diterima Hari Ini`, `Piutang Belum Lunas`), the active delivery queue, top 6 open receivables, and a muted all-time footer strip.
   - **Missing for Business Owners (using existing DB data, zero fabricated metrics):**
     - No **7-day or 30-day Cash Flow & Order Pulse mini-chart** (owners have to leave Dashboard and wait for Reports to see whether cash inflows are tracking outflows this week/month).
     - No **Today's Net Cash Flow** (`Selisih Kas Hari Ini = Kas Masuk - Kas Keluar`) surfaced clearly alongside cash in/out.
     - No **Active Order Pipeline Summary** (`Baru`, `Diproses`, `Siap Kirim` counts across all active items/orders) as a compact visual bar.
     - No **Recent Business Activity Feed** (last 5-6 real timestamped events from `orders`, `payments`, and `expenses`, e.g., new order created, payment received, expense logged).
     - No **Quick Action for Expense Entry** (`Catat Pengeluaran`) from the dashboard workspace, even though flower market runs and courier tips happen daily.
   - **Mobile Queue Tab Clipping (`02-dashboard-mobile-390.png`):** On `390px`, `Siap Kirim (2)` clips off the right edge of the horizontal scroll tablist with no visual hint that tabs scroll.

2. **Financial Reports Are Accurate But Visually Rudimentary Compared to Modern BI Standards:**
   - **Chart Interaction & Eye-Tracking:** `FinancialTrendChart` places the hovered period's readout inside a separate static strip above the SVG rather than a crisp floating tooltip anchored near the active bar/point. Users' eyes bounce up and down on every bar hover.
   - **Missing Net Cash-Flow Trend Line:** In `Masuk vs Keluar` mode, bars show cash in and cash out separately, but there is no optional/integrated `Selisih Kas` trend line or delta indicator showing net cash trajectory across weeks/months.
   - **Missing Payment Method Breakdown:** The `payments` table stores `method` (`TRANSFER`, `CASH`, `QRIS`, `OTHER`), yet Reports provides zero breakdown of cash receipts by method. For a florist shop reconciling BCA transfers vs physical cash drawer vs QRIS settlements, this is one of the highest-value real-world reports.
   - **Period Filter Redundancy & Missing `Semua Waktu`:** `ReportService::resolvePeriod()` already implements `'all_time'`, yet `PRESET_OPTIONS` in `Reports/Index.tsx:41` omits it. On Desktop, the filter row sits inside a large standalone bordered card with 60% empty space; on Mobile `390px` (`03-reports-mobile-390.png`), the `Periode lain` `<select>` duplicates the 4 quick buttons immediately above it.
   - **Semantic KPI Tone Missing:** `Reports/Index.tsx:455-476` never passes `tone` to `LedgerSummaryStrip`, so `Kas Masuk`, `Kas Keluar`, and negative `Selisih Kas` render in identical flat black.

### 2.3 Design System & Cross-Page Operational Audit Findings

1. **Hardcoded Hex Epidemic:** `resources/css/app.css` declares 30+ semantic CSS custom properties, yet nearly every React component hardcodes raw hex values (`bg-[#FFFDF9]`, `border-[#DED6C8]`, `text-[#545852]`), and subtle hex drift already occurred (`#E2B3AA` vs `#E5B5AC`, `#FCECE9` vs `#FAE5E1`).
2. **Table Visual Density & Border Heaviness:** On `Orders/Index`, `Payments/Index`, `Customers/Index`, and `ExpenseCategories/Index`, every row action button carries a heavy `1.5px solid #7D776C` outline at `44px` height, creating visual "boxiness" instead of calm scannable rows.
3. **Tablet `768px` Two-State Card Stretch (`04-orders-index-tablet-768.png`, `07-payments-index-tablet-768.png`):** `ResponsiveDataList` jumps straight from a 1-column mobile card stack (`< 1024px`) to a full desktop table (`>= 1024px`). At `768px`, single-column cards stretch `720px` wide, turning 10 orders into a `2,777px` tall scroll and Payments into `4,394px` (`5,524px` on mobile!). Adding a 2-column card grid at `md:` (`768px-1023px`) resolves the `antislop-layoutmobile` Two-State Layout defect.
4. **Mobile Pagination Wrapping (`07-payments-index-mobile-390.png`):** `Pagination.tsx:101` sets `min-w-[128px]` on `Sebelumnya` and `Berikutnya`, causing the 3-button row (`Sebelumnya`, `1`, `Berikutnya`) to wrap awkwardly onto 2 lines at `390px`.
5. **Orders Show Redundant Payment CTA (`Orders/Show.tsx:307,546,571`):** When an order has `outstanding > 0` and zero payments, `Catat Pembayaran` / `Catat Bayar` renders 3 times on the same screen. Also `<h1>` places a raw 36-char ULID inline beside `Nota`.
6. **Payments History Column Wrapping (`07-payments-index-desktop-1440.png`):** In `Riwayat Pembayaran Terakhir`, `MF-261124 · #5X41H3` wraps onto 2 lines even at `1440px` because the `Pesanan & Pelanggan` cell lacks `whitespace-nowrap` on the badge.
7. **Expenses Filter Ergonomics (`10-expenses-index-desktop-1440.png`):** Changing `Kategori` or `Status` dropdown does not auto-filter; `Terapkan Filter` sits alone on a second row below 5 controls.
8. **No Non-Blocking Toast Feedback:** `AppLayout` renders flash alerts inline at the top of `<main>`, pushing the entire page downward (layout shift) after every status step or quick payment, and never auto-dismissing routine success messages.
9. **Dead/Unused Code Leftovers:** `resources/js/components/stat-card.tsx` (unused), `AppSidebar` export in `app-sidebar.tsx` (unused), `resources/js/pages/Preview.tsx` & `/ui-preview` route (Phase 3.3 artifact eagerly bundled into `inertia.js`).

---

## 3. Analysis of Visual References (Syncro & Sparkpixel)

> **Direct Visual Verification Completed (24 Nov 2026):** Both third-party visual references (`reference-a-syncro.png` and `reference-b-sparkpixel.png`) were directly inspected at full resolution during development and are retained locally (excluded from public repository distribution). Every design decision below is grounded in observed visual evidence from both images and adapted into MFMS's `Calm Botanical Workspace V2` identity without cloning either template (R-30).

### 3.1 Reference A: Syncro Dashboard (`reference-a-syncro.png`)

**Directly Observed Strengths:**
- **Clean Framed Shell & Surface Separation:** Crisp white sidebar and elevated topbar (`Overview`, search button, account block with name + role + subtle logout icon) clearly separated from a soft neutral canvas (`#F7F8FA`) by hairline borders (`1px`), giving the workspace effortless visual calm.
- **Organized Sidebar Grouping & Active Accent Bar:** Quiet group headers (`Main Menu`, `System`), uncluttered row rhythm, and a restrained active item treatment combining a soft tinted pill with a thin vertical accent bar at the edge, plus a quiet bottom `Logout` action.
- **Modular 3-Band Composition:** Top page header (`Dashboard Overview` + 1-line subtitle + right-aligned period chip + single primary CTA), followed by 4 balanced KPI cards with crisp `12px` radius, hairline borders, and small top-right icon indicators; a 3-card analytical middle band (vertical bar chart with floating white tooltip, radial compliance gauge, segmented distribution bar with 2x2 legend); and an asymmetric 2-column operational bottom band (~65% structured table / ~35% compact secondary list).

| Principle | What to Adopt / Adapt for MFMS | What to Reject (Avoid Cloning / R-30) |
| --- | --- | --- |
| **Clean Application Shell & Organized Sidebar** | Retain MFMS's signature Deep Botanical Cypress sidebar (`#16261E`) so brand identity stays unmistakable, organize into 3 crisp groups (`Operasional`, `Keuangan`, `Pengaturan`), adopt Syncro's vertical Terracotta accent marker (`3px` bar) on the active pill, remove duplicate `Buat Pesanan` nav row, and tidy the operator footer with clean initials badge (no fake photo avatar, R-23). | Do not copy Syncro's cyan/teal palette, white sidebar background, or decorative notification bell icon with no backend (R-26). |
| **Elevated Compact Topbar** | Elevate the sticky topbar onto clean ivory (`#FFFDF9`) with a crisp `1px` `#E2DBD0` hairline bottom rule above the warm `#F6F3EC` canvas, pairing left contextual breadcrumb/title with right compact search and a single global `+ Pesanan Baru` CTA (hidden on `/ui-orders/create`). | Do not add fake notification bells, non-functional icons, or duplicate H2 headings before H1. |
| **Balanced KPI Cards & Modular Layout** | Upgrade `LedgerSummaryStrip` to crisp `12px`-radius modular ivory cards with subtle elevation, bold `24-26px` tabular Rupiah figures, optional restrained semantic icon badge, and asymmetric operational vs analytical grid composition (`RHYTHM 3`). | Do not ship Syncro's fabricated "+12% / -2.1%" percentage deltas without real comparable period series (R-17, R-38), and do not use rainbow circular KPI icon badges. |

### 3.2 Reference B: Sparkpixel Dashboard (`reference-b-sparkpixel.png`)

**Directly Observed Strengths:**
- **Refined Topbar Breadcrumb & Compact Toolbar Rhythm:** Topbar displays quiet breadcrumb navigation (`Dashboard > Company`) cleanly separated from a compact horizontal toolbar row of subtle bordered controls (`Last 7 days`, `All tags`, `All models`) with `1px` borders and zero chunky boxes.
- **High-Craft Typography & Quiet Borders:** Ultra-clean neutral surfaces, disciplined `13.5-14px` UI typography, generous card whitespace, subtle `1px` hairlines (`#E5E7EB` equivalent -> MFMS `#E2DBD0`), and crisp right-aligned tabular figures everywhere.
- **Premium Chart Card & Anchored Floating Tooltip:** Card header pairs quiet uppercase/icon label (`RECENT SALES`), large primary metric (`$142,500`) + quiet period caption on the left, and a compact segmented mode switch (`Gross | Profit`) + period control on the right. The floating white tooltip card sits directly near the hovered point with a crisp border, soft shadow, date header, color-coded rows with right-aligned values, and hairline divider.
- **Date-Block Schedule Rows (`Schedule`):** Compact left date-square badge (`16 Aug` stacked cleanly inside a quiet sunken tile) paired with event title, actor/details, and right-aligned tabular amount, offering high scan speed with minimal border clutter.

| Principle | What to Adopt / Adapt for MFMS | What to Reject (Avoid Cloning / R-30) |
| --- | --- | --- |
| **Breadcrumb Topbar & Quiet Hairlines** | Add `<nav aria-label="Breadcrumb">` module context in the desktop topbar (`Hari Ini`, `Pesanan > Detail Nota`), replace heavy `1.5px` dark outlines on interior table actions with softer `subtle` button borders (maintaining WCAG 1.4.11 contrast on inputs/focus), and use crisp `1px` `#E2DBD0` hairlines across cards and rows. | Do not introduce Sparkpixel's dual-rail icon+text nested sidebar (overkill for MFMS's 7 routes) or drop body text below `14px` (preserving readability for senior florist operators). |
| **Premium Chart Presentation & Floating Tooltips** | Carry into Phase 13C/13D: rounded bar caps, quiet dashed horizontal gridlines, anchored floating ivory tooltips with crisp hairline borders and tabular rows, compact inline `Masuk vs Keluar | Pesanan vs Masuk` segmented toggle, and clean zero-dependency SVG rendering. | Do not import heavy external chart libraries (Recharts/Chart.js) or use decorative diagonal stripe fills that hurt bar readability. |
| **Compact Segmented Filters & Schedule Cards** | Standardize `<SegmentedTabs>` across all filterable pages (Reports, Orders, Payments, Categories, Dashboard) and tighten list/table row density (`py-3` desktop rows, 2-column tablet cards at `768px`, date-block inspired visual hierarchy in Phase 13C Dashboard queue). | Do not hide active date ranges behind unlabeled icon-only buttons; keep clear Bahasa Indonesia labels everywhere. |

---

## 4. Proposed MFMS Design System (Calm Botanical Workspace v2)

### 4.1 Design Read & Liveliness Dials (Antislop Part 3)

> **Design Read:** Reading this as: Dual-purpose florist operations workspace and financial ledger for Indonesian shop staff and business owners, in a refined Warm Cotton Paper, Deep Botanical Cypress, and Ledger Typographic Hierarchy language combining Syncro's clean modular shell with Sparkpixel's crisp analytical clarity, dial **`ENERGY 2 / RHYTHM 3 / MOTION 1`**.

- **ENERGY 2 (Balanced):** Authoritative, calm, clearly structured; warm paper and crisp ivory sheets anchored by Deep Cypress navigation and restrained Terracotta urgency.
- **RHYTHM 3 (Varied):** Deliberate composition contrast between sections (compact top KPI strip -> asymmetric 2-column operational workspace -> visual analytics card -> structured ledger table), never repeating copy-paste card grids.
- **MOTION 1 (Calm):** Purposeful state transitions (`120-180ms` color/hover/tooltip/toast transitions only), zero decorative entrance animations, zero infinite pulse loops, 100% disabled under `prefers-reduced-motion: reduce`.
- **Identity Motif:** Warm cotton paper canvas (`#F6F3EC`) + Deep Cypress spine (`#16261E`) + Terracotta urgency seal (`#9A3B22`) + rectangular ledger status tags (`rounded-[4px]`, 1px border, no decorative dots) + tabular Rupiah ledger typography.

### 4.2 Semantic Color Tokens (100% Verified via `contrast-check.py`)

All new components must consume semantic CSS variables via Tailwind v4 `@theme` tokens (eliminating hardcoded raw hex strings across TSX files).

| Semantic Token | Hex Value | Verified Contrast (`contrast-check.py`) | Purpose & One-Line Reason (R-31) |
| --- | --- | --- | --- |
| `--bg-canvas` | `#F6F3EC` | Base canvas | Warm cotton paper reduces pure-white eye glare during full-day counter shifts. |
| `--bg-surface` | `#FFFDF9` | Base card surface | Clean ivory sheet lifts primary work cards and charts crisply off the warm canvas. |
| `--bg-sunken` | `#EFEAE0` | Subtle band/table head | Linen tray distinguishes table headers, filter bars, and secondary summaries without heavy borders. |
| `--bg-rail` | `#16261E` | `14.12:1` with `#F5F2EB` | Deep botanical cypress anchors Mutiara Florist identity on desktop without generic dark-mode tech styling. |
| `--bg-rail-active` | `#F4F0E8` | `13.89:1` with `#16261E` | Warm paper active pill creates unmistakable current-page location on the dark rail. |
| `--text-primary` | `#1B211D` | `16.12:1` (`#FFFDF9`) / `14.78:1` (`#F6F3EC`) | Deep botanical charcoal maximizes readability of Rupiah totals and headings for senior operators. |
| `--text-secondary` | `#525750` | `7.28:1` (`#FFFDF9`) / `6.68:1` (`#F6F3EC`) / `6.17:1` (`#EFEAE0`) | Muted sage-slate separates metadata and column labels while staying comfortably above WCAG AA `4.5:1`. |
| `--text-placeholder` | `#5E635C` | `6.05:1` (`#FFFDF9`) | Readable input hints that never fall into low-contrast grey-on-white failure. |
| `--brand-primary` | `#1B3B2B` | `12.11:1` (`#FFFDF9`) | Primary CTA, active segmented controls, `Kas Masuk` series, and 3px keyboard focus ring. |
| `--brand-urgent` | `#9A3B22` | `6.84:1` (`#FFFDF9`) | One deliberate accent reserved strictly for overdue deliveries, unpaid balances, and negative cash flow. |
| `--expense-ink` | `#8F4B1E` | `6.47:1` (`#FFFDF9`) | Text ink for `Kas Keluar` totals and labels, visually distinct from urgent receivables red. |
| `--chart-cash-out-bar` | `#C07624` | `3.53:1` (`#FFFDF9`) & `3.43:1` (`#1B3B2B`) | Warm marigold ochre bar fill passes WCAG 1.4.11 `3.0:1` against BOTH ivory canvas and neighboring cypress bar. |
| `--chart-orders-bar` | `#858980` | `3.51:1` (`#FFFDF9`) & `3.45:1` (`#1B3B2B`) | Warm stone slate bar fill for `Nilai Pesanan` passes `3.0:1` against BOTH ivory canvas and cypress bar. |
| `--status-ready-fg` | `#193F66` | `10.63:1` (`#FFFDF9`) / `9.66:1` (`#EDF3F8`) | Slate blue distinguishes `Siap Kirim` operational handoff from completed green and in-progress amber. |
| `--border-hairline` | `#E2DBD0` | Structural divider | Crisp subtle border inspired by Sparkpixel/Syncro to define cards and rows without harsh visual grid noise. |
| `--border-control` | `#857F74` | `3.91:1` (`#FFFDF9`) | Form input and secondary button edge passes WCAG 1.4.11 (`>= 3.0:1`) while softening table boxiness. |

### 4.3 Typography, Spacing, Radius, and Elevation Rules

- **Typefaces (R-06):** `Plus Jakarta Sans Variable` for all UI/display/numeric text (`tabular-nums` mandatory on all currency, counts, dates, percentages) + `JetBrains Mono Variable` strictly for compact order codes (`MF-261124 · #PHVWE7`) and phone numbers. Locally bundled via Fontsource for offline reliability.
- **Type Scale:**
  - Page `h1`: `clamp(1.5rem, 2vw, 1.75rem)` (`24-28px`), weight `700`, tracking `-0.02em`.
  - Section `h2`: `1.0625rem-1.125rem` (`17-18px`), weight `700`, tracking `-0.01em`.
  - KPI figure: `clamp(1.25rem, 1.9vw, 1.625rem)` (`20-26px`), weight `700`, `tabular-nums`, tight tracking `-0.02em`.
  - Body / Table cell: `14-15px` (`0.875rem-0.9375rem`), line-height `1.5`.
  - Metadata / Column Header / Badge: `12.5-13px` (`0.78125rem-0.8125rem`), sentence case (never wide-tracked ALL CAPS).
- **Radius Hierarchy (R-11):**
  - `4px`: Status badges, chart legend swatches, inline tag chips.
  - `6px`: Inner segmented tab buttons, compact row actions, chart bar top caps (`rx="4"`).
  - `8px`: Buttons, inputs, selects, alert banners.
  - `10px`: Primary cards, KPI strips, chart containers, modals, floating tooltips.
  - Zero page-wide pill spam; full radius only for genuine state dots (e.g., active sidebar indicator or small timeline marker).
- **Elevation (R-12):**
  - Tier 0 (Flat): Canvas `#F6F3EC`, sunken filter trays `#EFEAE0`.
  - Tier 1 (Card): `#FFFDF9` + `1px solid #E2DBD0` + `0 1px 2px rgba(22, 38, 30, 0.04)`.
  - Tier 2 (Floating Popover / Chart Tooltip / Toast): `#FFFDF9` + `1px solid #D5CEC2` + `0 10px 28px rgba(22, 38, 30, 0.12)`.
  - Tier 3 (Modal Dialog): `#FFFDF9` + backdrop `bg-[#16261E]/55` + `0 18px 44px rgba(22, 38, 30, 0.18)`.

### 4.4 Core Component Upgrades

| Component | Current Weakness | Phase 13 Standard |
| --- | --- | --- |
| **Buttons** | Table row buttons use heavy `1.5px` dark borders everywhere (`boxy` tables). | Add `table-action` / `subtle` variant (`border border-[#D5CEC2] bg-[#FFFDF9] hover:bg-[#EFEAE0]`, `min-h-[44px]` touch target preserved, cleaner visual weight inside dense tables). Keep `primary`, `secondary`, `urgent`, `danger`, `ghost`. |
| **Inputs & Selects** | Inline filter inputs/selects vary slightly across pages; no clearable search primitive. | Standardize `<SearchInput>` (with integrated icon + clear `X` button + `Enter` submit) and `<Select>` using semantic CSS tokens. |
| **Dialogs / Modals** | Already top-layer safe (`modal.tsx` Phase 12B); close button shows `X Tutup` occupying wide header space. | Preserve exact Phase 12B focus-trap/inert engine; refine header spacing and optional compact icon+label close control (`>= 44x44px`). |
| **Tables (`ResponsiveDataList`)** | 2-state jump (`<1024px` 1-col stack -> `>=1024px` table) stretches cards at `768px`; cramped tables clip inside 2-col pages (`Customers/Show`). | Upgrade to 3 responsive states: Mobile (`< 640px`) 1-col card, Tablet (`640px-1023px`) optional 2-col grid (`tabletColumns={2}`), Desktop (`>= 1024px`) compact table (`py-3`, `text-[14px]`, sticky/clear horizontal scroll cue if needed). |
| **Status Badges** | Already strong ledger tags (`badge.tsx`). | Keep rectangular `rounded-[4px]`, 1px border, WCAG AA verified tones; ensure zero raw enum strings anywhere in UI. |
| **Toast Notifications** | Inline flash banner causes vertical layout shift on every mutation and never auto-dismisses. | Introduce accessible `<ToastViewport>` (`role="status"` polite for success with 5s auto-dismiss + pause on hover/focus + manual dismiss; persistent `role="alert"` inline banner strictly for errors/validation). |
| **Skeletons, Empty & Error States** | Duplicated empty-state markup in 7 pages; good deferred skeletons in `page-skeleton.tsx`. | Extract `<EmptyState>` (cause + single primary CTA, per R-27) and `<AlertBanner>` (unified tone/border tokens); keep Instant Navigation V2 skeletons aligned with updated Dashboard/Reports geometry to prevent CLS. |
| **Accessibility & Keyboard** | Strong baseline (`0` small targets, `h1Count=1`). Chart bars support arrow keys. | Preserve all keyboard traps, `cursor: pointer`, `3px` `:focus-visible`, `44px` tap targets, and ensure floating chart tooltips trigger identically on keyboard focus (`Tab`/Arrows), mouse hover, and mobile tap. |

---

## 5. Proposed Application Shell Redesign

Combining Syncro's clean shell with MFMS's Calm Botanical identity:

1. **Desktop Sidebar (`>= 1024px`, `248px` fixed rail on `#16261E`):**
   - **Brand Header:** Clean typographic wordmark `Mutiara Florist` + subtle subtitle `Manajemen Toko & Kas` (no artificial monogram box per R-23).
   - **Logical Navigation Groups (3 focused groups, removing duplicate `Buat Pesanan` link from nav list because `+ Pesanan Baru` is the single shell CTA):**
     - `Ringkasan & Operasi`: `Hari Ini` (`/dashboard`), `Pesanan` (`/ui-orders`), `Pelanggan` (`/ui-customers`)
     - `Keuangan & Kas`: `Piutang & Bayar` (`/ui-payments`), `Pengeluaran` (`/ui-expenses`), `Laporan` (`/ui-reports`)
     - `Pengaturan Data`: `Kategori Biaya` (`/ui-expense-categories`)
   - **Active State:** Warm paper pill (`#F4F0E8`) with Deep Cypress bold ink (`#16261E`) + 6px Terracotta indicator (`#9A3B22`) marking active route; crisp `Memuat...` inline state during foreground visits.
   - **Account Footer:** Compact operator card showing `auth.user.name`, role context `Operator Toko`, and clean `Keluar Akun` button opening the confirmation modal.
2. **Compact Topbar (`h-[60px]`, sticky, matte `#F6F3EC` with crisp `1px` `#E2DBD0` bottom rule):**
   - **Left:**
     - On `< 1024px`: Brand mark `Mutiara Florist` (`whitespace-nowrap`, never wraps onto 2 lines!) + Tablet `Menu` button (`md:inline-flex lg:hidden`).
     - On `>= 1024px`: Compact global order/customer search (`max-w-[340px]`, submits on `Enter` with clear button, removing the bulky standalone `Cari Nota` button).
   - **Right:**
     - Single global primary action `+ Pesanan Baru` on `>= 768px`, **automatically hidden on `/ui-orders/create`** so there is never a redundant CTA.
     - Correspondingly, **remove duplicate `+ Buat Pesanan` from Dashboard and Orders Index page headers on Desktop/Tablet** (or demote page-level quick action to secondary tasks like `Catat Pembayaran` / `Catat Pengeluaran`), eliminating triple-CTA clutter!
     - On `< 768px`: Compact `Cari Nota` toggle button (`44px`), keeping topbar uncluttered.
3. **Mobile Navigation (`< 768px`):**
   - Keep the verified 4-destination bottom bar (`Hari Ini`, `Pesanan`, `Buat`, `Menu`) with `env(safe-area-inset-bottom)` padding and active top accent bar.
   - Enhance the `Menu` sheet modal to group secondary destinations cleanly (`Piutang & Pembayaran`, `Pelanggan`, `Pengeluaran`, `Kategori Biaya`, `Laporan`) with active-route highlighting (`aria-current="page"`) so mobile users know which secondary page they are currently on.

---

## 6. Proposed Dashboard Information Architecture (Dual Audience: Owner + Operator)

Every metric strictly follows `docs/BUSINESS_RULES.md` Section F. Sales/billed value is never labeled as revenue or cash received; simple cash difference is never labeled as net profit.

### 6.1 Layout Blueprint (`1440px` / `1366px` Desktop -> `768px` Tablet -> `390px` Mobile)

```text
+---------------------------------------------------------------------------------+
| Header: "Hari Ini" · Selasa, 24 November 2026                                   |
| Quick Actions: [ Catat Pengeluaran ]  [ Catat Pembayaran ]                      |
| (Note: "+ Pesanan Baru" lives once in Topbar on >=768px, Bottom Nav on mobile)  |
+---------------------------------------------------------------------------------+
| Row 1: 4 Balanced KPI Cards (1x4 desktop, 2x2 tablet & mobile)                  |
| [1. Kas Masuk Hari Ini] [2. Pengeluaran & Selisih] [3. Piutang Berjalan] [4. Kiriman & Pesanan] |
|  Rp2.060.000             Keluar Rp775.000           Rp4.585.000           4 rangkaian (3 nota)  |
|  3 pembayaran sah        Selisih +Rp1.285.000       6 nota belum lunas    2 terlambat · 2 siap  |
+---------------------------------------------------------------------------------+
| Row 2 (Desktop 12-col Asymmetric: 7 cols Left / 5 cols Right)                   |
| +---------------------------------------+ +-----------------------------------+ |
| | A. Pekerjaan & Pengiriman (Primary)   | | B. Piutang Terbuka (Deferred)     | |
| |  Tabs: Semua | Terlambat | Hari Ini   | |  Compact rows with:               | |
| |        | Siap Kirim (wrap-safe)       | |  Customer + Compact Code + Date   | |
| |  Grouped by Urgency -> Order:         | |  Sisa Rp... + [Catat Bayar]       | |
| |  - Customer + Compact OrderCodeBadge  | +-----------------------------------+ |
| |  - Item + Badge + Recipient/Address   | | C. Progres Pengerjaan Aktif       | |
| |  - One-click linear step button       | |  Compact segmented pipeline bar:  | |
| |    (with Deliver confirmation modal)  | |  Baru · Diproses · Siap Kirim     | |
| +---------------------------------------+ +-----------------------------------+ |
+---------------------------------------------------------------------------------+
| Row 3 (Owner Business Intelligence Band — Deferred Group 'insights')            |
| +---------------------------------------+ +-----------------------------------+ |
| | D. Tren Arus Kas Singkat (7h / 30h)   | | E. Aktivitas Transaksi Terbaru    | |
| |  Inline toggle: [7 Hari] [30 Hari]    | |  Last 6 real events (Order /      | |
| |  Zero-dep SVG mini bar+net line chart | |  Payment POSTED / Expense POSTED) | |
| |  Kas Masuk vs Kas Keluar + Tooltip    | |  with WIB date, actor, & amount   | |
| |  Link: "Buka Laporan Lengkap ->"      | |  (zero fabricated entries, R-38)  | |
| +---------------------------------------+ +-----------------------------------+ |
+---------------------------------------------------------------------------------+
| Row 4: Quiet Cumulative Ledger Strip (All-Time Context)                         |
| Total Nota (13) Rp15.465.000 | Kas Masuk Rp10.880.000 | Keluar Rp4.840.000 | Selisih Rp6.040.000 |
+---------------------------------------------------------------------------------+
```

### 6.2 Metric Accuracy & Backend Strategy

| Dashboard Metric | Exact Backend Formula (`docs/BUSINESS_RULES.md`) | Query Strategy (Preserving Latency) |
| --- | --- | --- |
| **Kas Masuk Hari Ini** | `SUM(payments.amount) WHERE status='POSTED' AND payment_date = today WIB` | Already in `DashboardService::todayStats()` (1 SQL round-trip) |
| **Kas Keluar & Selisih Hari Ini** | `SUM(expenses.amount) WHERE status='POSTED' AND expense_date = today WIB`; `Selisih = cash_in - cash_out` (labeled `Selisih kas hari ini`, NOT profit) | Already in `DashboardService::todayStats()` (derived client/server with zero extra query) |
| **Piutang Berjalan** | `SUM(MAX(orders.total_amount - paid_posted, 0))` snapshot saat ini | Already in `DashboardService::stats()` + `todayStats()` |
| **Kiriman & Pesanan Hari Ini** | `order_items` count due today (`NEW/PROCESSING/READY/DELIVERED`), overdue count (`delivery_date < today` unfinished), ready count, today's new orders count & billed value | Already in `DashboardService::todayStats()` |
| **Progres Pengerjaan Aktif** | Active `order_items` count grouped by `NEW`, `PROCESSING`, `READY` | Add 2 `SUM(CASE ...)` window columns to existing `activeDeliveryQueue()` query (**0 extra DB round-trips**) |
| **Tren Arus Kas Singkat (7 Hari / 30 Hari)** | Daily `cash_in` (POSTED payments by `payment_date`) vs `cash_out` (POSTED expenses by `expense_date`) for last 7 or 30 days | New read-only method `DashboardService::cashflowPulse(int $days = 7)` loaded via **`Inertia::defer(..., 'insights')`** so initial `/dashboard` TTFB stays identical (`~790-860ms`) |
| **Aktivitas Transaksi Terbaru** | `UNION ALL` of last 6 real records across `orders`, `payments (POSTED)`, and `expenses (POSTED)` ordered by `created_at DESC` | Loaded in the same `'insights'` deferred group (1 lightweight `UNION ALL ... LIMIT 6` query) |

---

## 7. Proposed Financial Reports Information Architecture

### 7.1 Layout & Visual Upgrades (Sparkpixel-Inspired Analytical Clarity)

1. **Unified Header & Compact Control Bar:**
   - Top row: `Laporan Usaha` + resolved WIB period subtitle (`30 Hari Terakhir · 26/10/2026 - 24/11/2026`) on left; `Unduh Excel (.xlsx)` button on right.
   - Compact inline period bar directly underneath (no bloated full-width empty card): segmented preset buttons `Hari Ini | 7 Hari | 30 Hari | Bulan Ini | Bulan Lalu | Tahun Ini | Semua Waktu | Kustom`.
   - On Mobile (`< 640px`): Single clean horizontally scrollable preset pill strip with subtle edge fade + `Kustom` expands inline date inputs (removing the redundant duplicate dropdown).
2. **4-Column Financial Summary Strip with Semantic Clarity:**
   - **Nilai Pesanan** (`#1B211D` ink, subtitle: `Bunga Rp... · Ongkir Rp...`, count: `13 pesanan · rata-rata Rp...`)
   - **Kas Masuk (Sah)** (`#164B2A` cypress green, subtitle: `Pembayaran tercatat sah · Rasio kas masuk terhadap nilai nota X%` when `total_billed > 0`, clearly noted as cash-date vs order-date)
   - **Kas Keluar (Sah)** (`#8F4B1E` warm ochre, subtitle: `Pengeluaran tercatat sah`)
   - **Selisih Kas** (`#164B2A` if `>= 0`, `#9A3B22` terracotta if `< 0`, subtitle: `Masuk dikurangi keluar, bukan laba bersih`)
   - Paired slim context strip below: `Piutang berjalan saat ini: Rp4.585.000 (6 nota terbuka, snapshot saat ini)` with direct link `Buka Piutang ->` (`/ui-payments`).
3. **Upgraded Primary Chart (`FinancialTrendChart` v2, Zero External Dependencies):**
   - **Question-Driven Title (Antislop `Charts Without a Question`):** Dynamic title matching mode: *"Perbandingan Kas Masuk dan Kas Keluar"* or *"Nilai Pesanan Dibanding Kas Masuk"*.
   - **Visual Polish:**
     - Rounded bar tops (`rx="4"`), refined bar proportions, WCAG-verified neighboring fills (`#1B3B2B` cypress vs `#C07624` marigold ochre for cash out, `#858980` stone slate for billed orders).
     - Subtle dashed horizontal gridlines (`#E8E2D7`) and crisp zero baseline.
     - **Optional Net Cash-Flow Overlay (`Garis Selisih Kas`):** Smooth polyline + markers plotting `cash_in - cash_out` across buckets in `Masuk vs Keluar` mode (toggleable cleanly in chart header).
     - **Floating Anchored Interactive Tooltip:** Appears smoothly near the hovered/focused bar (clamped inside SVG/container bounds so it never clips), displaying period label, order count, exact formatted Rupiah values, and net cash difference. On mobile (`< 640px`), tapping a bar highlights the slot and updates the pinned readout strip cleanly.
     - Full keyboard navigation (`Tab`, `ArrowLeft`, `ArrowRight`, `Home`, `End`) preserved.
4. **3-Card Business Intelligence Breakdown Grid (Deferred `'details'`):**
   - **Status Pengerjaan & Status Pembayaran** (side-by-side 2-col card): Retain compact stacked distribution bars + counts/percentages, with WCAG-verified colors and direct drill-down links to `/ui-orders?status=...` or `/ui-orders?payment=UNPAID`.
   - **Kas Masuk per Metode Pembayaran (NEW High-Value BI Card):** Breaks down `POSTED` payments in the selected period by `Transfer bank`, `Tunai`, `QRIS`, `Lainnya` (count, Rupiah total, percentage share, true-proportion horizontal bar). Derived in 1 lightweight `GROUP BY method` query inside existing `ReportService::getBreakdowns()`.
   - **Pengeluaran per Kategori (FIXED Proportion Math):** Fix bar width from `amount / maxAmount` to true `amount / totalCashOut` (with `min-w-[4px]` floor for tiny non-zero categories) so `64%` visually fills `64%` of the track, matching its numeric percentage.
5. **Readable Period Breakdown Table (Progressive Disclosure):**
   - Fix raw enum leak (`(VOIDED)` -> `"Catatan yang dibatalkan otomatis dikecualikan dari seluruh perhitungan kas."`).
   - Add summary footer row (`Total Periode`) inside the expanded table so totals visually reconcile with the top KPI cards.
   - Preserve exact Excel `.xlsx` export (`SimpleXlsxExporter`) with zero breaking changes.

---

## 8. Page-by-Page Improvement Recommendations

| Page / Route | Current State | Specific Phase 13 Improvements |
| --- | --- | --- |
| **Login** (`/login`) | Clean split layout, accessible password toggle (`01-login-desktop-1440.png`). | Align colors to v2 CSS variables (`#16261E`, `#F6F3EC`), polish subtle focus/card refinement. Low priority (already solid). |
| **App Shell** (`AppLayout`, `AppSidebar`) | Triple `+ Buat Pesanan` CTA on desktop; tablet `768px` topbar wraps brand & crowds buttons; inline flash pushes content. | Consolidate to single `+ Pesanan Baru` CTA in topbar (hidden on `/ui-orders/create`), remove `Buat Pesanan` from sidebar nav items, fix tablet `768px` topbar (`whitespace-nowrap` brand + compact search), add non-blocking `<ToastViewport>` for success flash, highlight active secondary route inside mobile `Menu` modal. |
| **Dashboard** (`/dashboard`) | Strong daily queue, but raw 36-char ULIDs, ambiguous duplicate receivables, no owner BI trend chart or recent activity. | Implement Section 6 dual-audience IA: use `<OrderCodeBadge compact />`, show order code & date on `Piutang Terbuka` rows, add active pipeline progress bar, add deferred 7d/30d Cash Flow Pulse mini-chart + Recent Business Activity feed, add `Catat Pengeluaran` quick action, fix mobile filter tab scroll cue. |
| **Reports** (`/ui-reports`) | Accurate math & deferred loading, but flat chart without floating tooltip, wrong expense bar proportion (`64%` = 100% bar), raw `(VOIDED)` leak, missing `Semua Waktu` & payment method breakdown. | Implement Section 7 BI upgrade: compact period bar + `Semua Waktu`, semantic KPI tones, floating tooltip + net cash-flow line + WCAG 3:1 chart fills (`#C07624` / `#858980`), payment method breakdown card, true-proportion expense bars, remove `(VOIDED)` string, add table total footer row. |
| **Orders Index** (`/ui-orders`) | Clean desktop table; stretched 1-col cards on `768px` tablet; duplicate topbar+header Create button; heavy outlined row buttons. | Remove duplicate header Create button on desktop/tablet (keep on mobile if helpful or rely on bottom nav `+ Buat`), add 2-col card grid on `768px` tablet, soften row `Detail` button to `subtle` variant, add subtle overdue indicator on `Tanggal Kirim` when past due and not `COMPLETED`. |
| **Create / Edit Order** (`/ui-orders/create`, `/edit`) | Excellent 1:1 `OrderRequest` fields, searchable customer select + quick-create modal, sticky summary (`05-orders-create-desktop-1440.png`). | Hide redundant `+ Pesanan Baru` topbar button when already on `/ui-orders/create`; add subtle item count badge in sticky summary (`1 rangkaian · 1 buah`); keep all form logic and dirty guard untouched. |
| **Order Detail** (`/ui-orders/{id}`) | Clear layout, WA copy works, safe delivery & void modals. Raw 36-char ULID in H1; triple `Catat Pembayaran` button when unpaid with 0 payments. | Display compact order code in H1 with copyable full code pill in metadata row; consolidate to max 1 primary `Catat Pembayaran` button in header + 1 empty-state CTA (remove duplicate 3rd button in payment card header when empty). |
| **Payments & Receivables** (`/ui-payments`) | Good split between Receivables & deferred History. Mobile receivable cards show raw 36-char ULID; history badge wraps onto 2 lines at `1440px`; 5,524px tall mobile scroll; header KPI box inconsistent. | Use `<OrderCodeBadge compact />` on mobile receivable cards, add `whitespace-nowrap` on history badge, standardize summary strip with `LedgerSummaryStrip` (Total Piutang Aktif + Jumlah Nota Belum Lunas + Kas Masuk Hari Ini), apply 2-col tablet grid (`768px`), and fix mobile pagination button width (`min-w-[104px]`) so pagination stays on 1 clean row at `390px`. |
| **Customers Index & Detail** (`/ui-customers`, `/ui-customers/{id}`) | Clean list. **P0 bug:** `Customers/Show` clips the `Aksi` (`Detail`) column off the right edge at `1440px` (`09-customers-show-desktop-1440.png`). | Fix `Customers/Show` layout: move `Riwayat Pesanan Pelanggan` to full width below the 2-col Customer Info + Archive aside (or streamline to 4 crisp columns: `No. Nota & Tanggal`, `Rangkaian`, `Status`, `Total & Aksi`) so `Detail` never clips at `1366px` or `1440px`. Add customer lifetime billed/outstanding summary metric in right aside. |
| **Expenses Index & Create** (`/ui-expenses`, `/ui-expenses/create`) | **P0 bug:** `recorded_by_user` always falls back to `"Operator"`. Summary banner uses green `#1D3B2A` instead of ochre `#8F4B1E`. Filter bar orphans `Terapkan Filter` on row 2. | Fix `UiExpenseController::index()` to serialize `'recorded_by_user' => ['id' => ..., 'name' => ...]` explicitly so real staff names display; recolor summary strip to warm ochre `#8F4B1E`; auto-apply Kategori/Status filters or align filter bar cleanly on desktop; apply 2-col tablet card grid. |
| **Expense Categories** (`/ui-expense-categories`) | Clean 2-col layout with safe modals (`11-categories-index-desktop-1440.png`). | Soften row action buttons (`Ubah Nama`, `Nonaktifkan`) with `subtle` table-action styling and align surface tokens to v2 CSS variables. |

---

## 9. Component Reuse Strategy

### 9.1 Retire Dead Code (Zero Risk)
- Delete unused `resources/js/components/stat-card.tsx` (replaced by `LedgerSummaryStrip` / `KpiCard`).
- Remove unused `AppSidebar` export in `resources/js/components/app-sidebar.tsx` (keep `SidebarContent`).
- Evaluate removing `/ui-preview` route and `resources/js/pages/Preview.tsx` (after checking whether any PHPUnit test references `ui-preview`).

### 9.2 Shared Primitives to Extract / Upgrade

| Component | Target Path | Replaces Duplication Across |
| --- | --- | --- |
| **`PageHeader`** | `resources/js/components/ui/page-header.tsx` | 11 pages duplicating `border-b pb-5` header, back link, `h1`, subtitle, and action slot |
| **`SegmentedTabs`** | `resources/js/components/ui/segmented-tabs.tsx` | 5 pages duplicating filter chips/tabs (`Dashboard`, `Orders`, `Payments`, `ExpenseCategories`, `Reports`) with consistent `44px` height, `aria-pressed`/`role="tab"`, and horizontal mobile scroll cue |
| **`AlertBanner`** | `resources/js/components/ui/alert-banner.tsx` | 9 pages duplicating success/error/warning/info banner markup with drifted hex borders |
| **`ToastViewport`** | `resources/js/components/ui/toast-viewport.tsx` | `AppLayout` inline success flash (eliminates mutation CLS while keeping accessible `role="status"` + manual dismiss) |
| **`EmptyState`** | `resources/js/components/ui/empty-state.tsx` | 7 pages duplicating centered icon + heading + cause copy + single action CTA |
| **`LedgerSummaryStrip` v2** | `resources/js/components/ledger-summary-strip.tsx` | Unified KPI strip across `Dashboard`, `Reports`, `Payments`, `Expenses`, `Orders/Show` with semantic tone (`default`, `paid`, `expense`, `urgent`), optional compact icon/meta, and consistent `2x2` mobile / `1x4` desktop grid |
| **`ResponsiveDataList` v2** | `resources/js/components/ui/responsive-data-list.tsx` | All 6 tabular views; adds `tabletColumns?: 1 | 2` to eliminate `768px` stretched card stacks and tightens desktop row padding (`py-3`) |
| **Modular SVG Charts** | `resources/js/components/charts/` (`trend-chart.tsx`, `proportion-bars.tsx`, `chart-tooltip.tsx`) | Shared between **Reports** (full interactive chart + payment method & expense breakdowns) and **Dashboard** (compact 7d/30d Cash Flow Pulse mini-chart + active fulfillment pipeline bar), keeping **0 kB** external chart dependencies |

---

## 10. Prioritized Implementation Roadmap

| Phase | Priority & Goal | Key Scope & Files | Dependencies |
| --- | --- | --- | --- |
| **Phase 13B: Design System, Shell & P0 Bug Fixes** | **P0 / Foundation** | 1. Migrate `app.css` tokens to `@theme` semantic variables (v2 palette + WCAG 3:1 chart fills).<br>2. Extract `PageHeader`, `SegmentedTabs`, `AlertBanner`, `EmptyState`, `ToastViewport`; add `subtle` table-action button variant; fix `Pagination` mobile width (`390px`); upgrade `ResponsiveDataList` with `tabletColumns={2}`.<br>3. Refine `AppLayout` & `AppSidebar` (fix `768px` tablet topbar, eliminate triple `+ Buat Pesanan` CTA, mobile active secondary indicator).<br>4. Fix P0 bugs: `UiExpenseController` `recorded_by_user` serialization (**AUD-01**), `Customers/Show` desktop action clipping (**AUD-02**), `Expenses/Index` ochre color (**AUD-10**), `Reports/Index` raw `(VOIDED)` (**AUD-09**), `Payments` mobile ULID & history wrapping (**AUD-05**). | Approved Phase 13A plan |
| **Phase 13C: Dashboard Redesign (Owner + Operator)** | **P1 / Core BI** | 1. Add read-only `DashboardService::cashflowPulse(int $days)` & `recentActivity(int $limit = 6)` + active pipeline counts in `activeDeliveryQueue()` (deferred in `'insights'` group).<br>2. Rebuild `Dashboard.tsx` per Section 6: 4 balanced KPI cards (incl. Today's Cash In/Out/Net Diff), compact `<OrderCodeBadge>` in queue, unambiguous `Piutang Terbuka` rows (customer + order code + date), active pipeline bar, deferred 7d/30d Cash Flow Pulse mini-chart, Recent Business Activity feed, quick `Catat Pengeluaran` action. | Phase 13B |
| **Phase 13D: Financial Reports & Charts Enhancement** | **P1 / Core BI** | 1. Add payment method breakdown (`TRANSFER`, `CASH`, `QRIS`, `OTHER`) to `ReportService::getBreakdowns()` (1 lightweight `GROUP BY` query).<br>2. Upgrade `components/charts/` zero-dep SVG engine: floating anchored tooltip, optional Net Cash-Flow line overlay, WCAG 3:1 neighboring bars (`#1B3B2B` vs `#C07624` / `#858980`), fixed true-proportion `ExpenseCategoryCard` (`amount / totalCashOut`).<br>3. Upgrade `Reports/Index.tsx`: compact Sparkpixel-style period filter bar (adding `Semua Waktu`), semantic KPI tones, payment-method BI card, expanded table total footer row, preserve Excel export 100%. | Phase 13B |
| **Phase 13E: Operational Polish & Full Regression QA** | **P2 / Polish & Gate** | 1. Polish `Orders/Index` (overdue delivery cue, 2-col tablet cards), `Orders/Show` (compact H1 code + remove 3rd payment button duplicate), `Payments/Index` (unified KPI strip), `Expenses/Index` (auto-filter dropdowns), `Customers/Show` (lifetime total/outstanding aside).<br>2. Retire unused `stat-card.tsx` and unused exports.<br>3. Run full QA gate: `npm run typecheck`, `npm run build`, PHPUnit reconciliation suite, `contrast-check.py`, 4-viewport `agent-browser` click-through + After screenshots, Instant Navigation V2 verification. | Phases 13B, 13C, 13D |

---

## 11. Performance and Regression Risks

| Risk Area | Specific Threat | Mandatory Safeguard |
| --- | --- | --- |
| **Instant Navigation V2 Stuck Pending State** | Refactoring `AppLayout` or adding new deferred keys (`insights`) without registering them in `DEFERRED_PROP_KEYS` inside `resources/js/lib/navigation-state.ts` could trigger foreground loading bars during background deferred fetches. | Explicitly add any new deferred prop keys (e.g. `'dashboardInsights'`) to `DEFERRED_PROP_KEYS` in `navigation-state.ts` and preserve `UiNavigationPerformanceTest` assertions. |
| **Supabase / PostgreSQL Latency Regression** | Adding Dashboard mini-charts or recent activity synchronously in `UiDashboardController::__invoke()` would add round-trip latency on top of the current `792-863 ms` baseline. | Load Dashboard Cash Flow Pulse & Recent Activity exclusively inside `Inertia::defer(..., 'insights', true)` using consolidated queries (`UNION ALL` / single grouped query), keeping initial Dashboard SQL round-trips unchanged. |
| **JavaScript Bundle Bloat** | Adding a third-party chart library (Recharts ~240kB, Chart.js ~160kB) would inflate `inertia.js` (currently `641.7 kB` raw eager bundle) and slow mobile hydration. | Maintain **zero new JS dependencies**: build tooltips, sparklines, net-flow lines, and proportion charts in lightweight modular React SVG (`< 15 kB` delta). |
| **Financial & Accounting Integrity Drift** | Introducing misleading BI labels ("Laba Bersih", "Omzet Kas") or accidentally including `VOIDED` records in new Dashboard pulse/payment method queries. | Every new query filters `status = 'POSTED'` explicitly; every UI label mirrors `docs/BUSINESS_RULES.md` Section F; add PHPUnit reconciliation assertions matching SQL totals against Dashboard & Reports props before and after `VOIDED` mutations. |
| **Inappropriate Caching of Financial Data** | Increasing Inertia prefetch `cacheFor` beyond `10s` or adding server response caching on financial endpoints risks showing stale balances after payment/void actions. | Keep `cacheFor="10s"` with existing `cacheTags` and `router.flushAll()` on mutations (already enforced in `navigation-state.ts:508`); zero HTTP caching on financial routes. |
| **PostgreSQL vs SQLite Query Compatibility** | New `DashboardService` or `ReportService` queries using MySQL-only functions (`DATE_FORMAT`, `IFNULL`) would break Supabase PostgreSQL production. | Use ANSI SQL (`COALESCE`, `CASE WHEN`, `>=` / `<=` date bounds) tested against PHPUnit and verified against Phase 15A Postgres compatibility rules. |

---

## 12. Testing and Acceptance Criteria

Phase 13 implementation will not be declared complete until ALL measurable gates pass:

1. **Financial Integrity & Reconciliation (PHPUnit):**
   - `php artisan test` passes 100% of core, Phase 9, UI Report, UI Dashboard, and Instant Navigation V2 tests (excluding only skipped/unconfigured external `pgsql_testing` tests when local Postgres is offline, or 100% pass when Postgres is running).
   - New feature tests verify `UiExpenseController` exposes real `recorded_by_user.name`, `ReportService::getBreakdowns()` payment-method totals sum exactly to `summary.cash_in` (excluding `VOIDED`), and `DashboardService::cashflowPulse()` matches `ReportService` daily cash totals to the exact Rupiah.
   - Excel `.xlsx` export structure and reconciled cell values remain 100% unchanged and valid.
2. **TypeScript & Bundle Budget:**
   - `npm run typecheck` (`tsc --noEmit`): `0` errors.
   - `npm run build` (`vite build`): `0` warnings/errors; `inertia-*.js` raw size stays `<= 670 kB` (within `+5%` of `641.7 kB` baseline; zero external chart library added).
3. **WCAG AA Accessibility & Contrast (`contrast-check.py`):**
   - Every text/surface pair `>= 4.5:1` (normal text) and `>= 3.0:1` (large text); every interactive control border and adjacent chart series `>= 3.0:1` (WCAG 1.4.11).
   - Keyboard-only walkthrough (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`, chart `ArrowLeft`/`ArrowRight`) verified with visible `3px` focus outline on all controls and zero focus traps outside modals.
4. **4-Viewport Responsive & DOM Telemetry (`agent-browser` on isolated synthetic SQLite):**
   - Verified on `1440x900`, `1366x768`, `768x1024`, and `390x844` across Login, Dashboard, Reports, Orders Index/Create/Show, Payments, Customers Index/Show, Expenses Index/Create, Expense Categories:
     - Horizontal overflow (`scrollWidth > innerWidth`): **0** across all route x viewport pairs.
     - Interactive touch targets `< 44x44px`: **0**.
     - Clipped table action columns (including `Customers/Show` at `1440px` and `1366px`): **0**.
     - Console / JS runtime errors: **0**.
     - Em dashes (`U+2014`) and raw enum leaks (`POSTED`, `VOIDED`, `UNPAID`, `PARTIAL`, `PAID`, `order_date`) in rendered DOM: **0**.
5. **Instant Navigation V2 Non-Regression:**
   - Navigating across all sidebar/bottom-nav tabs completes cleanly with zero stuck `Memuat...` pending indicators, scoped filter loading works without cross-page leakage, and deferred sections render matching skeletons with graceful retry on failure.
6. **Before vs After Visual Evidence:**
   - Matching "After" screenshots captured across all 4 viewports on isolated synthetic data and compared directly against Phase 13A baseline screenshots.

---

## 13. Before Screenshots Inventory (Baseline Commit `9e601d6`)

All 30 baseline screenshots were captured from the isolated synthetic SQLite environment (`127.0.0.1:8193`, zero real customer/financial data) and stored under `docs/phase13/screenshots/`:

| Module | Desktop (`1440x900`) | Laptop (`1366x768`) | Tablet (`768x1024`) | Mobile (`390x844`) |
| --- | --- | --- | --- | --- |
| **Login** | [01-login-desktop-1440.png](screenshots/01-login-desktop-1440.png) | - | - | [01-login-mobile-390.png](screenshots/01-login-mobile-390.png) |
| **Dashboard** | [02-dashboard-desktop-1440.png](screenshots/02-dashboard-desktop-1440.png) | [02-dashboard-laptop-1366.png](screenshots/02-dashboard-laptop-1366.png) | [02-dashboard-tablet-768.png](screenshots/02-dashboard-tablet-768.png) | [02-dashboard-mobile-390.png](screenshots/02-dashboard-mobile-390.png) |
| **Reports** | [03-reports-desktop-1440.png](screenshots/03-reports-desktop-1440.png) | [03-reports-laptop-1366.png](screenshots/03-reports-laptop-1366.png) | [03-reports-tablet-768.png](screenshots/03-reports-tablet-768.png) | [03-reports-mobile-390.png](screenshots/03-reports-mobile-390.png) |
| **Orders Index** | [04-orders-index-desktop-1440.png](screenshots/04-orders-index-desktop-1440.png) | [04-orders-index-laptop-1366.png](screenshots/04-orders-index-laptop-1366.png) | [04-orders-index-tablet-768.png](screenshots/04-orders-index-tablet-768.png) | [04-orders-index-mobile-390.png](screenshots/04-orders-index-mobile-390.png) |
| **Create Order** | [05-orders-create-desktop-1440.png](screenshots/05-orders-create-desktop-1440.png) | - | - | [05-orders-create-mobile-390.png](screenshots/05-orders-create-mobile-390.png) |
| **Order Detail** | [06-orders-show-desktop-1440.png](screenshots/06-orders-show-desktop-1440.png) | - | [06-orders-show-tablet-768.png](screenshots/06-orders-show-tablet-768.png) | [06-orders-show-mobile-390.png](screenshots/06-orders-show-mobile-390.png) |
| **Payments** | [07-payments-index-desktop-1440.png](screenshots/07-payments-index-desktop-1440.png) | - | [07-payments-index-tablet-768.png](screenshots/07-payments-index-tablet-768.png) | [07-payments-index-mobile-390.png](screenshots/07-payments-index-mobile-390.png) |
| **Customers** | [08-customers-index-desktop-1440.png](screenshots/08-customers-index-desktop-1440.png) | - | - | [08-customers-index-mobile-390.png](screenshots/08-customers-index-mobile-390.png) |
| **Customer Detail** | [09-customers-show-desktop-1440.png](screenshots/09-customers-show-desktop-1440.png) | - | - | - |
| **Expenses** | [10-expenses-index-desktop-1440.png](screenshots/10-expenses-index-desktop-1440.png) | - | [10-expenses-index-tablet-768.png](screenshots/10-expenses-index-tablet-768.png) | [10-expenses-index-mobile-390.png](screenshots/10-expenses-index-mobile-390.png) |
| **Categories** | [11-categories-index-desktop-1440.png](screenshots/11-categories-index-desktop-1440.png) | - | - | [11-categories-index-mobile-390.png](screenshots/11-categories-index-mobile-390.png) |

---

## 14. Recommended Scope Achievable Before Progress 3 Deadline

With the Progress 3 Implementasi deadline on **26 November 2026, 23:59 WIB** (approximately **56 hours** from this audit), trying to rewrite every form and minor screen risks destabilizing a live production system. The highest-impact, lowest-risk achievable scope prioritizes **visible business intelligence, shell elegance, and P0 defect fixes**:

### Must-Ship Before 26 Nov 2026 (High Impact, Safe Execution)
1. **Phase 13B (Foundation, Shell & P0 Fixes):**
   - Semantic CSS v2 tokens (`app.css`), subtle table-action button styling, `<PageHeader>`, `<SegmentedTabs>`, `<ToastViewport>`, and 2-col `768px` tablet grid in `ResponsiveDataList` + mobile `Pagination` fix.
   - Clean `AppLayout` & `AppSidebar`: fix `768px` tablet topbar cramming and eliminate triple `+ Buat Pesanan` CTA clutter.
   - Fix all concrete P0/P1 defects found in screenshots: `Expenses` `recorded_by_user` attribution bug (`AUD-01`), `Customers/Show` clipped `Detail` column (`AUD-02`), `Expenses` ochre summary color (`AUD-10`), raw ULIDs in `Dashboard` & `Payments` mobile (`AUD-05`), `Reports` `(VOIDED)` leak (`AUD-09`).
2. **Phase 13C (Dashboard Dual-Audience Upgrade):**
   - Balanced 4-KPI strip (including Today's Cash In, Cash Out + Net Cash Diff, Receivables, Deliveries).
   - Unambiguous `Piutang Terbuka` rows (compact code + date), active fulfillment pipeline bar, and deferred (`'insights'`) 7d/30d **Cash Flow Pulse mini-chart** + **Recent Business Activity** feed.
3. **Phase 13D (Financial Reports & Analytics Upgrade):**
   - Compact Sparkpixel-style period filter bar (with `Semua Waktu`), semantic KPI tones.
   - Upgraded zero-dep SVG chart with **floating anchored tooltip**, **Net Cash-Flow line overlay**, and WCAG 3:1 bar contrast (`#1B3B2B` vs `#C07624` / `#858980`).
   - New **Payment Method Breakdown** card (`Transfer`, `Tunai`, `QRIS`, `Lainnya`), fixed true-proportion **Expense Category** bars, and expanded table total footer row.
4. **Full Verification Gate:** PHPUnit reconciliation + TypeScript + Vite build + `contrast-check.py` + 4-viewport `agent-browser` QA + Before/After screenshots.

### Defer Post-Deadline (Phase 13E Nice-to-Have)
- Deep visual polish of `Customers/Create`, `Customers/Edit`, `Expenses/Create`, and `Login` (already clean and functional).
- Optional keyboard command palette (`Cmd/Ctrl+K`) for power users.
- Cleanup of legacy Blade fallback routes (keep untouched for emergency rollback safety).

---

## 15. Anti-Slop Delivery Gate (Phase 13A Audit & Plan Verification)

- **R-02 PASS:** Zero em dash (`U+2014`) characters in this audit document and planned UI copy (verified via regex scan).
- **R-03 PASS:** All 4 target viewports (`1440x900`, `1366x768`, `768x1024`, `390x844`) audited live; `768px` tablet topbar and Two-State card stretch explicitly targeted in Phase 13B.
- **R-17 / R-36 / R-38 / C-5 PASS:** Zero fabricated metrics or unverified claims; production latency figures sourced from prompt, DOM telemetry & bundle sizes measured directly, and missing reference image attachments disclosed transparently.
- **R-23 PASS:** Zero unrequested logos, fake avatars, or artificial monogram boxes proposed; wordmark remains typographic `Mutiara Florist`.
- **R-25 PASS:** All proposed color tokens and chart neighboring pairs verified mathematically via `.agents/skills/antislop-human/contrast-check.py` (`>= 4.5:1` text, `>= 3.0:1` UI borders & adjacent chart bars).
- **R-27 PASS:** Empty, loading (deferred skeletons), and error states (inline alerts + deferred retry) specified for every existing and new section.
- **R-30 PASS:** Syncro and Sparkpixel principles synthesized selectively into MFMS's `Calm Botanical Workspace` without cloning either product.
- **R-31 PASS:** Design Read, explicit dials (`ENERGY 2 / RHYTHM 3 / MOTION 1`), and one-line reasons recorded for every core palette, typography, radius, elevation, and layout choice.
- **R-35 PASS (Audit Scope):** Isolated SQLite app booted, seeded, authenticated, and verified live across 30 screenshots with 0 JS errors; no application source files modified during Phase 13A.
