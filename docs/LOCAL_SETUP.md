# Panduan Instalasi & Pengembangan Lokal MFMS

Dokumen ini menjelaskan cara menyiapkan dan menjalankan Mutiara Florist Management System (MFMS) di mesin pengembangan lokal (Windows, macOS, atau Linux) tanpa menyentuh database produksi.

## 1. Prasyarat Perangkat Lunak

- **PHP:** `8.2` atau `8.3` (produksi Docker memakai PHP 8.3) dengan ekstensi `pdo_pgsql` dan/atau `pdo_mysql`, `pdo_sqlite`, `mbstring`, `openssl`, `zip`, `bcmath`, `fileinfo`, `ctype`.
- **Composer:** versi 2.x.
- **Node.js & npm:** Node.js `20+` (untuk Vite 8, React 19, TypeScript 5.9, dan Tailwind CSS 4).
- **Database Lokal:** PostgreSQL `16+` (direkomendasikan agar setara produksi) atau MariaDB/MySQL `10.4+` / `8.0+`.

## 2. Langkah Instalasi Awal

1. **Clone repository dan pindah ke direktori proyek:**

```bash
git clone https://github.com/Vluuuu/Mutiara-Florist-Management-System.git
cd Mutiara-Florist-Management-System
```

2. **Pasang dependensi backend dan frontend:**

```bash
composer install
npm install
```

3. **Buat file konfigurasi lingkungan `.env`:**

```bash
cp .env.example .env
php artisan key:generate
```

4. **Konfigurasi database lokal di `.env`:**

Contoh untuk **PostgreSQL lokal**:

```env
APP_NAME="Mutiara Florist Management System"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://127.0.0.1:8000
APP_TIMEZONE=Asia/Jakarta
APP_LOCALE=id

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=mfms_local
DB_USERNAME=postgres
DB_PASSWORD=ISI_PASSWORD_LOKAL_ANDA
DB_SSLMODE=prefer
```

Contoh untuk **MariaDB/MySQL lokal** (misalnya XAMPP port 3306 atau 3307):

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=mutiara_florist_local
DB_USERNAME=root
DB_PASSWORD=
```

Pastikan `CLOUDFLARE_ACCESS_ENFORCE=false` (default) di lingkungan lokal agar halaman dapat diakses langsung melalui `127.0.0.1:8000` tanpa header Cloudflare Access.

5. **Jalankan migrasi skema database:**

```bash
php artisan migrate
```

6. **Buat akun admin pertama:**

```bash
php artisan mfms:create-admin
```

Perintah ini meminta nama, email, dan password secara interaktif di terminal. Demi keamanan, registrasi publik tidak tersedia dan `mfms:create-admin` hanya membuat akun pertama saat tabel `users` masih kosong.

## 3. Menjalankan Aplikasi Lokal

### Mode Pengembangan (Hot Module Replacement)

Jalankan dua proses di terminal terpisah:

```bash
# Terminal 1: Backend Laravel
php artisan serve --host=127.0.0.1 --port=8000

# Terminal 2: Frontend Vite (React 19 + TypeScript + Tailwind 4)
npm run dev
```

Atau jalankan aset produksi secara lokal:

```bash
npm run build
php artisan serve --host=127.0.0.1 --port=8000
```

Akses aplikasi melalui browser di `http://127.0.0.1:8000/login`.

### Skrip Bantu Windows (Opsional)

Untuk operasional lokal Windows dengan XAMPP MariaDB, tersedia skrip bantu aman di folder `scripts/`:

- `scripts/Start-MFMS.bat` (`scripts/start-mfms.ps1`): memeriksa kesiapan MariaDB, `.env`, dan build `public/build/manifest.json`, lalu menyalakan server lokal `127.0.0.1:8000`.
- `scripts/Stop-MFMS.bat` (`scripts/stop-mfms.ps1`): menghentikan proses server Laravel milik MFMS secara terverifikasi tanpa memaksa berhenti layanan database.

## 4. Menjalankan Pemeriksaan & Pengujian Lokal

```bash
# Pemeriksaan tipe TypeScript
npm run typecheck

# Build produksi aset frontend
npm run build

# Pengujian otomatis terisolasi (SQLite in-memory sesuai phpunit.xml)
php artisan test
```

`phpunit.xml` memaksa `DB_CONNECTION=sqlite` dan `DB_DATABASE=:memory:` sehingga menjalankan `php artisan test` tidak mengubah database lokal atau produksi di `.env`.

## 5. Aturan Kebersihan Repository Lokal

- Jangan pernah melakukan commit terhadap `.env`, file backup `.enc`/`.meta.json`, dump `.sql`, atau data pelanggan asli.
- Jika ingin mencoba backup lokal: `php artisan mfms:backup` akan menyimpan arsip terenkripsi di `storage/app/backups/` yang sudah dikecualikan di `.gitignore`.

Rujukan terkait: [DATABASE.md](DATABASE.md), [DEPLOYMENT.md](DEPLOYMENT.md), [TEST_PLAN.md](TEST_PLAN.md).
