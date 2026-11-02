# Acceptance & Test Plan — MFMS
**Status:** Pada 2 November 2026, `php artisan test` dijalankan di laptop operator dan menghasilkan **7 PASS (23 assertions, durasi 1,88 detik)**. Empat migrasi dasar berstatus Ran di MariaDB. Hasil ini terbatas pada tes yang sudah diimplementasikan; sebagian besar skenario T-01 s.d. T-38 masih belum diuji.

## Pendekatan
Unit test untuk kalkulasi nominal/status; feature test Laravel untuk controller, autentikasi, form validation, MySQL transactions dan laporan. Tambahkan tes concurrency ber-DATABASE nyata untuk pembayaran.

## Matriks pengujian

| ID | Modul | Skenario | Ekspektasi |
| --- | --- | --- | --- |
| T-01 | Authentication | Pengunjung belum login membuka halaman internal | Dialihkan ke login |
| T-02 | Customers | Tambah, cari, dan edit pelanggan | Data tersimpan dan tampil kembali |
| T-03 | Orders | Order berisi 2 item dengan 1 pelanggan | 1 order + 2 item + total benar |
| T-04 | Orders | Satu item tidak valid | Tidak ada header/item setengah tersimpan |
| T-05 | Orders | Ubah harga ketika sudah DP melebihi total baru | Ditolak tanpa mutasi data |
| T-06 | Payments | Order 800k, DP 200k | PARTIAL, sisa 600k |
| T-07 | Payments | Pelunasan 600k | PAID, sisa 0 |
| T-08 | Payments | Pembayaran 10k setelah lunas | Ditolak |
| T-09 | Payments | Submit dua kali idempotency key sama | Satu pembayaran tercatat |
| T-10 | Payments | Submit dua pembayaran valid dengan key berbeda | Keduanya tercatat bila saldo cukup |
| T-11 | Payments | Dua request paralel pada saldo 100k masing-masing 100k | Paling banyak satu diterima |
| T-12 | MVP Scope | Coba mencari aksi pembatalan pada order belum dibayar | Tidak ada tombol/endpoint pembatalan pada MVP |
| T-13 | MVP Scope | Coba mencari aksi pembatalan/refund pada order berbayar | Tidak ada tombol/endpoint pembatalan atau refund pada MVP |
| T-14 | Audit | Void payment/expense salah input | Alasan/waktu/aktor tercatat |
| T-15 | Expenses | Catat pengeluaran 100k | Nilai kas keluar bertambah, nilai penjualan tetap |
| T-16 | Reports | Order tanggal A dibayar tanggal B | Masuk penjualan A, penerimaan B |
| T-17 | Reports | Saat filter periode | Piutang diberi label snapshot saat ini |
| T-18 | Reports | Ekspor Excel | Nilai sesuai tampilan dan format Rupiah terbaca |
| T-19 | Data safety | File .env, SQL, data pelanggan asli | Tidak ikut commit |
| T-20 | Restore | Backup terenkripsi diverifikasi | Restore sukses pada DB uji, row counts/checksum sesuai |
| T-21 | Order Items | Dua bunga satu order, tanggal dan tujuan berbeda | Jadwal/tujuan setiap item tetap benar setelah edit, refresh, dan restore |
| T-22 | Order Items | Satu bunga jenis sama dikirim dua tanggal berbeda | Dua baris item terpisah, bukan digabung otomatis |
| T-23 | Fulfillment | Item A DELIVERED, item B belum DELIVERED | Status order bukan COMPLETED |
| T-24 | Fulfillment | Seluruh item DELIVERED | Status order menjadi COMPLETED |
| T-25 | Pricing | Bunga Rp800k mode INCLUDED dengan shipping_fee 0 | Total item tetap Rp800k |
| T-26 | Pricing | 2 bunga @250k, shipping_fee 75k mode SEPARATE | Total item Rp575k; fee tidak dikalikan qty |
| T-27 | Pricing | Order gabungan item INCLUDED 800k dan SEPARATE 575k | Total Rp1.375.000; nilai bunga Rp1.300.000; ongkir tambahan Rp75.000 |
| T-28 | Validation | Mode INCLUDED dengan fee >0 atau SEPARATE dengan fee 0 | Input ditolak server, tidak ada penulisan parsial |
| T-29 | Pricing | Ubah ongkir setelah DP sehingga total baru < payment POSTED | Ditolak atomik dan perubahan diaudit bila sah |
| T-30 | Reports | Ongkir terpisah ditagihkan Rp75k; kurir dibayar Rp55k | Tagihan memuat 75k, expense 55k, uang masuk hanya dari POSTED payments |
| T-31 | Pricing | Item sama jenis tetapi tanggal/lokasi berbeda | Masing-masing ongkir dicatat dan dihitung sekali per pengiriman |
| T-32 | Pricing | Input pesanan normal dengan bunga dan ongkir terpisah | Total = Σ(qty × unit_price + ongkir SEPARATE), tidak ada diskon/pajak |
| T-33 | Scope | Form dan database awal | Tidak mempunyai field diskon/pajak maupun perhitungan otomatisnya |
| T-34 | Order & Payments | Simpan order tanpa pembayaran atau deposit | Berhasil; payments kosong, status UNPAID, piutang = total tagihan |
| T-35 | Order & Payments | Bayar lunas bersamaan dengan pemesanan | Tepat satu payment POSTED dengan nominal penuh, status PAID |
| T-36 | Order & Payments | Order seluruh item DELIVERED tetapi belum menerima uang | Progres order COMPLETED, payment status UNPAID, sisa tagihan tetap ada |
| T-37 | Order & Payments | Order selesai dikirim, pembayaran penuh baru diterima kemudian | Payment berubah PAID dan sisa 0; progres delivery tetap COMPLETED |
| T-38 | Order & Payments | Pencatatan DP dilakukan pada order tertentu, tidak pada order lain | DP bersifat opsional dan status PARTIAL hanya pada order yang benar-benar dibayar sebagian |

## Implementasi tes awal
- `tests/Feature/ExampleTest.php` — redirect dari / ke /login.
- `tests/Feature/AdminAccessTest.php` — proteksi dashboard, registrasi publik 404, login, logout dan kredensial salah.
- `tests/Feature/DashboardTest.php` — total pesanan 1.000.000, pembayaran POSTED 250.000, piutang 750.000, pengeluaran 50.000.
- Ketiga file tes di atas berhasil dijalankan bersama tes unit bawaan, total **7 PASS / 23 assertions**. PHPUnit menggunakan SQLite in-memory melalui `phpunit.xml`; migrasi MariaDB lokal telah berhasil dijalankan terpisah. Belum ada bukti uji rollback pada database uji terpisah, concurrency MySQL, maupun QA visual browser.

## Exit gate Phase 0
- Rancangan ERD, aturan pembayaran dan kriteria penerimaan konsisten.
- Pengiriman berbeda tanggal/tujuan dan ongkir termasuk/terpisah per item sudah disetujui. Pembayaran penuh awal/akhir dan DP opsional adalah pola utama. **Cancel/refund (termasuk bagi order belum bayar) dan diskon/pajak tidak termasuk MVP.**
- Hal yang belum disetujui tetap diberi label OPEN; tidak diam-diam ditambahkan ke MVP.

## Exit gate sebelum data usaha nyata dimasukkan
- Semua T-01 s.d. T-38 yang relevan pada scope rilis lulus.
- Restore teruji, rahasia tidak ada di Git, migrasi dari nol berhasil, UI divalidasi operator.
- SOP backup dan penanganan kesalahan input tersedia.

Rincian contoh dan invariant ongkir lihat [PRICING_AND_SHIPPING.md](PRICING_AND_SHIPPING.md).

Status pengujian selanjutnya harus membedakan PASS tes otomatis dasar dari skenario penerimaan T-01–T-38 yang belum semuanya memiliki implementasi.
