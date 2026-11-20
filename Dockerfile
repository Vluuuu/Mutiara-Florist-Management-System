# ==============================================================================
# MFMS Production Multi-Stage Dockerfile (Laravel 12 + React/Inertia)
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

# Configure PHP & Nginx
COPY docker/php.ini /usr/local/etc/php/conf.d/mfms.ini
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

# Ensure proper permissions
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache && \
    chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/up || exit 1

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
