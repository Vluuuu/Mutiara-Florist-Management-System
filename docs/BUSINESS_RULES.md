# Aturan Bisnis — Pesanan dan Pembukuan
**Status:** Draft v0.1. Aturan yang belum dipastikan ditandai **PERLU KEPUTUSAN**.

## 1. Pemesanan
- Pemesanan dibuat oleh operator internal, bukan pelanggan melalui checkout publik.
- Satu pelanggan dapat membuat banyak pesanan.
- Satu pesanan dapat berisi banyak item bunga dengan penerima, pengirim ucapan, jumlah, dan harga masing-masing.
- Status pengerjaan contoh: `NEW`, `PROCESSING`, `READY`, `COMPLETED`, `CANCELLED`.
- Status pengerjaan **tidak sama** dengan status pembayaran.
- Data pengiriman wajib cukup jelas untuk pengerjaan nyata; detail validasi disepakati saat form difinalisasi.

## 2. Nilai pesanan
- Nominal dalam Rupiah bulat (`BIGINT`), bukan floating-point.
- `total_item = quantity × unit_price`; total tagihan berasal dari penjumlahan item yang valid.
- Ongkir, diskon, dan pajak **belum diputuskan**. Jangan diam-diam menambahkan logikanya.
- Setelah pembayaran diterima, revisi total pesanan harus melalui prosedur terkontrol agar tidak menimbulkan saldo negatif atau riwayat tidak konsisten.

## 3. Pembayaran
- Setiap penerimaan uang adalah satu baris `payments`; DP dan pelunasan dapat tercatat terpisah.
- Pembayaran valid harus positif dan tidak melebihi saldo terutang (hingga prosedur lebih bayar/refund dibuat).
- `sudah_dibayar = SUM(payments valid)`.
- `sisa_tagihan = total_tagihan - sudah_dibayar`.
- `Belum Dibayar` bila pembayaran 0; `DP/Sebagian` bila >0 dan < total; `Lunas` bila sama dengan total.
- Status bayar dihitung, bukan dua checkbox manual yang dapat saling bertentangan.
- Cegah submit ganda dan gunakan transaksi MySQL untuk pencatatan pembayaran.
- Koreksi pembayaran tidak boleh menghilangkan jejak historis; desain reversal/void **PERLU KEPUTUSAN**.

## 4. Pengeluaran dan laporan
- Pengeluaran memiliki tanggal, kategori, nominal, dan keterangan.
- **Nilai penjualan:** jumlah nilai pesanan yang memenuhi definisi transaksi penjualan pada periode tanggal order.
- **Penerimaan kas:** penjumlahan pembayaran valid berdasarkan tanggal pembayaran; **bukan** menjumlahkan nilai pesanan sekali lagi.
- **Pengeluaran kas:** transaksi pengeluaran berdasarkan tanggal pengeluaran.
- **Selisih kas operasional sederhana:** penerimaan kas - pengeluaran kas. Ini **bukan otomatis laba bersih** karena tidak mencakup seluruh pengakuan biaya/akuntansi.
- **Piutang:** jumlah sisa tagihan pesanan aktif sesuai aturan pembatalan yang nanti ditetapkan.
- Setiap metrik harus menampilkan periode yang dipilih dan definisi tanggalnya.

## 5. Pembatalan dan pengembalian uang — PERLU KEPUTUSAN
- Apakah pesanan yang belum dibayar boleh dibatalkan langsung?
- Bagaimana menangani pesanan yang sudah DP?
- Apakah DP dapat dikembalikan, hangus, atau diperhitungkan sebagian?
- Bagaimana memisahkan refund dari pengeluaran operasional biasa?
- Apakah pesanan selesai masih boleh diperbaiki dan siapa yang dapat melakukannya?

**Sementara:** jangan implementasikan penghapusan permanen pada pembayaran. Jangan mengasumsikan pesanan dibatalkan otomatis menghapus catatan uang masuk.

## 6. Data lama dan impor — PERLU KEPUTUSAN
- Sheets yang digunakan saat ini memiliki beberapa kolom tidak lengkap/ambigu. Impor harus menggunakan mapping kolom, pratinjau, validasi, deteksi duplikat, dan laporan baris ditolak.
- Nilai harga `?`, status pembayaran kosong, dan tanggal tidak standar tidak boleh dianggap valid secara otomatis.
- Jangan mengunggah data pelanggan asli sebagai fixture, screenshot publik, atau contoh repo.

## 7. Kasus uji minimum
| Skenario | Ekspektasi |
| --- | --- |
| 2 item @ Rp500.000 dan Rp300.000, masing-masing qty 1 | Total Rp800.000 |
| Total Rp800.000, DP Rp200.000 | Status sebagian, sisa Rp600.000 |
| Pelunasan Rp600.000 | Status lunas, sisa Rp0 |
| Pembayaran tambahan Rp10.000 pada pesanan lunas | Ditolak |
| Pembayaran yang sama disubmit dua kali | Tidak tercatat ganda |
| Pengeluaran Rp100.000 | Menambah pengeluaran, tidak mengubah penjualan |
| Pelanggan memesan beberapa order | Riwayat order tetap terpisah |

Dokumen ini menjadi acuan tes dan implementasi, setelah aturan yang belum pasti disahkan.
