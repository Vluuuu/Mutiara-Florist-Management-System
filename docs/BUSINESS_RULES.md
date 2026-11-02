# Business Rules — Mutiara Florist Management System

**Versi:** v0.3 (2 November 2026) — pengiriman per item  
**Status:** Aturan inti sebagai **baseline desain**. Kebijakan refund, ongkir/diskon, dan beberapa skenario pembatalan **belum disetujui**. Jangan mengklaim sudah menjadi kebijakan operasional.

## A. Alur pesanan

1. Operator memilih pelanggan yang sudah ada atau membuat pelanggan baru.
2. Pesanan harus memiliki paling sedikit satu item bunga dengan jenis, penerima ("Untuk"), pengirim ucapan ("Dari"), kuantitas, dan harga satuan.
3. Detail **penerima, pengirim ucapan, tanggal kirim, dan lokasi tujuan** ditentukan untuk setiap item karena satu pemesan dapat memilih tanggal/alamat berbeda dalam satu order (dikonfirmasi operator).
4. Satu baris item merupakan kelompok bunga dengan **tanggal dan lokasi pengiriman yang sama**. Jika tanggal/lokasi berbeda, pisahkan ke item lain meskipun jenis bunganya sama.
5. Nomor pesanan unik dihasilkan backend; jangan menggunakan "jumlah order + 1" yang rawan bentrok.
6. Total rupiah dihitung pada server, bukan menerima nominal total mentah yang bisa dimanipulasi browser.

Status pengerjaan **setiap item**: `NEW` → `PROCESSING` → `READY` → `DELIVERED`. Status pesanan adalah ringkasan dari item-itemnya: baru, diproses (termasuk progres campuran), siap (semua item READY), selesai (semua item DELIVERED), atau dibatalkan seluruhnya jika belum ada pembayaran. Pengiriman sebagian **tidak membuat seluruh pesanan dianggap selesai**. Perbaikan status manual perlu audit. Status bayar tetap terpisah.

## B. Nilai tagihan

- `item_subtotal = quantity × unit_price`.
- `order_total = Σ item_subtotal`. Total harus positif pada MVP.
- Kolom `orders.total_amount` hanya boleh diperbarui oleh service dalam transaksi MySQL yang sama dengan perubahan item.
- Setelah DP diterima, perubahan harga/jumlah tidak boleh membuat total pesanan lebih kecil daripada jumlah uang yang sudah tercatat. Revisi harus terdata di audit.
- Belum ada aturan untuk ongkir, diskon, pajak atau gratisan. **Jangan** tambahkan angka otomatis ke tagihan sebelum ada keputusan.

## C. Pembayaran

- Pencatatan penerimaan uang adalah **event pembayaran**; satu pesanan dapat memiliki banyak event.
- Satu event memiliki nilai positif, tanggal pembayaran, metode, referensi opsional, dan siapa yang mencatat.
- Event dengan `status = POSTED` dihitung sebagai penerimaan. `VOIDED` berarti pencatatan salah yang dibatalkan dengan alasan dan audit; **bukan** bukti pengembalian uang kepada pelanggan.
- Status bayar **turunan**, bukan dua checkbox seperti di Sheets:
  - `UNPAID` jika jumlah POSTED = 0.
  - `PARTIAL` jika 0 < jumlah POSTED < total tagihan.
  - `PAID` jika jumlah POSTED = total tagihan.
- Tidak menerima pembayaran lebih besar dari saldo tagihan. Pengecekan saldo dan insert payment harus memakai transaction dan lock pada baris order.
- Cegah pengiriman form ganda menggunakan idempotency key unik per aksi. **Dua pembayaran dengan nominal sama tetap boleh** bila merupakan dua aksi yang benar-benar berbeda.
- Koreksi nilai pembayaran dilakukan dengan void beserta alasan/audit, lalu catat pembayaran yang benar bila sesuai. Tidak ada hard delete.

### Contoh perhitungan
```text
Order terdiri dari 2 item: Rp500.000 dan Rp300.000
Total tagihan: Rp800.000
DP diterima: Rp200.000
Status: PARTIAL | Sisa: Rp600.000
Pelunasan diterima: Rp600.000
Status: PAID | Sisa: Rp0
```

## D. Pembatalan dan refund: batas aman sementara

**Keputusan bisnis masih terbuka.** Agar tidak salah menangani uang, pendekatan MVP yang diusulkan:

- Order **belum dibayar** dapat dibatalkan, dengan alasan dan jejak audit. Status menjadi `CANCELLED`, tanpa penghapusan data.
- Order dengan pembayaran POSTED **tidak dapat dibatalkan melalui UI** hingga kebijakan DP hangus, refund, biaya pembatalan, dan penyajian di laporan disepakati.
- Order yang sudah `COMPLETED` tidak dapat dibatalkan/diubah sembarangan.
- Refund tidak diperlakukan sebagai `expenses` operasional biasa tanpa model dan aturan yang jelas.
- Jika benar-benar sudah ada uang dikembalikan, jangan gunakan void untuk menyamarkan kejadian tersebut.

Sebelum merilis pembatalan order berbayar, tentukan: persentase/refund penuh atau parsial, bagaimana DP hangus dicatat, jenis perubahan status yang diizinkan, serta apakah butuh entitas `refunds` terpisah.

## E. Pengeluaran

- Catat **uang usaha yang benar-benar dikeluarkan**, bukan utang dagang yang belum dibayar.
- Setiap pengeluaran harus memiliki tanggal, kategori, nominal positif, keterangan, dan operator pencatat.
- Pengeluaran bisa di-void dengan alasan dan audit bila salah input; belum perlu sistem akuntansi double-entry.
- Kategori biaya dinonaktifkan, bukan dihapus permanen bila telah digunakan.

## F. Definisi metrik dan periode laporan

| Metrik | Definisi | Periode |
| --- | --- | --- |
| Jumlah order aktif | Orders non-CANCELLED | order_date |
| Nilai penjualan pesanan | SUM(total_amount) orders non-CANCELLED | order_date |
| Penerimaan uang | SUM(payments amount WHERE POSTED) | payment_date |
| Pengeluaran uang | SUM(expenses amount WHERE POSTED) | expense_date |
| Selisih kas sederhana | Penerimaan uang - pengeluaran uang | tanggal arus kas |
| Piutang saat ini | SUM(max(order total - payments POSTED, 0)) untuk order aktif | snapshot saat dilihat |

**Penting:** nilai penjualan bukan uang masuk; DP dan pelunasan dihitung tepat sekali dalam uang masuk. Selisih kas sederhana **bukan laba bersih**. Jangan menampilkan "piutang per akhir bulan" jika belum punya rekonstruksi saldo historis. Koreksi/void yang sah dapat mengubah jumlah historis menurut tanggal transaksi; audit menyimpan jejak tindakan.

## G. Validasi input dan keamanan

- Jumlah item > 0; harga satuan >= 0; total order > 0; nilai pembayaran/pengeluaran > 0. **Tanggal kirim dan lokasi tujuan wajib per item**, bukan sekali untuk seluruh pesanan.
- Perhitungan menggunakan integer Rupiah + validasi overflow.
- Validasi di Laravel backend walaupun form sudah memiliki validasi JS.
- Penghapusan permanen data keuangan tidak tersedia dalam antarmuka biasa.
- Operator harus login. Password hash, CSRF, session safety, dan izin akses untuk lampiran.
- Gunakan data simulasi di repo dan tes; informasi pelanggan asli hanya ada di database lokal.
- Backup konsisten harus mencakup database, serta lampiran jika fitur lampiran aktif; uji restore di lingkungan terpisah.

## H. Acceptance scenarios (sebelum implementasi)

| ID | Skenario | Hasil yang diharapkan |
| --- | --- | --- |
| BR-01 | Order 2 item @500k dan @300k | Total 800k |
| BR-02 | DP 200k | Status PARTIAL, piutang 600k |
| BR-03 | Bayar 600k berikutnya | Status PAID, piutang 0 |
| BR-04 | Bayar lagi 10k pada order lunas | Ditolak |
| BR-05 | Dua request dengan idempotency key sama | Paling banyak 1 payment dibuat |
| BR-06 | Dua payment sah masing-masing 100k dengan key berbeda | Keduanya masuk jika saldo cukup |
| BR-07 | Order belum dibayar dibatalkan | Tetap tercatat, tidak masuk penjualan aktif |
| BR-08 | Pembatalan order yang sudah ada DP | Ditolak sampai kebijakan ditetapkan |
| BR-09 | Pengeluaran 100k | Pengeluaran bertambah; tidak mengubah nilai penjualan |
| BR-10 | Ubah nilai item sehingga total < sudah dibayar | Ditolak |
| BR-11 | Void pembayaran salah input dengan alasan | Penerimaan terkoreksi; audit tidak hilang |
| BR-12 | Pembayaran paralel pada saldo tersisa sama | Total POSTED tidak melebihi tagihan |
| BR-13 | Satu order dua item dengan lokasi/tanggal pengiriman berbeda | Kedua jadwal dan tujuan tersimpan per item tanpa saling menimpa |
| BR-14 | Hanya item pertama dari dua item sudah DELIVERED | Order belum berstatus COMPLETED |
| BR-15 | Dua item dengan jenis sama namun tanggal berbeda | Tetap dua item berbeda dan tidak digabung otomatis |

## I. Keputusan pemilik/operator yang masih dibutuhkan

1. Pada pesanan dengan DP, apakah uang bisa dikembalikan? Dalam kondisi apa saja?
2. Apakah ongkir dan diskon biasanya dicatat terpisah dari harga bunga?
3. Kategori pengeluaran, metode pembayaran, dan rekening yang benar-benar digunakan?
4. Apakah pesanan yang sudah dibayar penuh bisa diperbaiki, dibatalkan, atau diganti?
5. Apakah dibutuhkan jam pengiriman spesifik (di luar tanggal) dan status kurir? **Belum diputuskan**.

Rangkuman status masing-masing keputusan ada di [DECISIONS.md](DECISIONS.md). Diagram alur: [WORKFLOWS.md](WORKFLOWS.md).
