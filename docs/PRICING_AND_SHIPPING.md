# Harga dan Ongkos Kirim — MFMS

**Rancangan:** v0.4 · 2 November 2026  
**Keputusan pengguna yang dikonfirmasi:** ongkos kirim **kadang sudah termasuk harga bunga**, kadang **ditagihkan terpisah**. Item bunga dalam satu pesanan dapat memiliki tanggal dan tujuan kirim berbeda.

## 1. Keputusan desain

**Satu item order merepresentasikan kelompok bunga dengan satu tanggal dan satu lokasi pengiriman.** Pilihan ongkir disimpan **per item**, bukan satu kolom ongkir total pada header order, agar sebuah order dapat memuat item dengan kebijakan pengiriman berlainan. Ini merupakan keputusan desain teknis untuk memenuhi kebutuhan usaha, bukan pernyataan bahwa pelanggan selalu menerima ongkir berbeda untuk setiap bunga.

Field baru pada `order_items`:

| Kolom | Tipe usulan | Ketentuan |
| --- | --- | --- |
| `shipping_mode` | VARCHAR(12) | Wajib: `INCLUDED` atau `SEPARATE` |
| `shipping_fee` | BIGINT UNSIGNED | Rupiah bulat, NOT NULL, default 0; satu biaya per baris item/pengiriman, **bukan per unit bunga** |

Arti status:
- **INCLUDED**: ongkir **tidak ditagihkan sebagai baris tambahan**; harga produk yang ditulis operator telah mencakup atau menyerap biaya pengirimannya. `shipping_fee = 0`.
- **SEPARATE**: biaya kirim **ditagihkan tambahan** melalui order kepada pelanggan. `shipping_fee > 0`; uang ini ditagih dan diterima oleh florist, bukan pembayaran langsung pelanggan ke kurir.
- Jika tarif yang tadinya terpisah dibebaskan, gunakan `INCLUDED` dengan `shipping_fee = 0`; UI boleh menyebut "Tidak ditagih terpisah" agar tidak menjanjikan gratis.
- Satu pesanan boleh berisi gabungan item `INCLUDED` dan `SEPARATE` dengan tujuan/tanggal berbeda.

**Belum menjadi fitur MVP:** ongkir yang dibayar pelanggan langsung ke kurir (bukan ke florist), tarif otomatis berdasarkan wilayah/jarak, berat, kurir, atau pajak. Jika proses itu nyata terjadi, butuh aturan tambahan sebelum mencatat transaksi tersebut.

## 2. Rumus jumlah tagihan

```text
product_subtotal(item)   = quantity × unit_price
shipping_charge(item)   = 0 jika INCLUDED, shipping_fee jika SEPARATE
item_billable_total     = product_subtotal(item) + shipping_charge(item)

products_total(order)   = Σ product_subtotal(item)
shipping_total(order)   = Σ shipping_charge(item)
orders.total_amount     = products_total + shipping_total

payments_received       = Σ payments.amount dengan status POSTED
outstanding             = orders.total_amount - payments_received
```

- `unit_price` adalah harga **per unit bunga** dalam Rupiah. Untuk item INCLUDED harga itu telah memuat ongkir yang disepakati; tidak membuat charge ongkir kedua.
- `shipping_fee` adalah ongkir **yang ditagihkan pelanggan** pada baris pengiriman itu, bukan ongkos aktual yang dibayarkan kepada kurir.
- `orders.total_amount` menjadi nilai materialisasi/cache dari detail item; tidak boleh diinput bebas di frontend.
- Jangan gunakan FLOAT/DOUBLE; gunakan integer Rupiah dan validasi nilai serta overflow di server.
- **Diskon, pajak, dan biaya lain** belum punya aturan yang disetujui; belum ditambahkan dalam rumus.

## 3. Contoh perhitungan

| Item | Qty × Harga bunga | Mode | Ongkir tambahan | Subtotal tagihan |
| --- | ---: | --- | ---: | ---: |
| Papan ucapan untuk 5 Nov di Jakarta | 1 × Rp800.000 | INCLUDED | Rp0 | Rp800.000 |
| Buket untuk 7 Nov di Tangerang | 2 × Rp250.000 | SEPARATE | Rp75.000 | Rp575.000 |
| **Total** | **Rp1.300.000** | | **Rp75.000** | **Rp1.375.000** |

Jika pelanggan bayar DP Rp375.000, total sudah dibayar Rp375.000 dan sisa tagihan Rp1.000.000. Saat pelunasan Rp1.000.000, status menjadi PAID.

Untuk 2 buket pada satu tanggal/lokasi, ongkir Rp75.000 **hanya dikenakan sekali untuk item tersebut**, bukan dua kali. Jika pengiriman dibagi menjadi dua tujuan/tanggal, buat dua item agar ongkir per pengiriman tidak rancu.

## 4. Pemasukan, pengeluaran dan laporan

- **Nilai bunga:** `Σ quantity × unit_price` (bukan termasuk ongkir SEPARATE).
- **Ongkir ditagihkan:** `Σ shipping_fee` untuk item SEPARATE.
- **Total nilai pesanan:** nilai bunga + ongkir ditagihkan.
- **Uang masuk:** seluruh payment yang POSTED, termasuk pembayaran untuk tagihan bunga dan ongkir. Jangan menambahkan ongkir sekali lagi ke total payment.
- **Biaya kirim nyata yang ditanggung usaha:** catat melalui `expenses` pada kategori pengiriman/transportasi ketika uang benar-benar keluar, jika memang dibayar usaha; **jangan otomatis menyamakan** biaya tersebut dengan `shipping_fee` yang ditagihkan.
- **Selisih kas:** seluruh uang masuk minus pengeluaran aktual; bukan laporan laba bersih.

Contoh: ongkir ditagih Rp75.000, tetapi ongkir yang dibayar ke kurir Rp55.000. Catat **Rp75.000** sebagai bagian dari tagihan order dan **Rp55.000** sebagai pengeluaran yang terpisah ketika dibayar. Bila ongkir sudah INCLUDED, ongkir tambahan pada invoice tetap Rp0; biaya yang dikeluarkan usaha tetap dapat dicatat sebagai pengeluaran.

## 5. Validasi dan perubahan harga

- `quantity > 0`; `unit_price >= 0`; total order wajib positif.
- `shipping_mode = INCLUDED` mengharuskan `shipping_fee = 0`.
- `shipping_mode = SEPARATE` mengharuskan `shipping_fee > 0`.
- Tidak boleh ada biaya negatif, nominal yang melebihi batas BIGINT, atau overflow pada perkalian/penjumlahan.
- **Satu baris item = satu jadwal/lokasi**. Jangan menambah ongkir ke per-unit price otomatis jika mode SEPARATE.
- Saat item/ongkir diubah setelah ada DP, lakukan transaksi database yang mengunci order, hitung ulang total, pastikan **total baru >= jumlah payment POSTED**. Catat perubahan harga dan alasan di audit.
- Jika edit mengubah rincian tanggal/lokasi, pastikan riwayat perubahan operasional tetap dapat dilacak sesuai kebijakan audit.

## 6. Perilaku UI yang direncanakan

Pada setiap baris `order_items`: *jenis bunga, qty, harga satuan, tanggal kirim, lokasi, penerima, pengirim, jenis ongkir [Sudah termasuk | Ditagihkan terpisah], nilai ongkir (hanya muncul jika terpisah)*.

Di ringkasan form/detail pesanan:
- Subtotal bunga
- Total ongkir tambahan
- **Total tagihan**
- Sudah dibayar
- Sisa tagihan

Tidak ada perhitungan tarif otomatis pada MVP. Operator memasukkan ongkir berdasarkan kesepakatan dengan pembeli.

## 7. Keputusan yang belum final

- **Discount/potongan harga:** apakah dibutuhkan per item/order dan bagaimana syaratnya?
- **Pengiriman pihak ketiga:** apakah pelanggan pernah membayar ongkir langsung ke kurir di luar pembayaran florist?
- **Refund/pembatalan:** bagaimana pengembalian DP atau ongkir yang sudah diterima bila pengiriman dibatalkan?
- **Pajak:** jika memang dibutuhkan, aturan harus disepakati dahulu.
- **Harga bunga termasuk ongkir:** tidak ada breakdown nominal ongkir tersembunyi tanpa data tambahan yang memang dicatat.

Rujukan: [DATABASE](DATABASE.md), [BUSINESS_RULES](BUSINESS_RULES.md), [TEST_PLAN](TEST_PLAN.md), dan [DECISIONS](DECISIONS.md).
