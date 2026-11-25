<?php

namespace App\Services;

use App\Support\DemoAccessManager;
use Carbon\Carbon;
use Database\Seeders\DemoDatasetSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PDO;
use RuntimeException;

class DemoResetService
{
    public function __construct(
        private readonly DemoAccessManager $demo
    ) {}

    /**
     * Rebuilds the isolated demo SQLite database out-of-band on a staging file,
     * runs full migrations + synthetic florist seeding, verifies SQLite integrity,
     * and atomically swaps the live SQLite file under an exclusive file lock
     * with a brief quiesce flag to keep concurrent requests safe.
     *
     * @return array{
     *     sqlite_path: string,
     *     size_bytes: int,
     *     reset_at: string,
     *     sessions_flushed: int,
     *     counts: array<string, int>
     * }
     */
    public function reset(?string $targetSqlitePath = null, ?bool $flushSessions = null): array
    {
        if (! $this->demo->isDemoRuntime()) {
            throw new RuntimeException(
                'DemoResetService DITOLAK: Reset demo hanya boleh dijalankan pada runtime demo (MFMS_RUNTIME_MODE=demo).'
            );
        }

        if ($this->demo->demoPassword() === null) {
            throw new RuntimeException('DEMO_PASSWORD wajib dikonfigurasi sebelum menjalankan reset database demo.');
        }

        $targetPath = $targetSqlitePath ?: (string) Config::get('database.connections.sqlite.database', '');
        if ($targetPath === '' || $targetPath === ':memory:') {
            throw new RuntimeException(
                "Target SQLite demo tidak valid untuk reset berbasis berkas (terdeteksi: '{$targetPath}')."
            );
        }

        if (str_contains(strtolower($targetPath), 'mutiara_florist_prod')) {
            throw new RuntimeException('PERINGATAN KERAS: Path target mengandung nama produksi. Reset dibatalkan.');
        }

        $targetDir = dirname($targetPath);
        if (! is_dir($targetDir) && ! mkdir($targetDir, 0775, true) && ! is_dir($targetDir)) {
            throw new RuntimeException("Gagal membuat direktori SQLite demo: {$targetDir}");
        }

        $lockPath = (string) Config::get('demo.reset_lock_file', $targetDir.'/reset.lock');
        $lockDir = dirname($lockPath);
        if (! is_dir($lockDir)) {
            @mkdir($lockDir, 0775, true);
        }

        $lockHandle = fopen($lockPath, 'c+');
        if ($lockHandle === false) {
            throw new RuntimeException("Gagal membuka file lock reset demo: {$lockPath}");
        }

        if (! flock($lockHandle, LOCK_EX)) {
            fclose($lockHandle);
            throw new RuntimeException('Gagal memperoleh lock eksklusif untuk reset demo.');
        }

        $stagingPath = $targetPath.'.staging.'.getmypid().'.'.bin2hex(random_bytes(4));
        $resettingFlagPath = (string) Config::get('demo.resetting_flag_file', $targetDir.'/resetting.flag');
        $previousDefault = (string) Config::get('database.default', 'sqlite');
        $originalStagingConfig = Config::get('database.connections.demo_staging');

        try {
            // 0. Crash recovery: remove any orphaned staging artifacts left by an interrupted prior reset
            foreach (glob($targetPath.'.staging.*') ?: [] as $orphanStaging) {
                if (is_file($orphanStaging)) {
                    @unlink($orphanStaging);
                }
            }

            // 1. Build a brand-new SQLite database completely out-of-band (zero downtime during seed)
            if (touch($stagingPath) === false) {
                throw new RuntimeException("Gagal membuat file staging SQLite: {$stagingPath}");
            }

            Config::set('database.connections.demo_staging', [
                'driver' => 'sqlite',
                'database' => $stagingPath,
                'prefix' => '',
                'foreign_key_constraints' => true,
                'busy_timeout' => 5000,
                'journal_mode' => 'DELETE',
                'synchronous' => 'NORMAL',
                'transaction_mode' => 'DEFERRED',
            ]);
            DB::purge('demo_staging');

            $migrateExit = Artisan::call('migrate', [
                '--database' => 'demo_staging',
                '--force' => true,
            ]);

            if ($migrateExit !== 0) {
                throw new RuntimeException('Migrasi skema pada file staging SQLite demo gagal: '.trim(Artisan::output()));
            }

            // Temporarily bind default connection to demo_staging so domain services seed cleanly
            Config::set('database.default', 'demo_staging');
            DB::setDefaultConnection('demo_staging');

            try {
                app(DemoDatasetSeeder::class)->run();
            } finally {
                Config::set('database.default', $previousDefault);
                DB::setDefaultConnection($previousDefault);
            }

            // 2. Verify SQLite integrity & row counts before swapping live file
            $stagingConn = DB::connection('demo_staging');
            $integrity = $stagingConn->selectOne('PRAGMA integrity_check');
            $integrityStatus = is_object($integrity) ? strtolower((string) ($integrity->integrity_check ?? '')) : '';
            if ($integrityStatus !== 'ok') {
                throw new RuntimeException("Verifikasi integrity_check SQLite staging gagal: {$integrityStatus}");
            }

            $counts = [
                'users' => $stagingConn->table('users')->count(),
                'customers' => $stagingConn->table('customers')->count(),
                'orders' => $stagingConn->table('orders')->count(),
                'order_items' => $stagingConn->table('order_items')->count(),
                'payments' => $stagingConn->table('payments')->count(),
                'expense_categories' => $stagingConn->table('expense_categories')->count(),
                'expenses' => $stagingConn->table('expenses')->count(),
                'audit_logs' => $stagingConn->table('audit_logs')->count(),
            ];

            if ($counts['users'] !== 1 || $counts['orders'] < 10) {
                throw new RuntimeException('Jumlah data sintetis staging tidak memenuhi ambang minimum verifikasi.');
            }

            // Force DELETE journal mode on staging so it is a single self-contained file with no WAL sidecars
            $stagingConn->statement('PRAGMA journal_mode=DELETE');
            DB::disconnect('demo_staging');
            DB::purge('demo_staging');

            // 3. Enter brief quiesce window so concurrent HTTP requests receive 503 Retry-After cleanly
            $flagDir = dirname($resettingFlagPath);
            if (! is_dir($flagDir)) {
                @mkdir($flagDir, 0775, true);
            }
            file_put_contents($resettingFlagPath, Carbon::now('Asia/Jakarta')->toIso8601String());

            // Give in-flight queries a short moment to complete before checkpointing & swapping
            usleep(app()->runningUnitTests() ? 10_000 : 200_000);

            // 4. Checkpoint & close existing live SQLite file to prevent stale WAL replay on new inode
            $isActiveSqliteTarget = (string) Config::get('database.connections.sqlite.database', '') === $targetPath;
            if ($isActiveSqliteTarget) {
                DB::disconnect('sqlite');
                DB::purge('sqlite');
            }

            if (is_file($targetPath)) {
                $this->checkpointAndCloseSqlite($targetPath);
            }

            gc_collect_cycles();

            foreach ([$targetPath.'-wal', $targetPath.'-shm', $targetPath.'-journal'] as $sidecar) {
                if (is_file($sidecar)) {
                    @unlink($sidecar);
                }
            }

            // 5. Atomic file replacement
            if (! @rename($stagingPath, $targetPath)) {
                // Fallback for Windows handles if rename cannot overwrite directly
                if (! @copy($stagingPath, $targetPath)) {
                    throw new RuntimeException("Gagal mengganti file SQLite demo di {$targetPath}");
                }
                @unlink($stagingPath);
            }

            @chmod($targetPath, 0664);

            // 6. Enable WAL mode on the fresh live database for concurrent demo read/write safety
            $this->configureLiveWalMode($targetPath);
            if ($isActiveSqliteTarget) {
                DB::purge('sqlite');
            }

            // 7. Optionally flush file-based demo sessions so stale model IDs do not linger
            $shouldFlush = $flushSessions ?? (bool) Config::get('demo.flush_sessions_on_reset', true);
            $sessionsFlushed = $shouldFlush ? $this->flushFileSessions() : 0;

            $resetAt = Carbon::now('Asia/Jakarta')->toIso8601String();
            $sizeBytes = (int) (filesize($targetPath) ?: 0);

            Log::info('MFMS demo SQLite dataset reset completed cleanly.', [
                'sqlite_path' => $targetPath,
                'size_bytes' => $sizeBytes,
                'counts' => $counts,
                'sessions_flushed' => $sessionsFlushed,
            ]);

            return [
                'sqlite_path' => $targetPath,
                'size_bytes' => $sizeBytes,
                'reset_at' => $resetAt,
                'sessions_flushed' => $sessionsFlushed,
                'counts' => $counts,
            ];
        } finally {
            Config::set('database.default', $previousDefault);
            DB::setDefaultConnection($previousDefault);

            if ($originalStagingConfig === null) {
                $connections = Config::get('database.connections', []);
                unset($connections['demo_staging']);
                Config::set('database.connections', $connections);
            } else {
                Config::set('database.connections.demo_staging', $originalStagingConfig);
            }

            DB::disconnect('demo_staging');
            DB::purge('demo_staging');

            foreach ([$stagingPath, $stagingPath.'-wal', $stagingPath.'-shm', $stagingPath.'-journal'] as $tmpFile) {
                if (is_file($tmpFile)) {
                    @unlink($tmpFile);
                }
            }

            if (is_file($resettingFlagPath)) {
                @unlink($resettingFlagPath);
            }

            flock($lockHandle, LOCK_UN);
            fclose($lockHandle);
        }
    }

    private function checkpointAndCloseSqlite(string $path): void
    {
        try {
            $pdo = new PDO('sqlite:'.$path);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $pdo->exec('PRAGMA busy_timeout=5000');
            $pdo->exec('PRAGMA wal_checkpoint(TRUNCATE)');
            $pdo->exec('PRAGMA journal_mode=DELETE');
            $pdo = null;
        } catch (\Throwable $e) {
            Log::warning('SQLite pre-swap checkpoint warning (continuing safely): '.$e->getMessage());
        }
    }

    private function configureLiveWalMode(string $path): void
    {
        $pdo = new PDO('sqlite:'.$path);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->exec('PRAGMA busy_timeout=5000');
        $pdo->exec('PRAGMA foreign_keys=ON');
        $pdo->exec('PRAGMA journal_mode=WAL');
        $pdo->exec('PRAGMA synchronous=NORMAL');
        $pdo = null;
    }

    private function flushFileSessions(): int
    {
        if (Config::get('session.driver') !== 'file') {
            return 0;
        }

        $sessionDir = (string) Config::get('session.files', storage_path('framework/sessions'));
        if ($sessionDir === '' || ! is_dir($sessionDir)) {
            return 0;
        }

        $deleted = 0;
        $entries = scandir($sessionDir) ?: [];
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..' || $entry === '.gitignore') {
                continue;
            }
            $full = $sessionDir.DIRECTORY_SEPARATOR.$entry;
            if (is_file($full) && @unlink($full)) {
                $deleted++;
            }
        }

        return $deleted;
    }
}
