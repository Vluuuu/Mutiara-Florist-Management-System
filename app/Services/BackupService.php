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

    /**
     * Creates an encrypted database backup with SHA-256 integrity checksum.
     *
     * @return array{enc_path: string, meta_path: string, meta: array}
     */
    public function createBackup(?string $encryptionKey = null, ?string $connection = null): array
    {
        $conn = DB::connection($connection);
        $key = $encryptionKey ?: config('app.key');

        if (empty($key)) {
            throw new InvalidArgumentException('Kunci enkripsi backup tidak boleh kosong.');
        }

        $backupDir = storage_path('app/backups');
        if (! is_dir($backupDir)) {
            mkdir($backupDir, 0750, true);
        }

        $timestamp = Carbon::now('Asia/Jakarta')->format('Y-m-d_His');
        $baseName = 'mfms_backup_'.$timestamp;
        $encPath = $backupDir.'/'.$baseName.'.enc';
        $metaPath = $backupDir.'/'.$baseName.'.meta.json';

        // 1. Generate SQL dump and gather metrics
        $tableCounts = [];
        $sqlParts = [];
        $sqlParts[] = "-- MFMS Encrypted Database Backup";
        $sqlParts[] = "-- Generated at: ".Carbon::now('Asia/Jakarta')->toIso8601String();
        $sqlParts[] = "-- Driver: ".$conn->getDriverName();
        $sqlParts[] = "";

        foreach (self::TABLES as $table) {
            if (! Schema::connection($connection)->hasTable($table)) {
                continue;
            }

            $count = (int) $conn->table($table)->count();
            $tableCounts[$table] = $count;

            $sqlParts[] = "-- Table: {$table} ({$count} rows)";
            $sqlParts[] = "DELETE FROM {$table};";

            if ($count > 0) {
                // Fetch in chunks to avoid memory spikes
                $conn->table($table)->orderBy('id', 'asc')->chunk(500, function ($rows) use (&$sqlParts, $table, $conn): void {
                    foreach ($rows as $row) {
                        $rowArr = (array) $row;
                        $columns = array_keys($rowArr);
                        $escapedColumns = array_map(fn ($c) => "`{$c}`", $columns);

                        $values = [];
                        foreach ($rowArr as $val) {
                            if ($val === null) {
                                $values[] = 'NULL';
                            } elseif (is_numeric($val)) {
                                $values[] = (string) $val;
                            } else {
                                // Escape string value
                                $escaped = str_replace(["\\", "'"], ["\\\\", "\\'"], (string) $val);
                                $values[] = "'{$escaped}'";
                            }
                        }

                        $sqlParts[] = "INSERT INTO `{$table}` (".implode(', ', $escapedColumns).") VALUES (".implode(', ', $values).");";
                    }
                });
            }
            $sqlParts[] = "";
        }

        // Financial invariant metrics for verification
        $hasOrders = Schema::connection($connection)->hasTable('orders');
        $hasPayments = Schema::connection($connection)->hasTable('payments');
        $hasExpenses = Schema::connection($connection)->hasTable('expenses');

        $metrics = [
            'orders_count' => $hasOrders ? (int) $conn->table('orders')->count() : 0,
            'orders_total_amount' => $hasOrders ? (int) $conn->table('orders')->sum('total_amount') : 0,
            'payments_posted_amount' => $hasPayments ? (int) $conn->table('payments')->where('status', 'POSTED')->sum('amount') : 0,
            'expenses_posted_amount' => $hasExpenses ? (int) $conn->table('expenses')->where('status', 'POSTED')->sum('amount') : 0,
        ];

        $plainSql = implode("\n", $sqlParts);

        // 2. Compute SHA-256 checksum on plaintext
        $sha256 = hash('sha256', $plainSql);

        // 3. Encrypt using AES-256-CBC
        $derivedKey = hash('sha256', $key, true);
        $iv = random_bytes(16);
        $cipherText = openssl_encrypt($plainSql, 'AES-256-CBC', $derivedKey, OPENSSL_RAW_DATA, $iv);

        if ($cipherText === false) {
            throw new RuntimeException('Gagal mengenkripsi data backup dengan AES-256-CBC.');
        }

        // Write encrypted file
        file_put_contents($encPath, $cipherText);
        chmod($encPath, 0600);

        // 4. Create metadata
        $meta = [
            'backup_file' => basename($encPath),
            'created_at' => Carbon::now('Asia/Jakarta')->toIso8601String(),
            'cipher' => 'AES-256-CBC',
            'iv' => base64_encode($iv),
            'checksum_sha256' => $sha256,
            'size_plain' => strlen($plainSql),
            'size_encrypted' => strlen($cipherText),
            'tables' => $tableCounts,
            'metrics' => $metrics,
        ];

        file_put_contents($metaPath, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        chmod($metaPath, 0600);

        return [
            'enc_path' => $encPath,
            'meta_path' => $metaPath,
            'meta' => $meta,
        ];
    }

    /**
     * Decrypts and restores backup into an ISOLATED TEST database only.
     * Never allows execution on production / default operational database.
     *
     * @return array{status: string, checksum_verified: bool, tables_verified: bool, metrics_verified: bool, fk_verified: bool, details: array}
     */
    public function restoreTest(string $encPath, ?string $encryptionKey = null, ?string $targetConnection = 'testing'): array
    {
        // -------------------------------------------------------------
        // STRICT SAFETY CHECK: Restorasi DILARANG pada database produksi
        // -------------------------------------------------------------
        $defaultConnection = config('database.default');
        $targetConn = $targetConnection ?: 'testing';

        if ($targetConn === $defaultConnection && $defaultConnection !== 'testing') {
            throw new InvalidArgumentException(
                "KEAMANAN DATA: Restorasi dilarang dijalankan pada koneksi database operasional default '{$defaultConnection}'! Gunakan database pengujian terisolasi."
            );
        }

        $dbName = config("database.connections.{$targetConn}.database");
        if ($dbName === 'mfms' || $dbName === 'mutiara_florist') {
            throw new InvalidArgumentException(
                "KEAMANAN DATA: Target database '{$dbName}' teridentifikasi sebagai database utama. Restorasi dibatalkan!"
            );
        }

        // If target is SQLite file and does not exist yet, create empty file
        if (config("database.connections.{$targetConn}.driver") === 'sqlite' && is_string($dbName) && $dbName !== ':memory:') {
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
        if (! is_array($meta) || ! isset($meta['iv'], $meta['checksum_sha256'])) {
            throw new RuntimeException("Format file metadata tidak valid atau rusak.");
        }

        // Decrypt
        $key = $encryptionKey ?: config('app.key');
        $derivedKey = hash('sha256', $key, true);
        $iv = base64_decode((string) $meta['iv']);
        $cipherText = (string) file_get_contents($encPath);

        $plainSql = openssl_decrypt($cipherText, 'AES-256-CBC', $derivedKey, OPENSSL_RAW_DATA, $iv);
        if ($plainSql === false) {
            throw new RuntimeException("Gagal mendekripsi backup. Kunci enkripsi salah atau file korup.");
        }

        // Verify Checksum
        $calculatedSha256 = hash('sha256', $plainSql);
        if (! hash_equals($meta['checksum_sha256'], $calculatedSha256)) {
            throw new RuntimeException("INTEGRITAS GAGAL: Checksum SHA-256 tidak cocok! Data backup mungkin telah dimanipulasi.");
        }

        // Execute SQL statements in the isolated target connection
        $conn = DB::connection($targetConn);

        // Ensure tables exist on target connection by migrating if needed
        if (! Schema::connection($targetConn)->hasTable('orders')) {
            \Illuminate\Support\Facades\Artisan::call('migrate', [
                '--database' => $targetConn,
                '--force' => true,
            ]);
        }

        $lines = explode("\n", $plainSql);
        $buffer = '';

        $conn->transaction(function () use ($conn, $lines, &$buffer): void {
            foreach ($lines as $line) {
                $trimmed = trim($line);
                if ($trimmed === '' || str_starts_with($trimmed, '--')) {
                    continue;
                }

                $buffer .= $line."\n";
                if (str_ends_with($trimmed, ';')) {
                    // SQLite specific: remove backticks for compatibility if target is SQLite
                    $stmt = $buffer;
                    if ($conn->getDriverName() === 'sqlite') {
                        $stmt = str_replace(['`', '\\\\', "\\'"], ['"', '\\', "''"], $stmt);
                    }
                    $conn->unprepared($stmt);
                    $buffer = '';
                }
            }
        });

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
