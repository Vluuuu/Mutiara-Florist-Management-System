<?php

namespace App\Support;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DemoRuntimeGuard
{
    /**
     * Enforces strict runtime database isolation when running in demo mode.
     * Prevents database fallback to PostgreSQL/MySQL/MariaDB and scrubs
     * non-SQLite connections from runtime configuration.
     *
     * @throws RuntimeException
     */
    public static function enforceSqliteOnlyIsolation(): void
    {
        $manager = app(DemoAccessManager::class);
        if (! $manager->isDemoRuntime()) {
            return;
        }

        $defaultConnection = (string) Config::get('database.default', '');
        $defaultConfig = Config::get("database.connections.{$defaultConnection}");

        if (! is_array($defaultConfig) || ($defaultConfig['driver'] ?? null) !== 'sqlite') {
            throw new RuntimeException(
                "ISOLASI DEMO GAGAL: Runtime demo wajib memakai driver sqlite, ditemukan '{$defaultConnection}'."
            );
        }

        $databasePath = (string) ($defaultConfig['database'] ?? '');
        if ($databasePath === '') {
            throw new RuntimeException('ISOLASI DEMO GAGAL: Lokasi database SQLite demo tidak dikonfigurasi.');
        }

        if (str_contains(strtolower($databasePath), 'mutiara_florist_prod')) {
            throw new RuntimeException('ISOLASI DEMO GAGAL: Path database terdeteksi mengarah ke nama produksi.');
        }

        // Scrub all non-SQLite connection definitions from runtime config so no service
        // or fallback path can ever open a connection to production PostgreSQL/MariaDB.
        $connections = Config::get('database.connections', []);
        if (is_array($connections)) {
            $filtered = [];
            foreach ($connections as $name => $conn) {
                if (is_array($conn) && ($conn['driver'] ?? null) === 'sqlite') {
                    $filtered[$name] = $conn;
                }
            }
            Config::set('database.connections', $filtered);
        }

        // Ensure SQLite pragmatic safety defaults for concurrent demo traffic.
        if (Config::get("database.connections.{$defaultConnection}.busy_timeout") === null) {
            Config::set("database.connections.{$defaultConnection}.busy_timeout", 5000);
        }
        if (Config::get("database.connections.{$defaultConnection}.foreign_key_constraints") !== true) {
            Config::set("database.connections.{$defaultConnection}.foreign_key_constraints", true);
        }
        if ($databasePath !== ':memory:' && Config::get("database.connections.{$defaultConnection}.journal_mode") === null) {
            Config::set("database.connections.{$defaultConnection}.journal_mode", 'WAL');
        }
        if ($databasePath !== ':memory:' && Config::get("database.connections.{$defaultConnection}.synchronous") === null) {
            Config::set("database.connections.{$defaultConnection}.synchronous", 'NORMAL');
        }
    }

    /**
     * Blocks sensitive administrative or production operations inside demo runtime.
     *
     * @throws RuntimeException
     */
    public static function forbidInDemoRuntime(string $operation): void
    {
        if (app(DemoAccessManager::class)->isDemoRuntime()) {
            throw new RuntimeException(
                "Operasi administratif '{$operation}' dinonaktifkan pada lingkungan demo."
            );
        }
    }

    /**
     * Enforces soft row quotas inside the shared demo runtime so abusive
     * traffic cannot exhaust container storage. No-op in production runtime.
     */
    public static function enforceDemoQuota(string $table, int $limit, string $errorField, string $label): void
    {
        if (! app(DemoAccessManager::class)->isDemoRuntime()) {
            return;
        }

        if (DB::table($table)->count() >= $limit) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                $errorField => "Batas kapasitas data simulasi {$label} ({$limit} entri) telah tercapai. Data akan direset otomatis setiap 24 jam.",
            ]);
        }
    }

    /**
     * Verifies that the active default PDO connection is genuinely SQLite.
     *
     * @throws RuntimeException
     */
    public static function assertActiveConnectionIsSqlite(): void
    {
        if (! app(DemoAccessManager::class)->isDemoRuntime()) {
            return;
        }

        $driver = DB::connection()->getDriverName();
        if ($driver !== 'sqlite') {
            throw new RuntimeException("ISOLASI DEMO GAGAL: Koneksi aktif bukan sqlite (terdeteksi: {$driver}).");
        }
    }
}
