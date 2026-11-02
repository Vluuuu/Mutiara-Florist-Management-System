# Roadmap Pengembangan
**Status:** Phase 1 sedang berjalan. Kerangka Laravel 12, login, dashboard, dan migrasi telah di-commit ke GitHub; setup runtime lokal belum diverifikasi.

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
- [x] Import kerangka resmi **Laravel 12** (butuh PHP >=8.2) ke repository.
- [ ] Konfigurasi MySQL lokal via `.env`; pastikan tidak masuk Git.
- [x] Tambahkan layout Blade, Tailwind 4, dan Alpine.js (build lokal masih perlu diverifikasi).
- [x] Implementasi awal layout dashboard dan navigasi responsif; modul lain masih placeholder nonaktif.
- [x] Tulis migration awal untuk **8 tabel inti** termasuk users; belum dijalankan pada MySQL laptop.
- [ ] Jalankan `php artisan migrate` dan uji rollback pada database pengembangan kosong.
- [x] Tulis login/logout admin tunggal tanpa registrasi publik dan perintah `mfms:create-admin`.
- [ ] Jalankan tes autentikasi dan dashboard serta uji browser di laptop.

**Exit gate:** proyek bisa dibuka di browser lokal, tes setup lulus, dan migration bisa dijalankan ulang dari nol. **Belum tercapai** sampai verifikasi lokal dilakukan. Lihat [panduan setup Windows](LOCAL_SETUP.md).

## Phase 2 — Orders & Customers
- [ ] CRUD pelanggan.
- [ ] CRUD pesanan dan multi-item dengan **tanggal, tujuan, serta ongkir INCLUDED/SEPARATE per item**.
- [ ] Nomor order unik, validasi input, filter/pencarian.
- [ ] Status pengerjaan per item dan ringkasan otomatis status order.
- [ ] Pengujian transaksi multi-item, perhitungan ongkir tanpa diskon/pajak, dan perubahan harga setelah DP.

**Exit gate:** pesanan dapat dibuat, dicari, diedit sesuai aturan, dan bertahan setelah restart.

## Phase 3 — Payments & Expenses
- [ ] Riwayat pembayaran fleksibel: tanpa DP, langsung lunas saat pesan, bayar penuh kemudian, dan DP opsional.
- [ ] Status bayar dan piutang hasil perhitungan.
- [ ] CRUD kategori serta pencatatan pengeluaran.
- [ ] Void kesalahan input pembayaran/pengeluaran dengan alasan dan audit; **bukan** implementasi cancel/refund. Fitur cancel/refund masuk backlog pasca-MVP bila diperlukan.
- [ ] Tes nominal, pembayaran berlebih, submit ganda, dan konsistensi transaksi.

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
