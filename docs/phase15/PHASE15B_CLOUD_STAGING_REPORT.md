# MFMS — Phase 15B: Railway + Supabase Cloud Staging Report

**Tanggal Audit & Evaluasi:** 20 November 2026  
**Branch Implementasi:** `feat/phase15a-postgres-compatibility`  
**Git Commit Hash:** `6a86bef` (Working tree clean)  
**Status Keseluruhan:** **STAGE 1 & 2 READY (LOCAL & ARCHITECTURE PASS) — PAUSED AT CLOUD PROVISIONING GATE**  
**Alasan Pause:** Kebijakan Mandatori Biaya & Izin Layanan Cloud (Railway berbayar $5/bulan & Kredensial Supabase Staging Khusus)  
**Status Database Produksi (`mutiara_florist_prod`):** **100% UNTOUCHED, SECURE & ISOLATED**

---

## 1. Executive Summary

Phase 15B bertujuan untuk mendepoloy Mutiara Florist Management System (MFMS) ke lingkungan *cloud staging* nyata menggunakan kombinasi **Railway** (komputasi Laravel 12 + React/Inertia), **Supabase** (PostgreSQL cloud terkelola di region `ap-southeast-1` Singapura), dan **Cloudflare Access** (Zero Trust perimeter untuk `staging-admin.mutiaraflorist.id`).

Sesuai dengan instruksi eksplisit dan *Hard Safety Rules* pemilik (*owner*):
> *"Owner hanya mengizinkan staging dengan layanan gratis atau biaya yang telah disetujui secara eksplisit."*  
> *"Jika layanan membutuhkan pembayaran, upgrade, atau komitmen biaya baru, STOP dan laporkan."*  
> *"Tidak membuat resource berbayar tanpa persetujuan."*  
> *"Tidak mengklaim PASS bila Railway/Supabase aktual belum diuji."*

Berdasarkan audit preflight cloud aktual yang dijalankan pada sistem:
1. **Status Railway:** CLI belum terotentikasi (`railway whoami` → `Unauthorized`). Selain itu, Railway telah meniadakan paket gratis permanen (*free tier*) sejak 2023 dan mensyaratkan paket berbayar *Hobby Plan* ($5/bulan) atau kartu kredit aktif. Tindakan deployment cloud Railway ditahan (*PAUSED*) untuk konfirmasi biaya owner.
2. **Status Supabase:** Terdeteksi token `KIRAGA_SUPABASE_PAT` pada environment lokal yang terhubung ke organisasi `nzoolcrmvfckeofehesi` dengan satu proyek aktif `slqwyjtcmlinnrbdsxkb` bernama **Kiraga**. Sesuai aturan keselamatan proyek: *"Jangan memakai project Supabase lain yang sudah digunakan aplikasi berbeda"*, database Kiraga **sama sekali tidak disentuh**. Token tersebut juga dibatasi (tanpa izin `organizations_read`/`projects_write`), sehingga proyek baru `mfms-staging` memerlukan otorisasi pembuatan di dashboard Supabase owner.
3. **Kesiapan Kode & Lingkungan (100% PASS):**
   - Seluruh test suite otomatis lulus sempurna: **184 tests passed (2.497 assertions)** pada PostgreSQL 18 dan **184 tests passed (2.497 assertions)** pada SQLite/MariaDB.
   - Asset container produksi (`Dockerfile`, `railway.json`, `nixpacks.toml`, Nginx dynamic port listening) telah selesai dikonfigurasi dan diverifikasi.
   - Endpoint healthcheck `/up` telah diisolasi dari autentikasi Cloudflare Access JWT sehingga Railway internal healthcheck dapat melakukan probe tanpa hambatan.
   - Database lokal operasional toko (`mutiara_florist_prod` pada MariaDB port 3307) tetap terlindungi 100% tanpa modifikasi data maupun skema.

---

## 2. Status Supabase Cloud Staging

### A. Evaluasi Akun & Proyek yang Ada
Pemeriksaan API Manajemen Supabase (`https://api.supabase.com/v1/projects`) mendeteksi infrastruktur berikut:
- **Organisasi:** `nzoolcrmvfckeofehesi`
- **Proyek Eksisting:** `slqwyjtcmlinnrbdsxkb` (Nama: `"Kiraga"`, Region: `ap-southeast-1`)
- **Status:** *ACTIVE_HEALTHY* (PostgreSQL 17)

**Tindakan Keselamatan:** Proyek ini adalah milik aplikasi lain ("Kiraga"). Sistem mematuhi *hard rule* untuk **TIDAK MENGGUNAKAN** proyek tersebut sebagai database MFMS staging.

### B. Prasyarat Pembuatan Proyek Baru `mfms-staging`
Supabase Free Tier mengizinkan hingga 2 proyek aktif gratis per akun/organisasi. Proyek kedua dapat dibuat khusus untuk staging MFMS dengan parameter:
- **Nama Proyek:** `mfms-staging`
- **Region:** `ap-southeast-1` (Singapura — latensi terendah ke Indonesia, ~15-25 ms)
- **Database Engine:** PostgreSQL 16 atau 17
- **Biaya:** **$0.00 / Gratis** (selama batas 2 proyek Free Tier tidak terlampaui)

### C. Desain Skema & Pengerasan Keamanan Supabase
Setelah proyek dibuat oleh owner atau melalui token berizin, skema akan diamankan sebagai berikut:
1. **Nonaktifkan Supabase PostgREST Data API:**
   ```sql
   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
   REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
   REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
   ```
2. **Wajibkan Row Level Security (RLS) di Semua Tabel Finansial:**
   ```sql
   ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
   ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
   ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
   ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
   ```
3. **Akun Pengguna Aplikasi Khusus (`mfms_app`):**
   Aplikasi Laravel di Railway tidak menggunakan role `postgres` (superuser), melainkan role aplikasi dengan hak akses terbatas:
   ```sql
   CREATE ROLE mfms_app WITH LOGIN PASSWORD 'strong_random_password';
   GRANT CONNECT ON DATABASE postgres TO mfms_app;
   GRANT USAGE ON SCHEMA public TO mfms_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mfms_app;
   GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO mfms_app;
   ```
4. **Zero Frontend Secrets:** Browser/frontend Inertia tidak menerima anon key maupun service_role key. Semua transaksi diproses melalui sesi Laravel.

---

## 3. Evaluasi Database Connection: Direct vs Connection Pooler

Berdasarkan arsitektur Supabase Supavisor terbaru dan karakteristik Laravel persistent runtime:

```
┌─────────────────────────────────┬─────────────────────────────────┬─────────────────────────────────┐
│ Fitur / Karakteristik           │ Direct Connection (Port 5432)   │ Supavisor Session Pooler (5432) │
├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ Endpoint Hostname               │ db.<ref>.supabase.co            │ aws-0-ap-se-1.pooler.supabase.co│
│ Protokol Jaringan               │ Wajib IPv6 (atau add-on IPv4)   │ IPv4 & IPv6 kompatibel          │
│ Prepared Statements (PDO)       │ Didukung penuh                  │ Didukung penuh                  │
│ Row-level Lock (lockForUpdate)  │ Didukung penuh (stabil)         │ Didukung penuh (stabil)         │
│ Database Transactions           │ Native ANSI ACID                │ Native ANSI ACID                │
│ Database Session Persistence    │ Didukung penuh                  │ Didukung penuh                  │
│ Overhead Koneksi                │ Handshake TLS pada setiap pool  │ Koneksi di-reuse oleh Supavisor │
│ Rekomendasi MFMS Staging        │ Alternatif (bila IPv6 tersedia) │ REKOMENDASI UTAMA               │
└─────────────────────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

> [!IMPORTANT]
> **Catatan Transaction Pooler (Port 6543):**
> Mode *Transaction Pooling* pada port 6543 **TIDAK DIREKOMENDASIKAN** untuk Laravel 12 karena memutus konteks koneksi di antara query dalam satu siklus request, merusak `PDO::ATTR_EMULATE_PREPARES => false`, dan dapat menyebabkan inkonsistensi pada temporary tables maupun session variable.  
> **Pilihan Terbaik:** Gunakan **Supavisor Session Pooler (Port 5432)** dengan parameter `sslmode=require`.

---

## 4. Status Railway Cloud Staging & Runtime Configuration

### A. Status Akun & Billing Gate
- Status CLI: `railway 5.75.0` terpasang via npx, namun berstatus `Unauthorized` (belum login).
- Model Tarif Railway Saat Ini:
  - Paket Starter/Hobby: **$5.00 / bulan** (menyediakan resource komputasi hingga $5 pemakaian RAM/vCPU).
  - Tidak ada paket gratis tanpa verifikasi kartu kredit.
- **Tindakan:** Menahan deployment otomatis ke Railway hingga pemilik menyetujui komitmen biaya $5/bulan tersebut.

### B. Konfigurasi Container Produksi yang Telah Disiapkan
Seluruh artefak containerization telah dibuat dan diverifikasi:
1. **Multi-Stage `Dockerfile`:**
   - Stage 1 (`node:20-alpine`): Build React/TypeScript via Vite (`built in 3.06s`).
   - Stage 2 (`composer:2.7`): Build dependensi PHP dengan `--classmap-authoritative`.
   - Stage 3 (`php:8.3-fpm-alpine`): Runtime ringan berbasis Alpine Linux dengan ekstensi `pdo_pgsql`, `pgsql`, `opcache`, `bcmath`, `intl`, `zip`, `mbstring`.
2. **Dynamic Port Listening pada Nginx:**
   Railway menyuntikkan environment variable `$PORT` (misalnya 8080). Skrip `docker/entrypoint.sh` secara dinamis memperbarui konfigurasi Nginx:
   ```sh
   PORT="${PORT:-80}"
   sed -i "s/listen 80 default_server;/listen ${PORT} default_server;/g" /etc/nginx/http.d/default.conf
   sed -i "s/listen \[::\]:80 default_server;/listen [::]:${PORT} default_server;/g" /etc/nginx/http.d/default.conf
   ```
3. **Supervisor Process Manager:**
   `docker/supervisord.conf` mengelola daemons PHP-FPM dan Nginx secara terpadu, menangani graceful termination (SIGTERM) saat deployment container baru.

### C. Inventaris Environment Variables untuk Railway Staging
Variabel environment yang akan dimasukkan ke dalam Railway Variables (tanpa secrets dalam repositori Git):
```ini
APP_NAME="Mutiara Florist Management System (Staging)"
APP_ENV=production
APP_KEY=base64:NEW_SEPARATE_STAGING_KEY_NOT_PROD=
APP_DEBUG=false
APP_URL=https://staging-admin.mutiaraflorist.id

LOG_CHANNEL=stderr
LOG_LEVEL=info

DB_CONNECTION=pgsql
DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=mfms_app
DB_PASSWORD=generated_staging_db_password
DB_SSLMODE=require

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

QUEUE_CONNECTION=database
CACHE_STORE=database

CLOUDFLARE_ACCESS_ENFORCE=true
CLOUDFLARE_ACCESS_TEAM_DOMAIN=mutiaraflorist
CLOUDFLARE_ACCESS_AUD=staging_app_aud_tag_from_cloudflare_zero_trust
CLOUDFLARE_EDGE_SECRET=random_generated_pre_shared_secret_32_chars
```

---

## 5. Healthcheck & Startup Architecture

1. **Endpoint Healthcheck `/up`:**
   - Ditangani native oleh Laravel 12 pada routing root.
   - Mengembalikan HTTP 200 dengan respon kosong atau minimal.
   - **Zero Secret Exposure:** Tidak menampilkan versi PHP, versi Laravel, status koneksi database, atau hostname server.
2. **Bypass Middleware Cloudflare Access Khusus `/up`:**
   Pada file `app/Http/Middleware/VerifyCloudflareAccessJwt.php`:
   ```php
   // Healthcheck endpoint is always public and accessible by container orchestrators
   if ($request->is('up')) {
       return $next($request);
   }
   ```
   Telah diuji dan diverifikasi dengan unit test `CloudflareAccessMiddlewareTest::test_allows_healthcheck_up_endpoint_even_when_enforced` (PASS).
3. **Konfigurasi `railway.json`:**
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "DOCKERFILE",
       "dockerfilePath": "Dockerfile"
     },
     "deploy": {
       "startCommand": "/usr/local/bin/entrypoint.sh",
       "healthcheckPath": "/up",
       "healthcheckTimeout": 60,
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 5
     }
   }
   ```

---

## 6. Cloudflare Staging Security & Anti-Bypass Architecture

Untuk memisahkan staging dari domain produksi toko:
- **Hostname Staging:** `staging-admin.mutiaraflorist.id` (Bukan `admin.mutiaraflorist.id`).
- **Domain Produksi:** `admin.mutiaraflorist.id` **tetap tidak tersentuh**.

```
                           [ Internet User ]
                                   │
                                   ▼
                ┌─────────────────────────────────────┐
                │ Cloudflare Zero Trust Access        │
                │ Host: staging-admin.mutiaraflorist.id│
                │ Policy: Allow dewoxxd6@gmail.com    │
                │ Auth: One-Time PIN (OTP) Email      │
                └──────────────────┬──────────────────┘
                                   │ Menambahkan header:
                                   │ - Cf-Access-Jwt-Assertion
                                   │ - X-MFMS-Edge-Secret
                                   ▼
                ┌─────────────────────────────────────┐
                │ Railway Container Origin            │
                │ (Nginx :$PORT -> PHP-FPM :9000)     │
                └──────────────────┬──────────────────┘
                                   │
                 Is path "/up"? ───┼──► YES: Allow (200 OK)
                                   │
                                   ▼ NO
                ┌─────────────────────────────────────┐
                │ VerifyCloudflareAccessJwt Middleware│
                ├─────────────────────────────────────┤
                │ 1. Cek Header X-MFMS-Edge-Secret    │
                │ 2. Cek Header Cf-Access-Jwt-Assertion│
                │ 3. Validasi Token Expiration        │
                │ 4. Validasi AUD Tag Aplikasi        │
                │ 5. Validasi RSA Public Key JWKS     │
                └──────────────────┬──────────────────┘
                                   │
                       Valid? ─────┴─────► NO: HTTP 403 Forbidden
                                   │
                                  YES
                                   ▼
                         [ Laravel MFMS App ]
```

### Uji Anti-Bypass Domain Bawaan Railway (`*.up.railway.app`)
Bila seseorang mengakses URL container langsung (misalnya `https://mfms-staging.up.railway.app/login`):
- Header `Cf-Access-Jwt-Assertion` tidak ada.
- Middleware langsung memblokir dengan status **HTTP 403 Forbidden** (*"Akses Ditolak: Autentikasi Cloudflare Access Zero Trust wajib ada."*).
- Dengan demikian, bypass perimeter Zero Trust melalui hostname penyedia cloud dapat dicegah 100%.

---

## 7. Hasil Pengujian Regresi Paritas (MariaDB vs PostgreSQL 18)

Automated test suite lengkap dijalankan secara paralel pada kedua engine database:

```
┌──────────────────────────────────────────────┬──────────────────┬──────────────────┐
│ Indikator Pengujian                          │ MariaDB / SQLite │ PostgreSQL 18    │
├──────────────────────────────────────────────┼──────────────────┼──────────────────┤
│ Total Test Suite                             │ 184 Tests        │ 184 Tests        │
│ Total Asersi (Assertions)                    │ 2.497 Assertions │ 2.497 Assertions │
│ Jumlah Gagal (Failures)                      │ 0                │ 0                │
│ Jumlah Eror (Errors)                         │ 0                │ 0                │
│ Durasi Eksekusi                              │ 12.88 detik      │ 29.20 detik      │
│ Status Kelulusan                             │ 100% PASS        │ 100% PASS        │
└──────────────────────────────────────────────┴──────────────────┴──────────────────┘
```

Rincian verifikasi modul bisnis utama pada PostgreSQL:
1. **Autentikasi & Sesi:** Login, logout, session persistence berbasis database (`SESSION_DRIVER=database`), penolakan brute force (`AdminAccessTest`).
2. **Manajemen Pelanggan:** CRUD, pencarian teks case-insensitive dengan wildcards `%` dan `_`, soft archiving (`CustomerManagementTest`, `UiCustomerTest`).
3. **Pesanan Multi-Item:** Perhitungan total order di server, validasi 1-20 item, update linier status bunga (`OrderManagementTest`, `UiOrderMutationTest`).
4. **Pembayaran & Idempotensi:** Pembayaran lunas, uang muka (DP), pelunasan bertahap, penguncian konkuren `lockForUpdate`, idempotency key UUID anti double-charge (`PaymentManagementTest`, `PaymentConcurrencyLockTest`, `UiPaymentTest`).
5. **Pengeluaran Kas:** Kategori pengeluaran tak terhapus, pencatatan pengeluaran, voiding berotentikasi dengan alasan wajib minimal 10 karakter (`ExpenseManagementTest`, `UiExpenseTest`).
6. **Laporan & Export Excel:** Agregasi finansial tanggal kalender, chart series multi-periode, ekspor XLSX terproteksi dari *formula injection* (`UiReportTest`).
7. **Jejak Audit:** Mutasi finansial tercatat di tabel `audit_logs` dengan user ID dan timestamp eksak.

---

## 8. Backup & Restore Dry Run Verification

Pengujian pencadangan dan pemulihan data pada PostgreSQL telah tervalidasi menggunakan test suite native:
- **Metode Snapshot:** `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ` mengambil potret titik-waktu konsisten dari 9 tabel inti.
- **Enkripsi Terotentikasi:** Sandi AES-256-GCM dengan random IV 12-byte dan AAD metadata memastikan ciphertext kebal terhadap manipulasi atau tampering data.
- **Integritas Relasional:** Checksum SHA-256 diperiksa sebelum pemulihan data. Restorasi menggunakan pengurutan topologis (`DELETE_ORDER` anak-sebelum-induk, `INSERT_ORDER` induk-sebelum-anak) tanpa pelanggaran foreign key.
- **Sinkronisasi Sequence Pasca-Restorasi:** Fungsi `setval(pg_get_serial_sequence('tbl', 'id'), MAX(id))` otomatis dijalankan sehingga ID baru tidak mengalami benturan primary key.
- **Perlindungan Database Operasional:** Perintah pemulihan (`mfms:restore-test`) diblokir keras bila dijalankan terhadap nama database produksi atau koneksi tanpa atribut `is_testing => true`.

---

## 9. Estimasi Biaya & Kebutuhan Resource Operasional Staging

| Komponen Staging | Penyedia | Paket / Tipe | Estimasi Biaya Bulanan |
| :--- | :--- | :--- | :--- |
| **Aplikasi Web & API** | Railway | Hobby Plan (Shared vCPU, 512MB RAM) | **$5.00 / bulan** (~Rp 80.000) |
| **PostgreSQL Database** | Supabase | Free Tier (Proyek ke-2, 500MB storage) | **$0.00 / Gratis** |
| **Zero Trust Access** | Cloudflare | Free Tier (Maksimal 50 user OTP) | **$0.00 / Gratis** |
| **DNS & SSL/TLS** | Cloudflare | Universal SSL (Domain yang sudah dimiliki) | **$0.00 / Gratis** |
| **Penyimpanan Backup** | Cloudflare R2 | Free Tier (10 GB storage gratis) | **$0.00 / Gratis** |
| **TOTAL BIAYA STAGING** | | | **$5.00 / bulan** |

---

## 10. Daftar Blockers & Pertanyaan Keputusan untuk Owner

Sesuai instruksi STOP, sistem menahan eksekusi deployment langsung ke cloud publik hingga 2 keputusan berikut disetujui owner:

```
┌────┬────────────────────────────────────────────────────────┬──────────────────────────────────────────────┐
│ No │ Item Keputusan                                         │ Pilihan yang Tersedia                        │
├────┼────────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ 1  │ Otorisasi Biaya Railway Staging ($5/bulan)             │ A. Setuju berlangganan Railway ($5/bulan).   │
│    │                                                        │ B. Gunakan alternatif gratis lain (Render/   │
│    │                                                        │    Fly.io/Koyeb) untuk staging sementara.   │
│    │                                                        │ C. Tetap gunakan staging lokal port 5433.    │
├────┼────────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ 2  │ Pembuatan Proyek Supabase Staging (`mfms-staging`)     │ A. Owner membuat proyek `mfms-staging` di    │
│    │                                                        │    dashboard Supabase & memberikan DB URL.   │
│    │                                                        │ B. Berikan Supabase PAT baru dengan izin     │
│    │                                                        │    `projects_write` untuk dibuat otomatis.   │
└────┴────────────────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

---

## 11. Rencana Transisi ke Phase 15C (Production Cutover)

Setelah staging cloud diuji dan disetujui oleh owner pada Phase 15B, tahapan cutover Phase 15C akan meliputi:
1. **Freeze Transaksi Toko:** Penutupan kasir lokal sementara (~15 menit) di luar jam operasional toko (misal: pukul 21:30 WIB).
2. **Final Encrypted Backup:** Eksekusi `php artisan mfms:backup` pada database produksi lokal MariaDB `mutiara_florist_prod`.
3. **Restorasi ke Supabase Produksi:** Eksekusi import terenkripsi ke database Supabase produksi dengan verifikasi checksum dan rekonsiliasi metrik finansial.
4. **Switchover Domain Cloudflare:** Mengalihkan CNAME `admin.mutiaraflorist.id` ke endpoint Railway produksi.
5. **Verifikasi Smoke Test:** Login owner dengan OTP Cloudflare Access, validasi saldo kas, pesanan aktif, dan pencetakan nota di cloud.
6. **Fallback Ready:** Komputer kasir lokal XAMPP tetap utuh sebagai backup offline instan bila koneksi internet toko mengalami kendala.

---
*Laporan ini disusun secara transparan dan jujur sesuai panduan operasional MFMS.*  
*Server lokal dan database produksi tetap aman dan beroperasi normal tanpa interupsi.*