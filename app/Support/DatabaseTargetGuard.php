<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use RuntimeException;

class DatabaseTargetGuard
{
    /**
     * Blacklist of foreign project references that belong to other applications
     * and MUST NEVER be connected or modified during MFMS staging.
     */
    public const BLOCKED_PROJECT_REFS = [
        'slqwyjtcmlinnrbdsxkb', // External application / ChatGPT project
    ];

    /**
     * Validate target connection configuration and server identity.
     * Prevents accidental execution on production databases or wrong Supabase projects.
     *
     * @param string $connName
     * @param string|null $expectedProjectRef
     * @param bool $requirePgsql
     * @param bool $confirmServerIdentity
     * @return array
     * @throws RuntimeException
     */
    public static function validateTarget(
        string $connName,
        ?string $expectedProjectRef = null,
        bool $requirePgsql = true,
        bool $confirmServerIdentity = true
    ): array {
        $config = config("database.connections.{$connName}");
        if (! is_array($config)) {
            throw new RuntimeException("Koneksi database '{$connName}' tidak ditemukan dalam konfigurasi database.");
        }

        $driver = (string) ($config['driver'] ?? '');
        $dbName = (string) ($config['database'] ?? '');
        $dbHost = (string) ($config['host'] ?? '');
        $dbPort = (string) ($config['port'] ?? '');
        $dbUser = (string) ($config['username'] ?? '');

        // 1. PostgreSQL Driver Enforcement
        if ($requirePgsql && $driver !== 'pgsql') {
            throw new RuntimeException("Target koneksi bukan PostgreSQL (driver: {$driver}). Operasi dibatalkan demi keamanan.");
        }

        // 2. Production Database Name Safeguard
        if ($dbName === 'mutiara_florist_prod' || str_contains(strtolower($dbName), 'mutiara_florist_prod')) {
            throw new RuntimeException("PERINGATAN KERAS: Target koneksi adalah database produksi toko (mutiara_florist_prod). Operasi DITOLAK demi integritas data!");
        }

        // 3. Production Port Safeguard (XAMPP MariaDB port 3307 or default 3306)
        $isLocalHost = in_array(strtolower($dbHost), ['127.0.0.1', 'localhost', '::1'], true);
        if ($isLocalHost && in_array($dbPort, ['3307', '3306'], true)) {
            throw new RuntimeException("PERINGATAN KERAS: Target koneksi diarahkan ke port database produksi lokal toko (:{$dbPort}). Operasi DITOLAK!");
        }

        // 4. Supabase Target & Project Reference Safeguard
        $isSupabaseHost = str_contains(strtolower($dbHost), 'supabase.co') || str_contains(strtolower($dbHost), 'supabase.com');
        $isSupabasePoolerUser = str_starts_with($dbUser, 'postgres.');
        $isSupabaseTarget = $isSupabaseHost || $isSupabasePoolerUser || $dbPort === '6543';

        $detectedProjectRef = null;
        if ($isSupabaseTarget) {
            // Block known foreign project refs
            foreach (self::BLOCKED_PROJECT_REFS as $blockedRef) {
                if (str_contains(strtolower($dbUser), $blockedRef) || str_contains(strtolower($dbHost), $blockedRef)) {
                    throw new RuntimeException("DITOLAK: Proyek Supabase ini teridentifikasi sebagai proyek eksternal/terlarang ('{$blockedRef}') dan dilarang digunakan untuk MFMS staging.");
                }
            }

            // Extract project ref from username (pooler mode) or host (direct mode)
            if (preg_match('/^postgres\.([a-zA-Z0-9_-]+)$/', $dbUser, $matches)) {
                $detectedProjectRef = $matches[1];
            } elseif (preg_match('/^db\.([a-zA-Z0-9_-]+)\.supabase\.co$/i', $dbHost, $matches)) {
                $detectedProjectRef = $matches[1];
            } elseif (str_contains(strtolower($dbHost), 'pooler.supabase.com')) {
                throw new RuntimeException("Koneksi Supabase Pooler wajib menggunakan format username 'postgres.<project_ref>', ditemukan: '{$dbUser}'.");
            }

            // Check against allowed project ref if specified
            $allowedRef = $expectedProjectRef ?: config('database.staging_project_ref') ?: env('DB_STAGING_PROJECT_REF');
            if (! empty($allowedRef)) {
                if ($detectedProjectRef !== $allowedRef) {
                    $detectedDisplay = $detectedProjectRef ?: 'tidak teridentifikasi';
                    throw new RuntimeException("Target koneksi Supabase tidak cocok dengan project ref staging yang diizinkan (Diharapkan: '{$allowedRef}', Terdeteksi: '{$detectedDisplay}'). Operasi DITOLAK demi keamanan isolasi.");
                }
            }
        } elseif (! empty($expectedProjectRef)) {
            // If user explicitly passed --project-ref, but connection is not pointing to that Supabase project
            if ($detectedProjectRef !== $expectedProjectRef) {
                throw new RuntimeException("Parameter --project-ref='{$expectedProjectRef}' diberikan, namun target koneksi '{$connName}' bukan proyek Supabase tersebut.");
            }
        }

        // 5. Pre-write Server Identity Confirmation
        $serverVersion = null;
        $serverDb = null;
        $serverUser = null;

        if ($confirmServerIdentity) {
            try {
                $pdo = DB::connection($connName)->getPdo();
                $identity = $pdo->query('SELECT current_database() as c_db, current_user as c_user, version() as c_ver')->fetch(\PDO::FETCH_ASSOC);

                $serverDb = (string) ($identity['c_db'] ?? '');
                $serverUser = (string) ($identity['c_user'] ?? '');
                $serverVersion = (string) ($identity['c_ver'] ?? '');

                if ($serverDb === 'mutiara_florist_prod' || str_contains(strtolower($serverDb), 'mutiara_florist_prod')) {
                    throw new RuntimeException("PERINGATAN KERAS: Database aktif pada server adalah '{$serverDb}' (database produksi toko). Operasi DITOLAK!");
                }
            } catch (\Throwable $e) {
                if ($e instanceof RuntimeException) {
                    throw $e;
                }
                // Scrub potential password leaks in connection error messages
                $sanitizedMsg = preg_replace('/(password|pwd)=[^ ;]+/i', '$1=***', $e->getMessage());
                throw new RuntimeException("Koneksi ke database target '{$connName}' gagal: {$sanitizedMsg}");
            }
        }

        return [
            'connection' => $connName,
            'driver' => $driver,
            'host' => $dbHost,
            'port' => $dbPort,
            'database' => $dbName,
            'username' => $dbUser,
            'sslmode' => (string) ($config['sslmode'] ?? 'prefer'),
            'project_ref' => $detectedProjectRef,
            'server_database' => $serverDb,
            'server_user' => $serverUser,
            'server_version' => $serverVersion,
        ];
    }
}
