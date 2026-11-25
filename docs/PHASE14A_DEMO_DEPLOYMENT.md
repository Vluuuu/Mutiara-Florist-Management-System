# MFMS Phase 14B: Panduan Reconciled Deployment, Cloudflare Access & Rollback (Ubuntu Host)

**Staging Target:** `https://staging-admin.mutiaraflorist.id` (`127.0.0.1:10000`, `~/apps/mfms-staging`)  
**Production Target:** `https://admin.mutiaraflorist.id` (`127.0.0.1:10001`, `~/apps/mfms-production`)  
**Environment Directory:** `~/apps/mfms-config` (`staging.env`, `staging-demo.env`, `production.env`, `production-demo.env`)  
**Durasi Demo Produksi:** 14 hari kalender sejak `DEMO_ACTIVATED_AT` (dimulai HANYA saat aktivasi produksi resmi)  
**Reset Otomatis:** Setiap 24 jam pukul `03:00 WIB` via scheduler bawaan container demo

> **Production Gate:** JANGAN aktifkan demo produksi maupun ubah kebijakan Cloudflare produksi sebelum staging QA dan autentikasi admin terverifikasi lulus 100%.

---

## 1. Arsitektur Autentikasi Domain Tunggal & Cloudflare Access (Terverifikasi)

Berdasarkan dokumentasi resmi Cloudflare Zero Trust (`developers.cloudflare.com`):
- Ketika sebuah jalur dicakup kebijakan **Bypass**, Cloudflare Edge **tidak selalu menyuntikkan header `Cf-Access-Jwt-Assertion`**, namun browser admin yang telah lulus Email OTP di `/admin-entry` tetap menyimpan dan mengirim cookie **`CF_Authorization`** (`HttpOnly; Secure; Path=/; SameSite=Lax`, bertanda tangan kriptografi **RS256**).
- Oleh karena itu, baik `nginx-router.conf.template` maupun `VerifyCloudflareAccessJwt` memverifikasi token dari **`Cf-Access-Jwt-Assertion` header ATAU `CF_Authorization` cookie** secara ketat (*fail-closed* RS256 + JWKS `cdn-cgi/access/certs` + Issuer + AUD + `exp` + `nbf`).

```text
Pengunjung Publik (Dosen / Asisten)           Admin Florist (Terlindungi OTP)
               |                                            |
               | GET https://<domain>/login                 | 1. GET https://<domain>/admin-entry
               | (tanpa CF_Authorization)                   |    -> Cloudflare Access Email OTP (Allow)
               |                                            |    -> Browser menerima CF_Authorization (RS256)
               |                                            | 2. Redirect ke /login & /dashboard (Cookie CF_Authorization)
               v                                            v
                    Cloudflare Global Edge + Cache Rule (Bypass Cache) + cloudflared
                                            |
                      Staging: 127.0.0.1:10000  |  Production: 127.0.0.1:10001
                                            v
                            mfms-*-router (nginx:1.27-alpine, 48 MB RAM)
                           /                                           \
    Tanpa CF token ATAU mfms_runtime=demo                   Ada CF token (Header/Cookie) & bukan demo
    (strip Cf-Access-Jwt-Assertion & Edge Secret)                       |
                          v                                             v
         mfms-*-demo (256 MB RAM, 0.5 CPU)            mfms-*-app (512 MB RAM, 1.0 CPU)
         - MFMS_RUNTIME_MODE=demo                     - MFMS_RUNTIME_MODE=production
         - APP_KEY demo terpisah                      - APP_KEY produksi/staging
         - SESSION_COOKIE=mfms_demo_session           - SESSION_COOKIE=mfms_*_session
         - DB_CONNECTION=sqlite (/var/lib/mfms-demo)  - DB_CONNECTION=pgsql (Supabase TLS)
         - Tanpa kredensial DB/Backup produksi        - VerifyCloudflareAccessJwt FAIL-CLOSED (RS256)
         - Cache-Control: no-store, private           - Cache-Control: no-store, private
```

### Persiapan Kebijakan Cloudflare Zero Trust & Caching (Staging dulu, Produksi setelah GO)
Untuk domain target (`staging-admin.mutiaraflorist.id` saat staging QA; `admin.mutiaraflorist.id` saat produksi aktif):
1. **Aplikasi Cloudflare Access #1 (Gerbang Admin OTP):**
   - Path: `<domain>/admin-entry`
   - Policy: **Allow** hanya email pemilik/operator florist (Email OTP).
   - Catat **AUD Tag** aplikasi ini dan pastikan nilai tersebut tercantum pada `CLOUDFLARE_ACCESS_AUD` di `staging.env` / `production.env` (mendukung daftar koma `AUD_LAMA,AUD_ADMIN_ENTRY` untuk transisi tanpa downtime).
2. **Aplikasi Cloudflare Access #2 (Bypass Sementara 14 Hari pada Root):**
   - Path: `<domain>` (root / wildcard selain `/admin-entry`)
   - Policy: **Bypass** -> `Everyone`.
3. **Cloudflare Cache Rule (Wajib):**
   - Rule: Hostname equals `<domain>` -> **Bypass Cache** (melengkapi header `Cache-Control: no-store, no-cache, must-revalidate, private` dari aplikasi & `proxy_no_cache 1` dari Nginx router).
4. **Cloudflare Tunnel (`cloudflared`):**
   - Tidak perlu perubahan: staging tetap `http://127.0.0.1:10000`, produksi tetap `http://127.0.0.1:10001`.

---

## 2. Prosedur Deployment Staging Ubuntu (`~/apps/mfms-staging`, `127.0.0.1:10000`)

Semua perintah di bawah ini **aman terhadap aset Phase 13** (tidak menghapus image lama, tidak menghapus `staging.env`, tidak menyentuh `~/apps/mfms-production` maupun port `10001`).

```bash
# ------------------------------------------------------------------
# STEP 1: Inspeksi kondisi saat ini & cadangkan compose staging lama
# ------------------------------------------------------------------
docker ps --filter "name=mfms-" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
mkdir -p ~/apps/mfms-staging/backups
cp -a ~/apps/mfms-staging/compose.yaml ~/apps/mfms-staging/backups/compose.yaml.pre-phase14.$(date +%Y%m%d%H%M%S) 2>/dev/null || true

# ------------------------------------------------------------------
# STEP 2: Ambil revisi Phase 14B & build image tunggal mfms:phase14b
# ------------------------------------------------------------------
mkdir -p ~/builds
git clone --branch feat/phase14a-temporary-demo-access https://github.com/Vluuuu/Mutiara-Florist-Management-System.git ~/builds/mfms-phase14b || (cd ~/builds/mfms-phase14b && git fetch origin && git checkout feat/phase14a-temporary-demo-access && git pull --ff-only)
cd ~/builds/mfms-phase14b
PHASE14_SHA=$(git rev-parse --short HEAD)
docker build \
  --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" \
  -t "mfms:phase14b-${PHASE14_SHA}" \
  -t mfms:phase14b .

# ------------------------------------------------------------------
# STEP 3: Siapkan ~/apps/mfms-config/staging-demo.env (tanpa rahasia prod)
# ------------------------------------------------------------------
if [ ! -f ~/apps/mfms-config/staging-demo.env ]; then
  cp ~/builds/mfms-phase14b/docker/env/demo.env.example ~/apps/mfms-config/staging-demo.env
  chmod 600 ~/apps/mfms-config/staging-demo.env
  DEMO_APP_KEY=$(docker run --rm --entrypoint php mfms:phase14b /var/www/html/artisan key:generate --show)
  DEMO_PASS=$(docker run --rm --entrypoint php mfms:phase14b /var/www/html/artisan mfms:demo-generate-password)
  NOW_WIB=$(TZ=Asia/Jakarta date +%Y-%m-%dT%H:%M:%S+07:00)
  sed -i "s|^APP_KEY=.*|APP_KEY=${DEMO_APP_KEY}|" ~/apps/mfms-config/staging-demo.env
  sed -i "s|^APP_URL=.*|APP_URL=https://staging-admin.mutiaraflorist.id|" ~/apps/mfms-config/staging-demo.env
  sed -i "s|^DEMO_PASSWORD=.*|DEMO_PASSWORD=${DEMO_PASS}|" ~/apps/mfms-config/staging-demo.env
  sed -i "s|^DEMO_ACTIVATED_AT=.*|DEMO_ACTIVATED_AT=${NOW_WIB}|" ~/apps/mfms-config/staging-demo.env
  echo "Staging demo password generated and written to ~/apps/mfms-config/staging-demo.env"
fi

# ------------------------------------------------------------------
# STEP 4: Salin compose & router template ke ~/apps/mfms-staging
# ------------------------------------------------------------------
cp ~/builds/mfms-phase14b/docker/compose.staging.phase14.yml ~/apps/mfms-staging/compose.phase14.yml
cp ~/builds/mfms-phase14b/docker/nginx-router.conf.template ~/apps/mfms-staging/nginx-router.conf.template

# ------------------------------------------------------------------
# STEP 5: Hentikan container staging lama secara terkontrol (TANPA menghapus image/volume)
#         lalu aktifkan stack dual-runtime staging di 127.0.0.1:10000
# ------------------------------------------------------------------
cd ~/apps/mfms-staging
docker compose -f compose.yaml stop 2>/dev/null || docker stop mfms-staging 2>/dev/null || true

MFMS_IMAGE="mfms:phase14b-${PHASE14_SHA}" \
MFMS_STAGING_ENV_FILE="$HOME/apps/mfms-config/staging.env" \
MFMS_STAGING_DEMO_ENV_FILE="$HOME/apps/mfms-config/staging-demo.env" \
docker compose -f compose.phase14.yml up -d

# ------------------------------------------------------------------
# STEP 6: Verifikasi staging
# ------------------------------------------------------------------
docker ps --filter "name=mfms-staging" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
curl -fsS http://127.0.0.1:10000/up && echo " (router /up OK)"
docker exec mfms-staging-demo php artisan mfms:demo-status
docker exec mfms-staging-demo php artisan schedule:list
docker stats --no-stream mfms-staging-router mfms-staging-app mfms-staging-demo
```

### Rollback Staging Instan (< 15 detik, kembali ke Phase 13)
```bash
cd ~/apps/mfms-staging
docker compose -f compose.phase14.yml down
docker compose -f compose.yaml up -d
curl -fsS http://127.0.0.1:10000/up && echo " (Phase 13 staging restored)"
```

---

## 3. Perintah Aktivasi & Rollback Produksi (HANYA Setelah Staging QA Lulus)

> **PERINGATAN:** Jalankan bagian ini HANYA setelah verifikasi staging penuh (admin OTP + demo isolation + browser QA) dinyatakan lulus. Jendela 14 hari dimulai tepat saat `DEMO_ACTIVATED_AT` diset di `production-demo.env`.

### Aktivasi Produksi (`~/apps/mfms-production`, `127.0.0.1:10001`)
```bash
# 1. Cadangkan compose produksi Phase 13 (JANGAN hapus image Phase 13 maupun production.env)
mkdir -p ~/apps/mfms-production/backups
cp -a ~/apps/mfms-production/compose.yaml ~/apps/mfms-production/backups/compose.yaml.pre-phase14.$(date +%Y%m%d%H%M%S)

# 2. Buat ~/apps/mfms-config/production-demo.env dengan APP_KEY & DEMO_PASSWORD baru
cp ~/builds/mfms-phase14b/docker/env/demo.env.example ~/apps/mfms-config/production-demo.env
chmod 600 ~/apps/mfms-config/production-demo.env
PROD_DEMO_KEY=$(docker run --rm --entrypoint php mfms:phase14b /var/www/html/artisan key:generate --show)
PROD_DEMO_PASS=$(docker run --rm --entrypoint php mfms:phase14b /var/www/html/artisan mfms:demo-generate-password)
ACTIVATED_WIB=$(TZ=Asia/Jakarta date +%Y-%m-%dT%H:%M:%S+07:00)
sed -i "s|^APP_KEY=.*|APP_KEY=${PROD_DEMO_KEY}|" ~/apps/mfms-config/production-demo.env
sed -i "s|^APP_URL=.*|APP_URL=https://admin.mutiaraflorist.id|" ~/apps/mfms-config/production-demo.env
sed -i "s|^DEMO_PASSWORD=.*|DEMO_PASSWORD=${PROD_DEMO_PASS}|" ~/apps/mfms-config/production-demo.env
sed -i "s|^DEMO_ACTIVATED_AT=.*|DEMO_ACTIVATED_AT=${ACTIVATED_WIB}|" ~/apps/mfms-config/production-demo.env

# 3. Pastikan CLOUDFLARE_ACCESS_AUD di ~/apps/mfms-config/production.env mencakup AUD /admin-entry
#    (format: CLOUDFLARE_ACCESS_AUD=<AUD_LAMA>,<AUD_ADMIN_ENTRY>)

# 4. Pasang compose & router produksi Phase 14B
cp ~/builds/mfms-phase14b/docker/compose.production.phase14.yml ~/apps/mfms-production/compose.phase14.yml
cp ~/builds/mfms-phase14b/docker/nginx-router.conf.template ~/apps/mfms-production/nginx-router.conf.template

# 5. Alihkan port 127.0.0.1:10001 secara terkontrol (image Phase 13 tetap tersimpan utuh)
cd ~/apps/mfms-production
docker compose -f compose.yaml stop
MFMS_IMAGE="mfms:phase14b" \
MFMS_PROD_ENV_FILE="$HOME/apps/mfms-config/production.env" \
MFMS_PROD_DEMO_ENV_FILE="$HOME/apps/mfms-config/production-demo.env" \
docker compose -f compose.phase14.yml up -d

# 6. Verifikasi sebelum mengubah Cloudflare Access
curl -fsS http://127.0.0.1:10001/up && echo " (prod router /up OK)"
docker exec mfms-production-demo php artisan mfms:demo-status

# 7. Terakhir: aktifkan Cloudflare Access /admin-entry (Allow Admin OTP) + root Bypass + Cache Bypass
```

### Emergency Disable Produksi (< 1 detik, Zero Downtime Admin)
```bash
docker exec mfms-production-demo php artisan mfms:demo-disable
```

### Rollback Produksi Penuh (Setelah 14 Hari atau Darurat)
```bash
# 1. Pada Cloudflare Zero Trust: hapus aturan Bypass root & aktifkan kembali Allow (Admin OTP) pada admin.mutiaraflorist.id/*
# 2. Kembalikan stack produksi Phase 13 pada 127.0.0.1:10001
cd ~/apps/mfms-production
docker compose -f compose.phase14.yml down
docker compose -f compose.yaml up -d
curl -fsS http://127.0.0.1:10001/up && echo " (Phase 13 production restored)"
# 3. (Opsional) Hapus volume data simulasi demo setelah periode evaluasi selesai:
#    docker volume rm mfms-production_mfms-production-demo-data || docker volume rm mfms-production-demo-data
```
