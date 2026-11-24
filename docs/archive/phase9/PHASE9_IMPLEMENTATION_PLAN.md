# Phase 9: Implementation Plan (Locked to Approved Botanical Studio Design)
**Mutiara Florist Management System (MFMS)**

- **Desain Disetujui:** **Arah 2 - Botanical Studio Workspace (`commit 3177c6f`)**
- **Referensi Visual Resmi:** `docs/phase8-2/direction-2-botanical-studio.html`
- **Spesifikasi Terkunci:** `docs/DESIGN.md`
- **Catatan Persetujuan:** `docs/PHASE8_2_DESIGN_APPROVAL.md`

Seluruh pengerjaan Phase 9 tidak boleh mengubah `OrderService`, `PaymentService`, `ExpenseService`, `ReportService`, `BackupService`, schema database operasional, maupun rumus bisnis keuangan.

---

## 1. Prinsip Pengaman Implementasi (Non-Negotiable)

1. **Zero Business Logic Regression:** `OrderService`, `PaymentService`, `ExpenseService`, `ReportService`, `BackupService`, dan seluruh rumus integer Rupiah tidak diubah pada Phase 9.
2. **Backend Scope Terbatas:**
   - **Sprint 1:** Penambahan `messages()` dan `attributes()` Bahasa Indonesia di seluruh 7 `FormRequest`, format tanggal `Asia/Jakarta` (WIB) serta format Rupiah konsisten, dan penyelarasan props `nav` di controller tanpa menyentuh rumus bisnis.
   - **Sprint 2-3 (terpisah setelah Sprint 1 di-review):** Penambahan query read-only bila disetujui untuk antrean `delivery_date` Dashboard atau riwayat pembayaran di Piutang.
3. **Strategi Git Stacked PR:**
   - PR #6 (`audit/phase7-ui-ux` -> `main`) dan PR #7 (`design/phase8-human-centered-refinement` -> `main`) diintegrasikan berurutan (PR #6 lebih dahulu sebelum PR #7).
   - Sprint 1 bekerja pada branch terpisah `feat/phase9-sprint1-foundation` yang dibuat dari `design/phase8-human-centered-refinement` dengan target PR stacked ke `design/phase8-human-centered-refinement` agar diff hanya memuat kode Sprint 1.
4. **Gate Verifikasi Wajib:** `npm run typecheck`, `npm run build`, `php artisan test`, `contrast-check.py`, serta verifikasi `agent-browser` pada `360×780`, `390×844`, `768×1024`, `1024×768`, dan `1440×900` dengan database testing terisolasi.

---

## 2. Sprint 1 — Fondasi Design System, Shell Botanical Studio, Validasi & Format (Fokus Saat Ini)

| Task | Backlog ID | Ruang Lingkup Pekerjaan | Kriteria Selesai |
| :--- | :--- | :--- | :--- |
| **9.1.1 Lokalisasi Validasi 7 FormRequest** | `UX-P0-01` | Tambah `messages()` dan `attributes()` Bahasa Indonesia pada seluruh 7 `FormRequest` (`OrderRequest`, `CustomerRequest`, `StorePaymentRequest`, `VoidPaymentRequest`, `StoreExpenseRequest`, `VoidExpenseRequest`, `ExpenseCategoryRequest`), termasuk pesan array item pesanan tanpa raw key `items.0.*`. | Tidak ada pesan validasi Inggris atau raw field key pada respons error; PHPUnit feature tests lulus. |
| **9.1.2 Penyelarasan Format Rupiah & Tanggal WIB** | `UX-P0-02`, `UX-P2-05` | Seragamkan `formatRupiah()` (`Rp1.500.000`, `-Rp55.000`, `tabular-nums`) dan formatter tanggal WIB (`dd/mm/yyyy`, `dd/mm/yyyy HH:mm WIB`) di `resources/js/lib/format.ts` serta controller pembacaan tanggal (`UiExpenseController::index()`, dll.) tanpa menyentuh service keuangan. | Tidak ada pergeseran tanggal UTC -1 hari; seluruh nominal bertanda `Rp` + `tabular-nums`. |
| **9.1.3 Token CSS & Komponen Bersama Botanical Studio** | `UX-P1-10`, `UX-P1-12`, `UX-P2-05` | Implementasi token CSS terkunci (`#FBF9F6`, `#143326`, `#8C3B4A`, `#858E87`, status semantik WCAG AA) di `resources/css/app.css`. Bangun komponen bersama: `Button`, `Input`, `Badge`, `Modal`, `CurrencyInput`, `SearchableSelect`, dan `ResponsiveDataList` (+ utilitas error summary / order badge). | Kontras lulus WCAG AA, `cursor: pointer`, `:focus-visible`, `Escape` modal + return focus, dan target tap mobile `>= 44px`. |
| **9.1.4 AppLayout Desktop/Tablet/Mobile & Cleanup Scaffolding** | `UX-P0-03`, `UX-P0-05`, `UX-P2-01` | Bangun `AppLayout` sesuai referensi `direction-2-botanical-studio.html`: Dark Spruce Sidebar (`#143326`) pada `>= 1024px`, topbar tablet dengan trigger `Menu` (`768px-1023px`), dan 4-destinasi mobile bottom navigation (`Hari Ini`, `Pesanan`, `Buat`, `Menu`) dengan drawer halaman sekunder + `Keluar Akun` & `Escape`. Bersihkan badge `Phase 3.3`, blok `Pengembangan berikutnya`, serta fallback link `Blade lama` dari shell, dashboard, dan halaman login. | `overflowCount = 0` di `360px`..`1440px`, 4 tab bottom nav aktif, tombol `Keluar` tampak & berfungsi, `npm run typecheck` + `npm run build` + `php artisan test` lulus. |

---

## 3. Sprint 2 — Alur Harian Inti: Login, Dashboard, Pelanggan, & Pesanan (Menunggu Review Sprint 1)

| Task | Backlog ID | Ruang Lingkup | Referensi Desain |
| :--- | :--- | :--- | :--- |
| **9.2.1 Login & Dashboard Operasional** | `UX-P1-06`, `UX-P2-04` | Eye toggle password di Login, urutan mobile Dashboard menempatkan antrean kiriman terlambat/hari ini (berbasis `DATE`) di atas KPI ringkas `2×2`, tambahan query read-only `DashboardService` untuk kiriman aktif & top piutang. | `direction-2-botanical-studio.html` (`screen-dashboard`) |
| **9.2.2 Pelanggan & Daftar Pesanan** | `UX-P0-04`, `UX-P1-05`, `UX-P1-07` | Terapkan `ResponsiveDataList`, chip filter status bahasa Indonesia, riwayat order di Detail Pelanggan, tombol langsung `+ Pesan`. | `direction-2-botanical-studio.html` (`screen-orders`, `screen-customers`) |
| **9.2.3 Form Buat/Edit Pesanan & Detail Pesanan** | `UX-P0-06`, `UX-P1-01..04` | Field terpisah 1:1 `OrderRequest`, `SearchableSelect` + modal `+ Pelanggan Baru` tanpa reset item, `Duplikat Item`, 1 CTA `Simpan Pesanan` per viewport, error summary, konfirmasi aman `Tandai Terkirim`, `Salin Ringkasan WA` aktual, serta modal bayar & void min 10 karakter. | `direction-2-botanical-studio.html` (`screen-order-form`, `screen-order-detail`) |

---

## 4. Sprint 3 — Keuangan, Pengeluaran, Laporan, & Delivery Gate Akhir (Menunggu Sprint 2)

| Task | Backlog ID | Ruang Lingkup |
| :--- | :--- | :--- |
| **9.3.1 Piutang & Pembayaran (`/ui-payments`)** | `UX-P0-04`, `UX-P1-08` | Utamakan daftar **Tagihan Belum Lunas** + `Catat Bayar` langsung modal; riwayat `Tercatat`/`Dibatalkan` di blok sekunder terpisah. |
| **9.3.2 Pengeluaran & Kategori Biaya** | `UX-P0-02`, `UX-P1-09`, `UX-P1-10` | `ResponsiveDataList`, render `errors.to`, `<Modal>` Void & arsip kategori (hapus `window.confirm()`), tambah kategori cepat. |
| **9.3.3 Laporan (`/ui-reports`)** | `UX-P1-11`, `UX-P2-05` | Hapus istilah teknis SQL/enum, seragamkan `-Rp...` & `tabular-nums`, filter transaksi, kartu mobile. |
| **9.3.4 Verifikasi Menyeluruh Phase 9** | Semua | Gate akhir PHPUnit + TypeScript + Vite build + Anti-Slop browser QA lintas 5 viewport + perbandingan screenshot. |
