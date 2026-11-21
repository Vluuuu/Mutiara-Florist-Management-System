# ==============================================================================
# MFMS Production Multi-Stage Dockerfile (Laravel 12 + React/Inertia)
# Fully hardened for Render Free (512 MB RAM) & Cloudflare Access Zero Trust
# ==============================================================================

# Stage 1: Build React/TypeScript frontend via Vite
FROM node:20-alpine AS node-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY resources/ ./resources/
COPY vite.config.js tsconfig.json components.json ./
RUN npm run build

# Stage 2: Install Composer production dependencies
FROM composer:2.7 AS composer-builder
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --ignore-platform-reqs
COPY app/ ./app/
COPY bootstrap/ ./bootstrap/
COPY config/ ./config/
COPY database/ ./database/
COPY routes/ ./routes/
COPY artisan ./
RUN composer dump-autoload --optimize --no-dev --classmap-authoritative

# Stage 3: Final Production Runtime (PHP 8.3 FPM + Nginx on Alpine)
FROM php:8.3-fpm-alpine AS runner

# Install system dependencies
RUN apk add --no-cache \
    nginx \
    supervisor \
    curl \
    postgresql-dev \
    libzip-dev \
    icu-dev \
    libpng-dev \
    oniguruma-dev

# Install PHP extensions required by MFMS
RUN docker-php-ext-install -j$(nproc) \
    pdo_pgsql \
    pgsql \
    zip \
    bcmath \
    intl \
    opcache \
    mbstring

# Configure PHP runtime & FPM pool tuned for 512 MB memory limit
COPY docker/php.ini /usr/local/etc/php/conf.d/mfms.ini
COPY docker/fpm-pool.conf /usr/local/etc/php-fpm.d/zz-mfms.conf
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /var/www/html

# Copy application code
COPY . .
# Overwrite with clean vendor from composer stage
COPY --from=composer-builder /app/vendor ./vendor
# Copy compiled Vite assets into public/build
COPY --from=node-builder /app/public/build ./public/build

# Ensure proper read/traverse permissions for www-data without exposing non-public app files to other users
RUN chown -R root:www-data /var/www/html && \
    find /var/www/html -type d -exec chmod 750 {} + && \
    find /var/www/html -type f -exec chmod 640 {} + && \
    chmod 750 /var/www/html/artisan && \
    find /var/www/html/public -type d -exec chmod 755 {} + && \
    find /var/www/html/public -type f -exec chmod 644 {} + && \
    chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache && \
    find /var/www/html/storage /var/www/html/bootstrap/cache -type d -exec chmod 775 {} + && \
    find /var/www/html/storage /var/www/html/bootstrap/cache -type f -exec chmod 664 {} +

# Healthcheck compatible with Render ($PORT=10000) and standard HTTP port
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:10000/up || curl -f http://localhost:80/up || exit 1

EXPOSE 10000 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
