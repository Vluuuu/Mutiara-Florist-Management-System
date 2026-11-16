# Phase 3.3 — Fondasi React + TypeScript + Inertia.js

## Ruang lingkup
Ini **draft integrasi** untuk memigrasikan tampilan MFMS secara bertahap. Laravel 12 dan MariaDB tetap menjadi sumber kebenaran; jangan mengubah tabel, nilai keuangan, atau data nyata. Route Blade lama tetap aktif. Satu-satunya layar React baru adalah **/ui-preview**, hanya untuk admin yang sudah login.

Stack baru: React 19 + TypeScript (TSX), Inertia.js v3, Tailwind CSS 4, shadcn/ui-style components, dan Vite 8. Sementara itu `resources/js/app.js` dan semua view Blade lama dipertahankan agar fitur bisnis yang sudah ada tidak terganggu.

## Penting: lockfile BELUM diperbarui
Lingkungan penulisan branch tidak dapat mengakses registry Composer/npm sehingga **composer.lock dan package-lock.json masih versi main**. Jangan merge sampai lockfile dihasilkan ulang, typecheck, build, serta tes benar-benar dijalankan di laptop Windows. Jangan menjalankan `npm ci` atau `composer install` pada branch ini sebelum lockfile diselaraskan.

## Instalasi pada laptop pengembangan
Gunakan PowerShell di D:\xampp\htdocs\Mutiara-Florist-Management-System; pastikan status Git lokal bersih sebelum berpindah branch.

```powershell
git fetch origin
git switch feat/phase3-3-react-inertia-foundation
composer update inertiajs/inertia-laravel --with-all-dependencies
npm install
npm run typecheck
npm run build
php artisan test
```

Saat menjalankan aplikasi, XAMPP/MariaDB dan .env lokal tetap menggunakan database dev yang sudah ada. **Jangan** menjalankan `migrate:fresh`, `db:wipe`, restore, atau migration destruktif.

```powershell
php artisan serve
```

Buka `http://127.0.0.1:8000/login`, login admin, lalu buka `http://127.0.0.1:8000/ui-preview`. Kembali ke dashboard Blade melalui tombol pada preview.

Periksa:
- Guest ke `/ui-preview` dialihkan ke `/login`.
- User login mendapat halaman React dan identitas yang sesuai.
- Menu lama: pelanggan, pesanan, pembayaran, pengeluaran, kategori tetap berjalan.
- Tidak ada pengaruh ke total pembayaran/piutang maupun perubahan skema.
- `npm run typecheck`, `npm run build`, dan `php artisan test` lulus tanpa mengubah atau menghapus tes lama.

Jika seluruh pengujian lulus, commit lockfile yang **dihasilkan otomatis** pada branch yang sama:

```powershell
git add composer.lock package-lock.json
git commit -m "build: lock React and Inertia dependencies"
git push -u origin feat/phase3-3-react-inertia-foundation
```

Periksa ulang hasil di pull request sebelum merge. Untuk rollback sebelum merge, pindah ke `main` dan gunakan dependensi versi main; jangan menghapus database.

## Batasan
- React + Inertia **belum** menggantikan login, dashboard, CRUD, atau tampilan finansial.
- Komponen button adalah fondasi shadcn-style; library lengkap belum dipasang via CLI dan desain akhir belum dipilih.
- Tidak ada perubahan deployment, DNS, Cloudflare Tunnel, Figma, atau BAB II dalam branch ini.
- Phase 4 laporan/Excel/backup dan QA produksi masih pekerjaan terpisah.
