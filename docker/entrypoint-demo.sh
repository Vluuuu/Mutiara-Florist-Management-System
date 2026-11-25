#!/bin/sh
set -e

echo "Starting MFMS Isolated Demo Container..."

# Fail closed if runtime mode or DB driver is misconfigured
if [ "${MFMS_RUNTIME_MODE:-}" != "demo" ]; then
    echo "ERROR: entrypoint-demo.sh requires MFMS_RUNTIME_MODE=demo" >&2
    exit 1
fi

if [ "${DB_CONNECTION:-}" != "sqlite" ]; then
    echo "ERROR: Demo runtime strictly requires DB_CONNECTION=sqlite" >&2
    exit 1
fi

# Ensure production database credentials or backup keys are NOT injected into demo container
if [ -n "${DB_HOST:-}" ] || [ -n "${DB_PASSWORD:-}" ] || [ -n "${DB_URL:-}" ] || [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "ERROR: Production database or backup secrets detected in demo container environment. Refusing to start." >&2
    exit 1
fi

# Activate lightweight demo PHP-FPM pool (max_children=3)
if [ -f /etc/mfms/fpm-pool-demo.conf ]; then
    cp /etc/mfms/fpm-pool-demo.conf /usr/local/etc/php-fpm.d/zz-mfms.conf
fi

PORT="${PORT:-10000}"
echo "Configuring Demo Nginx to listen on port ${PORT}..."
sed -i -E "s/listen [0-9]+ default_server;/listen ${PORT} default_server;/g" /etc/nginx/http.d/default.conf
sed -i -E "s/listen \[::\]:[0-9]+ default_server;/listen [::]:${PORT} default_server;/g" /etc/nginx/http.d/default.conf

DEMO_DATA_DIR="$(dirname "${DB_DATABASE:-/var/lib/mfms-demo/demo.sqlite}")"
mkdir -p "${DEMO_DATA_DIR}" \
         /var/lib/mfms-demo/sessions \
         /var/lib/mfms-demo/cache \
         /var/www/html/storage/framework/cache/data \
         /var/www/html/storage/framework/sessions \
         /var/www/html/storage/framework/views \
         /var/www/html/storage/logs \
         /var/www/html/storage/app/exports

chown -R www-data:www-data "${DEMO_DATA_DIR}" /var/lib/mfms-demo /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 "${DEMO_DATA_DIR}" /var/lib/mfms-demo /var/www/html/storage /var/www/html/bootstrap/cache

echo "Caching demo Laravel configuration and routes..."
php /var/www/html/artisan optimize:clear
php /var/www/html/artisan config:cache
php /var/www/html/artisan route:cache
php /var/www/html/artisan view:cache

# Initialize isolated SQLite database with synthetic dataset if not present yet
if [ ! -f "${DB_DATABASE}" ] || [ ! -s "${DB_DATABASE}" ]; then
    echo "Initializing fresh synthetic demo SQLite database at ${DB_DATABASE}..."
    su -s /bin/sh www-data -c "php /var/www/html/artisan mfms:demo-reset --force --keep-sessions"
fi

echo "Executing supervisord (PHP-FPM + Nginx + 24h demo reset scheduler)..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
