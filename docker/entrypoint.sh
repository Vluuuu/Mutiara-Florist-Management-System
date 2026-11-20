#!/bin/sh
set -e

echo "Starting MFMS Production Container..."

# Configure port if specified by Railway
PORT="${PORT:-80}"
echo "Configuring Nginx to listen on port ${PORT}..."
sed -i "s/listen 80 default_server;/listen ${PORT} default_server;/g" /etc/nginx/http.d/default.conf
sed -i "s/listen \[::\]:80 default_server;/listen [::]:${PORT} default_server;/g" /etc/nginx/http.d/default.conf

# Ensure storage directories exist with proper permissions
mkdir -p /var/www/html/storage/framework/cache/data \
         /var/www/html/storage/framework/sessions \
         /var/www/html/storage/framework/views \
         /var/www/html/storage/logs \
         /var/www/html/storage/app/backups \
         /var/www/html/storage/app/exports

chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Run Laravel optimization commands
echo "Optimizing Laravel configuration and routes..."
php /var/www/html/artisan optimize:clear
php /var/www/html/artisan config:cache
php /var/www/html/artisan route:cache
php /var/www/html/artisan view:cache

# Start supervisor to manage PHP-FPM and Nginx
echo "Executing supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
