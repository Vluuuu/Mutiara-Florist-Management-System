# Phase 9: Implementation Plan (Mapped to P0 / P1 / P2 Audit Backlog)
**Mutiara Florist Management System (MFMS)**

Rencana ini dijalankan **setelah pemilik memilih opsi visual final** pada Phase 8 (Opsi A, Opsi B, atau Opsi C) dan mengunci `docs/DESIGN.md`. Seluruh pengerjaan Phase 9 tidak boleh mengubah logika perhitungan tagihan, pembayaran idempoten, status item linier, maupun integritas audit.

---

## Prinsip Pengaman Implementasi (Non-Negotiable)

1. **Zero Business Logic Regression:** `OrderService`, `PaymentService`, `ExpenseService`, `ReportService`, `BackupService`, dan seluruh rumus integer Rupiah tidak diubah.
2. **Backend Read-Formatting Only:** Perubahan backend dibatasi pada:
   - Penambahan `messages()` & `attributes()` Bahasa Indonesia pada 7 `FormRequest` (UX-P0-01).
   - Format tanggal zona `Asia/Jakarta` pada `UiExpenseController::index()` (UX-P0-02).
   - Penyelarasan prop `nav` & tambahan data ringkas read-only untuk Dashboard/Customer Show (`agenda kirim`, `riwayat order pelanggan`) dengan `DashboardService`/`OrderService` teruji.
3. **Gate Verifikasi di Setiap Batch:** `npm run typecheck`, `npm run build`, `php artisan test`, serta verifikasi `agent-browser` pada `1440×900`, `768×1024`, dan `390×844` + `contrast-check.py` dan checklist Anti-Slop.

---

## Tahap 1 — Fondasi Design System, Shell, & Perbaikan Kritis P0 (Sprint 1)

| Task | Backlog ID | Ruang Lingkup Pekerjaan | Kriteria Selesai |
| --- | --- | --- | --- |
| **9.1.1 Lokalisasi Validasi Backend** | `UX-P0-01` | Tambah `messages()` & `attributes()` Bahasa Indonesia di seluruh 7 `FormRequest` (`CustomerRequest`, `OrderRequest`, `StorePaymentRequest`, `VoidPaymentRequest`, `StoreExpenseRequest`, `VoidExpenseRequest`, `ExpenseCategoryRequest`), termasuk label ramah item pesanan (`Bunga #1: Jenis bunga`). | Tidak ada teks validasi Inggris atau key `items.0.*`; feature test PHPUnit membuktikan pesan Bahasa Indonesia. |
| **9.1.2 Fix Tanggal & Mata Uang Pengeluaran** | `UX-P0-02` | Format `expense_date` (`d/m/Y`) & `voided_at` (`d/m/Y H:i` WIB) di `UiExpenseController::index()`. Seragamkan `formatRupiah()` (`Rp...`, `-Rp...`) di `resources/js/lib/format.ts` dan pakai di seluruh halaman termasuk Pengeluaran & Laporan. | Tanggal WIB akurat (tidak mundur 1 hari UTC); semua nominal bertanda `Rp` + `tabular-nums`. |
| **9.1.3 Token CSS & Komponen Inti** | `UX-P1-10`, `UX-P1-12`, `UX-P2-05` | Implementasi token warna & tipografi pilihan pemilik di `resources/css/app.css`. Bangun komponen bersama: `Modal`, `CurrencyInput`, `SearchableSelect`, `ResponsiveDataList`, `OrderCodeBadge`, `CharCounterTextarea`, `Badge`, `Button`. | Semua komponen memenuhi WCAG AA (`contrast-check.py` PASS), `cursor: pointer`, `Escape` modal, dan `min-h-[44px]` di mobile. |
| **9.1.4 Shell Navigasi & Pembersihan Scaffolding** | `UX-P0-03`, `UX-P0-05`, `UX-P2-01`, `UX-P2-07` | Bangun `AppLayout` & navigasi baru sesuai opsi terpilih (Opsi A/B/C). Hapus blok `FALLBACK BLADE LAMA`, badge `Phase 3.3`, teks usang, dan topbar `<h2>` duplikat. Perbaiki scroll mobile drawer + `Keluar` tampak + `Escape`. Key flash banner agar reset bersih. | `overflowX: false` di `390×844`, `Keluar` tampak di mobile, `Escape` menutup drawer, urutan heading valid (`<h1>` dulu). |

---

## Tahap 2 — Alur Inti Harian: Login, Dashboard, Pelanggan, & Pesanan (Sprint 2)

| Task | Backlog ID | Ruang Lingkup Pekerjaan | Kriteria Selesai |
| --- | --- | --- | --- |
| **9.2.1 Login & Dashboard Operasional** | `UX-P1-06`, `UX-P2-04` | Perbaiki `<Head title="Masuk" />`, tambah *eye toggle* password, hapus link Blade fallback. Ubah Dashboard menjadi ruang kerja operasional: CTA cepat (`+ Buat Pesanan`, `+ Catat Pengeluaran`), Agenda Pengiriman Hari Ini & Besok, serta hierarki Kas & Piutang. Samakan `nav` di `UiDashboardController`. | Operator melihat pengiriman hari ini dan bisa buat order/pengeluaran dalam 1 klik dari Dashboard. |
| **9.2.2 Pelanggan (Index, Create, Edit, Show)** | `UX-P0-04`, `UX-P1-07` | Terapkan `<ResponsiveDataList>` pada daftar pelanggan (kartu di mobile/tablet). Pada Detail Pelanggan, tampilkan daftar riwayat order pelanggan, tombol `+ Buat Pesanan` (prefill `?customer_id=`), dan `<Modal>` arsip standar. | Tidak ada kolom terpotong di `390×844` & `768×1024`; flow Pelanggan -> Pesanan turun dari 7 klik menjadi <= 3 klik. |
| **9.2.3 Daftar Pesanan (`/ui-orders`)** | `UX-P0-04`, `UX-P1-05` | Perbaiki tombol menjadi `+ Buat Pesanan`. Tambah chip filter cepat status (`Semua`, `Baru`, `Diproses`, `Siap Kirim`, `Selesai`). Tampilkan `<OrderCodeBadge>`, nama penerima & tanggal kirim terdekat, serta `<ResponsiveDataList>`. | Status & tagihan terbaca utuh di mobile/tablet; filter status cukup 1 klik. |
| **9.2.4 Form Pesanan Create & Edit** | `UX-P0-06`, `UX-P1-01`, `UX-P1-03`, `UX-P1-12`, `UX-P2-02`, `UX-P2-03` | Hapus default `customers[0]`; pakai `<SearchableSelect>` + modal tambah pelanggan cepat tanpa menghapus form. Layout 2 kolom *sticky summary*. Tambah `Duplikat Bunga`, `<CurrencyInput>`, sembunyikan ongkir saat `INCLUDED`, ikat 100% `<label htmlFor>`. Di Edit: hapus `ID #...`, badge final untuk `DELIVERED`, peringatan wajib alasan perubahan dinamis. | `inputsNoLabel = 0`; tambah pelanggan baru tidak menghapus item; zero typo spasi. |
| **9.2.5 Detail Pesanan & Modal Pembayaran/Void/Fulfillment** | `UX-P1-02`, `UX-P1-04`, `UX-P1-10`, `UX-P2-06` | Layout 2 kolom *sticky* keuangan, 1 tombol `+ Catat Pembayaran`, link profil & HP pelanggan. Satu badge status per item + stepper 4 tahap + perbaiki copy `Siap kirim`. Pakai `<Modal>` + `<CurrencyInput>` + `<CharCounterTextarea>` + regenerasi `idempotency_key` setelah error. | Tidak ada duplikasi CTA atau kebingungan copy status; semua modal lolos uji `Tab` & `Escape`. |

---

## Tahap 3 — Keuangan, Pengeluaran, Laporan, & Uji Penerimaan Final (Sprint 3)

| Task | Backlog ID | Ruang Lingkup Pekerjaan | Kriteria Selesai |
| --- | --- | --- | --- |
| **9.3.1 Piutang & Pembayaran (`/ui-payments`)** | `UX-P0-04`, `UX-P1-08` | Tambah aksi cepat **`Catat Bayar`** langsung membuka `<Modal>` Pembayaran di halaman Piutang, plus `<ResponsiveDataList>` untuk mobile/tablet. | Pelunasan piutang dapat dilakukan langsung dari daftar piutang tanpa pindah halaman. |
| **9.3.2 Pengeluaran & Kategori Biaya** | `UX-P0-02`, `UX-P0-04`, `UX-P1-09`, `UX-P1-10` | `<ResponsiveDataList>` di Pengeluaran, render `errors.to` saat filter tanggal terbalik, `<Modal>` Void dengan `CharCounterTextarea`, `<Modal>` nonaktifkan kategori (hapus `window.confirm()`), tombol ubah nama kategori `>= 40px` ber-`aria-label`, dan tambah kategori cepat di form pengeluaran. | `unlabeledBtns = 0`, tidak ada dialog native `confirm()`, nominal & tanggal WIB akurat. |
| **9.3.3 Laporan (`/ui-reports`)** | `UX-P1-11`, `UX-P2-05` | Hapus istilah teknis (`order_date`, `(NEW)`, `(UNPAID)`), seragamkan `-Rp55.000` & `tabular-nums`, tambah toggle *"Hanya hari ada transaksi"*, perbesar chip filter preset (`>= 40px`), kartu harian untuk mobile `< 768px`. | Tabel laporan terbaca rapi di mobile tanpa `Rp` terpotong; zero istilah teknis SQL/enum. |
| **9.3.4 Full Verification & Anti-Slop Delivery Gate** | Semua | Jalankan `npm run typecheck`, `npm run build`, `php artisan test`, `Ui*Test` + `contrast-check.py` + `agent-browser` click-through penuh (desktop `1440×900`, tablet `768×1024`, mobile `390×844`) + audit screenshot perbandingan sebelum/sesudah. | 100% tes lulus, Anti-Slop Delivery Gate seluruh blok PASS tanpa pengecualian. |
