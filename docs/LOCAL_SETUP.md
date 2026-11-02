# Phase 1 — Menjalankan MFMS di Laptop Windows

**Status:** Panduan setup, bukan hasil pengujian di laptop operator. Aplikasi telah di-*scaffold* di GitHub, tetapi Composer, MySQL lokal, migrasi, dan browser harus dijalankan di laptop.

## 1. Prasyarat

- **PHP 8.3+**, ekstensi `pdo_mysql`, `mbstring`, `fileinfo`, `openssl`, `dom`, `xml`, dll. Versi PHP XAMPP yang lebih tua tidak dapat menjalankan Laravel 13.
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
DB_PORT=3306
DB_DATABASE=mutiara_florist
DB_USERNAME=root
DB_PASSWORD=
```

`DB_USERNAME` dan `DB_PASSWORD` hanyalah contoh development XAMPP. Jika MySQL lokal memakai user/password berbeda, gunakan kredensial yang benar. Jangan unggah isi `.env`, dump SQL, atau password ke chat/repositori.

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

## 7. Batas Phase 1

- Dashboard/login hanya fondasi, bukan modul CRUD selesai.
- CRUD pelanggan, pesanan multi-item, DP, pengeluaran, dan ekspor laporan masih roadmap Phase 2–4.
- Aturan nominal tetap integer Rupiah, tanggal/tujuan/ongkir per item, DP opsional, tidak ada diskon/pajak maupun cancel/refund di MVP.
- Data pelanggan asli belum boleh diimpor sampai validasi, backup dan restore tersedia.

**Jika terjadi error**, simpan pesan error terminal, hasil `php -v` dan `php artisan migrate:status` (tanpa kredensial) untuk investigasi.
