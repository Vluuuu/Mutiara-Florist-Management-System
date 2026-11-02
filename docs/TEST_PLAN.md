# Acceptance & Test Plan — MFMS
**Status:** rancangan kasus uji. Tidak ada tes yang dinyatakan sudah dijalankan.

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
| T-12 | Cancellation | Batalkan order tanpa pembayaran | CANCELLED, tidak hilang permanen |
| T-13 | Cancellation | Batalkan order yang sudah DP | Ditolak pada MVP |
| T-14 | Audit | Void payment/expense salah input | Alasan/waktu/aktor tercatat |
| T-15 | Expenses | Catat pengeluaran 100k | Nilai kas keluar bertambah, nilai penjualan tetap |
| T-16 | Reports | Order tanggal A dibayar tanggal B | Masuk penjualan A, penerimaan B |
| T-17 | Reports | Saat filter periode | Piutang diberi label snapshot saat ini |
| T-18 | Reports | Ekspor Excel | Nilai sesuai tampilan dan format Rupiah terbaca |
| T-19 | Data safety | File .env, SQL, data pelanggan asli | Tidak ikut commit |
| T-20 | Restore | Backup terenkripsi diverifikasi | Restore sukses pada DB uji, row counts/checksum sesuai |

## Exit gate Phase 0
- Rancangan ERD, aturan pembayaran dan kriteria penerimaan konsisten.
- Aturan pembatalan/refund, ongkir/diskon, pengiriman ganda telah ditanyakan ke pengguna.
- Hal yang belum disetujui tetap diberi label OPEN; tidak diam-diam ditambahkan ke MVP.

## Exit gate sebelum data usaha nyata dimasukkan
- Semua T-01 s.d. T-20 yang relevan pada scope rilis lulus.
- Restore teruji, rahasia tidak ada di Git, migrasi dari nol berhasil, UI divalidasi operator.
- SOP backup dan penanganan kesalahan input tersedia.

Tidak ada hitungan tes PASS sebelum tes benar-benar dibuat dan dijalankan.
