# Mutiara Florist Management System (MFMS)

Sistem administrasi internal **Mutiara Indah Florist** untuk mengelola pesanan bunga dan pembukuan keuangan dalam satu aplikasi web.

> **Status:** **Phase 3.1 — kode Pembayaran & Piutang sudah ditambahkan ke GitHub, belum dites pada laptop** (2 November 2026). Baseline terakhir yang sudah lulus: Phase 2.2 **34 PASS / 193 assertions**. 16 tes pembayaran baru, QA browser keuangan dan concurrency MariaDB menunggu verifikasi. Baseline bisnis v0.6: pengiriman/ongkir per item, DP opsional, tanpa cancel/refund/diskon/pajak MVP.

## Tujuan

- Memindahkan proses pencatatan pesanan manual dari Google Sheets ke aplikasi terstruktur.
- Mencatat pelanggan, pesanan dan detail bunga, pembayaran **opsional** (lunas langsung, lunas kemudian, atau DP jika terjadi), pengeluaran, serta piutang.
- Menyediakan dashboard dan laporan berdasarkan data transaksi yang benar.
- Mengekspor laporan ke Excel dan menyiapkan backup database di luar laptop.

## Rancangan teknologi

| Lapisan | Rencana |
| --- | --- |
| Aplikasi | Laravel 12 monolith (PHP 8.2+, MVC) |
| UI | Blade, Tailwind CSS 4, Alpine.js |
| Database | MySQL lokal + Eloquent ORM + migrations |
| Grafik | Chart.js |
| Lingkungan awal | Windows, server pengembangan lokal |
| Backup | Dump database dan lampiran terenkripsi; salinan lokal dan Google Drive |
| Pengguna tahap awal | Satu operator/admin |

**Batasan awal:** akses lokal melalui laptop; tidak ada toko online, payment gateway, multi-tenant, atau hosting produksi. Akses HP/jarak jauh dan integrasi pihak ketiga merupakan pengembangan berikutnya.

## Jalankan di Windows

Lihat **[panduan setup lokal](docs/LOCAL_SETUP.md)**. Ringkasnya: clone repo, `composer install`, buat `.env`, jalankan MySQL dan buat database `mutiara_florist`, `php artisan key:generate`, `php artisan migrate`, `php artisan mfms:create-admin`, `npm install && npm run build`, lalu `php artisan serve`. PHP harus **>=8.2**.

Setup lokal sudah menjalankan lima migrasi, membuat akun admin, dan **34 tes otomatis Phase 2.2 PASS (193 assertions)**. Kode Pembayaran & Piutang Phase 3.1 menambah form pembayaran, void dan daftar piutang tanpa migrasi baru; **belum ada bukti tes Phase 3.1 di laptop**. `composer.lock` dan `package-lock.json` tersimpan di GitHub. Backup/restore dan uji paralel MariaDB masih pending; jangan memasukkan data pelanggan nyata dulu.

## Dokumentasi

- [PRD — kebutuhan dan ruang lingkup](docs/PRD.md)
- [Arsitektur sistem](docs/ARCHITECTURE.md)
- [Rancangan database](docs/DATABASE.md)
- [Aturan bisnis](docs/BUSINESS_RULES.md)
- [Aturan harga dan ongkos kirim](docs/PRICING_AND_SHIPPING.md)
- [Roadmap](docs/ROADMAP.md)
- [Uji fitur pelanggan Phase 2](docs/CUSTOMERS_PHASE2.md)
- [Uji pesanan multi-item Phase 2.2](docs/ORDERS_PHASE2.md)
- [Uji pembayaran & piutang Phase 3.1](docs/PAYMENTS_PHASE3.md)
- [Log keputusan](docs/DECISIONS.md)
- [Alur kerja dan use cases](docs/WORKFLOWS.md)
- [Rancangan pengujian](docs/TEST_PLAN.md)

## Alur pengembangan

1. **Phase 0 — Foundation:** validasi kebutuhan, diagram, aturan keuangan, dokumentasi.
2. **Phase 1 — Setup:** Laravel, tampilan dasar, MySQL, migrasi, login satu pengguna.
3. **Phase 2 — Orders:** CRUD pelanggan, pesanan, dan item bunga.
4. **Phase 3 — Finance:** pembayaran fleksibel (tanpa DP wajib), piutang, pengeluaran dan audit koreksi; cancel/refund di luar MVP.
5. **Phase 4 — Reporting & Backup:** dashboard, laporan, ekspor, backup/pemulihan.
6. **Phase 5 — QA:** pengujian fungsional, data, keamanan dasar, dan UX.

Lihat [roadmap](docs/ROADMAP.md) untuk kriteria penyelesaian setiap fase.

## Keamanan dan data

Jangan commit file `.env`, database atau dump SQL, bukti pembayaran, data pribadi pelanggan asli, kunci API, atau arsip backup. Gunakan **data sintetis** pada seed dan screenshot. GitHub menyimpan **kode dan dokumentasi**, bukan data operasional/backup.

## Proposal akademik

Proyek juga digunakan untuk mata kuliah Pemrograman Aplikasi Web (PAW). Implementasi full-stack merupakan ruang lingkup pengembangan yang dipilih, meskipun tugas kuliah mengizinkan mockup. Dokumen proposal tersimpan terpisah dan tidak otomatis menjadi sumber kebenaran ketika keputusan teknis di sini diperbarui.

## Catatan

Semua dokumen di `docs/` merupakan rancangan awal dan dapat direvisi sebelum implementasi. Detail teknis yang belum dikonfirmasi diberi status **usulan** atau **perlu diputuskan**.
