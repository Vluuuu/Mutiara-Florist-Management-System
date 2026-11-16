# Roadmap Pengembangan
**Status:** Phase 3.3.2 React Customer Management: pengujian lokal **85 PASS / 705 assertions** (4,80s), `npm run typecheck` PASS, `npm run build` PASS, browser QA Playwright 25 PASS / 0 FAIL. Modul Pelanggan React aktif di `/ui-customers`, terintegrasi dengan `CustomerService` bersama modul Blade `/customers`.

## Phase 0 — Foundation (sedang berlangsung)
- [x] Inisialisasi repo GitHub private dan README.
- [x] Draft PRD, arsitektur, database, aturan bisnis, roadmap, dan log keputusan.
- [ ] Validasi seluruh alur bisnis dengan operator/pemilik (pengiriman & ongkir per item, pembayaran penuh di awal/akhir, DP opsional sudah dikonfirmasi; cancel/refund ditunda).
- [x] Buat rancangan ERD 8 tabel dan baseline integritas pembayaran (v0.5, pengiriman/ongkir per item tanpa diskon/pajak).
- [x] Keputusan scope: **pembatalan/refund tidak dikembangkan pada MVP** karena belum ada kebutuhan kasus nyata; aturannya diputuskan nanti jika diperlukan.
- [x] Susun acceptance criteria dan test scenarios versi pertama (draft).
- [ ] Review/sahkan acceptance criteria bersama operator.

**Exit gate:** core schema & aturan pembayaran (tanpa DP wajib) cukup sebagai baseline untuk memulai Laravel. Pembatalan/refund sengaja di luar MVP dan bukan blocker setup/migration core. Keputusan lain yang memengaruhi model harus dicatat sebelum perubahan migrasi.

## Phase 1 — Laravel Foundation
- [x] Adaptasi scaffold aplikasi ke **Laravel 12**, memakai dependensi kompatibel PHP >=8.2; berhasil diinstal pada XAMPP PHP 8.2.12.
- [x] Konfigurasi MariaDB lokal XAMPP 10.4.32 port **3307** melalui `.env` lokal; migrasi sukses. Jangan unggah password/`.env` ke Git.
- [x] Tambahkan layout Blade, Tailwind 4, dan Alpine.js; `npm run build` berhasil di laptop.
- [x] Implementasi awal layout dashboard dan navigasi responsif; modul lain masih placeholder nonaktif.
- [x] Tulis migration awal untuk **8 tabel inti** termasuk users; **keempat migration Laravel berhasil dijalankan** pada MariaDB lokal.
- [x] Jalankan `php artisan migrate` pada database pengembangan kosong; semua 4 migration DONE.
- [ ] Uji migrasi ulang dari awal/rollback pada **database uji terpisah**, bukan database lokal yang sudah memiliki akun admin.
- [x] Tulis login/logout admin tunggal tanpa registrasi publik dan perintah `mfms:create-admin`.
- [x] Buat akun admin pertama dengan `mfms:create-admin` dan akses `/login` serta `/dashboard` melalui server lokal.
- [x] Jalankan PHPUnit pada laptop: **7 tests PASS, 23 assertions**, termasuk login/logout, proteksi dashboard, dan ringkasan keuangan.
- [ ] QA manual tampilan browser dan logout serta uji migrasi rollback pada database uji terpisah.
- [x] `composer.lock` dan `package-lock.json` sudah di-commit dan di-push ke `main` oleh operator (`37fdaa2`); `git status --short` kosong.

**Exit gate:** proyek bisa dibuka di browser lokal, tes setup lulus, dan migration bisa dijalankan ulang dari nol. **Tes dasar setup sudah lulus**; QA manual browser dan uji rollback database uji belum terverifikasi. Lockfiles telah di-commit. Implementasi Phase 2 dapat disiapkan dengan data sintetis, namun Phase 1 belum ditutup secara formal. Lihat [panduan setup Windows](LOCAL_SETUP.md).

## Phase 2 — Orders & Customers
- [x] **Implementasi kode** CRUD pelanggan: daftar, cari nama/telepon, tambah, detail, edit, arsip (soft delete hanya jika tidak ada order), audit perubahan.
- [x] Tulis tes fitur pelanggan (akses, validasi, pencarian, duplikasi telepon, pagination, HTML escaping, audit, perlindungan relasi order).
- [x] Jalankan **migrasi soft delete** pelanggan dan `php artisan test` di laptop: 17 PASS / 83 assertions; Vite build berhasil.
- [ ] QA manual browser menggunakan pelanggan sintetis. Lihat [CUSTOMERS_PHASE2.md](CUSTOMERS_PHASE2.md).
- [x] **Kode Phase 2.2:** buat, daftar, detail, edit pesanan multi-item dengan **tanggal/tujuan/penerima/pengirim dan ongkir INCLUDED/SEPARATE per item**. Operator mengonfirmasi pengujian di browser lokal.
- [x] Nomor pesanan unik ULID di backend, validasi server, pencarian nomor/pelanggan, filter status dan pagination.
- [x] Alur status item bertahap NEW → PROCESSING → READY → DELIVERED, ringkasan status order otomatis; item yang sudah diproses tidak boleh dihapus.
- [x] Service transaksi database: jumlah ongkir terpisah dihitung sekali per item; perubahan setelah DP tidak boleh lebih rendah dari pembayaran POSTED, dan repricing berbayar wajib alasan + audit.
- [x] Tulis dan jalankan 17 tes otomatis baru untuk perhitungan, keamanan, validasi, pembayaran tercatat, perubahan item/status, dan audit; **34/34 PASS, 193 assertions** untuk seluruh suite.
- [x] `npm run build` berhasil dan operator melaporkan pengujian browser halaman Pesanan berhasil; route `/orders`, `/orders/create`, dan `/orders/{order}` tampak di log server.
- [ ] Verifikasi kelengkapan QA manual seluruh alur (edit status, filter, logout, refresh), termasuk interaksi order dengan pelanggan yang diarsipkan. Lihat [ORDERS_PHASE2.md](ORDERS_PHASE2.md).

**Exit gate:** pesanan dapat dibuat, dicari, diedit sesuai aturan, dan bertahan setelah restart.

## Phase 3 — Payments & Expenses
- [x] **Kode Phase 3.1:** catat pembayaran POSTED dalam urutan DP/cicilan/pelunasan opsional, baik sesaat setelah order dibuat maupun belakangan. Form pembayaran berada di detail order; belum ada pembayaran gabungan atomik dalam satu request pembuatan order.
- [x] **Kode Phase 3.1:** status UNPAID/PARTIAL/PAID dan jumlah piutang dihitung dari nilai order minus pembayaran POSTED, tampil di detail order, dashboard, dan daftar Piutang.
- [x] **Kode Phase 3.1:** guard pembayaran berlebih, lock baris order yang sama dengan OrderService, idempotency UUID unik, input dengan CSRF/auth, audit per pembayaran.
- [x] **Kode Phase 3.1:** void pencatatan salah dengan alasan, timestamp dan audit, tanpa menghapus payment asli. **Bukan refund.**
- [x] Tulis dan jalankan 16 tes `PaymentManagementTest`; total suite Phase 3.1 **50 PASS / 324 assertions**.
- [ ] QA manual seluruh alur pembayaran dengan data fiktif dan uji concurrency MariaDB riil (SQLite PHPUnit belum membuktikannya).
- [ ] Dukungan pembayaran penuh/DP **bersamaan dengan submit pembuatan order dalam satu transaksi atomik** (T-35); saat ini pembayaran dicatat dari detail setelah order tersimpan.
- [x] **Kode Phase 3.2:** kategori tambah/rename/nonaktif/aktif, pengeluaran POSTED, pencarian/filter, void beralasan dan audit; tanpa hard delete.
- [x] Migrasi UUID pengeluaran DONE pada MariaDB lokal, Vite build PASS, 15 tes ExpenseManagementTest PASS; keseluruhan **65 PASS / 469 assertions**.
- [ ] QA manual browser kategori, pengeluaran, filter, void, dan dashboard dengan data fiktif. Lihat [EXPENSES_PHASE3.md](EXPENSES_PHASE3.md).

### Phase 3.3 — Fondasi React 19 + TypeScript + Inertia.js
- [x] Scaffold Inertia.js v3, React 19, TypeScript, Tailwind CSS 4, shadcn/ui foundation, Lucide React, dan Vite 8.
- [x] Route preview terisolasi `/ui-preview` dengan middleware `HandleInertiaRequests`.
- [x] Dependency lockfile (`composer.lock` & `package-lock.json`) terkunci dan tervalidasi.

### Phase 3.3.1 — Migrasi Dashboard React
- [x] Ekstraksi perhitungan statistik dashboard ke service bersama `DashboardService` agar angka pada dashboard Blade (`/dashboard`) dan dashboard React (`/ui-dashboard`) 100% konsisten.
- [x] Hanya transaksi `POSTED` yang dihitung pada uang diterima (`payments`) dan pengeluaran (`expenses`); transaksi `VOIDED` diabaikan dari kas.
- [x] Piutang dihitung `max(billed - received, 0)` dan tidak pernah negatif.
- [x] Selisih kas sederhana dihitung dari kas masuk minus keluar dan secara eksplisit tidak disebut sebagai laba bersih.
- [x] Implementasi layout manajemen modern (`AppLayout`) dengan desktop sidebar, mobile drawer responsif, toggle navigasi, dan identitas user.
- [x] Implementasi kartu metrik (`StatCard`, `Card`) dengan ikon Lucide dan format rupiah standar Indonesia.
- [x] Navigasi modul bisnis lama (Pelanggan, Pesanan, Pembayaran, Pengeluaran, Kategori) menggunakan tautan HTML native agar tidak bentrok dengan XHR router Inertia.
- [x] 7 tes otomatis baru di `UiDashboardTest` (total suite **74 PASS / 572 assertions**).
- [x] QA browser otomatis Playwright pada viewport desktop dan mobile: 14 PASS / 0 FAIL, bebas error konsol dan tanpa overflow horizontal.

### Phase 3.3.2 — Migrasi Pelanggan React
- [x] Ekstraksi operasi bisnis dan audit log pelanggan ke service bersama `CustomerService` (`paginate`, `create`, `update`, `archive`).
- [x] Perlindungan integritas bisnis: nama wajib, telepon & catatan opsional, telepon duplikat diizinkan, literal escaping untuk `%` dan `_`, pelanggan dengan pesanan dilarang diarsipkan, arsip menggunakan soft delete, pencatatan audit log lengkap.
- [x] Antarmuka React Inertia lengkap di route terisolasi `/ui-customers`:
  - `Customers/Index`: tabel responsif, form pencarian nama/telepon dengan tombol reset, paginasi 10 pelanggan per halaman, tautan ke Blade lama.
  - `Customers/Create`: formulir tambah pelanggan dengan validasi server, pesan error per input, indikator loading, dan pembatalan.
  - `Customers/Edit`: formulir edit data pelanggan dengan pre-fill data awal dan pencatatan audit field yang berubah.
  - `Customers/Show`: detail lengkap pelanggan, waktu WIB, total pesanan, kartu proteksi arsip jika memiliki pesanan, serta modal dialog konfirmasi arsip jika tanpa pesanan.
- [x] Integrasi navigasi sidebar: item aktif pada prefix `/ui-customers`, tautan fallback ke Pelanggan Blade lama.
- [x] 11 pengujian otomatis baru di `UiCustomerTest` (total suite **85 PASS / 705 assertions**).
- [x] QA browser otomatis Playwright pada database terisolasi (SQLite) dengan data sintetis: 25 PASS / 0 FAIL (tambah, edit, cari, reset, paginasi, tolak arsip jika ada order, sukses arsip jika tanpa order, verifikasi soft delete, pengujian viewport mobile, 0 error).

### Phase 3.3.3A — Migrasi Daftar & Detail Pesanan React
- [x] Ekstraksi query daftar dan perakitan representasi detail pesanan ke service bersama `OrderService` (`paginate`, `getOrderDetail`), dipakai konsisten oleh `OrderController` (Blade) dan `UiOrderController` (React).
- [x] Perlindungan aturan bisnis pesanan:
  - 1–20 item bunga per pesanan dengan jadwal, penerima, pengirim, lokasi, dan ongkir independen.
  - Mode ongkir `INCLUDED` (Rp0) vs `SEPARATE` (dihitung satu kali per item, bukan dikalikan jumlah bunga).
  - Status pengerjaan (`NEW`, `PROCESSING`, `READY`, `COMPLETED`) independen dari status pembayaran (`UNPAID`, `PARTIAL`, `PAID`).
  - Pesanan hanya berstatus `COMPLETED` bila seluruh item sudah `DELIVERED`.
  - Hanya pembayaran berstatus `POSTED` yang dihitung ke kas masuk; pembayaran `VOIDED` dikecualikan.
  - Sisa tagihan (`outstanding`) dihitung `max(total_amount - received, 0)` dan tidak pernah negatif.
- [x] Antarmuka React Inertia lengkap di route terisolasi `/ui-orders`:
  - `Orders/Index`: tabel responsif, form pencarian nomor pesanan dan nama pelanggan dengan literal escaping `%` dan `_`, filter status pengerjaan, tombol reset, indikator status pengerjaan & pembayaran berbasis badge, paginasi 10 pesanan per halaman.
  - `Orders/Show`: detail pesanan lengkap, 4 kartu ringkasan keuangan (total tagihan, uang diterima, sisa tagihan, status pembayaran), kartu status pengerjaan & catatan, daftar bunga per item dengan rincian biaya & ongkir, kartu rekap nilai pesanan, dan riwayat pembayaran (read-only) dengan pemisahan jelas antara pembayaran tercatat (`POSTED`) dan koreksi pencatatan (`VOIDED`).
- [x] Navigasi silang mulus ke antarmuka Blade untuk operasi mutasi data yang belum dimigrasikan:
  - Buat pesanan baru: `<a href="/orders/create">`
  - Edit pesanan: `<a href="/orders/{id}/edit">`
  - Catat pembayaran / koreksi void: `<a href="/orders/{id}#pembayaran">`
  - Tampilan Blade lama: `<a href="/orders">` dan `<a href="/orders/{id}">`
- [x] Integrasi navigasi sidebar: item aktif pada prefix `/ui-orders`, tautan fallback ke "Pesanan Blade lama".
- [x] 10 pengujian otomatis baru di `UiOrderTest` (total suite **95 PASS / 978 assertions**).
- [x] QA browser otomatis Playwright pada database terisolasi (SQLite) dengan data sintetis: 56 checks PASS / 0 FAIL (tamu dialihkan, login, desktop index, pencarian, filter status, reset, paginasi halaman 2, detail order multi-item, kalkulasi ongkir separate/included, riwayat pembayaran posted & voided, tautan ke Blade lama, responsive mobile iPhone 13, 0 error konsol).
- [x] Tangkapan layar QA desktop dan mobile tersimpan di `storage/app/`.

**Exit gate:** halaman daftar dan detail pesanan React terverifikasi lengkap membaca data backend nyata berdampingan dengan modul Blade lama tanpa merusak aturan bisnis atau data operasional.

## Phase 4 — Dashboard, Reports & Data Safety
- [ ] Ringkasan dan grafik per periode.
- [ ] Ekspor Excel.
- [ ] Backup konsisten dengan lampiran serta enkripsi.
- [ ] Salinan backup ke Google Drive (manual atau otomatis sesuai keputusan).
- [ ] Restore pada database uji dan dokumentasi prosedur.
- [ ] Evaluasi impor data Sheets/Excel (P1; tidak memblokir MVP bila belum disetujui).

**Exit gate:** laporan sesuai data sumber dan minimal satu backup berhasil dipulihkan.

## Phase 5 — QA & Handover
- [ ] Uji alur pembayaran penuh di awal/akhir, DP opsional, serta pesanan selesai namun belum dibayar.
- [ ] Uji tampilan laptop dan smartphone.
- [ ] Uji keamanan dasar (auth, validasi, file, secrets).
- [ ] Panduan penggunaan dan prosedur backup/restore.
- [ ] Kumpulkan bukti tugas PAW (tangkapan layar dan demonstrasi).
- [ ] Review bersama pengguna sebelum data nyata dipindahkan.

**Exit gate:** aplikasi layak untuk uji operasional lokal dan batasan yang tersisa terdokumentasi.

Dokumentasi rancangan: [DATABASE](DATABASE.md), [BUSINESS_RULES](BUSINESS_RULES.md), [PRICING_AND_SHIPPING](PRICING_AND_SHIPPING.md), [WORKFLOWS](WORKFLOWS.md), [TEST_PLAN](TEST_PLAN.md).

## Aturan bekerja
1. Setiap perubahan fitur memperbarui PRD/aturan jika mengubah perilaku yang disepakati.
2. Gunakan issue/PR untuk pekerjaan substantif setelah foundation.
3. Jangan mencampur data asli pelanggan dengan repo.
4. Selesaikan tes dan verifikasi sebelum menganggap fase selesai.
