# Phase 1 — Menjalankan MFMS di Laptop Windows

**Status:** Setup awal telah dibuktikan operator pada 2 November 2026: Laravel 12 terinstal, MariaDB 10.4.32 port 3307 terhubung, 4 migration DONE, admin lokal dibuat, server menerima request `/login` dan `/dashboard`. 7 tes dasar PHPUnit telah PASS; QA visual browser dan pengujian CRUD Pelanggan Phase 2 belum dilakukan.

## 1. Prasyarat

- **PHP 8.2+**, ekstensi `pdo_mysql`, `mbstring`, `fileinfo`, `openssl`, `dom`, `xml`, dll. Versi PHP XAMPP yang lebih tua tidak dapat menjalankan Laravel 12.
- Composer 2, Node.js versi yang kompatibel dengan Vite 8 (Node.js 20.19+ atau 22.12+), npm, Git.
- MySQL/MariaDB lokal; XAMPP yang sudah terinstal dapat digunakan **jika versi PHP memenuhi syarat**. Jangan menjalankan dua server MySQL pada port 3306 yang sama.
- Repository GitHub bersifat **private**, jadi `git clone` memerlukan akun GitHub dengan akses.

Di PowerShell:
```powershell
php -v
composer --version
node -v
npm -v
git --version
php -m
```
Pastikan `php -v` adalah PHP yang digunakan **Composer dan terminal**. Jika XAMPP terpasang tetapi versi PHP di PATH berbeda, selesaikan konflik PATH dahulu.

## 2. Clone repository

Pilih folder proyek lokal yang sesuai. Contoh bila ingin meletakkannya di XAMPP:
```powershell
cd D:\xampp\htdocs
git clone https://github.com/Vluuuu/Mutiara-Florist-Management-System.git
cd Mutiara-Florist-Management-System
```

Jika memakai folder pengembangan lain, path dapat disesuaikan. Folder proyek **tidak perlu** menjadi virtual host dulu: `php artisan serve` sudah cukup.

## 3. Dependensi dan konfigurasi database

```powershell
composer install
Copy-Item .env.example .env
```

Jalankan server MySQL lokal (mis. dari Control Panel XAMPP). Buat database kosong bernama **`mutiara_florist`** melalui phpMyAdmin atau SQL:
```sql
CREATE DATABASE mutiara_florist
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Konfigurasi `.env` (file ini hanya disimpan **di laptop**, tidak di GitHub):
```dotenv
APP_NAME="Mutiara Florist Management System"
APP_ENV=local
APP_DEBUG=true
APP_TIMEZONE=Asia/Jakarta
APP_LOCALE=id
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3307
DB_DATABASE=mutiara_florist
DB_USERNAME=root
DB_PASSWORD=ISI_PASSWORD_LOKAL_SENDIRI
```

Pada laptop pengembangan yang sudah dicek, MariaDB XAMPP menggunakan **port 3307** dan akun root memiliki password (tidak dicatat di repo). Sesuaikan nilai `DB_PASSWORD` lokal milikmu; string `ISI_PASSWORD_LOKAL_SENDIRI` hanyalah placeholder, bukan password nyata. Jika menggunakan instalasi lain, port dan akun juga dapat berbeda. **Jangan unggah** isi `.env`, dump SQL, atau password ke chat/repositori.

## 4. Kunci aplikasi, migrasi, dan akun admin

```powershell
php artisan key:generate
php artisan migrate
php artisan mfms:create-admin
```

Perintah admin meminta nama, email, dan password **minimal 12 karakter** secara interaktif. Tidak ada password default atau halaman registrasi publik. Sistem MVP hanya mengizinkan satu akun awal; jangan gunakan `db:seed` untuk membuat akun contoh.

**Jangan** menjalankan `php artisan migrate:fresh` pada database berisi data usaha nyata karena akan menghapus seluruh tabel.

## 5. Frontend dan server

```powershell
npm install
npm run build
php artisan serve
```

Buka **http://127.0.0.1:8000/login**, lalu masuk dengan akun yang dibuat pada langkah sebelumnya. Halaman pertama adalah dashboard berisi agregat data yang benar-benar ada di database; semuanya nol saat database baru.

Jika ingin mengembangkan tampilan dengan hot-reload, jalankan `npm run dev` di terminal terpisah. `npm run build` tidak membutuhkan CDN font pihak ketiga.

## 6. Verifikasi dasar

Hasil yang sudah dicatat pada laptop operator: `composer install` sukses, `php artisan key:generate` sukses, `php artisan migrate` sukses (4 migration), `php artisan mfms:create-admin` sukses, `php artisan serve` sukses; request ke login dan dashboard tercatat. **Output `php artisan test` dan konfirmasi tampilan browser masih diperlukan.**

```powershell
php artisan route:list
php artisan migrate:status
php artisan test
```

Untuk `php artisan test` menggunakan SQLite in-memory sesuai `phpunit.xml`, PHP lokal juga membutuhkan `pdo_sqlite`. Uji integrasi khusus MySQL tetap perlu dilakukan sebelum data nyata digunakan.

Cek manual:
- Halaman `/login` tampil.
- Pengunjung tanpa login diarahkan dari `/dashboard` ke `/login`.
- Login admin berhasil; logout mengakhiri sesi.
- Tidak ada halaman `/register`.
- Dashboard menampilkan total pesanan, nilai order, uang diterima, piutang, pengeluaran, dan selisih kas.
- Delapan tabel bisnis termasuk `users` dan `audit_logs` tersedia sesuai desain; Laravel juga bisa membuat tabel infrastruktur sendiri.

## Pengembangan Phase 2 — Pelanggan

Jika Phase 1 sudah terpasang, jalankan pada terminal baru yang tidak dipakai `artisan serve`:
```powershell
git pull --ff-only origin main
php artisan migrate
php artisan test
php artisan route:list --path=customers
```
Migration baru **hanya menambahkan** kolom `deleted_at` ke `customers`; tidak menghapus tabel atau akun admin. Buka `http://127.0.0.1:8000/customers` setelah login. Gunakan **pelanggan sintetis** untuk QA, bukan pelanggan nyata. Lihat [CUSTOMERS_PHASE2.md](CUSTOMERS_PHASE2.md).

## 7. Batas Phase 1

- Dashboard/login hanya fondasi, bukan modul CRUD selesai.
- CRUD pelanggan, pesanan multi-item, DP, pengeluaran, dan ekspor laporan masih roadmap Phase 2–4.
- Aturan nominal tetap integer Rupiah, tanggal/tujuan/ongkir per item, DP opsional, tidak ada diskon/pajak maupun cancel/refund di MVP.
- Data pelanggan asli belum boleh diimpor sampai validasi, backup dan restore tersedia.

**Jika terjadi error**, simpan pesan error terminal, hasil `php -v` dan `php artisan migrate:status` (tanpa kredensial) untuk investigasi.
