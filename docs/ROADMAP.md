# Roadmap Pengembangan
**Status:** Rencana awal, belum ada tanggal pasti atau implementasi yang diklaim selesai.

## Phase 0 — Foundation (sedang berlangsung)
- [x] Inisialisasi repo GitHub private dan README.
- [x] Draft PRD, arsitektur, database, aturan bisnis, roadmap, dan log keputusan.
- [ ] Validasi alur bisnis dengan operator/pemilik.
- [ ] Finalisasi ERD dan keputusan pembatalan/refund.
- [ ] Tetapkan acceptance criteria untuk versi pertama.

**Exit gate:** scope dan aturan uang jelas sebelum membuat migration final.

## Phase 1 — Laravel Foundation
- [ ] Bootstrap Laravel sesuai versi PHP yang dipakai.
- [ ] Konfigurasi MySQL lokal via `.env`; pastikan tidak masuk Git.
- [ ] Setup Blade, Tailwind, dan Alpine.js.
- [ ] Layout dashboard dan navigasi responsif.
- [ ] Migration awal dan seed data sintetis.
- [ ] Login satu akun operator dan tes autentikasi.

**Exit gate:** proyek bisa dibuka di browser lokal, tes setup lulus, dan migration bisa dijalankan ulang dari nol.

## Phase 2 — Orders & Customers
- [ ] CRUD pelanggan.
- [ ] CRUD pesanan dan multi-item.
- [ ] Nomor order unik, validasi input, filter/pencarian.
- [ ] Status pengerjaan.
- [ ] Pengujian transaksi multi-item dan pengubahan data.

**Exit gate:** pesanan dapat dibuat, dicari, diedit sesuai aturan, dan bertahan setelah restart.

## Phase 3 — Payments & Expenses
- [ ] Riwayat DP dan pelunasan.
- [ ] Status bayar dan piutang hasil perhitungan.
- [ ] CRUD kategori serta pencatatan pengeluaran.
- [ ] Aturan pembatalan, void/reversal, dan audit log (setelah keputusan bisnis final).
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
- [ ] Uji alur dari pesanan hingga pelunasan.
- [ ] Uji tampilan laptop dan smartphone.
- [ ] Uji keamanan dasar (auth, validasi, file, secrets).
- [ ] Panduan penggunaan dan prosedur backup/restore.
- [ ] Kumpulkan bukti tugas PAW (tangkapan layar dan demonstrasi).
- [ ] Review bersama pengguna sebelum data nyata dipindahkan.

**Exit gate:** aplikasi layak untuk uji operasional lokal dan batasan yang tersisa terdokumentasi.

## Aturan bekerja
1. Setiap perubahan fitur memperbarui PRD/aturan jika mengubah perilaku yang disepakati.
2. Gunakan issue/PR untuk pekerjaan substantif setelah foundation.
3. Jangan mencampur data asli pelanggan dengan repo.
4. Selesaikan tes dan verifikasi sebelum menganggap fase selesai.
