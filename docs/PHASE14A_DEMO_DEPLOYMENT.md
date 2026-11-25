# MFMS Phase 14A: Panduan Deployment, Cloudflare Access & Rollback Akses Demo Sementara

**Target Domain:** `https://admin.mutiaraflorist.id` (tanpa subdomain tambahan)  
**Durasi Aktif Demo:** 14 hari kalender sejak `DEMO_ACTIVATED_AT` (WIB)  
**Reset Otomatis:** Setiap 24 jam pukul `03:00 WIB` via scheduler bawaan container `mfms-demo`

> **Status:** Disiapkan untuk staging dan aktivasi terkontrol. Belum diterapkan ke produksi maupun Cloudflare live.

---

## 1. Arsitektur Isolasi Dual-Runtime pada Domain Tunggal

```text
Browser Evaluator (Dosen / Asisten)          Browser Admin Florist (Produksi)
                |                                            |
                | HTTPS admin.mutiaraflorist.id              | HTTPS admin.mutiaraflorist.id/admin-entry
                | (tanpa Cf-Access-Jwt-Assertion)            | (Cloudflare Access Email OTP -> CF_Authorization)
                v                                            v
                   Cloudflare Global Edge + Outbound Tunnel (cloudflared)
                                            |
                                            | http://127.0.0.1:10000
                                            v
                      mfms-router (nginx:1.27-alpine, 48 MB RAM, 0.25 CPU)
                       /                                             \
   No CF JWT or mfms_runtime=demo                             Valid CF JWT (no demo cookie)
   (strips CF JWT & Edge Secret)                                      |
                      v                                               v
        mfms-demo (256 MB RAM, 0.5 CPU)                 mfms-prod (512 MB RAM, 1.0 CPU)
        - MFMS_RUNTIME_MODE=demo                        - MFMS_RUNTIME_MODE=production
        - APP_KEY terpisah (demo-only)                  - APP_KEY produksi
        - SESSION_COOKIE=mfms_demo_session              - SESSION_COOKIE=mfms_prod_session
        - DB_CONNECTION=sqlite (WAL mode)               - DB_CONNECTION=pgsql (Supabase TLS)
        - Volume lokal /var/lib/mfms-demo               - CLOUDFLARE_ACCESS_ENFORCE=true
        - TANPA kredensial DB/Backup produksi           - Menolak login demo@mutiaraflorist.id
```

### Mengapa Isolasi Ini Fail-Closed
1. **Container terpisah, rahasia terpisah:** `mfms-demo` tidak memiliki `DB_HOST`, `DB_PASSWORD`, `DB_URL`, `APP_KEY` produksi, maupun `BACKUP_ENCRYPTION_KEY`. Script `docker/entrypoint-demo.sh` menolak menyala bila salah satu variabel produksi terdeteksi.
2. **Routing tidak dapat dibypass lewat cookie:** `mfms-router` hanya mengarahkan trafik ke `mfms-prod` bila header `Cf-Access-Jwt-Assertion` dari Cloudflare Edge ada. Permintaan tanpa header tersebut selalu diarahkan ke `mfms-demo`.
3. **Verifikasi kriptografi produksi tetap utuh:** `mfms-prod` tetap menjalankan `VerifyCloudflareAccessJwt` secara fail-closed (RS256 + JWKS + AUD + Issuer + Expiry). Header `Cf-Access-Jwt-Assertion` palsu ditolak `403 Forbidden`.
4. **Anti session confusion:** Nama cookie berbeda (`mfms_prod_session` vs `mfms_demo_session`), `APP_KEY` berbeda, backend sesi berbeda (PostgreSQL vs file lokal demo), dan payload sesi mengunci `mfms_runtime_mode`.

---

## 2. Estimasi Overhead Sumber Daya pada Server Ubuntu

Kedua container aplikasi memakai **satu Docker image yang sama (`mfms:phase14a`)** sehingga tidak menggandakan penyimpanan image pada disk Ubuntu.

| Komponen | Image | Batas RAM | Estimasi RAM Idle / Aktif | Batas CPU | Disk Tambahan |
| --- | --- | --- | --- | --- | --- |
| `mfms-prod` (eksisting) | `mfms:phase14a` | `512 MB` | ~110 - 180 MB | `1.00 vCPU` | 0 MB (shared image) |
| `mfms-demo` (baru) | `mfms:phase14a` | `256 MB` | ~65 - 110 MB (`pm.max_children=3`) | `0.50 vCPU` | ~1 - 5 MB (`demo.sqlite` + sessions) |
| `mfms-router` (baru) | `nginx:1.27-alpine` | `48 MB` | ~8 - 18 MB | `0.25 vCPU` | ~45 MB (image Alpine Nginx) |
| **Total Overhead Baru** | | **+304 MB limit** | **~75 - 130 MB aktual** | **+0.75 vCPU cap** | **< 55 MB disk** |

---

## 3. Persiapan Cloudflare Zero Trust Access (Belum Diterapkan)

Saat jendela evaluasi 14 hari siap diaktifkan di produksi:

1. **Pertahankan aplikasi Access khusus admin pada jalur `/admin-entry`:**
   - Buat/perbarui Cloudflare Access Self-Hosted Application untuk `admin.mutiaraflorist.id/admin-entry` dengan kebijakan **Allow** eksklusif ke email pemilik/operator florist (OTP Email yang sudah ada).
   - Pastikan durasi sesi Access sesuai kebijakan operasional (mis. 12 atau 24 jam) sehingga cookie `CF_Authorization` tetap aktif pada domain `admin.mutiaraflorist.id` (path `/`) setelah admin melewati `/admin-entry`.
   - Salin nilai **AUD Tag** aplikasi ini ke `CLOUDFLARE_ACCESS_AUD` milik `mfms-prod`.
2. **Ubah kebijakan jalur root `admin.mutiaraflorist.id` (selama 14 hari saja):**
   - Tambahkan kebijakan **Bypass** untuk `Everyone` pada aplikasi root `admin.mutiaraflorist.id` (kecuali `/admin-entry` yang memiliki aplikasi Access tersendiri yang lebih spesifik).
   - Cloudflare Zero Trust tetap melampirkan header `Cf-Access-Jwt-Assertion` otomatis untuk admin yang sudah membawa cookie `CF_Authorization` valid dari `/admin-entry`, sementara pengunjung dosen/asisten tanpa cookie Access akan langsung mencapai `mfms-router` -> `mfms-demo`.
3. **Verifikasi Cloudflare Tunnel (`cloudflared`):**
   - Tidak perlu perubahan konfigurasi `cloudflared` karena `mfms-router` tetap mendengarkan di `http://127.0.0.1:10000`.
4. **Setelah 14 hari berakhir:**
   - Hapus aturan Bypass root dan kembalikan kebijakan Cloudflare Access **Allow (Email Admin)** pada seluruh `admin.mutiaraflorist.id/*`.

---

## 4. Langkah Deployment Staging / Produksi Terkontrol

### Langkah 1: Siapkan Environment Demo di Luar Git (`/etc/mfms/demo.env`)
```bash
sudo mkdir -p /etc/mfms
sudo cp docker/env/demo.env.example /etc/mfms/demo.env
sudo chmod 600 /etc/mfms/demo.env

# Hasilkan APP_KEY khusus demo (WAJIB BERBEDA dari prod.env)
docker run --rm mfms:phase14a php artisan key:generate --show

# Hasilkan password demo khusus yang kuat
docker run --rm mfms:phase14a php artisan mfms:demo-generate-password
```

Isi `/etc/mfms/demo.env` dengan:
- `APP_KEY=` hasil generate demo di atas (bukan key produksi)
- `DEMO_PASSWORD=` hasil `mfms:demo-generate-password`
- `DEMO_ACTIVATED_AT=` timestamp WIB saat aktivasi (contoh `2026-11-25T08:00:00+07:00`)
- `DEMO_DURATION_DAYS=14`
- `DEMO_ENABLED=true`

Pastikan `/etc/mfms/prod.env` memiliki:
- `MFMS_RUNTIME_MODE=production`
- `SESSION_COOKIE=mfms_prod_session`
- `CLOUDFLARE_ACCESS_ENFORCE=true`

### Langkah 2: Build Image Tunggal & Jalankan Stack Dual-Runtime
```bash
# 1. Build image tunggal mfms:phase14a
docker compose -f docker/docker-compose.phase14a.yml build

# 2. Hentikan container tunggal lama (bila sebelumnya berjalan sebagai mfms-prod standalone di port 10000)
docker stop mfms-prod && docker rm mfms-prod

# 3. Jalankan router + prod + demo bersama-sama
MFMS_PROD_ENV_FILE=/etc/mfms/prod.env \
MFMS_DEMO_ENV_FILE=/etc/mfms/demo.env \
docker compose -f docker/docker-compose.phase14a.yml up -d
```

### Langkah 3: Verifikasi Pasca-Deploy
```bash
# Cek status kontainer & healthcheck
docker compose -f docker/docker-compose.phase14a.yml ps

# Cek status demo & masa berlaku (tanpa mencetak password)
docker exec mfms-demo php artisan mfms:demo-status

# Cek bahwa scheduler reset harian 03:00 WIB terdaftar
docker exec mfms-demo php artisan schedule:list

# Uji reset manual pertama (opsional)
docker exec mfms-demo php artisan mfms:demo-reset --force
```

---

## 5. Emergency Kill Switch & Prosedur Rollback

### A. Matikan Demo Seketika (< 1 detik, tanpa downtime produksi)
```bash
docker exec mfms-demo php artisan mfms:demo-disable
```
Efek: seluruh sesi demo aktif langsung dicabut pada permintaan berikutnya, form login menolak akun demo, dan kartu kredensial demo disembunyikan. Produksi (`mfms-prod`) tetap berjalan normal 100%.

Untuk mengaktifkan kembali:
```bash
docker exec mfms-demo php artisan mfms:demo-enable
```

### B. Rollback Penuh ke Arsitektur Produksi Tunggal (Setelah 14 Hari atau Darurat)
```bash
# 1. Hentikan seluruh stack dual-runtime
docker compose -f docker/docker-compose.phase14a.yml down

# 2. Hapus volume data demo lokal (opsional untuk pembersihan total)
docker volume rm mfms-demo-data || true

# 3. Jalankan kembali container produksi tunggal pada 127.0.0.1:10000
docker run -d \
  --name mfms-prod \
  --restart unless-stopped \
  --env-file /etc/mfms/prod.env \
  -p 127.0.0.1:10000:10000 \
  mfms:phase14a

# 4. Pada Dashboard Cloudflare Zero Trust:
#    - Hapus aturan Bypass root pada admin.mutiaraflorist.id
#    - Aktifkan kembali kebijakan Allow (Email OTP Admin) untuk seluruh admin.mutiaraflorist.id/*
```
