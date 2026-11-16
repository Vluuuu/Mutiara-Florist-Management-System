# Phase 3.3.3A — Migrasi Daftar & Detail Pesanan React (Inertia.js + TypeScript)

## Ringkasan
Fase 3.3.3A mengimplementasikan antarmuka pembacaan data **Daftar Pesanan dan Detail Pesanan** berbasis **React 19 + TypeScript + Inertia.js v3** pada grup route terisolasi `/ui-orders`. Tampilan ini bekerja berdampingan dengan modul Pesanan Blade lama (`/orders`), mengekstrak logika query dan penyiapan detail ke service bersama (`OrderService`), dan mempertahankan 100% integritas aturan bisnis pesanan serta kalkulasi keuangan backend Laravel.

Aksi pembuatan pesanan baru, edit pesanan, dan pencatatan/void pembayaran tetap diarahkan ke halaman Blade lama menggunakan navigasi native HTML (`<a>`) agar integritas transaksi, kunci baris database (`lockForUpdate`), dan audit log tetap terjaga.

---

## Arsitektur & Aturan Bisnis yang Dipertahankan

### 1. Service Bersama (`App\Services\OrderService`)
Ekstraksi logika query daftar dan penyiapan data detail ke dalam method reusable:
- `paginate(?string $search = null, ?string $status = null, int $perPage = 10): LengthAwarePaginator`:
  - Menangani pencarian nomor pesanan dan nama pelanggan dengan perlindungan literal escaping untuk karakter `'!'`, `'%'`, dan `'_'` (`str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search)`).
  - Filter status pengerjaan pesanan (`NEW`, `PROCESSING`, `READY`, `COMPLETED`).
  - Menghitung jumlah item pesanan (`items_count`).
  - Mengagregasi pembayaran yang hanya berstatus `POSTED` (`withSum(['payments as paid_amount' => fn($q) => $q->where('status', 'POSTED')], 'amount')`).
  - Digunakan secara bersama oleh `OrderController::index` (Blade) dan `UiOrderController::index` (React) sehingga hasil daftar pesanan 100% konsisten.
- `getOrderDetail(Order $order): array`:
  - Eager load relasi pelanggan (`customer:id,name,phone`), item pesanan (`items` urut `id`), dan riwayat pembayaran (`payments.recordedBy:id,name` urut `id` desc).
  - Menghitung `flower_total` dari `sum(quantity * unit_price)`.
  - Menghitung `shipping_total` dari `sum(shipping_mode === 'SEPARATE' ? shipping_fee : 0)`.
  - Menghitung `received` dari `payments->where('status', 'POSTED')->sum('amount')`. Pembayaran `VOIDED` secara mutlak dikecualikan.
  - Menghitung `outstanding = max(total_amount - received, 0)` sehingga tidak pernah bernilai negatif.
  - Menghitung status pembayaran: `UNPAID` (Belum bayar) jika `received == 0`, `PAID` (Lunas) jika `received >= total_amount`, atau `PARTIAL` (Sebagian).

### 2. Aturan Bisnis Pesanan & Pengiriman
- Setiap pesanan dapat memuat 1–20 item bunga.
- Setiap item bunga dapat memiliki jadwal kirim, penerima, pengirim, lokasi pengiriman, dan mode ongkir yang berbeda.
- Mode ongkir `INCLUDED`: biaya ongkir tambahan adalah Rp0 (ongkir sudah termasuk dalam harga bunga).
- Mode ongkir `SEPARATE`: biaya ongkir tambahan dihitung satu kali per item, **bukan** dikalikan dengan jumlah kuantitas bunga.
- Status pengerjaan pesanan (`NEW`, `PROCESSING`, `READY`, `COMPLETED`) independen dari status pembayaran (`UNPAID`, `PARTIAL`, `PAID`).
- Pesanan hanya berstatus `COMPLETED` bila seluruh item bunganya sudah berstatus `DELIVERED`.

### 3. Route Terisolasi (`/ui-orders`)
- `GET /ui-orders` (`ui-orders.index`): Menampilkan daftar pesanan dengan filter pencarian, filter status pengerjaan, dan paginasi 10 pesanan per halaman.
- `GET /ui-orders/{order}` (`ui-orders.show`): Menampilkan detail pesanan lengkap, rincian tiap item bunga, ringkasan nilai keuangan, dan riwayat pembayaran (read-only).

### 4. Navigasi Silang React – Blade
Operasi penulisan / mutasi data yang belum dimigrasikan diarahkan ke antarmuka Blade lama:
- Tambah pesanan baru: `<a href="/orders/create">`
- Edit pesanan: `<a href="/orders/{id}/edit">`
- Catat pembayaran baru atau koreksi void: `<a href="/orders/{id}#pembayaran">`
- Tampilan daftar Blade lama: `<a href="/orders">`
- Tampilan detail Blade lama: `<a href="/orders/{id}">`

---

## Hasil Pengujian & QA

### 1. PHPUnit / Pest Feature Tests
- Perintah: `php artisan test`
- Hasil: **95 passed (978 assertions)**, durasi ~4.5s
- Termasuk 10 tes pada `UiOrderTest`:
  1. `guests cannot access ui order pages`: Tamu tanpa login dialihkan ke `/login`.
  2. `admin can view orders list with inertia`: Admin dapat melihat daftar pesanan dengan Inertia.
  3. `search filters orders by number and customer name with literal wildcards`: Pencarian literal dengan escaping `%` dan `_`.
  4. `filter by status`: Filter status pengerjaan (`READY`, `COMPLETED`, dll).
  5. `pagination limits to ten orders per page`: Paginasi 10 pesanan per halaman.
  6. `order detail view shows complete item and shipping breakdown`: Tampilan detail pesanan dengan kalkulasi bunga, ongkir `INCLUDED` vs `SEPARATE`, dan total tagihan.
  7. `payment calculations and voided payments are excluded`: Verifikasi pembayaran `POSTED` vs `VOIDED` (voided tidak masuk uang diterima dan sisa tagihan).
  8. `outstanding never becomes negative on overpayment`: Sisa tagihan tidak pernah negatif.
  9. `empty state is rendered when no orders exist`: Tampilan empty state saat tidak ada data pesanan.
  10. `order detail handles order with notes and empty payments`: Penanganan pesanan tanpa riwayat pembayaran.

### 2. TypeScript Typecheck
- Perintah: `npm run typecheck`
- Hasil: **PASS (0 errors)**

### 3. Vite Production Build
- Perintah: `npm run build`
- Hasil: **PASS (exit code 0)**

### 4. End-to-End Browser QA (Playwright)
- Pengujian otomatis via Playwright Chromium pada server terisolasi dengan data sintetis:
  - **Hasil:** **56 checks PASS / 0 FAIL**
  1. `PASS` Tamu ke `/ui-orders` dialihkan ke `/login`.
  2. `PASS` Tamu ke `/ui-orders/1` dialihkan ke `/login`.
  3. `PASS` Login admin sintetis berhasil.
  4. `PASS` GET `/ui-orders` mengembalikan HTTP 200.
  5. `PASS` Heading utama "Pesanan" dan subjudul penjelasan ter-render di React.
  6. `PASS` Tabel pesanan ter-render dengan 10 baris pada halaman 1.
  7. `PASS` Kolom nomor pesanan, pelanggan, status pengerjaan, total tagihan (Rp), dan status pembayaran terverifikasi.
  8. `PASS` Filter pencarian nama pelanggan ("Sinar") mengembalikan hasil presisi (1 order).
  9. `PASS` Tombol Reset mengembalikan 10 baris halaman 1.
  10. `PASS` Filter status `COMPLETED` menampilkan pesanan berstatus Selesai dan Lunas.
  11. `PASS` Paginasi halaman 2 menampilkan sisa 4 pesanan (total 14 pesanan).
  12. `PASS` Navigasi ke detail pesanan (`/ui-orders/1`) berhasil.
  13. `PASS` Header detail pesanan memuat nomor pesanan dan nama pemesan.
  14. `PASS` 4 Kartu metrik: Total tagihan (`Rp1.900.000`), Uang diterima (`Rp1.000.000`), Sisa tagihan (`Rp900.000`), Status pembayaran (`Sebagian`).
  15. `PASS` Kartu pengerjaan pesanan menampilkan status `Diproses` dan catatan pesanan.
  16. `PASS` Item 1 (Papan Bunga): Kuantitas 2, subtotal `Rp1.500.000`, ongkir termasuk `Rp0`.
  17. `PASS` Item 2 (Buket Meja): Kuantitas 1, subtotal `Rp350.000`, ongkir terpisah `Rp50.000`.
  18. `PASS` Rincian nilai pesanan: total bunga `Rp1.850.000`, total ongkir tambahan `Rp50.000`, total tagihan `Rp1.900.000`.
  19. `PASS` Riwayat pembayaran: Pembayaran `POSTED` tercatat `Rp1.000.000` via Transfer Bank; Pembayaran `VOIDED` menampilkan alasan koreksi dan timestamp WIB.
  20. `PASS` Navigasi silang ke Blade: link "Buka di Blade lama" (`/orders/1`), link "+ Catat pembayaran" (`/orders/1#pembayaran`), link "Edit pesanan" (`/orders/1/edit`).
  21. `PASS` Navigasi silang pada Index: link "Tampilan Blade lama" (`/orders`), link "+ Buat pesanan" (`/orders/create`).
  22. `PASS` Pengujian responsif mobile (viewport 390x844 - iPhone 13): tombol hamburger menu tampil, drawer navigasi responsif, tabel horizontal scrollable tanpa visual overflow.
  23. `PASS` Konsol browser bersih dari error (0 error).
- Bukti tangkapan layar tersimpan di `storage/app/`:
  - `qa-orders-index-desktop.png`
  - `qa-orders-show-desktop.png`
  - `qa-orders-index-mobile.png`

---

## Keamanan Data & Lingkungan
- Seluruh pengujian browser dijalankan pada database pengujian terisolasi (SQLite) dengan data sintetis.
- Database lokal utama MariaDB (port 3307) dan akun admin operasional sama sekali tidak disentuh atau diubah password-nya.
- Tidak ada kredensial atau data pribadi yang dimasukkan ke repository.
- Seluruh file pengujian sementara (`database/qa_browser.sqlite`, `.env.qa_browser`, `qa_orders.mjs`) telah dibersihkan.
