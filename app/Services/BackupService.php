<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;
use RuntimeException;

class BackupService
{
    /**
     * Tables included in the consistent business backup.
     */
    public const TABLES = [
        'users',
        'customers',
        'orders',
        'order_items',
        'payments',
        'expense_categories',
        'expenses',
        'audit_logs',
        'migrations',
    ];

    protected string $backupDirectory;

    public function __construct(?string $backupDirectory = null)
    {
        $this->backupDirectory = $backupDirectory ?: storage_path('app/backups');
    }

    public function setBackupDirectory(string $dir): self
    {
        $this->backupDirectory = $dir;

        return $this;
    }

    public function getBackupDirectory(): string
    {
        return $this->backupDirectory;
    }

    /**
     * Resolves the encryption key with dedicated backup key priority.
     */
    public function resolveEncryptionKey(?string $explicitKey = null): string
    {
        $key = $explicitKey ?: env('BACKUP_ENCRYPTION_KEY') ?: config('backup.key') ?: config('app.key');

        if (empty($key)) {
            throw new InvalidArgumentException('Kunci enkripsi backup tidak boleh kosong.');
        }

        return (string) $key;
    }

    /**
     * Creates an encrypted database backup with AES-256-GCM authenticated encryption,
     * authenticated additional data (AAD) protecting metadata, and SHA-256 integrity checksum
     * using a consistent transactional database snapshot.
     *
     * @return array{enc_path: string, meta_path: string, meta: array}
     */
    public function createBackup(?string $encryptionKey = null, ?string $connection = null): array
    {
        $conn = DB::connection($connection);
        $key = $this->resolveEncryptionKey($encryptionKey);

        if (! is_dir($this->backupDirectory)) {
            mkdir($this->backupDirectory, 0750, true);
        }

        // Collision-resistant unique filename with microsecond resolution and random entropy
        $now = Carbon::now('Asia/Jakarta');
        $uniqueSuffix = $now->format('Y-m-d_His_u').'_'.bin2hex(random_bytes(4));
        $baseName = 'mfms_backup_'.$uniqueSuffix;
        $encPath = $this->backupDirectory.'/'.$baseName.'.enc';
        $metaPath = $this->backupDirectory.'/'.$baseName.'.meta.json';

        $encTmpPath = $encPath.'.tmp.'.bin2hex(random_bytes(4));
        $metaTmpPath = $metaPath.'.tmp.'.bin2hex(random_bytes(4));

        // 1. Consistent snapshot read via PDO directly to avoid desynchronizing Laravel's transaction counter
        $pdo = $conn->getPdo();
        $driver = $conn->getDriverName();
        $inConsistentSnapshot = false;

        try {
            if ($driver === 'mysql' || $driver === 'mariadb') {
                $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
                $pdo->exec('START TRANSACTION WITH CONSISTENT SNAPSHOT');
                $inConsistentSnapshot = true;
            } elseif ($driver === 'sqlite') {
                if (! $pdo->inTransaction()) {
                    $pdo->beginTransaction();
                    $inConsistentSnapshot = true;
                }
            }

            $tableCounts = [];
            $tableData = [];

            foreach (self::TABLES as $table) {
                if (! Schema::connection($connection)->hasTable($table)) {
                    continue;
                }

                $count = (int) $conn->table($table)->count();
                $tableCounts[$table] = $count;

                $rows = [];
                if ($count > 0) {
                    $conn->table($table)->orderBy('id', 'asc')->chunk(500, function ($chunk) use (&$rows): void {
                        foreach ($chunk as $row) {
                            $rows[] = (array) $row;
                        }
                    });
                }
                $tableData[$table] = $rows;
            }

            // Financial invariant metrics captured within the exact same point-in-time snapshot
            $hasOrders = Schema::connection($connection)->hasTable('orders');
            $hasPayments = Schema::connection($connection)->hasTable('payments');
            $hasExpenses = Schema::connection($connection)->hasTable('expenses');

            $metrics = [
                'orders_count' => $hasOrders ? (int) $conn->table('orders')->count() : 0,
                'orders_total_amount' => $hasOrders ? (int) $conn->table('orders')->sum('total_amount') : 0,
                'payments_posted_amount' => $hasPayments ? (int) $conn->table('payments')->where('status', 'POSTED')->sum('amount') : 0,
                'expenses_posted_amount' => $hasExpenses ? (int) $conn->table('expenses')->where('status', 'POSTED')->sum('amount') : 0,
            ];
        } finally {
            if ($inConsistentSnapshot) {
                try {
                    if ($driver === 'mysql' || $driver === 'mariadb') {
                        $pdo->exec('ROLLBACK');
                    } elseif ($driver === 'sqlite') {
                        if ($pdo->inTransaction()) {
                            $pdo->rollBack();
                        }
                    }
                } catch (\Throwable) {
                    // Suppress rollback errors during cleanup
                }
            }
        }

        // 2. Canonical serialization preserving exact types, leading zeros, emoji, quotes, etc.
        $createdAt = $now->toIso8601String();
        $payload = [
            'version' => 2,
            'format' => 'mfms_structured_v2',
            'created_at' => $createdAt,
            'driver' => $driver,
            'tables' => $tableData,
            'metrics' => $metrics,
        ];

        $plainData = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($plainData === false) {
            throw new RuntimeException('Gagal melakukan serialisasi data backup: '.json_last_error_msg());
        }

        // 3. Compute SHA-256 checksum on plaintext
        $sha256 = hash('sha256', $plainData);

        // 4. Authenticated Encryption with AES-256-GCM + Additional Authenticated Data (AAD)
        // AAD cryptographically binds the metadata header to the ciphertext
        $aadData = json_encode([
            'version' => 2,
            'backup_file' => basename($encPath),
            'created_at' => $createdAt,
            'tables' => $tableCounts,
            'metrics' => $metrics,
        ], JSON_UNESCAPED_SLASHES);

        $derivedKey = hash('sha256', $key, true);
        $iv = random_bytes(12); // Standard 96-bit nonce for GCM
        $tag = '';

        $cipherText = openssl_encrypt(
            $plainData,
            'aes-256-gcm',
            $derivedKey,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            $aadData,
            16
        );

        if ($cipherText === false) {
            throw new RuntimeException('Gagal mengenkripsi data backup dengan AES-256-GCM.');
        }

        try {
            // 5. Atomic write: write to .tmp and rename upon completion
            file_put_contents($encTmpPath, $cipherText);
            chmod($encTmpPath, 0600);

            $meta = [
                'backup_file' => basename($encPath),
                'created_at' => $createdAt,
                'cipher' => 'AES-256-GCM',
                'iv' => base64_encode($iv),
                'tag' => base64_encode($tag),
                'aad' => base64_encode($aadData),
                'checksum_sha256' => $sha256,
                'size_plain' => strlen($plainData),
                'size_encrypted' => strlen($cipherText),
                'tables' => $tableCounts,
                'metrics' => $metrics,
                'key_fingerprint' => substr(hash('sha256', $derivedKey), 0, 16),
            ];

            file_put_contents($metaTmpPath, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            chmod($metaTmpPath, 0600);

            // Rename atomically
            rename($encTmpPath, $encPath);
            rename($metaTmpPath, $metaPath);
        } catch (\Throwable $e) {
            if (file_exists($encTmpPath)) {
                @unlink($encTmpPath);
            }
            if (file_exists($metaTmpPath)) {
                @unlink($metaTmpPath);
            }
            throw $e;
        }

        return [
            'enc_path' => $encPath,
            'meta_path' => $metaPath,
            'meta' => $meta,
        ];
    }

    /**
     * Decrypts and restores backup into an ISOLATED TEST database only.
     * Enforces strict safety guards prohibiting non-testing / operational databases.
     *
     * @return array{status: string, checksum_verified: bool, tables_verified: bool, metrics_verified: bool, fk_verified: bool, details: array}
     */
    public function restoreTest(string $encPath, ?string $encryptionKey = null, ?string $targetConnection = 'testing'): array
    {
        // -------------------------------------------------------------
        // STRICT SAFETY CHECK: Restorasi DILARANG pada database operasional / non-testing
        // -------------------------------------------------------------
        if (app()->environment('production')) {
            throw new InvalidArgumentException(
                'KEAMANAN DATA: Restorasi DILARANG KERAS dijalankan di lingkungan produksi (production environment)!'
            );
        }

        $targetConn = $targetConnection ?: 'testing';
        $connConfig = config("database.connections.{$targetConn}");

        if (empty($connConfig) || ! is_array($connConfig)) {
            throw new InvalidArgumentException("KEAMANAN DATA: Koneksi target '{$targetConn}' tidak terdaftar dalam konfigurasi.");
        }

        // 1. Connection configuration MUST have explicit boolean permission flag 'is_testing' => true
        if (($connConfig['is_testing'] ?? false) !== true) {
            throw new InvalidArgumentException(
                "KEAMANAN DATA: Restorasi DITOLAK! Koneksi '{$targetConn}' tidak memiliki izin eksplisit 'is_testing' => true dalam konfigurasi database."
            );
        }

        // 2. Dilarang dijalankan pada koneksi operasional default
        $defaultConnection = config('database.default');
        if ($targetConn === $defaultConnection && $defaultConnection !== 'testing') {
            throw new InvalidArgumentException(
                "KEAMANAN DATA: Restorasi dilarang dijalankan pada koneksi database operasional default '{$defaultConnection}'! Gunakan database pengujian terisolasi."
            );
        }

        // 3. Dilarang keras menggunakan nama database operasional
        $dbName = (string) ($connConfig['database'] ?? '');
        $prohibitedDbNames = array_map('strtolower', array_filter([
            'mfms', 'mutiara_florist', 'laravel',
            (string) config('database.connections.mysql.database'),
            (string) config('database.connections.mariadb.database'),
        ]));

        if (in_array(strtolower($dbName), $prohibitedDbNames, true)) {
            throw new InvalidArgumentException(
                "KEAMANAN DATA: Target database '{$dbName}' teridentifikasi sebagai database operasional/utama. Restorasi dibatalkan!"
            );
        }

        // 4. Target database harus memiliki identitas pengujian eksplisit (:memory:, _test, _testing, test_)
        $isTestDb = ($dbName === ':memory:') || (bool) preg_match('/(_test$|_testing$|test_)/i', $dbName);
        if (! $isTestDb) {
            throw new InvalidArgumentException(
                "KEAMANAN DATA: Nama database target '{$dbName}' harus memiliki penamaan pengujian eksplisit '_test', '_testing', atau 'test_'. Restorasi dibatalkan!"
            );
        }

        // If target is SQLite file and does not exist yet, create empty file
        if (($connConfig['driver'] ?? '') === 'sqlite' && $dbName !== ':memory:') {
            if (! file_exists($dbName)) {
                $dir = dirname($dbName);
                if (! is_dir($dir)) {
                    mkdir($dir, 0755, true);
                }
                touch($dbName);
            }
        }

        // Locate metadata
        $metaPath = preg_replace('/\.enc$/', '.meta.json', $encPath);
        if (! file_exists($metaPath)) {
            throw new RuntimeException("File metadata backup tidak ditemukan pada: {$metaPath}");
        }

        $meta = json_decode((string) file_get_contents($metaPath), true);
        if (! is_array($meta) || ! isset($meta['iv'], $meta['checksum_sha256'], $meta['cipher'])) {
            throw new RuntimeException('Format file metadata tidak valid atau rusak.');
        }

        // Decrypt
        $key = $this->resolveEncryptionKey($encryptionKey);
        $derivedKey = hash('sha256', $key, true);
        $iv = base64_decode((string) $meta['iv']);
        $cipherText = (string) file_get_contents($encPath);
        $cipher = strtoupper((string) $meta['cipher']);

        $plainData = false;
        if ($cipher === 'AES-256-GCM') {
            $tag = base64_decode((string) ($meta['tag'] ?? ''));
            if ($tag === '') {
                throw new RuntimeException('Autentikasi tag AES-256-GCM tidak ditemukan dalam metadata.');
            }

            // Verify AAD if present
            $aad = isset($meta['aad']) ? base64_decode((string) $meta['aad']) : '';

            $plainData = openssl_decrypt(
                $cipherText,
                'aes-256-gcm',
                $derivedKey,
                OPENSSL_RAW_DATA,
                $iv,
                $tag,
                $aad
            );
        } elseif ($cipher === 'AES-256-CBC') {
            $plainData = openssl_decrypt(
                $cipherText,
                'AES-256-CBC',
                $derivedKey,
                OPENSSL_RAW_DATA,
                $iv
            );
        } else {
            throw new RuntimeException("Algoritma sandi '{$cipher}' tidak didukung.");
        }

        if ($plainData === false) {
            throw new RuntimeException('Gagal mendekripsi backup. Kunci enkripsi salah, tag/metadata autentikasi gagal, atau file korup.');
        }

        // Verify Checksum
        $calculatedSha256 = hash('sha256', $plainData);
        if (! hash_equals($meta['checksum_sha256'], $calculatedSha256)) {
            throw new RuntimeException('INTEGRITAS GAGAL: Checksum SHA-256 tidak cocok! Data backup mungkin telah dimanipulasi.');
        }

        // Execute Restore in isolated target connection
        $conn = DB::connection($targetConn);
        $targetDriver = $conn->getDriverName();

        // Ensure tables exist on target connection by migrating if needed
        if (! Schema::connection($targetConn)->hasTable('orders')) {
            \Illuminate\Support\Facades\Artisan::call('migrate', [
                '--database' => $targetConn,
                '--force' => true,
            ]);
        }

        // Check if format is structured JSON (v2) or legacy SQL
        $isJsonDump = str_starts_with(trim($plainData), '{');

        if ($isJsonDump) {
            $dump = json_decode($plainData, true);
            if (! is_array($dump) || ! isset($dump['tables'])) {
                throw new RuntimeException('Format data snapshot JSON backup tidak valid.');
            }

            // Disable FK checks during truncate and restore
            if ($targetDriver === 'mysql' || $targetDriver === 'mariadb') {
                $conn->statement('SET FOREIGN_KEY_CHECKS=0');
            } elseif ($targetDriver === 'sqlite') {
                $conn->statement('PRAGMA foreign_keys = OFF');
            }

            try {
                $conn->transaction(function () use ($conn, $dump): void {
                    // Truncate / delete all tables first
                    foreach (self::TABLES as $table) {
                        if (Schema::connection($conn->getName())->hasTable($table)) {
                            $conn->table($table)->delete();
                        }
                    }

                    // Insert rows with PDO prepared statements, preserving exact types and leading zeros
                    foreach ($dump['tables'] as $table => $rows) {
                        if (! Schema::connection($conn->getName())->hasTable($table) || empty($rows)) {
                            continue;
                        }

                        // Chunk inserts to avoid exceeding placeholder limits
                        foreach (array_chunk($rows, 200) as $chunk) {
                            $conn->table($table)->insert($chunk);
                        }
                    }
                });
            } finally {
                // Re-enable FK checks
                if ($targetDriver === 'mysql' || $targetDriver === 'mariadb') {
                    $conn->statement('SET FOREIGN_KEY_CHECKS=1');
                } elseif ($targetDriver === 'sqlite') {
                    $conn->statement('PRAGMA foreign_keys = ON');
                }
            }
        } else {
            // Legacy SQL dump fallback parser
            $lines = explode("\n", $plainData);
            $buffer = '';

            $conn->transaction(function () use ($conn, $lines, &$buffer): void {
                foreach ($lines as $line) {
                    $trimmed = trim($line);
                    if ($trimmed === '' || str_starts_with($trimmed, '--')) {
                        continue;
                    }

                    $buffer .= $line."\n";
                    if (str_ends_with($trimmed, ';')) {
                        $stmt = $buffer;
                        if ($conn->getDriverName() === 'sqlite') {
                            $stmt = str_replace(['`', '\\\\', "\\'"], ['"', '\\', "''"], $stmt);
                        }
                        $conn->unprepared($stmt);
                        $buffer = '';
                    }
                }
            });
        }

        // -------------------------------------------------------------
        // Post-restore verification
        // -------------------------------------------------------------
        $verifiedTables = [];
        $allTablesMatch = true;

        foreach ($meta['tables'] as $table => $expectedCount) {
            if (Schema::connection($targetConn)->hasTable($table)) {
                $actualCount = (int) $conn->table($table)->count();
                $match = ($actualCount === (int) $expectedCount);
                if (! $match) {
                    $allTablesMatch = false;
                }
                $verifiedTables[$table] = [
                    'expected' => $expectedCount,
                    'actual' => $actualCount,
                    'match' => $match,
                ];
            }
        }

        // Financial metrics verification
        $actualOrdersAmount = (int) $conn->table('orders')->sum('total_amount');
        $actualPaymentsPosted = (int) $conn->table('payments')->where('status', 'POSTED')->sum('amount');
        $actualExpensesPosted = (int) $conn->table('expenses')->where('status', 'POSTED')->sum('amount');

        $metricsMatch = (
            $actualOrdersAmount === (int) $meta['metrics']['orders_total_amount'] &&
            $actualPaymentsPosted === (int) $meta['metrics']['payments_posted_amount'] &&
            $actualExpensesPosted === (int) $meta['metrics']['expenses_posted_amount']
        );

        // Foreign keys integrity verification
        $orphanOrderItems = (int) $conn->table('order_items')
            ->leftJoin('orders', 'order_items.order_id', '=', 'orders.id')
            ->whereNull('orders.id')
            ->count();

        $orphanPayments = (int) $conn->table('payments')
            ->leftJoin('orders', 'payments.order_id', '=', 'orders.id')
            ->whereNull('orders.id')
            ->count();

        $orphanExpenses = (int) $conn->table('expenses')
            ->leftJoin('expense_categories', 'expenses.expense_category_id', '=', 'expense_categories.id')
            ->whereNull('expense_categories.id')
            ->count();

        $fkValid = ($orphanOrderItems === 0 && $orphanPayments === 0 && $orphanExpenses === 0);

        return [
            'status' => ($allTablesMatch && $metricsMatch && $fkValid) ? 'SUCCESS' : 'FAILED',
            'checksum_verified' => true,
            'tables_verified' => $allTablesMatch,
            'metrics_verified' => $metricsMatch,
            'fk_verified' => $fkValid,
            'details' => [
                'checksum_sha256' => $calculatedSha256,
                'tables' => $verifiedTables,
                'metrics' => [
                    'orders_total_amount' => [
                        'expected' => $meta['metrics']['orders_total_amount'],
                        'actual' => $actualOrdersAmount,
                        'match' => ($actualOrdersAmount === (int) $meta['metrics']['orders_total_amount']),
                    ],
                    'payments_posted_amount' => [
                        'expected' => $meta['metrics']['payments_posted_amount'],
                        'actual' => $actualPaymentsPosted,
                        'match' => ($actualPaymentsPosted === (int) $meta['metrics']['payments_posted_amount']),
                    ],
                    'expenses_posted_amount' => [
                        'expected' => $meta['metrics']['expenses_posted_amount'],
                        'actual' => $actualExpensesPosted,
                        'match' => ($actualExpensesPosted === (int) $meta['metrics']['expenses_posted_amount']),
                    ],
                ],
                'foreign_keys' => [
                    'orphan_order_items' => $orphanOrderItems,
                    'orphan_payments' => $orphanPayments,
                    'orphan_expenses' => $orphanExpenses,
                ],
            ],
        ];
    }
}
