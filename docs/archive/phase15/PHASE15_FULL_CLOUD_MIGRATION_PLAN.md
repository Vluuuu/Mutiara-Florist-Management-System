# MFMS — Phase 15: Full-Cloud Migration Feasibility & Architectural Transition Plan

**Status:** DRAFT UNTUK REVIEW OWNER (READ-ONLY AUDIT & PLANNING)  
**Tanggal Evaluasi:** 20 November 2026  
**Target Arsitektur:** Cloudflare (Edge/Access/DNS) + Railway (Laravel 12 & React/Inertia) + Supabase (PostgreSQL 16)  
**Target Domain:** `https://admin.mutiaraflorist.id`  
**Prinsip Keamanan:** Zero Trust, Perlindungan Data Finansial, Integritas Transaksional ACID, Zero Cloud Lockout

---

## Ringkasan Eksekutif (Executive Summary)

Owner Mutiara Indah Florist memutuskan untuk mengevaluasi pengalihan arsitektur deployment MFMS dari model **Local-First + Cloudflare Tunnel** (Phase 14) menuju **Full-Cloud Architecture**. Keputusan ini bertujuan menghilangkan ketergantungan operasional pada komputer kasir toko sebagai server fisik, mencegah gangguan saat komputer kasir dimatikan/mengalami kerusakan hardware, dan memungkinkan akses multi-operator yang stabil dari mana saja tanpa membebani perangkat kasir.

Laporan kelayakan ini menyimpulkan bahwa **migrasi MFMS ke Full-Cloud sangat layak (*highly feasible*), hemat biaya (~$5 - $7 / bulan), dan memiliki risiko teknis yang terkelola dengan baik**, asalkan 5 (lima) adaptasi kode kritis dan perlindungan keamanan zero-trust diterapkan secara ketat sebelum proses *cutover*.

---

## 1. Perbandingan Arsitektur: Full-Stack Railway vs Decoupled (Cloudflare Pages + Laravel API)

Sesuai arahan teknis, **Laravel Auth dan Inertia.js dipertahankan secara utuh**. Berikut adalah perbandingan komparatif terukur antara arsitektur Monolitik Full-Stack Modern (Railway) vs Arsitektur Terpisah (Cloudflare Pages/Workers + Headless REST API):

| Dimensi Evaluasi | Opsi A: Full-Stack Railway (Laravel 12 + Inertia/React) — *Direkomendasikan* | Opsi B: Decoupled (Cloudflare Pages/Workers + Headless API Railway) |
| :--- | :--- | :--- |
| **Beban & Waktu Adaptasi Kode** | **Hampir Nol (0 jam perubahan frontend).** Kode UI Inertia (`UiDashboard`, `UiCustomer`, `UiOrder`, `UiPayment`, `UiExpense`, `UiReport`) tetap 100% kompatibel tanpa modifikasi. | **Sangat Tinggi (80–120 jam kerja).** Seluruh controller harus diubah menjadi JSON Resource API; frontend harus dirombak total menggunakan client-side router, state manager, dan query fetching. |
| **Mekanisme Otentikasi & Sesi** | **Stateful Cookie Bawaan Laravel.** Aman dari serangan XSS via `HttpOnly`, `SameSite=Lax/Strict`, dan proteksi CSRF bawaan Laravel Session. | **Stateless Token (Sanctum/JWT).** Memerlukan penanganan refresh token, penyimpanan token pada browser yang rentan XSS, dan konfigurasi CORS lintas domain. |
| **Kompatibilitas Cloudflare Access** | **Sangat Mulus (*Native Seamless*).** Cloudflare Access melindungi seluruh domain web (`admin.mutiaraflorist.id`). Browser diarahkan ke layar OTP sebelum membuka halaman kasir. | **Rumit pada AJAX Request.** Request `fetch()` lintas domain dari Pages ke API Railway akan gagal/error CORS saat di-redirect oleh Cloudflare Access ke halaman OTP. |
| **Deployment & CI/CD** | **Satu Alur (*Single Pipeline*).** Satu kali `git push` ke Railway otomatis menjalankan build Vite, compile asset, dan menjalankan runtime PHP 8.3 container. | **Dua Alur Terpisah.** Pipeline terpisah untuk Cloudflare Pages dan Railway API, meningkatkan risiko desinkronisasi versi. |
| **Kebutuhan Bisnis Toko** | **Sangat Ideal untuk 1 Toko Florist (2–5 Operator).** Monolit modern memberikan efisiensi operasional maksimal tanpa kompleksitas mikroservis. | **Over-engineered.** Pola ini cocok untuk aplikasi publik berskala jutaan pengguna, bukan sistem kasir internal toko. |

### Diagram Arsitektur Target (Opsi A)

```
[ Operator HP / PC Kasir / Laptop Owner ]
                    │
                    ▼ (1) HTTPS Request ke admin.mutiaraflorist.id
      ┌─────────────────────────────┐
      │  Cloudflare Global Edge     │
      │  - DNS & Edge SSL           │
      │  - WAF & DDoS Shield        │
      │  - Cloudflare Access (OTP)  │  <─── Hanya email owner/operator yang diizinkan
      │  - Transform: X-Edge-Secret │
      └─────────────┬───────────────┘
                    │
                    ▼ (2) Proxy Terotentikasi (mTLS / Pre-shared Header)
      ┌─────────────────────────────┐
      │  Railway Container Service  │
      │  - Nginx / FrankenPHP       │
      │  - PHP 8.3 + Laravel 12     │
      │  - React / Inertia SPA      │
      │  - TrustHosts & TrustProxies│  <─── Tolak request tanpa Cloudflare Header
      └──────┬───────────────┬──────┘
             │               │
     (3) Web SQL Traffic     │ (4) Encrypted Nightly Backup Stream
             │               │
             ▼               ▼
┌─────────────────────────┐  ┌──────────────────────────────────┐
│  Supabase PostgreSQL    │  │  Cloudflare R2 Object Storage    │
│  - Port 6543 (Pooler)   │  │  - AES-256-GCM Backup (.enc)     │
│  - Port 5432 (Direct)   │  │  - SHA-256 Metadata (.meta.json) │
│  - RLS Aktif (No Anon)  │  │  - 0 Egress Fee, 90-day Policy   │
└─────────────────────────┘  └──────────────────────────────────┘
```

---

## 2. Inventaris & Audit Perubahan Kode: MariaDB ke PostgreSQL

Berdasarkan audit mendalam terhadap seluruh file migrasi, model, service, controller, dan query raw SQL, ditemukan **5 area utama** yang wajib diadaptasi agar MFMS berjalan 100% stabil di PostgreSQL:

### A. Case Sensitivity pada Pencarian Teks (`LIKE` vs `ILIKE`)
- **Masalah:** Di MariaDB dengan kolasi `utf8mb4_unicode_ci`, klausa `LIKE` bersifat *case-insensitive* (`budi` cocok dengan `Budi`). Di PostgreSQL, `LIKE` bersifat **case-sensitive**, sehingga pencarian kata kunci huruf kecil akan gagal menemukan nama pelanggan atau nomor pesanan berhuruf kapital.
- **Lokasi Kode Terdampak:**
  1. `app/Services/CustomerService.php` (L27–28)
  2. `app/Services/OrderService.php` (L34–35)
  3. `app/Services/PaymentService.php` (L33–34)
  4. `app/Http/Controllers/ExpenseController.php` (L45)
  5. `app/Http/Controllers/UiOrderController.php` (L43–44)
  6. `app/Http/Controllers/UiPaymentController.php` (L61–64)
- **Solusi Rekayasa:**  
  Gunakan klausa dinamis yang mendeteksi driver database, atau gunakan fungsi `LOWER(...)` standar ANSI SQL:
  ```php
  $likeOperator = DB::connection()->getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';
  $query->whereRaw("name {$likeOperator} ? ESCAPE '!'", [$pattern]);
  ```

### B. Penghapusan Fungsi `DATE(...)` pada Kolom yang Sudah Bertipe `DATE`
- **Masalah:** Di `app/Services/DashboardService.php` (L49–50, L118, L123–126, L132, L138), terdapat query:
  `whereRaw('DATE(order_date) = ?', [$todayIso])`
  Di PostgreSQL, fungsi `DATE(date_column)` tidak tersedia secara default (PostgreSQL hanya menyediakan konversi `date(timestamp)`). Selain itu, membungkus kolom dalam fungsi SQL merusak pemanfaatan B-Tree Index (*SARGability*).
- **Solusi Rekayasa:**  
  Karena kolom `order_date`, `delivery_date`, `payment_date`, dan `expense_date` sudah bertipe native `date`, query disederhanakan menjadi pembandingan langsung:
  ```php
  // Sebelum:
  ->whereRaw('DATE(order_date) = ?', [$todayIso])
  // Sesudah (Kompatibel MariaDB & PostgreSQL + Index SARGable):
  ->where('order_date', $todayIso)
  ```

### C. Sinkronisasi PostgreSQL Sequence (`AUTO_INCREMENT` vs `SERIAL`)
- **Masalah:** Di MariaDB, `AUTO_INCREMENT` secara otomatis meloncat ke nilai maksimum saat data lama diimpor dengan ID eksplisit. Di PostgreSQL, kolom ID menggunakan *sequence* (`tablename_id_seq`). Mengimpor data dengan ID manual **tidak menggeser sequence**, sehingga entri baru berikutnya akan melempar error fatal:
  `SQLSTATE[23505]: Unique violation: 7 ERROR: duplicate key value violates unique constraint "orders_pkey"`.
- **Solusi Rekayasa:**  
  Tambahkan pembaruan sequence wajib pada perintah restore/seeding:
  ```sql
  SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM users;
  SELECT setval(pg_get_serial_sequence('customers', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM customers;
  SELECT setval(pg_get_serial_sequence('orders', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM orders;
  SELECT setval(pg_get_serial_sequence('order_items', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM order_items;
  SELECT setval(pg_get_serial_sequence('payments', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM payments;
  SELECT setval(pg_get_serial_sequence('expenses', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM expenses;
  SELECT setval(pg_get_serial_sequence('expense_categories', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM expense_categories;
  SELECT setval(pg_get_serial_sequence('audit_logs', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM audit_logs;
  ```

### D. Adaptasi Snapshot Transaksional & Truncate pada `BackupService.php`
- **Masalah:** Di `app/Services/BackupService.php`:
  1. `createBackup()` mengeksekusi `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ` dan `START TRANSACTION WITH CONSISTENT SNAPSHOT` yang merupakan sintaks spesifik MySQL/MariaDB.
  2. `restoreTest()` mengeksekusi `SET FOREIGN_KEY_CHECKS=0` yang tidak dikenal di PostgreSQL.
- **Solusi Rekayasa:**
  1. Untuk pembuatan backup di PostgreSQL:
     ```php
     if ($driver === 'pgsql') {
         $pdo->exec('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');
         $inConsistentSnapshot = true;
     }
     ```
  2. Untuk pembersihan/truncate tabel pada uji restorasi di PostgreSQL:
     Gunakan pembersihan berjenjang (*cascade*) atau pengurutan topologis:
     ```sql
     TRUNCATE TABLE audit_logs, expenses, payments, order_items, orders, customers, expense_categories, users CASCADE;
     ```

### E. Konfigurasi `TrustProxies` dan `TrustHosts` di `bootstrap/app.php`
- **Masalah:** Saat ini `bootstrap/app.php` mengunci IP proxy hanya pada `['127.0.0.1', '::1']`. Di lingkungan Railway di balik Cloudflare, IP reverse proxy Railway dan Cloudflare bersifat dinamis. Jika tidak disesuaikan, Laravel tidak akan mempercayai header `X-Forwarded-Proto: https`, memicu *infinite redirect loop* HTTPS dan kegagalan verifikasi CSRF Inertia.
- **Solusi Rekayasa:**
  ```php
  $middleware->trustProxies(at: '*'); // Percayai edge proxy terdaftar
  $middleware->trustHosts(at: ['admin.mutiaraflorist.id']); // Kunci hanya domain resmi
  ```

---

## 3. Evaluasi Keamanan Supabase Data API & Perlindungan Tabel Finansial

Supabase secara default mengaktifkan **PostgREST Data API** pada `https://<project-ref>.supabase.co/rest/v1/`. Jika dibiarkan terbuka tanpa mitigasi, ini menghadirkan **risiko keamanan kritikal** bagi MFMS:

### Identifikasi Risiko
1. **Bypass Aturan Bisnis & Validasi:**  
   Laravel menegakkan integritas ketat (perhitungan server-side, idempotency UUID, kunci `lockForUpdate`, status linier, dan audit log). Siapapun yang memiliki Supabase Public Anon Key dapat mengirim request `POST/PATCH/DELETE` langsung ke API Supabase, melewati seluruh controller Laravel!
2. **Manipulasi Data Finansial:**  
   Penyerang dapat mengubah nilai `total_amount` order, menyisipkan `payments` fiktif, atau mengubah status menjadi `POSTED` tanpa jejak audit.

### Strategi Mitigasi Wajib (Defense-in-Depth)
MFMS adalah aplikasi monolitik murni di mana backend Laravel berkomunikasi langsung dengan PostgreSQL via port 6543/5432 menggunakan PDO. **MFMS sama sekali TIDAK MEMBUTUHKAN PostgREST atau Supabase JS Client**.

Langkah perlindungan mutlak yang harus diterapkan di Supabase:
1. **Aktifkan Row Level Security (RLS) pada SELURUH Tabel Bisnis:**
   ```sql
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
   ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
   ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
   ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
   ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
   ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
   ```
2. **JANGAN BUAT POLICY APAPUN untuk Role `anon` atau `authenticated`:**  
   Dengan RLS aktif tanpa policy, PostgREST akan menolak 100% permintaan baca/tulis dari internet luar (menghasilkan respons `401 Unauthorized` atau array kosong).
3. **Koneksi Laravel Menggunakan Role Pemilik (`postgres`):**  
   Koneksi PDO dari Railway menggunakan user database `postgres` yang secara native melewati (*bypass*) RLS, sehingga aplikasi kasir tetap berfungsi normal 100% tanpa hambatan.
4. **Matikan Skema Eksternal di Pengaturan Supabase:**  
   Buka *Project Settings -> API* di Supabase Dashboard, lalu hapus ekspos skema `public` dari API settings jika memungkinkan.

---

## 4. Perlindungan Cloudflare Access: Mencegah Bypass Hostname Provider

Ketika aplikasi di-deploy di Railway, provider biasanya memberikan domain publik default (misal: `mfms-production.up.railway.app`). Jika domain ini aktif, penyerang dapat langsung membuka halaman login melalui URL tersebut tanpa melewati Cloudflare Access OTP!

### Arsitektur Anti-Bypass Multi-Lapis

```
[ Akses Tak Resmi ke *.up.railway.app ] ───► [ Railway Origin ] ───► BLOCKED: 403 Forbidden
                                                                      (Bukan admin.mutiaraflorist.id &
                                                                       Tanpa X-Edge-Secret Header)

[ Akses Resmi ke admin.mutiaraflorist.id ] ──► [ Cloudflare Edge ]
                                                       │
                                              Validasi Email OTP
                                                       │
                                              Inject Header Rahasia
                                                       ▼
                                              [ Railway Origin ] ───► ALLOWED (200 OK)
```

### Langkah Konfigurasi Anti-Bypass
1. **Hapus Domain Default Provider di Railway:**  
   Setelah domain kustom `admin.mutiaraflorist.id` terhubung, hapus URL `*.up.railway.app` pada tab *Networking* di Railway. Dengan demikian, server origin hanya merespons Host Header kustom.
2. **Kunci Header Host pada Laravel (`TrustHosts`):**  
   Di `bootstrap/app.php`, pastikan hanya `admin.mutiaraflorist.id` yang diizinkan. Permintaan ke domain lain otomatis ditolak dengan `400 Bad Request`.
3. **Penyisipan Header Rahasia (*Pre-Shared Secret Header*):**
   - Di Cloudflare Dashboard (*Rules -> Transform Rules -> Modify Request Header*):  
     Tambahkan header: `X-MFMS-Edge-Secret: <string_acak_64_karakter>`.
   - Di Laravel Middleware (`EnsureCloudflareOrigin.php`):  
     Periksa apakah `request()->header('X-MFMS-Edge-Secret')` cocok dengan nilai pada `.env`. Jika tidak ada atau tidak cocok, lempar `abort(403, 'Akses origin langsung dilarang.')`.
4. **Verifikasi Cloudflare Access JWT Assertion:**  
   Cloudflare Access menyertakan header `Cf-Access-Jwt-Assertion` pada setiap request yang lolos autentikasi OTP. Middleware Laravel dapat memvalidasi signature JWT ini terhadap public key Cloudflare (`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`).

---

## 5. Manajemen Lingkungan, Database Connection Pooling, dan Cadangan

### A. Konfigurasi Connection Pooling Supabase (Supavisor)
PostgreSQL memiliki batas koneksi maksimal (*max connections*). Untuk mencegah *connection exhaustion* pada arsitektur cloud:
- **Web App Connection (Port 6543 - Transaction Mode):**  
  Gunakan URL pooler Supavisor untuk operasional web harian:
  ```env
  DB_CONNECTION=pgsql
  DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
  DB_PORT=6543
  DB_DATABASE=postgres
  DB_USERNAME=postgres.projectref
  DB_PASSWORD=secret
  DB_SSLMODE=require
  ```
  *Catatan Kritis:* Di `config/database.php`, aktifkan emulator prepared statements untuk koneksi pooler:
  ```php
  'options' => [
      PDO::ATTR_EMULATE_PREPARES => true,
  ],
  ```
- **Migration & Admin Connection (Port 5432 - Direct Session Mode):**  
  Gunakan port langsung untuk menjalankan `php artisan migrate` saat deployment, karena migrasi skema membutuhkan DDL transaksional penuh.

### B. Penyimpanan Cadangan Terenkripsi di Cloudflare R2
Di lingkungan Railway, filesystem container bersifat **efemeral (sementara)**; file yang disimpan di disk lokal akan terhapus saat redeploy atau restart. Oleh karena itu:
1. Cadangan harian (`mfms:backup`) tetap dienkripsi penuh menggunakan **AES-256-GCM** dengan kunci khusus (`BACKUP_ENCRYPTION_KEY`).
2. Setelah file `.enc` dan `.meta.json` selesai diproses di memori/storage sementara, file langsung dialirkan (*stream upload*) ke **Cloudflare R2 Private Bucket** menggunakan driver S3-compatible (`league/flysystem-aws-s3-v3`).
3. Kunci enkripsi backup **disimpan terpisah** di brankas password owner, tidak disimpan di database.
4. Konfigurasi Lifecycle Rule di Cloudflare R2: hapus otomatis file backup yang lebih tua dari 90 hari untuk efisiensi ruang.

---

## 6. Estimasi Biaya Operasional Bulanan (Single Shop, Multi-Operator)

Perhitungan estimasi biaya operasional bulanan untuk Mutiara Indah Florist (1 toko, 1 owner, 2–4 operator kasir):

| Komponen Layanan | Spesifikasi Resource | Skema Biaya | Estimasi / Bulan (USD) | Estimasi / Bulan (IDR) |
| :--- | :--- | :--- | :--- | :--- |
| **Cloudflare DNS & SSL** | Unlimited DNS queries, Edge SSL, DDoS Shield | Free Plan | $0.00 | Rp 0 |
| **Cloudflare Zero Trust (Access)** | Perlindungan OTP Email hingga 50 pengguna aktif | Free Tier (Up to 50 seats) | $0.00 | Rp 0 |
| **Cloudflare R2 Storage** | Penyimpanan backup terenkripsi (<100 MB data toko) | Free Tier (10 GB storage, $0 egress) | $0.00 | Rp 0 |
| **Railway Container Hosting** | Laravel 12 + Inertia SSR/Vite (0.5 vCPU, 512MB–1GB RAM) | Hobby Plan ($5 base kredit bulanan) | $5.00 – $7.00 | Rp 80.000 – Rp 110.000 |
| **Supabase PostgreSQL** | Database 500 MB, Compute Micro, Auto Backup | Free Tier (atau Pro $25 jika butuh SLA tinggi) | $0.00 (Opsi Free) | Rp 0 |
| **Domain .id** | `mutiaraflorist.id` (Biaya registrar tahunan Rp 250.000) | Tahunan diamortisasi bulanan | ~$1.30 | Rp 21.000 |
| **TOTAL ESTIMASI BIAYA** | **Arsitektur Full-Cloud Standar (Supabase Free + Railway)** | **Bulanan** | **~$6.30 – $8.30** | **~Rp 100.000 – Rp 130.000** |

> **Perbandingan Penghematan:**  
> Menjalankan komputer kasir fisik non-stop 24/7 di toko mengonsumsi daya listrik sekitar 100–150 Watt (~108 kWh/bulan = ±Rp 180.000/bulan) ditambah risiko keausan hardware (harddisk/SSD/PSU rusak). Arsitektur full-cloud justru **lebih hemat biaya** dan jauh lebih andal.

---

## 7. Analisis Ketersediaan Layanan Saat Internet Toko Terputus (Outage Analysis)

Peralihan dari arsitektur lokal ke full-cloud membawa konsekuensi operasional terhadap ketersediaan layanan saat jaringan internet toko terputus:

| Aspek Operasional | Arsitektur Lama (Local-First Phase 14) | Arsitektur Baru (Full-Cloud Phase 15) |
| :--- | :--- | :--- |
| **Status Saat Internet ISP Toko Mati** | Kasir PC tetap bisa melayani transaksi via `127.0.0.1:8000` (LAN lokal). Akses remote owner mati. | Kasir PC di toko **tidak dapat membuka sistem** melalui jaringan Wi-Fi toko yang mati. |
| **Dampak Pemadaman Listrik Toko (PLN Padam)** | Server toko ikut mati total, seluruh operasional kasir lumpuh. | **Server cloud tetap hidup 100%.** Operator/owner tetap dapat memproses pesanan melalui HP Android/iPhone menggunakan paket data seluler. |
| **Risiko Kerusakan Hardware Kasir** | Jika komputer kasir rusak/terkena virus/rusak OS, data lokal terancam dan sistem mati. | Komputer kasir hanyalah terminal browser (*thin client*). Jika rusak, kasir bisa langsung digantikan laptop lain atau tablet dalam 1 menit. |

### SOP Kontinjensi Toko Saat Koneksi ISP Padam
1. **Peralihan Cepat ke Mobile Hotspot (Tethering):**  
   Karena antarmuka MFMS sudah 100% responsif mobile (Phase 7 & 8), operator toko cukup menyalakan hotspot seluler smartphone dan menghubungkan PC kasir, atau langsung membuka `https://admin.mutiaraflorist.id` via browser smartphone.
2. **Nota Manual Sementara (<15 Menit Gangguan):**  
   Jika sinyal seluler toko mengalami gangguan total sesaat, operator mencatat transaksi di buku nota fisik manual, lalu menginputkannya ke MFMS begitu koneksi pulih.
3. **Keamanan Idempotensi Input Susulan:**  
   Form pesanan dan pembayaran MFMS menghasilkan `idempotency_key` unik di backend begitu form dibuka, sehingga input susulan tidak akan menyebabkan duplikasi data.

---

## 8. Rencana Implementasi Bertahap (Staging, Migration, Rollback & Test Plan)

Proses migrasi wajib dilaksanakan tanpa mengganggu operasional toko yang sedang berjalan (*zero disruption*):

### Tahap 1: Persiapan & Adaptasi Kode di Lingkungan Staging Lokal
1. Tambahkan konfigurasi koneksi `pgsql` pada `config/database.php`.
2. Adaptasi query `LIKE` -> `ILIKE` / `LOWER()` untuk kompatibilitas PostgreSQL.
3. Sederhanakan fungsi `DATE()` pada kolom tanggal di `DashboardService.php`.
4. Perbarui `BackupService.php` agar mendukung transaksi konsisten PostgreSQL dan reset sequence pasca-restorasi.
5. Jalankan seluruh rangkaian pengujian otomatis unit & fitur:
   ```bash
   php artisan test
   ```
   *Gate:* Seluruh 23 file test suite wajib berstatus PASS 100%.

### Tahap 2: Pembentukan Infrastruktur Cloud Staging (Tanpa Biaya Tambahan)
1. Buat project staging di Supabase PostgreSQL. Terapkan RLS pada seluruh tabel.
2. Buat service staging di Railway yang terhubung ke repositori branch `staging`.
3. Pasang variabel environment staging (kunci enkripsi, credentials database Supavisor).
4. Konfigurasikan Cloudflare Access pada subdomain staging (misal: `staging.mutiaraflorist.id`) dengan otentikasi OTP ke email owner.
5. Verifikasi bahwa direct access ke URL bawaan Railway menghasilkan HTTP 403.

### Tahap 3: Uji Dry-Run Migrasi Data
1. Ekspor cadangan dari database lokal menggunakan:
   ```bash
   php artisan mfms:backup
   ```
2. Jalankan uji restorasi otomatis ke database PostgreSQL Supabase:
   ```bash
   php artisan mfms:restore-test <backup_file.enc> --connection=pgsql_staging
   ```
3. Lakukan verifikasi matematis rekonsiliasi metrik keuangan:
   - `orders_count` cocok 100%
   - `orders_total_amount` cocok 100%
   - `payments_posted_amount` cocok 100%
   - `expenses_posted_amount` cocok 100%
   - Tidak ada foreign key yatim (*zero orphan records*).

### Tahap 4: Pelaksanaan Cutover Produksi (Estimasi Downtime: 15–30 Menit)
*Jadwal Eksekusi:* Malam hari di luar jam operasional toko (pukul 22:00 – 23:00 WIB).
1. **Kunci Server Lokal:** Aktifkan maintenance mode di server toko:
   ```bash
   php artisan down --message="Sedang berlangsung migrasi sistem ke cloud."
   ```
2. **Final Point-in-Time Snapshot:** Buat backup final terenkripsi dari `mutiara_florist_prod`.
3. **Import & Sequence Reset:** Muat snapshot ke database produksi Supabase dan sinkronkan seluruh sequence PostgreSQL.
4. **Validasi Paritas Data:** Pastikan total saldo buku dan transaksi di Supabase identik 100% dengan database lokal.
5. **Switchover DNS Cloudflare:** Arahkan CNAME `admin.mutiaraflorist.id` ke domain Railway yang telah diproteksi Cloudflare Access.
6. **Live Sanity Check:**
   - Login menggunakan akun admin owner via OTP Cloudflare Access + Password Bcrypt.
   - Periksa ringkasan dashboard, buat 1 pesanan uji coba, catat pembayaran uji coba, dan unduh laporan Excel.
   - Hapus/void data uji coba sesuai prosedur audit.

### Tahap 5: Rencana Pemulihan Darurat (Rollback Plan)
Jika terjadi kendala kritis yang tidak dapat diselesaikan dalam 30 menit selama masa cutover:
1. Kembalikan DNS `admin.mutiaraflorist.id` di Cloudflare ke target Cloudflare Tunnel lokal yang lama.
2. Nonaktifkan maintenance mode di komputer kasir toko:
   ```bash
   php artisan up
   ```
3. Komputer kasir toko kembali aktif seketika sebagai server operasional tanpa ada data yang hilang, karena database lokal `mutiara_florist_prod` sama sekali tidak dimodifikasi selama proses migrasi.

---

## 9. Rekomendasi Akhir untuk Owner

1. **Arah Migrasi Disetujui Secara Teknis:**  
   Peralihan ke arsitektur Full-Cloud (Cloudflare + Railway + Supabase) adalah keputusan strategis yang tepat untuk memodernisasi MFMS, membebaskan komputer kasir toko dari beban server, dan menjamin akses real-time bagi owner.
2. **Pertahankan Monolit Laravel + Inertia:**  
   Jangan memecah sistem menjadi REST API terpisah. Pendekatan monolitik modern memberikan keamanan cookie stateful maksimal dan menghemat ratusan jam kerja pengembangan.
3. **Wajib Menerapkan RLS Supabase & Cloudflare Anti-Bypass:**  
   Jangan meluncurkan cloud tanpa mengunci Supabase RLS dan memblokir domain default provider Railway. Keamanan data keuangan pelanggan adalah prioritas nomor satu.
4. **Keputusan Go/No-Go:**  
   Rencana ini siap dieksekusi ke tahap **Phase 15 Implementation** setelah owner meninjau dan memberikan persetujuan formal atas dokumen ini.

---
*Dokumen ini dibuat secara otomatis dalam mode Read-Only Audit & Planning. Tidak ada database operasional, DNS, tunnel, atau konfigurasi lokal yang diubah.*
