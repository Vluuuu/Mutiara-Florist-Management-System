# MFMS Phase 14B: Panduan Reconciled Deployment, Routing Domain Tunggal & Rollback (Ubuntu Host)

**Staging Target:** `https://staging-admin.mutiaraflorist.id` (`127.0.0.1:10000`, `~/apps/mfms-staging`, `CLOUDFLARE_ACCESS_ENFORCE=true`)  
**Production Target:** `https://admin.mutiaraflorist.id` (`127.0.0.1:10001`, `~/apps/mfms-production`, `CLOUDFLARE_ACCESS_ENFORCE=false`)  
**Environment Directory:** `~/apps/mfms-config` (`staging.env`, `staging-demo.env`, `production.env`, `production-demo.env`)  
**Durasi Demo Produksi:** 14 hari kalender sejak `DEMO_ACTIVATED_AT` (dimulai HANYA saat aktivasi produksi resmi)  
**Reset Otomatis:** Setiap 24 jam pukul `03:00 WIB` via scheduler bawaan container demo

> **Kompatibilitas Cloudflare Tanpa Perubahan Kebijakan:** Router Phase 14B secara default mengarahkan seluruh trafik ke runtime utama (`mfms-*-app`) kecuali browser memilih mode demo secara eksplisit melalui `/demo` (`Cookie: mfms_runtime=demo`). Arsitektur ini bekerja konsisten pada produksi (`CLOUDFLARE_ACCESS_ENFORCE=false`) maupun staging (`CLOUDFLARE_ACCESS_ENFORCE=true`) tanpa perlu mengubah kebijakan Cloudflare Access produksi.

---

## 1. Arsitektur Routing Domain Tunggal & Isolasi Runtime

```text
Pengunjung / Admin di https://admin.mutiaraflorist.id
                        |
      Cloudflare Edge + Tunnel (X-Forwarded-Proto: https)
                        |
      Staging: 127.0.0.1:10000  |  Production: 127.0.0.1:10001
                        v
        mfms-*-router (nginx:1.27-alpine, 48 MB RAM)
        - Default -> mfms-*-app (primary)
        - /demo atau Cookie mfms_runtime=demo -> mfms-*-demo
        - /admin-entry -> mfms-*-app (hapus mfms_runtime & mfms_demo_session)
        - Mempertahankan X-Forwarded-Proto (https) & tanpa proxy cache
        - Strip Cf-Access-Jwt-Assertion & X-MFMS-Edge-Secret ke demo
                       /                               \
   Default & /admin-entry                           /demo & mfms_runtime=demo
                     v                                   v
    mfms-*-app (512 MB RAM)                  mfms-*-demo (256 MB RAM)
    - MFMS_RUNTIME_MODE=production           - MFMS_RUNTIME_MODE=demo
    - APP_KEY produksi / staging             - APP_KEY demo terpisah
    - SESSION_COOKIE=mfms_prod_session       - SESSION_COOKIE=mfms_demo_session
    - DB_CONNECTION=pgsql (Supabase TLS)     - DB_CONNECTION=sqlite (WAL lokal)
    - DEMO_ENTRY_LINK_ENABLED=true           - Kartu kredensial demo + link /admin-entry
    - Menolak login demo@mutiaraflorist.id   - Menolak login selain demo@mutiaraflorist.id
    - CF JWT tetap aktif bila ENFORCE=true   - Tanpa kredensial DB/Backup produksi
```

---

## 2. Perintah Update Staging Ubuntu (`~/apps/mfms-staging`, `127.0.0.1:10000`)

```bash
cd ~/builds/mfms-phase14b
git fetch origin
git checkout feat/phase14a-temporary-demo-access
git pull --ff-only
PHASE14_SHA=$(git rev-parse --short HEAD)

docker build \
  --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" \
  -t "mfms:phase14b-${PHASE14_SHA}" \
  -t mfms:phase14b .

cp ~/builds/mfms-phase14b/docker/compose.staging.phase14.yml ~/apps/mfms-staging/compose.phase14.yml
cp ~/builds/mfms-phase14b/docker/nginx-router.conf.template ~/apps/mfms-staging/nginx-router.conf.template

cd ~/apps/mfms-staging
MFMS_IMAGE="mfms:phase14b-${PHASE14_SHA}" \
MFMS_STAGING_ENV_FILE="$HOME/apps/mfms-config/staging.env" \
MFMS_STAGING_DEMO_ENV_FILE="$HOME/apps/mfms-config/staging-demo.env" \
docker compose -f compose.phase14.yml up -d --force-recreate

curl -fsS http://127.0.0.1:10000/up && echo " (staging router OK)"
docker exec mfms-staging-demo php artisan mfms:demo-status
```

---

## 3. Perintah Aktivasi Produksi Ubuntu (`~/apps/mfms-production`, `127.0.0.1:10001`)

> Jalankan HANYA setelah update staging di atas terverifikasi. Tidak memerlukan perubahan kebijakan Cloudflare Access produksi.

```bash
# 1. Cadangkan compose produksi Phase 13 (JANGAN hapus image Phase 13 maupun production.env)
mkdir -p ~/apps/mfms-production/backups
cp -a ~/apps/mfms-production/compose.yaml ~/apps/mfms-production/backups/compose.yaml.pre-phase14.$(date +%Y%m%d%H%M%S)

# 2. Buat ~/apps/mfms-config/production-demo.env (APP_KEY & DEMO_PASSWORD baru, 14 hari dimulai sekarang)
if [ ! -f ~/apps/mfms-config/production-demo.env ]; then
  cp ~/builds/mfms-phase14b/docker/env/demo.env.example ~/apps/mfms-config/production-demo.env
  chmod 600 ~/apps/mfms-config/production-demo.env
  PROD_DEMO_KEY=$(docker run --rm --entrypoint php mfms:phase14b /var/www/html/artisan key:generate --show)
  PROD_DEMO_PASS=$(docker run --rm --entrypoint php mfms:phase14b /var/www/html/artisan mfms:demo-generate-password)
  ACTIVATED_WIB=$(TZ=Asia/Jakarta date +%Y-%m-%dT%H:%M:%S+07:00)
  sed -i "s|^APP_KEY=.*|APP_KEY=${PROD_DEMO_KEY}|" ~/apps/mfms-config/production-demo.env
  sed -i "s|^APP_URL=.*|APP_URL=https://admin.mutiaraflorist.id|" ~/apps/mfms-config/production-demo.env
  sed -i "s|^DEMO_PASSWORD=.*|DEMO_PASSWORD=${PROD_DEMO_PASS}|" ~/apps/mfms-config/production-demo.env
  sed -i "s|^DEMO_ACTIVATED_AT=.*|DEMO_ACTIVATED_AT=${ACTIVATED_WIB}|" ~/apps/mfms-config/production-demo.env
fi

# 3. Pasang compose & router produksi Phase 14B
cp ~/builds/mfms-phase14b/docker/compose.production.phase14.yml ~/apps/mfms-production/compose.phase14.yml
cp ~/builds/mfms-phase14b/docker/nginx-router.conf.template ~/apps/mfms-production/nginx-router.conf.template

# 4. Hentikan container produksi Phase 13 secara terkontrol (image Phase 13 tetap utuh) dan nyalakan stack Phase 14B
cd ~/apps/mfms-production
docker compose -f compose.yaml stop
MFMS_IMAGE="mfms:phase14b" \
MFMS_PROD_ENV_FILE="$HOME/apps/mfms-config/production.env" \
MFMS_PROD_DEMO_ENV_FILE="$HOME/apps/mfms-config/production-demo.env" \
docker compose -f compose.phase14.yml up -d

# 5. Verifikasi kesehatan, HTTPS redirect, status demo, dan scheduler
curl -fsS http://127.0.0.1:10001/up && echo " (production router OK)"
curl -fsS -I -H "X-Forwarded-Proto: https" -H "Host: admin.mutiaraflorist.id" http://127.0.0.1:10001/login | head -n 5
curl -fsS -I -H "X-Forwarded-Proto: https" -H "Host: admin.mutiaraflorist.id" http://127.0.0.1:10001/demo | grep -iE "^(HTTP/|Location:|Set-Cookie:)"
docker exec mfms-production-demo php artisan mfms:demo-status
docker exec mfms-production-demo php artisan schedule:list
```

---

## 4. Emergency Kill Switch & Rollback Penuh

### A. Matikan Demo Seketika (< 1 detik, Zero Downtime Produksi)
```bash
docker exec mfms-production-demo php artisan mfms:demo-disable
```

### B. Rollback Penuh ke Container Produksi Tunggal Phase 13 (`127.0.0.1:10001`)
```bash
cd ~/apps/mfms-production
docker compose -f compose.phase14.yml down
docker compose -f compose.yaml up -d
curl -fsS http://127.0.0.1:10001/up && echo " (Phase 13 production restored)"
```
