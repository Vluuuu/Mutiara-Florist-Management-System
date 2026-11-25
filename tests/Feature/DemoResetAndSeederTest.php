<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use App\Services\DemoResetService;
use Carbon\Carbon;
use Database\Seeders\DemoDatasetSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use PDO;
use Tests\TestCase;

class DemoResetAndSeederTest extends TestCase
{
    use RefreshDatabase;

    private string $tempDir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tempDir = storage_path('framework/testing/demo-reset-'.uniqid());
        mkdir($this->tempDir, 0775, true);
    }

    protected function tearDown(): void
    {
        parent::tearDown();

        if (is_dir($this->tempDir)) {
            foreach (glob($this->tempDir.'/*') ?: [] as $file) {
                @unlink($file);
            }
            @rmdir($this->tempDir);
        }
    }

    public function test_demo_dataset_seeder_obeys_all_mfms_financial_and_operational_invariants(): void
    {
        Config::set('demo.runtime_mode', 'demo');
        Config::set('demo.enabled', true);
        Config::set('demo.email', 'demo@mutiaraflorist.id');
        Config::set('demo.password', 'Mutiara-Seed-6v3K9');
        Config::set('demo.activated_at', Carbon::now('Asia/Jakarta')->toIso8601String());

        $this->seed(DemoDatasetSeeder::class);

        $this->assertSame(1, User::query()->count());
        $this->assertSame('demo@mutiaraflorist.id', User::query()->first()->email);
        $this->assertSame(12, Customer::query()->count());
        $this->assertSame(18, Order::query()->count());
        $this->assertGreaterThanOrEqual(20, DB::table('order_items')->count());
        $this->assertSame(6, DB::table('expense_categories')->count());
        $this->assertSame(5, DB::table('expense_categories')->where('is_active', true)->count());
        $this->assertSame(1, DB::table('payments')->where('status', 'VOIDED')->count());
        $this->assertSame(1, DB::table('expenses')->where('status', 'VOIDED')->count());
        $this->assertGreaterThan(50, DB::table('audit_logs')->count());

        // Verify server-side BIGINT math invariant across every seeded order
        foreach (Order::with('items', 'payments')->get() as $order) {
            $computedTotal = $order->items->sum(function ($item): int {
                $flower = (int) $item->quantity * (int) $item->unit_price;
                $shipping = $item->shipping_mode === 'SEPARATE' ? (int) $item->shipping_fee : 0;

                return $flower + $shipping;
            });

            $this->assertSame($computedTotal, (int) $order->total_amount);

            $paid = (int) $order->payments->where('status', 'POSTED')->sum('amount');
            $this->assertLessThanOrEqual((int) $order->total_amount, $paid);
        }

        // Verify zero-order customer exists for archive testing
        $zeroOrderCustomer = Customer::query()->withCount('orders')->where('name', 'Galeri Kopi Meranti')->first();
        $this->assertNotNull($zeroOrderCustomer);
        $this->assertSame(0, (int) $zeroOrderCustomer->orders_count);
    }

    public function test_atomic_daily_reset_restores_clean_synthetic_dataset_and_wipes_visitor_mutations(): void
    {
        $sqlitePath = $this->tempDir.'/demo.sqlite';
        $lockPath = $this->tempDir.'/reset.lock';
        $flagPath = $this->tempDir.'/resetting.flag';

        Config::set('demo.runtime_mode', 'demo');
        Config::set('demo.enabled', true);
        Config::set('demo.email', 'demo@mutiaraflorist.id');
        Config::set('demo.password', 'Mutiara-Reset-8k4M2');
        Config::set('demo.activated_at', Carbon::now('Asia/Jakarta')->toIso8601String());
        Config::set('demo.reset_lock_file', $lockPath);
        Config::set('demo.resetting_flag_file', $flagPath);

        // Initial build via DemoResetService
        $summary1 = app(DemoResetService::class)->reset(targetSqlitePath: $sqlitePath, flushSessions: false);

        $this->assertFileExists($sqlitePath);
        $this->assertFileDoesNotExist($flagPath);
        $this->assertSame(1, $summary1['counts']['users']);
        $this->assertSame(12, $summary1['counts']['customers']);
        $this->assertSame(18, $summary1['counts']['orders']);

        // Simulate visitor mutations directly on the live SQLite database
        $pdo = new PDO('sqlite:'.$sqlitePath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->exec("INSERT INTO customers (name, phone, notes, created_at, updated_at) VALUES ('Pengunjung Demo Sementara', '081299998888', 'Mutasi uji', datetime('now'), datetime('now'))");
        $mutatedCount = (int) $pdo->query('SELECT COUNT(*) FROM customers')->fetchColumn();
        $this->assertSame(13, $mutatedCount);
        $pdo = null;

        // Run scheduled Artisan reset command to restore clean baseline
        $this->artisan('mfms:demo-reset', [
            '--path' => $sqlitePath,
            '--keep-sessions' => true,
            '--force' => true,
        ])->assertSuccessful();

        // Verify visitor mutation is gone, baseline restored, integrity OK, WAL enabled, no staging leftovers
        $pdoAfter = new PDO('sqlite:'.$sqlitePath);
        $pdoAfter->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->assertSame(12, (int) $pdoAfter->query('SELECT COUNT(*) FROM customers')->fetchColumn());
        $this->assertSame(0, (int) $pdoAfter->query("SELECT COUNT(*) FROM customers WHERE name = 'Pengunjung Demo Sementara'")->fetchColumn());
        $this->assertSame('ok', strtolower((string) $pdoAfter->query('PRAGMA integrity_check')->fetchColumn()));
        $this->assertSame('wal', strtolower((string) $pdoAfter->query('PRAGMA journal_mode')->fetchColumn()));
        $pdoAfter = null;

        $this->assertEmpty(glob($this->tempDir.'/*.staging.*') ?: []);
        $this->assertFileDoesNotExist($flagPath);
    }

    public function test_demo_reset_command_refuses_execution_in_production_runtime(): void
    {
        Config::set('demo.runtime_mode', 'production');

        $this->artisan('mfms:demo-reset', ['--force' => true])
            ->assertFailed();
    }

    public function test_demo_status_never_exposes_password_and_password_generator_works(): void
    {
        $secret = 'Mutiara-NeverLeak-9z2X';
        Config::set('demo.runtime_mode', 'demo');
        Config::set('demo.enabled', true);
        Config::set('demo.password', $secret);
        Config::set('demo.activated_at', Carbon::now('Asia/Jakarta')->toIso8601String());

        $this->artisan('mfms:demo-status')
            ->assertSuccessful()
            ->doesntExpectOutputToContain($secret);

        $this->artisan('mfms:demo-generate-password')
            ->assertSuccessful();
    }

    public function test_reset_recovers_from_orphaned_staging_files_and_handles_concurrent_readers_safely(): void
    {
        $sqlitePath = $this->tempDir.'/demo_concurrent.sqlite';
        $lockPath = $this->tempDir.'/reset.lock';
        $flagPath = $this->tempDir.'/resetting.flag';

        Config::set('demo.runtime_mode', 'demo');
        Config::set('demo.enabled', true);
        Config::set('demo.email', 'demo@mutiaraflorist.id');
        Config::set('demo.password', 'Mutiara-Conc-3x8R5');
        Config::set('demo.activated_at', Carbon::now('Asia/Jakarta')->toIso8601String());
        Config::set('demo.reset_lock_file', $lockPath);
        Config::set('demo.resetting_flag_file', $flagPath);

        // Initial seed
        app(DemoResetService::class)->reset(targetSqlitePath: $sqlitePath, flushSessions: false);

        // Simulate crash-interrupted leftovers (orphaned staging file + stale resetting flag)
        $orphanStaging = $sqlitePath.'.staging.99999.deadbeef';
        file_put_contents($orphanStaging, 'corrupt-partial-bytes');
        file_put_contents($flagPath, 'stale-crash');
        touch($flagPath, time() - 90);

        // Launch a real parallel PHP worker reading & writing the SQLite DB concurrently while reset swaps
        $workerScript = $this->tempDir.'/worker.php';
        file_put_contents($workerScript, <<<'PHP'
<?php
$path = $argv[1];
$ok = 0;
$busy = 0;
for ($i = 0; $i < 12; $i++) {
    try {
        $pdo = new PDO('sqlite:'.$path);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->exec('PRAGMA busy_timeout=2000');
        $cnt = (int) $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn();
        if ($cnt >= 18) {
            $ok++;
        }
        $pdo = null;
    } catch (Throwable $e) {
        $busy++;
    }
    usleep(25000);
}
echo json_encode(['ok' => $ok, 'busy' => $busy]);
PHP);

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $proc = proc_open([PHP_BINARY, $workerScript, $sqlitePath], $descriptors, $pipes);
        $this->assertIsResource($proc);
        fclose($pipes[0]);

        // Run atomic reset concurrently with the active reader process
        $summary = app(DemoResetService::class)->reset(targetSqlitePath: $sqlitePath, flushSessions: false);

        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($proc);

        $this->assertSame(0, $exitCode, "Concurrent reader worker failed: {$stderr}");
        $workerStats = json_decode((string) $stdout, true);
        $this->assertIsArray($workerStats);
        $this->assertGreaterThan(0, $workerStats['ok']);

        // Confirm orphaned staging file & flag are gone, integrity is 100% ok, and counts are clean
        $this->assertFileDoesNotExist($orphanStaging);
        $this->assertFileDoesNotExist($flagPath);
        $this->assertSame(18, $summary['counts']['orders']);

        $pdoVerify = new PDO('sqlite:'.$sqlitePath);
        $this->assertSame('ok', strtolower((string) $pdoVerify->query('PRAGMA integrity_check')->fetchColumn()));
        $this->assertSame(18, (int) $pdoVerify->query('SELECT COUNT(*) FROM orders')->fetchColumn());
        $pdoVerify = null;
    }
}
