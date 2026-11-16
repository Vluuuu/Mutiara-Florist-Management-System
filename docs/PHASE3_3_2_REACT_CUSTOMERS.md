# Phase 3.3.2 — Migrasi Pelanggan React (Inertia.js + TypeScript)

## Ringkasan
Fase 3.3.2 mengimplementasikan antarmuka modul **Pelanggan (Customer Management)** berbasis **React 19 + TypeScript + Inertia.js v3** pada grup route terisolasi `/ui-customers`. Tampilan ini bekerja berdampingan dengan modul Pelanggan Blade lama (`/customers`), mengekstrak aturan bisnis ke service bersama (`CustomerService`), dan mempertahankan seluruh integritas validasi, aturan bisnis, serta audit log backend Laravel.

## Arsitektur & Aturan Bisnis yang Dipertahankan

1. **Service Bersama (`App\Services\CustomerService`)**
   - Menjadi sumber kebenaran tunggal untuk operasi pelanggan baik untuk controller Blade (`CustomerController`) maupun controller React (`UiCustomerController`):
     - `paginate(?string $search, int $perPage = 10)`: Paginasi 10 pelanggan per halaman. Karakter `'!'`, `'%'`, dan `'_'` pada kata kunci pencarian diperlakukan sebagai karakter literal (`str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search)`).
     - `create(array $data, User $actor)`: Pembuatan pelanggan dalam transaksi database dengan pencatatan audit log `customer.created`.
     - `update(Customer $customer, array $data, User $actor)`: Penguncian baris (`lockForUpdate`), pengecekan field yang kotor/berubah (`getDirty()`), dan pencatatan audit log `customer.updated` dengan daftar field yang berubah.
     - `archive(Customer $customer, User $actor)`: Memeriksa riwayat pesanan (`orders()->exists()`). Jika pelanggan memiliki pesanan, arsip ditolak (mengembalikan `false`). Jika tidak memiliki pesanan, dieksekusi soft delete (`$locked->delete()`) dan dicatat audit log `customer.archived`.

2. **Aturan Validasi Input**
   - Nama pelanggan: Wajib diisi (`required`), string, maksimal 255 karakter.
   - Nomor telepon: Opsional (`nullable`), maksimal 50 karakter. Nomor telepon boleh kembar/sama untuk beberapa pelanggan.
   - Catatan: Opsional (`nullable`), maksimal 2000 karakter.

3. **Grup Route Terisolasi (`/ui-customers`)**
   - `GET  /ui-customers` (`ui-customers.index`): Daftar pelanggan dengan pencarian & paginasi.
   - `GET  /ui-customers/create` (`ui-customers.create`): Form tambah pelanggan baru.
   - `POST /ui-customers` (`ui-customers.store`): Simpan pelanggan baru -> redirect ke detail.
   - `GET  /ui-customers/{customer}` (`ui-customers.show`): Detail pelanggan, total pesanan, waktu WIB, dan aksi arsip.
   - `GET  /ui-customers/{customer}/edit` (`ui-customers.edit`): Form edit pelanggan.
   - `PUT  /ui-customers/{customer}` (`ui-customers.update`): Simpan perubahan -> redirect ke detail.
   - `DELETE /ui-customers/{customer}` (`ui-customers.destroy`): Arsipkan pelanggan -> redirect ke daftar.

4. **Komponen Antarmuka React**
   - [app-sidebar.tsx](file:///D:/xampp/htdocs/Mutiara-Florist-Management-System/resources/js/components/app-sidebar.tsx): Navigasi aktif untuk Pelanggan (`/ui-customers*`), tautan silang ke "Pelanggan Blade lama".
   - [app-layout.tsx](file:///D:/xampp/htdocs/Mutiara-Florist-Management-System/resources/js/layouts/app-layout.tsx): Penanganan flash message sukses (`props.flash.success`) dan pesan kesalahan (`props.flash.error` / `props.errors.customer`).
   - [pagination.tsx](file:///D:/xampp/htdocs/Mutiara-Florist-Management-System/resources/js/components/pagination.tsx): Komponen paginasi responsif dengan penghitung data `from` sampai `to` dari `total`.
   - [Index.tsx](file:///D:/xampp/htdocs/Mutiara-Florist-Management-System/resources/js/pages/Customers/Index.tsx): Tabel data, pencarian real-time dengan tombol reset, empty state kontekstual.
   - [Create.tsx](file:///D:/xampp/htdocs/Mutiara-Florist-Management-System/resources/js/pages/Customers/Create.tsx): Form tambah pelanggan dengan validasi error inline dan status loading.
   - [Edit.tsx](file:///D:/xampp/htdocs/Mutiara-Florist-Management-System/resources/js/pages/Customers/Edit.tsx): Form edit data pelanggan dengan pre-fill data awal.
   - [Show.tsx](file:///D:/xampp/htdocs/Mutiara-Florist-Management-System/resources/js/pages/Customers/Show.tsx): Detail pelanggan, kartu total pesanan, penolakan arsip jika ada pesanan, dan modal konfirmasi jika tanpa pesanan.

## Hasil Pengujian & QA

### 1. PHPUnit / Pest Feature Tests
- Perintah: `php artisan test`
- Hasil: **85 passed (705 assertions)**, durasi ~4.8s
- Termasuk 11 tes baru pada `UiCustomerTest`:
  - Proteksi tamu dialihkan ke `/login`.
  - Akses daftar pelanggan via Inertia.
  - Tambah pelanggan & pencatatan audit log.
  - Validasi penolakan nama kosong & batas panjang karakter.
  - Izin nomor telepon duplikat.
  - Detail pelanggan & jumlah pesanan.
  - Edit pelanggan & audit log perubahan field.
  - Pencarian dengan literal escaping `%` dan `_`.
  - Arsip pelanggan tanpa pesanan & soft delete.
  - Penolakan arsip pelanggan yang memiliki riwayat pesanan.
  - Pembagian paginasi 10 pelanggan per halaman.

### 2. TypeScript Typecheck
- Perintah: `npm run typecheck`
- Hasil: **PASS (0 error)**

### 3. Vite Production Build
- Perintah: `npm run build`
- Hasil: **PASS (exit code 0)**

### 4. End-to-End Browser QA (Playwright)
- Pengujian otomatis via Playwright Chromium pada server terisolasi dengan data sintetis:
  - **Hasil:** **25 PASS / 0 FAIL**
  1. `PASS` Guest ke `/ui-customers` dialihkan ke `/login`.
  2. `PASS` Login admin sintetis berhasil.
  3. `PASS` HTTP GET `/ui-customers` status code 200.
  4. `PASS` Heading utama "Pelanggan" ter-render di React.
  5. `PASS` 10 baris pelanggan ditampilkan pada halaman 1.
  6. `PASS` Navigasi silang ke modul Pelanggan Blade lama (`/customers`).
  7. `PASS` Navigasi kembali ke Dashboard React (`/ui-dashboard`).
  8. `PASS` Halaman form tambah pelanggan terbuka (`/ui-customers/create`).
  9. `PASS` Validasi server menolak form dengan nama kosong.
  10. `PASS` Tambah pelanggan valid berhasil dan dialihkan ke detail (`/ui-customers/{id}`).
  11. `PASS` Halaman detail menampilkan nama pelanggan yang baru dibuat.
  12. `PASS` Notifikasi flash sukses "Pelanggan berhasil ditambahkan" ditampilkan.
  13. `PASS` Halaman form edit pelanggan terbuka (`/ui-customers/{id}/edit`).
  14. `PASS` Edit data tersimpan dan dialihkan ke detail.
  15. `PASS` Nomor telepon yang diperbarui ditampilkan pada detail.
  16. `PASS` Pencarian nama menghasilkan data yang tepat.
  17. `PASS` Reset pencarian mengembalikan daftar 10 pelanggan halaman 1.
  18. `PASS` Paginasi halaman 2 memuat sisa pelanggan.
  19. `PASS` Pelanggan yang memiliki riwayat pesanan dilarang diarsipkan.
  20. `PASS` Modal dialog konfirmasi arsip muncul saat tombol arsip ditekan.
  21. `PASS` Eksekusi arsip berhasil dan dialihkan ke index dengan flash sukses.
  22. `PASS` Pelanggan yang telah diarsipkan tersembunyi dari pencarian (soft deleted).
  23. `PASS` Tombol menu hamburger mobile tampak pada viewport iPhone 13.
  24. `PASS` Tidak ada horizontal overflow pada viewport mobile (0 px).
  25. `PASS` Tidak ada error halaman maupun pesan error pada konsol browser (0 error).
- Bukti tangkapan layar tersimpan di `storage/app/`:
  - `qa-customer-index-desktop.png`
  - `qa-customer-show-desktop.png`
  - `qa-customer-index-mobile.png`

## Keamanan Data & Lingkungan
- Seluruh pengujian browser dijalankan pada database pengujian terisolasi (SQLite) dengan data sintetis.
- Database lokal utama MariaDB (port 3307) dan akun admin operasional sama sekali tidak disentuh atau diubah password-nya.
- Tidak ada kredensial atau data pribadi yang dimasukkan ke repository.
