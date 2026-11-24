# Phase 3.3.1 — Migrasi Dashboard React (Inertia.js + TypeScript)

## Ringkasan
Fase 3.3.1 mengimplementasikan dashboard manajemen berbasis **React 19 + TypeScript + Inertia.js v3** pada route terisolasi `/ui-dashboard`. Tampilan ini bekerja berdampingan dengan dashboard Blade lama (`/dashboard`), mengambil data statistik finansial dari service backend bersama (`DashboardService`), dan mempertahankan seluruh modul bisnis yang belum dimigrasikan.

## Arsitektur & Keputusan Teknis

1. **Service Bersama (`App\Services\DashboardService`)**
   - Menghitung statistik kumulatif dari database:
     - `orders`: total jumlah pesanan tercatat.
     - `billed`: total nilai pesanan (termasuk ongkos kirim terpisah).
     - `received`: akumulasi pembayaran berstatus `POSTED`.
     - `outstanding`: piutang berjalan dihitung dengan `max(billed - received, 0)`.
     - `expenses`: akumulasi pengeluaran kas berstatus `POSTED`.
     - `cash_flow`: selisih kas sederhana (`received - expenses`).
   - Transaksi berstatus `VOIDED` (baik pembayaran maupun pengeluaran) **dikecualikan** dari perhitungan kas.
   - Angka kas masuk minus kas keluar secara eksplisit dinamakan **"Selisih kas sederhana"** dan diberi catatan bahwa ini bukan laba bersih akuntansi.
   - Digunakan oleh `DashboardController` (Blade) dan `UiDashboardController` (Inertia/React), menjamin angka keduanya selalu identik.

2. **Routing & Isolasi Bertahap**
   - Route baru: `GET /ui-dashboard` dilindungi middleware `auth` dan `HandleInertiaRequests`.
   - Route lama `GET /dashboard` (Blade) tetap aktif sebagai fallback dan verifikasi operasional.
   - Link timbal balik tersedia di kedua dashboard (Blade memiliki tautan ke React Dashboard, dan React Dashboard memiliki tautan ke Dashboard Blade lama).

3. **Komponen Antarmuka (React + TypeScript)**
   - `AppLayout`: Layout manajemen modern dengan sidebar desktop permanen (`lg:block`), header mobile dengan tombol hamburger drawer (`lg:hidden`), indikator inisial admin, dan status bar.
   - `SidebarContent`: Navigasi utama dengan ikon Lucide. Menggunakan link HTML native (`<a>`) untuk modul Blade (Pelanggan, Pesanan, Pembayaran, Pengeluaran, Kategori) dan form POST native untuk logout agar tidak memicu intercept XHR Inertia terhadap respons HTML non-Inertia.
   - `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`: Komponen dasar berbasis pola shadcn/ui.
   - `StatCard`: Kartu metrik dengan pemisah visual, ikon kontekstual, indikator aksen emerald pada metrik selisih kas, dan label format mata uang standar Indonesia (`id-ID`).
   - `Dashboard`: Tampilan grid 6 kartu metrik responsif (1 kolom di mobile, 2 kolom di tablet/small desktop, 3 kolom di desktop lebar).

## Hasil Pengujian & QA

### 1. PHPUnit / Pest Feature Tests
- Perintah: `php artisan test`
- Hasil: **74 passed (572 assertions)**, durasi ~3.6s
- Mencakup:
  - `AdminAccessTest`: 4 PASS
  - `CustomerManagementTest`: 10 PASS
  - `DashboardTest`: 1 PASS
  - `ExampleTest`: 2 PASS
  - `ExpenseManagementTest`: 15 PASS
  - `OrderManagementTest`: 17 PASS
  - `PaymentManagementTest`: 16 PASS
  - `UiDashboardTest`: 7 PASS (guest redirect, data stats backend, guard POSTED only pada payment, guard POSTED only pada expense, piutang non-negatif, konsistensi angka dengan dashboard Blade, operasionalitas dashboard Blade lama)
  - `UiPreviewTest`: 2 PASS

### 2. TypeScript Typecheck
- Perintah: `npm run typecheck`
- Hasil: **PASS (exit code 0, 0 error)**

### 3. Vite Production Build
- Perintah: `npm run build`
- Hasil: **PASS (exit code 0)**
  - `public/build/assets/app-*.css` (~30 kB)
  - `public/build/assets/inertia-*.js` (~406 kB)

### 4. End-to-End Browser QA (Playwright)
- Pengujian otomatis via Playwright Chromium pada port lokal 8001 dengan MariaDB 3307:
  - Guest `/ui-dashboard` redirect ke `/login`: **PASS**
  - Login berhasil dan redirect ke dashboard: **PASS**
  - GET `/ui-dashboard` HTTP status 200: **PASS**
  - Header & judul Dashboard React: **PASS**
  - 6 kartu statistik ter-render: **PASS**
  - Verifikasi label statistik (tanpa klaim laba bersih palsu): **PASS**
  - Desktop sidebar tampak pada viewport 1440x900: **PASS**
  - Navigasi sidebar berisi 6 item aktif: **PASS**
  - Navigasi ke modul Blade Pelanggan berfungsi via full-page reload: **PASS**
  - Mobile burger button tampak pada viewport iPhone 13: **PASS**
  - Mobile drawer membuka dengan benar: **PASS**
  - Pengecekan horizontal overflow desktop (0 px) & mobile (0 px): **PASS**
  - Pengecekan console errors & page errors (0 error): **PASS**
  - **Ringkasan QA browser: 14 PASS / 0 FAIL**

## Rekomendasi Langkah Berikutnya
1. Modul Pelanggan (`customers`) dapat direncanakan sebagai modul berikutnya untuk dimigrasikan ke React/Inertia pada Phase 3.3.2.
2. Pertahankan route `/dashboard` sampai modul operasional utama selesai dievaluasi oleh pengguna.
