# Mutiara Florist Management System (MFMS)

Sistem administrasi internal **Mutiara Indah Florist** untuk mengelola pesanan bunga dan pembukuan keuangan dalam satu aplikasi web.

> **Status:** Phase 0 — perencanaan dan dokumentasi (baseline skema v0.4: pengiriman dan ongkir per item; refund/diskon belum final). Belum ada implementasi aplikasi. Rencana pengembangan: full-stack Laravel dan MySQL lokal, satu operator utama dari laptop.

## Tujuan

- Memindahkan proses pencatatan pesanan manual dari Google Sheets ke aplikasi terstruktur.
- Mencatat pelanggan, pesanan dan detail bunga, pembayaran (DP/pelunasan), pengeluaran, serta piutang.
- Menyediakan dashboard dan laporan berdasarkan data transaksi yang benar.
- Mengekspor laporan ke Excel dan menyiapkan backup database di luar laptop.

## Rancangan teknologi

| Lapisan | Rencana |
| --- | --- |
| Aplikasi | Laravel monolith (PHP, MVC) |
| UI | Blade, Tailwind CSS, Alpine.js |
| Database | MySQL lokal + Eloquent ORM + migrations |
| Grafik | Chart.js |
| Lingkungan awal | Windows, server pengembangan lokal |
| Backup | Dump database dan lampiran terenkripsi; salinan lokal dan Google Drive |
| Pengguna tahap awal | Satu operator/admin |

**Batasan awal:** akses lokal melalui laptop; tidak ada toko online, payment gateway, multi-tenant, atau hosting produksi. Akses HP/jarak jauh dan integrasi pihak ketiga merupakan pengembangan berikutnya.

## Dokumentasi

- [PRD — kebutuhan dan ruang lingkup](docs/PRD.md)
- [Arsitektur sistem](docs/ARCHITECTURE.md)
- [Rancangan database](docs/DATABASE.md)
- [Aturan bisnis](docs/BUSINESS_RULES.md)
- [Aturan harga dan ongkos kirim](docs/PRICING_AND_SHIPPING.md)
- [Roadmap](docs/ROADMAP.md)
- [Log keputusan](docs/DECISIONS.md)
- [Alur kerja dan use cases](docs/WORKFLOWS.md)
- [Rancangan pengujian](docs/TEST_PLAN.md)

## Alur pengembangan

1. **Phase 0 — Foundation:** validasi kebutuhan, diagram, aturan keuangan, dokumentasi.
2. **Phase 1 — Setup:** Laravel, tampilan dasar, MySQL, migrasi, login satu pengguna.
3. **Phase 2 — Orders:** CRUD pelanggan, pesanan, dan item bunga.
4. **Phase 3 — Finance:** pembayaran, piutang, pengeluaran, aturan pembatalan.
5. **Phase 4 — Reporting & Backup:** dashboard, laporan, ekspor, backup/pemulihan.
6. **Phase 5 — QA:** pengujian fungsional, data, keamanan dasar, dan UX.

Lihat [roadmap](docs/ROADMAP.md) untuk kriteria penyelesaian setiap fase.

## Keamanan dan data

Jangan commit file `.env`, database atau dump SQL, bukti pembayaran, data pribadi pelanggan asli, kunci API, atau arsip backup. Gunakan **data sintetis** pada seed dan screenshot. GitHub menyimpan **kode dan dokumentasi**, bukan data operasional/backup.

## Proposal akademik

Proyek juga digunakan untuk mata kuliah Pemrograman Aplikasi Web (PAW). Implementasi full-stack merupakan ruang lingkup pengembangan yang dipilih, meskipun tugas kuliah mengizinkan mockup. Dokumen proposal tersimpan terpisah dan tidak otomatis menjadi sumber kebenaran ketika keputusan teknis di sini diperbarui.

## Catatan

Semua dokumen di `docs/` merupakan rancangan awal dan dapat direvisi sebelum implementasi. Detail teknis yang belum dikonfirmasi diberi status **usulan** atau **perlu diputuskan**.
