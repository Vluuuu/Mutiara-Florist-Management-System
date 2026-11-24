# Panduan Arsitektur & Deployment Produksi MFMS

**Target Produksi Aktif:** [https://admin.mutiaraflorist.id](https://admin.mutiaraflorist.id)  
**Baseline Rilis Terpasang:** Branch `release/phase13-ui-bi`, commit `0b436a9bc8e53328f633ee21a0666eaa6b3cbe6d`

Dokumen ini merangkum arsitektur deployment produksi MFMS yang berjalan di server Ubuntu berbasis Docker, database PostgreSQL Supabase, dan publikasi aman melalui Cloudflare Tunnel.

## 1. Topologi Produksi

```text
Browser Admin/Operator
        |
        | HTTPS (admin.mutiaraflorist.id)
        v
Cloudflare Global Edge
  - DNS & TLS penuh
  - Cloudflare Zero Trust Access (Email OTP / kebijakan akses terbatas)
        |
        | Outbound Encrypted Tunnel (cloudflared)
        v
Server Ubuntu (Docker Host)
  - Container MFMS (Dockerfile: PHP 8.3 FPM + Nginx + Supervisord)
  - Mendengarkan port internal loopback / container (tanpa port forwarding publik)
        |
        | PostgreSQL over TLS (DB_SSLMODE=require)
        v
Supabase PostgreSQL
  - RLS aktif pada semua tabel skema public
  - Hak akses PostgREST (anon/authenticated) dicabut
```

## 2. Spesifikasi Container Docker

Container aplikasi dibangun menggunakan multi-stage `Dockerfile` dan konfigurasi di direktori `docker/`:

1. **Stage 1 (`node:20-alpine`):** Memasang paket npm dari `package-lock.json` dan membangun aset React/TypeScript/Tailwind CSS 4 melalui `npm run build`.
2. **Stage 2 (`composer:2.7`):** Memasang dependensi PHP produksi (`--no-dev --optimize-autoloader --classmap-authoritative`).
3. **Stage 3 (`php:8.3-fpm-alpine`):**
   - Ekstensi PHP aktif: `pdo_pgsql`, `pdo_mysql`, `pgsql`, `zip`, `bcmath`, `opcache`.
   - Web server **Nginx** (`docker/nginx.conf`): melayani `public/`, header keamanan dasar (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`), kompresi gzip, endpoint liveness `/up`, serta pemblokiran akses langsung ke file tersembunyi (`/.env`, `/.git`) dan `/storage/app/`.
   - **PHP-FPM** (`docker/fpm-pool.conf`, `docker/php.ini`): `memory_limit = 128M`, `opcache.memory_consumption = 64M`, `date.timezone = Asia/Jakarta`, `expose_php = Off`, `pm.max_children = 5`.
   - **Supervisord** (`docker/supervisord.conf`): mengelola `php-fpm`, `nginx`, dan loop `artisan schedule:run` setiap 60 detik.
   - **Entrypoint** (`docker/entrypoint.sh`): menyiapkan izin folder `storage/` dan `bootstrap/cache/`, menjalankan `config:cache`, `route:cache`, `view:cache`, lalu mengeksekusi `supervisord`. **Container tidak pernah menjalankan `php artisan migrate` secara otomatis saat startup.**

## 3. Variabel Lingkungan Produksi (Tanpa Nilai Rahasia)

Konfigurasi produksi disuntikkan melalui file environment server yang tidak masuk ke Git:

| Grup | Variabel | Keterangan |
| --- | --- | --- |
| Aplikasi | `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://admin.mutiaraflorist.id`, `APP_KEY` | `APP_KEY` dibuat dengan `php artisan key:generate --show` dan disimpan aman di luar repository. |
| Lokalisasi | `APP_TIMEZONE=Asia/Jakarta`, `APP_LOCALE=id` | Menjaga konsistensi tanggal transaksi dan laporan dalam WIB. |
| Database | `DB_CONNECTION=pgsql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `DB_SSLMODE=require` | Koneksi PostgreSQL terenkripsi ke Supabase. |
| Sesi & Cache | `SESSION_DRIVER=database`, `SESSION_SECURE_COOKIE=true`, `CACHE_STORE=database`, `QUEUE_CONNECTION=database` | Menjaga sesi tetap persisten saat container di-restart. |
| Keamanan Edge | `CLOUDFLARE_ACCESS_ENFORCE=true`, `CLOUDFLARE_ACCESS_TEAM_DOMAIN`, `CLOUDFLARE_ACCESS_AUD`, `CLOUDFLARE_EDGE_SECRET` (opsional) | Mengaktifkan verifikasi JWT RS256 fail-closed pada `VerifyCloudflareAccessJwt`. |
| Backup | `BACKUP_ENCRYPTION_KEY` | Kunci terpisah untuk enkripsi backup AES-256-GCM (fallback ke `APP_KEY` bila kosong). |

## 4. Prosedur Build & Jalankan Container (Referensi)

```bash
# 1. Build image dari commit rilis yang diverifikasi
docker build -t mfms:phase13 .

# 2. Jalankan container dengan file env eksternal pada loopback lokal server Ubuntu
docker run -d \
  --name mfms-prod \
  --restart unless-stopped \
  --env-file /path/aman/mfms.env \
  -p 127.0.0.1:10000:10000 \
  mfms:phase13
```

Catatan operasional:
- Publikasi ke `admin.mutiaraflorist.id` dilakukan melalui daemon `cloudflared` (Cloudflare Tunnel) yang mengarah ke `http://127.0.0.1:10000`.
- Migrasi database dijalankan secara terkontrol dan eksplisit sebelum atau saat jendela pemeliharaan (`php artisan migrate --force` atau `php artisan mfms:migrate-staging` untuk staging yang diproteksi `DatabaseTargetGuard`), bukan secara otomatis di `entrypoint.sh`.

## 5. Lingkungan Staging & Konfigurasi Eksperimental

- Lingkungan staging (`https://staging-admin.mutiaraflorist.id`) berjalan pada server Ubuntu berbasis container Docker terpisah (`mfms-staging`) menggunakan `Dockerfile` yang sama dan data sintetis, tanpa ketergantungan pada Render, Railway, maupun Nixpacks.
- Seluruh konfigurasi eksperimental cloud PaaS dari fase eksplorasi awal (`railway.json`, `nixpacks.toml`, dan `render.yaml`) telah dipindahkan ke `docs/archive/deployment-experiments/` karena tidak ada deployment aktif yang bergantung pada ketiganya.

Rujukan terkait: [ARCHITECTURE.md](ARCHITECTURE.md), [BACKUP_RESTORE.md](BACKUP_RESTORE.md), [LOCAL_SETUP.md](LOCAL_SETUP.md).
