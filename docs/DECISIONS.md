# Decision Log — MFMS
**Revisi:** 2 November 2026 · **Status:** Phase 1 dimulai, runtime belum diuji pada laptop operator.

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
| D-011 | Accepted (scope) | **Tidak ada fitur cancel/refund pada MVP**, termasuk order belum dibayar | Operator belum menemui kasus pembatalan; aturan refund/DP hangus belum diketahui, diputuskan pada tahap lanjutan |
| D-012 | Design baseline | Penjualan berdasar order_date, penerimaan payment_date, pengeluaran expense_date | Cegah laporan kas dan penjualan tercampur |
| D-013 | Design baseline | Piutang yang ditampilkan adalah snapshot saat ini, bukan histori as-of | Belum ada historical ledger/snapshot |
| D-014 | Deferred | Kebijakan refund/DP hangus dan pembatalan | Ditunda hingga ada kebutuhan nyata; bukan blocker migration inti |
| D-015 | Accepted | Ongkir bisa termasuk harga bunga atau ditagihkan terpisah | Jawaban operator 2 Nov 2026; rincian di [PRICING_AND_SHIPPING.md](PRICING_AND_SHIPPING.md) |
| D-016 | Accepted | Satu pesanan dapat berisi banyak item dengan tanggal **dan** lokasi pengiriman berbeda | Jawaban operator: tiap bunga mengikuti permintaan tanggal/tujuan pembeli; model per item |
| D-017 | Open | Metode bayar dan kategori biaya yang umum digunakan | Butuh daftar awal |
| D-018 | Open | Lingkungan pengembangan Windows yang dipakai; backup Drive manual/otomatis | Perlu cek perangkat & preferensi |
| D-019 | Open | Impor Excel/Sheets masuk MVP atau fase berikutnya | Perlu prioritas/estimasi |
| D-020 | Open | Penanganan pesanan gratis, revisi status completed, dan retensi lampiran | Kasus pinggir belum ditetapkan |
| D-021 | Accepted | Diskon/potongan harga dan pajak **tidak diperlukan pada MVP** | Dikonfirmasi operator 2 Nov 2026; tidak membuat kolom atau fitur awal |
| D-022 | Open | Ongkir dibayar pelanggan langsung ke kurir di luar florist | Perlu aturan agar tidak dicatat sebagai kas florist |
| D-023 | Design baseline | Mode dan ongkir ditagihkan per item pengiriman, dapat campur dalam satu order | Mendukung multi-tujuan dan tidak menduplikasi ongkir per quantity |
| D-024 | Accepted | **DP opsional**; umumnya lunas langsung saat memesan atau dibayar penuh belakangan | Tidak boleh memaksa deposit untuk menyimpan pesanan; user 2 Nov 2026 |
| D-025 | Accepted | Pesanan boleh COMPLETED namun masih UNPAID/PARTIAL | Progres pengerjaan dan status pembayaran dipisah |
| D-026 | Accepted (scope) | Belum ada kasus pembatalan yang dilaporkan; implementasi cancel/refund setelah MVP bila diperlukan | Tidak menciptakan aturan refund tanpa dasar |

## Rencana tindak lanjut
1. Konfirmasi keputusan **Open** yang masih dibutuhkan untuk MVP (D-017 s.d. D-020 dan D-022 jika relevan). Refund D-014 **Deferred** dan diskon/pajak D-021 di luar MVP.
2. Jika pembatalan/refund benar-benar dibutuhkan kelak, rancang dan setujui aturannya sebelum implementasi; tidak diperlukan untuk migration core MVP.
3. Core Laravel setup boleh dimulai sekarang dengan pembayaran 0..N per order, DP opsional, dan tanpa fitur CANCELLED/refund.
4. Jika sebuah keputusan mengubah tabel, perbarui [DATABASE](DATABASE.md), [BUSINESS_RULES](BUSINESS_RULES.md), [PRD](PRD.md) dan tes terkait.

**Design baseline ongkir:** `order_items.shipping_mode` (`INCLUDED`/`SEPARATE`) dan `order_items.shipping_fee` (Rupiah bulat). Mode ini boleh berbeda antar-item dalam satu pesanan. Biaya aktual pengiriman tidak dianggap sama dengan ongkir yang ditagihkan. **Tidak ada discount/tax fields atau kalkulasi diskon/pajak pada MVP.**

## Implementasi Phase 1
Kerangka resmi Laravel 12 telah ditambahkan ke repo, bersama halaman login/dashboard dan **file migration** core. Migrasi **belum dieksekusi** ke MySQL lokal, tidak ada kredensial admin default atau data pelanggan asli di repo. Lihat [LOCAL_SETUP.md](LOCAL_SETUP.md) untuk verifikasi runtime. PHP 8.2+ diperlukan.

