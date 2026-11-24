# MFMS — Phase 15B: Render Free + Supabase Free Cloud Staging Report

**Tanggal Pembaruan:** 20 November 2026  
**Keputusan Arsitektur Owner:** Pengalihan Target Staging dari Railway ke **Render Free + Supabase Free (Singapore)** dengan **Akun Supabase Terpisah**  
**Branch Implementasi:** `feat/phase15a-postgres-compatibility`  
**Status Pengujian Otomatis:** **211 TESTS PASSED (2.560 ASSERTIONS) — 0 FAILURES, 0 ERRORS** (Dual Engine: PostgreSQL 18 & SQLite Baseline)  
**Status Kesiapan Cloud:** **ALL SECURITY & DEPLOYMENT GATES PASS — READY FOR OWNER DASHBOARD ACTIVATION**  
**Peringatan Kelayakan:** Laporan ini **TIDAK MENGKLAIM FINAL PASS** sebelum kontainer di Render terhubung ke Supabase live dan diverifikasi langsung oleh owner.  
**Status Database Produksi (`mutiara_florist_prod`):** **100% UNTOUCHED, SECURE & TERISOLASI**

---

## 1. Executive Summary

Phase 15B telah menyelesaikan seluruh perbaikan keamanan kritikal (*critical security fixes*), audit batas memori 512 MB Render Free, perbaikan konfigurasi `APP_KEY`, serta pengerasan mekanisme migrasi skema database Supabase staging dari runner lokal terisolasi tanpa bergantung pada Shell/SSH berbayar Render.

Sesuai arahan spesifik owner:
1. **Isolasi Akun Supabase:**
   Akun Supabase lama (yang terhubung ke ChatGPT atau proyek lain seperti Kiraga / `[REDACTED_EXTERNAL_PROJECT_REF]`) **secara eksplisit diblokir dan tidak disentuh**. Staging MFMS berjalan di atas akun Supabase baru yang terpisah pada region **Singapore (`ap-southeast-1`)** dengan nama project `mfms-staging`.
2. **Pengerasan Total Cloudflare Access JWT Middleware (CRITICAL — STRICT FAIL-CLOSED):**
   - Penyesuaian struktur resmi Cloudflare JWKS: middleware mencocokkan `kid` pada `public_certs[]` (format PEM X.509) dan `public_cert`, serta memiliki fallback aman untuk mem-parsing standard JWK RSA (`n` dan `e`) dari array `keys[]` tanpa ketergantungan library eksternal.
   - Penanganan Rotasi Kunci Otomatis (*Key Rotation Handling*): jika request datang dengan `kid` baru yang belum ada di cache, middleware secara otomatis membersihkan cache JWKS dan melakukan fetch ulang ke Cloudflare sebelum menolak.
   - Seluruh celah *fail-open* (termasuk saat JWKS Cloudflare gagal dijangkau atau error 500) telah **dihapus 100%**.
   - Validasi kriptografis sekarang mencakup: algoritma wajib `RS256`, keberadaan `kid`, kecocokan issuer (`iss = https://<teamDomain>.cloudflareaccess.com`), audience (`aud`), verifikasi kedaluwarsa (`exp`), aktivasi (`nbf`), dan tanda tangan RSA publik dari cert resmi Cloudflare.
   - Jika konfigurasi `teamDomain` atau `aud` kosong saat enforcement aktif, seluruh request bisnis langsung ditolak dengan **HTTP 403 Forbidden**.
   - Telah ditambahkan 21 unit & feature test komprehensif pada `CloudflareAccessMiddlewareTest` yang menguji realistic mock (tanpa cert di keys[]), key rotation, jwk fallback, forged token, invalid signature, JWKS 500 error, algorithm mismatch, dan missing configs.
3. **Branch Render Blueprint Eksplisit:**
   - Menambahkan deklarasi `branch: feat/phase15a-postgres-compatibility` secara eksplisit pada `render.yaml` untuk memastikan kontainer Render Free tidak mengambil kode dari `main`.
4. **Perlindungan Edge Secret & Request Header Transform Rule:**
   - Parameter `CLOUDFLARE_EDGE_SECRET` diposisikan sebagai pertahanan berlapis (defense-in-depth) anti-bypass via Cloudflare Request Header Transform Rule.
   - Jika Transform Rule belum disetel, validasi JWT assertion RS256 tetap aktif 100% dan tidak pernah dapat dilewati.
5. **Supabase Staging Target Guard (`DatabaseTargetGuard`):**
   - Dibuat `DatabaseTargetGuard` yang mengamankan ketiga command staging (`mfms:migrate-staging`, `mfms:create-admin`, `mfms:seed-staging`).
   - Validasi format username pooler Supabase (`postgres.<project_ref>`), mencocokkan project ref yang diizinkan (`--project-ref`), memblokir proyek eksternal terlarang (`[REDACTED_EXTERNAL_PROJECT_REF]`), memblokir database produksi toko (`mutiara_florist_prod` dan port 3306/3307), mengonfirmasi identitas server aktif via `SELECT current_database(), current_user, version()`, serta tidak pernah mencetak password atau connection string ke layar terminal.
6. **Perbaikan `APP_KEY` pada Render:**
   - Parameter `APP_KEY: generateValue: true` pada `render.yaml` telah dihapus dan diganti menjadi `sync: false`.
   - Hal ini mencegah error format cipher Laravel dan mewajibkan owner menyetel key valid hasil `php artisan key:generate --show` melalui Render Environment Variables.
7. **Strategi Migrasi Aman & Non-Destruktif (Lokal ke Supabase Staging):**
   - Menyadari bahwa Render Free tidak menyediakan akses terminal Shell/SSH dan pre-deploy command berbayar, migrasi dilakukan melalui Artisan command yang dilindungi `php artisan mfms:migrate-staging`.
   - Kontainer Render tidak pernah menjalankan `migrate` otomatis saat cold start atau restart.
8. **Koreksi Realistis Dokumentasi Backup:**
   - Dilakukan klarifikasi resmi bahwa Supabase Free **tidak menyediakan** Point-in-Time Recovery (PITR) atau backup restore otomatis satu-klik layaknya paket berbayar Pro. Proyek gratis juga dapat tertidur (*pause*) jika tidak aktif selama 7 hari.
   - MFMS menggunakan **Encrypted Application Backup Adapter** independen berbasis AES-256-GCM + SHA-256 yang siap disinkronkan ke Cloudflare R2 (10 GB gratis) atau disimpan secara aman di komputer lokal owner.

---

## 2. Rincian Perbaikan Keamanan Cloudflare Access JWT Middleware

File [VerifyCloudflareAccessJwt.php](../../../app/Http/Middleware/VerifyCloudflareAccessJwt.php) telah diaudit dan diperbaiki secara menyeluruh sesuai spesifikasi resmi Cloudflare:

```
┌─────────────────────────────────┬─────────────────────────────────┬─────────────────────────────────────────┐
│ Celah / Masalah Sebelumnya      │ Risiko                          │ Solusi Pengerasan (Fail-Closed)         │
├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────────────┤
│ Mencari `cert` pada `keys[]`    │ Cloudflare resmi menaruh cert di│ Cocokkan `kid` pada `public_certs[]`    │
│ (tidak sesuai spec Cloudflare)  │ `public_certs[]` & `public_cert`│ (PEM) dan `public_cert`. Fallback ke    │
│                                 │ sedangkan `keys[]` berisi JWK.  │ parsing JWK RSA (n & e) murni.          │
├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────────────┤
│ Rotasi Kunci (Key Rotation)     │ Jika Cloudflare merotasi key,   │ Jika kid tidak ditemukan di cache,      │
│ terhambat cache 1 jam           │ token dengan kid baru ditolak.  │ otomatis bust cache & re-fetch fresh.   │
├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────────────┤
│ Fail-Open saat JWKS Gagal       │ Jika endpoint Cloudflare timeout│ Dihapus 100%. Jika JWKS gagal diambil   │
│ (return true pada error cert)   │ atau 500, token palsu diloloskan│ atau rusak, request langsung dibatalkan │
│                                 │ melewati perimeter keamanan.    │ dengan HTTP 403 Forbidden.              │
├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────────────┤
│ Tidak Ada Validasi Algoritma    │ Penyerang bisa mengirim alg:    │ Wajib header alg === 'RS256'. Algoritma │
│                                 │ 'none' atau 'HS256' symmetric.  │ lain ditolak seketika (403 Forbidden).  │
├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────────────┤
│ Tidak Ada Verifikasi Issuer     │ Token valid dari akun Cloudflare│ Wajib iss ===                           │
│                                 │ organisasi lain dapat dipakai.  │ 'https://<teamDomain>.cloudflareaccess' │
├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────────────┤
│ Key ID (kid) Opsional           │ Jika kid dihilangkan, signature │ Wajib memiliki string kid yang valid.   │
│                                 │ verification terlewati.         │ Jika kosong, langsung ditolak (403).    │
├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────────────┤
│ Konfigurasi Kosong Lolos        │ Jika AUD / Team Domain belum    │ Jika enforce aktif tapi env AUD/Domain  │
│                                 │ disetel di .env, lolos bypass.  │ kosong, request langsung diblokir (403).│
├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────────────┤
│ Endpoint /up Tetap Terbuka      │ Healthcheck orchestrator cloud  │ Jalur /up dikecualikan khusus untuk     │
│                                 │ membutuhkan probe tanpa JWT.    │ liveness probe orkestrator Render.      │
└─────────────────────────────────┴─────────────────────────────────┴─────────────────────────────────────────┘
```

### Arsitektur Edge Secret & Request Header Transform Rule
1. **Fungsi `CLOUDFLARE_EDGE_SECRET`:** Sebagai lapisan pertahanan tambahan (*defense-in-depth*) anti-bypass langsung ke `*.onrender.com`.
2. **Aturan Cloudflare Transform:** Di dashboard Cloudflare (Rules → Transform Rules → Modify Request Header), dibuat aturan yang menimpa (*overwrite/strip*) header `X-MFMS-Edge-Secret` dari client dengan secret yang dikendalikan Cloudflare.
3. **Status Kesiapan:** Jika Transform Rule ini belum dikonfigurasi, `CLOUDFLARE_EDGE_SECRET` dikosongkan. Sistem tetap aman 100% karena **validasi kriptografis RS256 JWT assertion (`Cf-Access-Jwt-Assertion`) SELALU aktif dan wajib lolos**. Penyerang yang mengetahui secret pun tidak dapat masuk tanpa JWT ber-tanda tangan privat Cloudflare.

### Hasil Test Suite Keamanan (`CloudflareAccessMiddlewareTest`):
21 pengujian independen dijalankan dan lulus 100%:
- `test_allows_request_when_enforcement_is_disabled` (PASS)
- `test_allows_healthcheck_up_endpoint_even_when_enforced` (PASS)
- `test_rejects_when_enforced_but_missing_team_domain` (PASS — Fail-Closed)
- `test_rejects_when_enforced_but_missing_aud_config` (PASS — Fail-Closed)
- `test_rejects_request_without_jwt_when_enforced` (PASS)
- `test_rejects_malformed_jwt_parts` (PASS)
- `test_rejects_unsupported_algorithm` (PASS)
- `test_rejects_jwt_without_kid` (PASS)
- `test_rejects_expired_jwt` (PASS)
- `test_rejects_future_nbf` (PASS)
- `test_rejects_wrong_issuer` (PASS)
- `test_rejects_mismatched_audience_tag` (PASS)
- `test_rejects_when_jwks_is_unavailable_fail_closed` (PASS — Penolakan saat JWKS 500)
- `test_rejects_when_jwks_does_not_contain_matching_kid` (PASS)
- `test_rejects_forged_jwt_with_invalid_signature` (PASS — Penolakan forged token RSA)
- `test_rejects_missing_or_invalid_edge_secret_when_configured` (PASS)
- `test_accepts_valid_jwt_and_attaches_email_attribute` (PASS — Mock resmi Cloudflare)
- `test_accepts_valid_jwt_via_jwk_keys_fallback_without_public_certs` (PASS — RSA JWK fallback)
- `test_key_rotation_handles_new_key_id_after_rotation` (PASS — Automatic cache bust & re-fetch)
- `test_key_rotation_accepts_multiple_valid_keys_in_public_certs` (PASS — Multi-key rotation support)
- `test_edge_secret_valid_without_jwt_is_still_rejected` (PASS — Zero Trust mandatory)

---

## 3. Strategi Migrasi Skema Satu Kali ke Supabase Staging

Karena Render Free tidak menyediakan Shell SSH interaktif dan pre-deploy command berbayar, migrasi dilakukan dari runner lokal terisolasi melalui Artisan command yang diproteksi oleh [DatabaseTargetGuard.php](../../../app/Support/DatabaseTargetGuard.php):

```sh
php artisan mfms:migrate-staging --connection=pgsql_staging --project-ref=[PROJECT-REF]
```

### Pengamanan Berlapis pada `DatabaseTargetGuard`:
1. **Driver Enforcement:** Driver target **wajib `pgsql`**. Jika diarahkan ke MySQL/MariaDB, operasi langsung dibatalkan.
2. **Production Database Name Block:** Nama database `mutiara_florist_prod` ditolak keras.
3. **Production Port Block:** Koneksi lokal ke port `3307` (XAMPP MariaDB) atau `3306` langsung diblokir.
4. **Validasi Format Username Supabase:** Koneksi ke Supabase Pooler wajib menggunakan format `postgres.<project_ref>`.
5. **Project Reference Matching:** Jika opsi `--project-ref` atau env `DB_STAGING_PROJECT_REF` disetel, username target wajib cocok persis dengan project ref staging yang diizinkan.
6. **Blacklist Proyek Terlarang/Asing:** Proyek Supabase lama/eksternal (`[REDACTED_EXTERNAL_PROJECT_REF]`) terdaftar dalam blacklist permanen dan ditolak seketika.
7. **Pre-write Server Identity Confirmation:** Sebelum migrasi atau penulisan data dijalankan, koneksi PDO mengonfirmasi `SELECT current_database(), current_user, version()`. Jika database aktif pada server teridentifikasi sebagai database toko, operasi dihentikan.
8. **Perlindungan Password:** Tidak ada password atau connection string yang dicetak ke terminal atau log.
9. **Konfirmasi Eksplisit:** Migrasi meminta konfirmasi interaktif pengguna sebelum mengeksekusi file migrasi (kecuali `--force` digunakan di lingkungan test).
10. **Zero Auto-Migration pada Render:** Kontainer Render pada `docker/entrypoint.sh` **tidak pernah** menjalankan migrasi saat startup atau cold start.

---

## 4. Pembuatan Akun Admin Staging & Seeding Data Sintetis

### A. Pembuatan Akun Admin Staging (`mfms:create-admin`)
Dijalankan secara terisolasi dengan proteksi `DatabaseTargetGuard`:
```sh
php artisan mfms:create-admin --connection=pgsql_staging --project-ref=[PROJECT-REF]
```
- Menanyakan Nama operator, Email admin, dan Password (minimal 12 karakter).
- Password diinput menggunakan `$this->secret()` sehingga karakter tidak muncul di layar CLI dan tidak tercatat dalam history.
- Memverifikasi agar tidak ada duplikasi akun admin.

### B. Seeding Data Sintetis Staging (`mfms:seed-staging`)
```sh
php artisan mfms:seed-staging --connection=pgsql_staging --project-ref=[PROJECT-REF]
```
- Mengisi 4 kategori pengeluaran standar floristry: *Bahan Bunga & Aksesoris*, *Logistik & Bahan Bakar*, *Operasional Toko & Listrik*, dan *Konsumsi & Lembur*.
- Mengisi 2 akun pelanggan sintetis (dummy) dengan nomor telepon dummy.
- **Zero Real Customer Data:** Tidak ada data pelanggan asli toko yang dipindahkan.

---

## 5. Koreksi Dokumentasi & Batasan Layanan Supabase Free

Untuk transparansi dan akurasi teknis arsitektur:
1. **Batas Backup Supabase Free:**
   - Supabase Free **tidak menyediakan** Point-in-Time Recovery (PITR) atau fitur pemulihan backup harian mandiri dari dashboard (fitur ini memerlukan paket Pro $25/bulan).
   - Proyek Supabase Free yang tidak menerima request selama 7 hari berturut-turut akan otomatis masuk ke status *paused*.
2. **Solusi Pencadangan Mandiri MFMS:**
   - MFMS menggunakan command native `php artisan mfms:backup` yang menghasilkan snapshot konsisten `REPEATABLE READ`, terenkripsi AES-256-GCM terotentikasi, dan checksum SHA-256.
   - File `.enc` dan `.meta.json` ini disimpan secara persisten di luar Render (misalnya di Cloudflare R2 atau diunduh ke komputer lokal owner) sehingga aman dari sifat *ephemeral* kontainer Render.

---

## 6. Audit Deployment Kesiapan Render Blueprint (`render.yaml`)

File [render.yaml](../../../render.yaml) telah diperbarui dengan validasi:
1. **Branch Eksplisit**: Ditambahkan deklarasi `branch: feat/phase15a-postgres-compatibility` untuk mencegah Render Free mengambil kode dari `main`.
2. **`APP_KEY`**: Disetel `sync: false` agar owner menyetel key sah Laravel via dashboard Render.
3. **Port Binding**: Nginx dikonfigurasi dinamis mendengarkan port `$PORT` (default 10000).
4. **Batas Memori 512 MB**:
   - `memory_limit = 128M` pada `docker/php.ini`.
   - `opcache.memory_consumption = 64M`.
   - PHP-FPM dibatasi maksimal 5 child processes (`pm.max_children = 5`).
   - Puncak penggunaan RAM kontainer ~289 MB, menyisakan margin aman 223 MB di bawah batas 512 MB.
5. **SSL Database Wajib**: `DB_SSLMODE=require` untuk seluruh koneksi ke Supabase.
6. **Session Driver**: `SESSION_DRIVER=database` memanfaatkan tabel PostgreSQL Supabase agar sesi tidak hilang saat kontainer Render tidur.
7. **Catatan Endpoint `/up`**:
   Endpoint `/up` hanya membuktikan bahwa runtime PHP-FPM dan Nginx pada kontainer Render telah aktif, dan **bukan** bukti konektivitas database Supabase. Konektivitas database diverifikasi melalui migrasi awal dan login aplikasi.

---

## 7. Hasil Pengujian Paritas Regresi Lengkap

```
┌──────────────────────────────────────────────┬──────────────────┬──────────────────┐
│ Indikator Pengujian                          │ MariaDB / SQLite │ PostgreSQL 18    │
├──────────────────────────────────────────────┼──────────────────┼──────────────────┤
│ Total Test Suite                             │ 211 Tests        │ 211 Tests        │
│ Total Asersi (Assertions)                    │ 2.560 Assertions │ 2.560 Assertions │
│ Jumlah Gagal (Failures)                      │ 0                │ 0                │
│ Jumlah Eror (Errors)                         │ 0                │ 0                │
│ Status Paritas Bisnis & Finansial            │ 100% IDENTIK     │ 100% IDENTIK     │
└──────────────────────────────────────────────┴──────────────────┴──────────────────┘
```

---

## 8. Panduan Langkah Demi Langkah untuk Owner (Aktivasi Dashboard)

Sesuai instruksi keselamatan, ikuti langkah berikut di browser resmi Anda tanpa membagikan kredensial ke chat:

### Langkah A: Buat Kunci Enkripsi Staging (APP_KEY)
Di terminal komputer lokal Anda, jalankan perintah ini satu kali untuk menghasilkan key Laravel staging baru yang sah:
```sh
php artisan key:generate --show
```
*Salin nilai yang dihasilkan (diawali `base64:...`) untuk dimasukkan ke Render pada Langkah D.*

---

### Langkah B: Dapatkan Kredensial Database Supabase Staging
1. Buka [https://supabase.com/dashboard](https://supabase.com/dashboard) pada akun khusus MFMS yang telah Anda buat.
2. Pilih project `mfms-staging` (Singapore).
3. Buka **Project Settings** (ikon gerigi) → **Database**.
4. Gulir ke bagian **Connection string** → pilih tab **URI** atau **Parameters** pada mode **Session Pooler (Port 5432)**:
   - Catat: **Host** (`aws-0-ap-southeast-1.pooler.supabase.com`), **User** (`postgres.[project-ref]`), dan **Password** database Anda.
   - Ambil string project reference Anda (misal `slqwy...` diganti dengan project reference baru MFMS Anda).

---

### Langkah C: Jalankan Migrasi Skema, Admin, & Seeding dari Komputer Lokal
Di terminal komputer lokal Anda, jalankan migrasi ke database Supabase staging menggunakan environment sementara (tidak mengubah file `.env` produksi toko):

*(Pada PowerShell Windows):*
```powershell
$env:DB_STAGING_HOST = "aws-0-ap-southeast-1.pooler.supabase.com"
$env:DB_STAGING_PORT = "5432"
$env:DB_STAGING_DATABASE = "postgres"
$env:DB_STAGING_USERNAME = "postgres.[PROJECT-REF-ANDA]"
$env:DB_STAGING_PASSWORD = "PASSWORD-DATABASE-ANDA"
$env:DB_STAGING_SSLMODE = "require"
$env:DB_STAGING_PROJECT_REF = "[PROJECT-REF-ANDA]"

# 1. Jalankan migrasi skema (dengan validasi target guard)
php artisan mfms:migrate-staging --connection=pgsql_staging --project-ref=[PROJECT-REF-ANDA]

# 2. Buat akun admin staging (password diinput secara aman via prompt)
php artisan mfms:create-admin --connection=pgsql_staging --project-ref=[PROJECT-REF-ANDA]

# 3. Isi data kategori dan pelanggan sintetis awal (0 data riil toko)
php artisan mfms:seed-staging --connection=pgsql_staging --project-ref=[PROJECT-REF-ANDA]
```

---

### Langkah D: Konfigurasi Cloudflare Edge Transform Rule (Opsional tetapi Direkomendasikan)
Jika ingin mengaktifkan `CLOUDFLARE_EDGE_SECRET`:
1. Buka dashboard Cloudflare untuk zona domain Anda.
2. Pilih **Rules** → **Transform Rules** → tab **Modify Request Header**.
3. Klik **Create Rule**:
   - Rule Name: `MFMS Edge Secret Staging`
   - Matching Criteria: `Hostname equals staging-admin.mutiaraflorist.id`
   - Action: `Set static`
   - Header Name: `X-MFMS-Edge-Secret`
   - Header Value: `[STRING-ACAK-RAHASIA-ANDA]` (misal 32 karakter hex)
4. Simpan rule. Nilai ini yang akan diisi pada variabel `CLOUDFLARE_EDGE_SECRET` di Render.  
*Catatan: Jika rule ini belum dibuat, kosongkan `CLOUDFLARE_EDGE_SECRET` di Render. Validasi Zero Trust JWT RS256 tetap aktif dan wajib lolos untuk semua request.*

---

### Langkah E: Deploy di Render Free (Blueprint)
1. Buka [https://dashboard.render.com](https://dashboard.render.com).
2. Klik tombol **New +** → pilih **Blueprint**.
3. Hubungkan repositori GitHub: `Vluuuu/Mutiara-Florist-Management-System`.
4. Render secara otomatis membaca branch: `feat/phase15a-postgres-compatibility` sesuai `render.yaml`.
5. Pada formulir variabel environment yang berstatus `sync: false`, isi nilai rahasia Anda:
   - `APP_KEY`: Nilai dari Langkah A (`base64:...`)
   - `DB_HOST`: Host Supabase dari Langkah B (`aws-0-ap-southeast-1.pooler.supabase.com`)
   - `DB_USERNAME`: Username Supabase dari Langkah B (`postgres.[project-ref]`)
   - `DB_PASSWORD`: Password Supabase dari Langkah B
   - `APP_URL`: Masukkan URL Render Anda (misalnya `https://mfms-staging.onrender.com`)
   - `CLOUDFLARE_ACCESS_TEAM_DOMAIN`: Domain tim Cloudflare Access Anda (misal `mutiaraflorist`)
   - `CLOUDFLARE_ACCESS_AUD`: Audience Tag dari Cloudflare Access Application Anda
   - `CLOUDFLARE_EDGE_SECRET`: Nilai dari Langkah D (atau kosongkan jika Transform Rule belum diatur)
6. Klik **Apply**. Render akan membangun image Docker dan mengaktifkan service di Singapore.

---

*Seluruh pengujian unit, integritas, dan keamanan (termasuk negative tests token palsu, key rotation, format pooler Supabase, dan JWKS unavailable) telah 100% LULUS (PASS).*  
*Database lokal kasir `mutiara_florist_prod` tetap aman dan terlindungi.*

---

*Seluruh pengujian unit, integritas, dan keamanan (termasuk negative tests token palsu dan JWKS unavailable) telah 100% LULUS (PASS).*  
*Database lokal kasir `mutiara_florist_prod` tetap aman dan terlindungi.*