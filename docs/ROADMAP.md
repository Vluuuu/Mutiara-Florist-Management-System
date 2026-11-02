# Roadmap Pengembangan
**Status:** Phase 3.2 Pengeluaran & Kategori: pengujian lokal **65 PASS / 469 assertions** (3,97s) pada 2 November 2026, migrasi UUID pengeluaran DONE, Vite build PASS. QA browser, uji concurrency MariaDB, dan backup/restore masih terbuka.

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

**Exit gate:** seluruh angka pembayaran/piutang konsisten dan dapat ditelusuri.

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
