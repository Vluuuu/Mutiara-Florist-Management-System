# Phase 2.1 — CRUD Pelanggan

**Status (2 November 2026):** Migrasi `deleted_at` berhasil dijalankan pada MariaDB lokal, Vite build PASS, dan `php artisan test` **17 PASS / 83 assertions** (termasuk 10 tes pelanggan). **QA interaksi browser manual masih menunggu verifikasi.**

## Cakupan
- Admin yang sudah login dapat mengakses **Pelanggan** melalui sidebar atau `/customers`.
- Daftar diurutkan dari yang terbaru, **10 pelanggan per halaman**, dengan pencarian nama dan nomor telepon.
- Form tambah/edit: nama wajib (maks. 255 karakter), telepon opsional (maks. 50 karakter, tidak unik), catatan opsional (maks. 2.000 karakter).
- Detail menampilkan data kontak, catatan, dan jumlah pesanan (belum ada halaman pesanan).
- Admin boleh mengarsipkan pelanggan yang **tidak memiliki pesanan**. Pelanggan terkait pesanan tidak bisa diarsipkan. Pengarsipan menggunakan `softDeletes`, bukan hapus permanen.
- Setiap create, perubahan edit, dan arsip dicatat dalam `audit_logs` dengan identitas admin dan nama field yang diubah. Log tidak menyalin nomor telepon/catatan.
- Akses guest ditolak; semua form POST/PUT/DELETE menggunakan CSRF dan validasi server. Tidak ada registrasi publik.

## Instalasi di laptop dengan XAMPP yang sudah berjalan
Gunakan PowerShell **baru** supaya proses `php artisan serve` tidak terhenti. Repository sudah dikonfigurasi memakai Laravel 12, PHP 8.2 dan MariaDB lokal port 3307 melalui `.env` (tetap rahasia).

```powershell
cd D:\xampp\htdocs\Mutiara-Florist-Management-System
git pull --ff-only origin main
php artisan migrate
php artisan test
php artisan route:list --path=customers
git status --short
```

**Jangan** menggunakan `migrate:fresh` pada database `mutiara_florist`. Migration baru hanya menambah `customers.deleted_at` dan semestinya muncul sebagai `Ran` setelah `migrate`.

`php artisan test` memakai database SQLite in-memory untuk pengujian dan tidak menghapus pelanggan di MariaDB lokal. Jika ada tes gagal, simpan **pesan error tanpa kredensial** untuk diperbaiki; jangan klaim PASS terlebih dahulu.

## QA browser (data sintetis saja)
1. Login; buka `http://127.0.0.1:8000/customers`; pastikan sidebar Pelanggan aktif.
2. Tambahkan pelanggan fiktif `Pelanggan Contoh` dengan telepon dan catatan opsional. Pastikan pindah ke detail.
3. Edit namanya, lalu cari menggunakan sebagian nama dan nomor telepon; uji reset pencarian.
4. Uji validasi nama kosong; tidak boleh tersimpan.
5. Uji arsip pelanggan fiktif **tanpa pesanan**; harus hilang dari daftar tanpa hard delete.
6. Uji logout, lalu buka `/customers` tanpa login; seharusnya diarahkan kembali ke login.
7. Proteksi pelanggan **dengan pesanan** diuji otomatis menggunakan data sintetis; belum ada UI input order pada tahap ini.

## Batasan
- Hanya modul pelanggan yang siap diuji. CRUD/order item, pembayaran dan laporan lanjutan belum dibangun.
- Belum ada halaman memulihkan pelanggan arsip; datanya tetap tersimpan dan mekanisme restore dapat ditambah nanti.
- Soft delete menandai arsip, **bukan** fitur pembatalan pesanan.
- Jangan memasukkan data pelanggan asli sebelum QA, backup, dan restore diverifikasi.
