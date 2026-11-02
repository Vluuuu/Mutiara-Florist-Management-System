# Rancangan Database (Draft ERD Tekstual)
**Status:** Usulan v0.1; struktur migrasi final belum dibuat.

## 1. Database
MySQL lokal, diakses lewat Eloquent ORM dan Laravel migrations. Gunakan `BIGINT` untuk nominal dalam **Rupiah bulat** (tanpa floating-point). Timestamp pencatatan disimpan secara konsisten; tanggal pesanan, pengiriman, dan pembayaran berbeda secara semantik.

## 2. Entitas dan atribut utama
### `users`
`id` (PK), `name`, `email` (unik), `password`, `created_at`, `updated_at`. Satu akun operator pada awal pengembangan; tidak perlu role matrix.

### `customers`
`id` (PK), `name`, `phone` (nullable), `notes` (nullable), `created_at`, `updated_at`. Nomor telepon tidak otomatis dijadikan unique karena beberapa nama/kontak bisa berbagi nomor.

### `orders`
`id` (PK), `order_number` (unik), `customer_id` (FK), `order_date`, `delivery_date` (nullable), `status`, `total_amount`, `notes`, `created_by` (FK users), timestamps. `total_amount` diperbarui dari item oleh service dalam transaksi atomik (bukan nilai bebas yang tidak tervalidasi).

### `order_items`
`id` (PK), `order_id` (FK), `flower_type`, `recipient`, `sender_name`, `delivery_address` (nullable), `quantity`, `unit_price`, `line_total`, `notes` (nullable), timestamps. Harga dan total tersimpan sebagai Rupiah bulat. Pertanyaan terbuka: perlu tanggal kirim pada item jika berbeda.

### `payments`
`id` (PK), `order_id` (FK), `payment_date`, `amount`, `method` (nullable), `reference` (nullable), `notes` (nullable), `created_by` (FK users), timestamps. Hanya pembayaran tervalidasi yang dihitung. Untuk koreksi, gunakan pembalikan/jejak audit (detail perlu disepakati).

### `expense_categories`
`id` (PK), `name` (unik), `is_active`, timestamps.

### `expenses`
`id` (PK), `expense_category_id` (FK), `expense_date`, `amount`, `description`, `created_by` (FK users), timestamps. Pengeluaran dicatat berdasar uang yang keluar pada tahap awal (bukan utang pemasok).

## 3. Relasi
```text
users     1 --- N orders
users     1 --- N payments
users     1 --- N expenses
customers 1 --- N orders
orders    1 --- N order_items
orders    1 --- N payments
expense_categories 1 --- N expenses
```

## 4. Integritas dan indeks
- `orders.order_number` unique; nomor ditetapkan server, bukan disusun dengan hitung jumlah baris.
- Indeks pada `orders(customer_id, order_date, status)`, `payments(order_id, payment_date)`, dan `expenses(expense_date, expense_category_id)`.
- FK untuk menjaga relasi pelanggan–pesanan–item–pembayaran.
- Batasi `quantity > 0`, `unit_price >= 0`, `amount > 0` untuk pembayaran/pengeluaran.
- Terapkan strategi pembatalan, bukan hard delete untuk transaksi yang telah memengaruhi pembukuan.
- Data pembayaran dan pengeluaran harus dapat ditelusuri; koreksi keuangan tidak menghapus riwayat.

## 5. Perhitungan
```text
line_total      = quantity * unit_price
order_total     = SUM(line_total) dari item pesanan (+ ongkir/-diskon jika kelak disepakati)
paid_amount     = SUM(pembayaran valid untuk order)
outstanding     = MAX(order_total - paid_amount, 0)
payment_status  = UNPAID jika paid_amount=0
                  PARTIAL jika 0 < paid_amount < order_total
                  PAID jika paid_amount=order_total
```
Untuk order dengan total nol, status tidak otomatis disimpulkan lunas: perlakuannya harus ditetapkan.

## 6. Pertanyaan terbuka
- Nama kategori bunga diketik bebas atau dikelola dalam tabel `products`?
- Lokasi dan jadwal kirim satu per order atau per item?
- Ongkir/diskon/pajak, pembatalan/refund, dan perubahan harga setelah DP?
- Foto bukti pembayaran memerlukan tabel `attachments` atau cukup file metadata?
- Apakah impor data lama diperlukan pada rilis pertama?

Tidak membuat migration final sebelum pertanyaan yang memengaruhi skema diselesaikan.
