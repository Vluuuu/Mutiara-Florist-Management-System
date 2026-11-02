# Decision Log — MFMS
**Revisi:** 2 November 2026 · **Status:** Phase 0 masih berlangsung.

Status:
- **Accepted:** arah produk yang telah dinyatakan pengguna.
- **Design baseline:** desain teknis untuk mulai implementasi core, masih bisa berubah saat review.
- **Open:** memerlukan keputusan operator/pemilik; jangan implementasikan asumsinya sebagai kebijakan final.

| ID | Status | Keputusan / isu | Keterangan |
| --- | --- | --- | --- |
| D-001 | Accepted | Administrasi florist internal, bukan toko online | Sumber data awal Google Sheets |
| D-002 | Accepted | Implementasi full-stack Laravel + MySQL | Tugas PAW mengizinkan cakupan melebihi mockup |
| D-003 | Accepted | Operator tunggal melalui laptop lokal | Tidak perlu multi-tenant/akses remote sekarang |
| D-004 | Accepted | MySQL lokal; Drive untuk backup; Excel untuk laporan | Media berfungsi berbeda |
| D-005 | Accepted | Modul order, pelanggan, pembayaran, pengeluaran, piutang, laporan, dashboard | Lingkup produk awal |
| D-006 | Design baseline | Laravel monolith MVC + Blade + Tailwind + Alpine.js | Tidak memakai Next.js terpisah |
| D-007 | Design baseline | Autentikasi satu akun admin | Lindungi data lokal |
| D-008 | Design baseline | 8 tabel core termasuk audit_logs; order_items dan payments terpisah | Memungkinkan multi-item dan DP |
| D-009 | Design baseline | Uang integer Rupiah; status bayar dihitung dari POSTED payments | Menghindari float dan checkbox tidak konsisten |
| D-010 | Design baseline | Perubahan order & payment atomik; cegah pembayaran ganda dengan transaction, lock, idempotency | Integritas data |
| D-011 | Design baseline | Pembatalan order tanpa pembayaran saja pada MVP; order berbayar ditahan | Batas aman sampai kebijakan refund disepakati |
| D-012 | Design baseline | Penjualan berdasar order_date, penerimaan payment_date, pengeluaran expense_date | Cegah laporan kas dan penjualan tercampur |
| D-013 | Design baseline | Piutang yang ditampilkan adalah snapshot saat ini, bukan histori as-of | Belum ada historical ledger/snapshot |
| D-014 | Open | Refund, DP hangus, biaya pembatalan dan koreksi pembayaran berimplikasi uang nyata | Belum ada persetujuan kebijakan |
| D-015 | Accepted | Ongkir bisa termasuk harga bunga atau ditagihkan terpisah | Jawaban operator 2 Nov 2026; rincian di [PRICING_AND_SHIPPING.md](PRICING_AND_SHIPPING.md) |
| D-016 | Accepted | Satu pesanan dapat berisi banyak item dengan tanggal **dan** lokasi pengiriman berbeda | Jawaban operator: tiap bunga mengikuti permintaan tanggal/tujuan pembeli; model per item |
| D-017 | Open | Metode bayar dan kategori biaya yang umum digunakan | Butuh daftar awal |
| D-018 | Open | Lingkungan pengembangan Windows yang dipakai; backup Drive manual/otomatis | Perlu cek perangkat & preferensi |
| D-019 | Open | Impor Excel/Sheets masuk MVP atau fase berikutnya | Perlu prioritas/estimasi |
| D-020 | Open | Penanganan pesanan gratis, revisi status completed, dan retensi lampiran | Kasus pinggir belum ditetapkan |
| D-021 | Open | Diskon/potongan harga dan pajak | Belum boleh dimasukkan ke rumus tagihan |
| D-022 | Open | Ongkir dibayar pelanggan langsung ke kurir di luar florist | Perlu aturan agar tidak dicatat sebagai kas florist |
| D-023 | Design baseline | Mode dan ongkir ditagihkan per item pengiriman, dapat campur dalam satu order | Mendukung multi-tujuan dan tidak menduplikasi ongkir per quantity |

## Rencana tindak lanjut
1. Konfirmasi keputusan **Open** (refund D-014, D-017 s.d. D-022 yang masih terbuka) dengan operator atau pemilik.
2. Finalisasi aturan ini **sebelum mengimplementasikan pembatalan berbayar**.
3. Core Laravel setup boleh dimulai tanpa seluruh kebijakan lanjutan, sepanjang tidak membuat fitur yang bertentangan dengan status Open.
4. Jika sebuah keputusan mengubah tabel, perbarui [DATABASE](DATABASE.md), [BUSINESS_RULES](BUSINESS_RULES.md), [PRD](PRD.md) dan tes terkait.

**Design baseline ongkir:** `order_items.shipping_mode` (`INCLUDED`/`SEPARATE`) dan `order_items.shipping_fee` (Rupiah bulat). Mode ini boleh berbeda antar-item dalam satu pesanan. Biaya aktual pengiriman tidak dianggap sama dengan ongkir yang ditagihkan.

Tidak ada migrasi atau aplikasi berjalan yang dibuat pada tahap dokumentasi ini.
