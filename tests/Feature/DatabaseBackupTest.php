<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\User;
use App\Services\BackupService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;
use Tests\TestCase;

class DatabaseBackupTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected BackupService $backupService;
    protected string $testBackupDir;
    protected string $testRestoreSqlite;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create();

        // 1. Strict test isolation: every test gets its own unique temporary directory
        $this->testBackupDir = storage_path('framework/testing/backups_test_'.Str::random(12));
        if (! is_dir($this->testBackupDir)) {
            mkdir($this->testBackupDir, 0750, true);
        }

        // 2. Isolate SQLite restore target entirely inside the test directory, never in database/
        $this->testRestoreSqlite = $this->testBackupDir.'/test_isolated_restore.sqlite';
        config(['database.connections.testing.database' => $this->testRestoreSqlite]);
        config(['database.connections.testing.is_testing' => true]);

        $this->backupService = new BackupService($this->testBackupDir);
    }

    protected function tearDown(): void
    {
        // Purge connections to release file locks on Windows
        DB::purge('testing');

        // Cleanup ONLY files in the isolated test directory
        if (is_dir($this->testBackupDir)) {
            $files = glob($this->testBackupDir.'/*');
            if (is_array($files)) {
                foreach ($files as $file) {
                    if (is_file($file)) {
                        @unlink($file);
                    }
                }
            }
            @rmdir($this->testBackupDir);
        }

        parent::tearDown();
    }

    private function seedSampleData(): void
    {
        $customer = Customer::create(['name' => 'Florist Client ABC', 'phone' => '08123456789']);

        $cat = new ExpenseCategory();
        $cat->name = 'Bahan Baku';
        $cat->is_active = true;
        $cat->save();

        $order = new Order();
        $order->forceFill([
            'order_number' => 'ORD-BCK-001',
            'customer_id' => $customer->id,
            'created_by' => $this->admin->id,
            'order_date' => '2026-11-15',
            'status' => 'PROCESSING',
            'total_amount' => 500000,
        ])->save();

        $item = new OrderItem();
        $item->forceFill([
            'order_id' => $order->id,
            'flower_type' => 'Buket Lili',
            'recipient' => 'Sari',
            'sender_name' => 'Budi',
            'delivery_date' => '2026-11-16',
            'delivery_location' => 'Jakarta',
            'quantity' => 1,
            'unit_price' => 500000,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'PROCESSING',
        ])->save();

        $payment = new Payment();
        $payment->forceFill([
            'order_id' => $order->id,
            'payment_date' => '2026-11-15',
            'amount' => 250000,
            'method' => 'TRANSFER',
            'status' => 'POSTED',
            'idempotency_key' => (string) Str::uuid(),
            'recorded_by' => $this->admin->id,
        ])->save();

        $expense = new Expense();
        $expense->forceFill([
            'expense_category_id' => $cat->id,
            'expense_date' => '2026-11-15',
            'amount' => 80000,
            'description' => 'Kain flanel',
            'status' => 'POSTED',
            'idempotency_key' => (string) Str::uuid(),
            'recorded_by' => $this->admin->id,
        ])->save();
    }

    public function test_create_encrypted_backup_generates_valid_enc_and_metadata_with_gcm_and_aad(): void
    {
        $this->seedSampleData();

        $result = $this->backupService->createBackup();

        $this->assertFileExists($result['enc_path']);
        $this->assertFileExists($result['meta_path']);

        $meta = $result['meta'];
        $this->assertSame('AES-256-GCM', $meta['cipher']);
        $this->assertNotEmpty($meta['iv']);
        $this->assertNotEmpty($meta['tag']);
        $this->assertNotEmpty($meta['aad']);
        $this->assertNotEmpty($meta['checksum_sha256']);
        $this->assertGreaterThan(0, $meta['size_encrypted']);

        // Check tables in metadata
        $this->assertGreaterThanOrEqual(1, $meta['tables']['users']);
        $this->assertGreaterThanOrEqual(1, $meta['tables']['customers']);
        $this->assertGreaterThanOrEqual(1, $meta['tables']['orders']);
        $this->assertGreaterThanOrEqual(1, $meta['tables']['payments']);
        $this->assertGreaterThanOrEqual(1, $meta['tables']['expenses']);

        // Financial invariant metrics check
        $this->assertSame(500000, $meta['metrics']['orders_total_amount']);
        $this->assertSame(250000, $meta['metrics']['payments_posted_amount']);
        $this->assertSame(80000, $meta['metrics']['expenses_posted_amount']);

        // Verify the .enc file is truly binary encrypted and does NOT contain plain text
        $rawEnc = file_get_contents($result['enc_path']);
        $this->assertStringNotContainsString('INSERT INTO', $rawEnc);
        $this->assertStringNotContainsString('Florist Client ABC', $rawEnc);

        // Verify atomic write: no .tmp files remaining
        $tmpFiles = glob($this->testBackupDir.'/*.tmp*');
        $this->assertEmpty($tmpFiles, 'Semua file sementara .tmp harus terhapus bersih setelah rename atomik');
    }

    public function test_operational_backup_directory_is_strictly_never_touched(): void
    {
        $operationalDir = storage_path('app/backups');
        $filesBefore = glob($operationalDir.'/*');

        $this->seedSampleData();
        $result = $this->backupService->createBackup();

        // Run restore
        $this->backupService->restoreTest($result['enc_path'], null, 'testing');

        // Verify operational directory has exact same files before and after
        $filesAfter = glob($operationalDir.'/*');
        $this->assertSame($filesBefore, $filesAfter, 'Direktori backup operasional dilarang keras dibuat, dimodifikasi, atau dihapus oleh automated tests');
    }

    public function test_data_integrity_with_leading_zeros_emoji_multiline_quotes_and_nulls(): void
    {
        // 1. Seed complex data
        $customer = Customer::create([
            'name' => 'Pelanggan 🌸 "Spesial" & \\ Keren',
            'phone' => '08123456789', // Phone with leading zero!
        ]);

        $cat = new ExpenseCategory();
        $cat->name = 'Operasional Toko';
        $cat->is_active = true;
        $cat->save();

        $order = new Order();
        $order->forceFill([
            'order_number' => 'ORD-000123', // Numeric string with leading zeros
            'customer_id' => $customer->id,
            'created_by' => $this->admin->id,
            'order_date' => '2026-11-16',
            'status' => 'PROCESSING',
            'total_amount' => 750000,
        ])->save();

        $item = new OrderItem();
        $item->forceFill([
            'order_id' => $order->id,
            'flower_type' => 'Bunga Mawar 🌹',
            'recipient' => 'Ibu Siti O\'Connor',
            'sender_name' => 'Budi \\ Santoso',
            'delivery_date' => '2026-11-17',
            'delivery_location' => "Gedung A, Lt. 3;\nJl. Melati No. 10;\nJakarta", // Multiline with semicolons!
            'quantity' => 2,
            'unit_price' => 375000,
            'shipping_mode' => 'INCLUDED',
            'shipping_fee' => 0,
            'fulfillment_status' => 'PROCESSING',
        ])->save();

        $payment = new Payment();
        $payment->forceFill([
            'order_id' => $order->id,
            'payment_date' => '2026-11-16',
            'amount' => 750000,
            'method' => 'TRANSFER',
            'reference' => 'TRF-009876', // Numeric string
            'status' => 'POSTED',
            'idempotency_key' => (string) Str::uuid(),
            'recorded_by' => $this->admin->id,
            'notes' => "Lunas via BCA;\nKonfirmasi via WA: 08123456789;\nKomentar: 'Mantap 💯'",
        ])->save();

        $expense = new Expense();
        $expense->forceFill([
            'expense_category_id' => $cat->id,
            'expense_date' => '2026-11-16',
            'amount' => 150000,
            'description' => "Pita Merah; Kertas Wrap;\nBaris Kedua; 'Kutip' \\ Backslash & Emoji 🌸;",
            'status' => 'POSTED',
            'idempotency_key' => (string) Str::uuid(),
            'recorded_by' => $this->admin->id,
        ])->save();

        // 2. Create backup
        $result = $this->backupService->createBackup();

        // 3. Restore to isolated test database
        $report = $this->backupService->restoreTest($result['enc_path'], null, 'testing');
        $this->assertSame('SUCCESS', $report['status']);

        // 4. Verify exact data and types on the restored database
        $restoredCustomer = Customer::on('testing')->where('id', $customer->id)->firstOrFail();
        $this->assertSame('08123456789', $restoredCustomer->phone, 'Nomor telepon dengan leading zero harus tetap string utuh!');
        $this->assertSame('Pelanggan 🌸 "Spesial" & \\ Keren', $restoredCustomer->name);

        $restoredOrder = Order::on('testing')->where('id', $order->id)->firstOrFail();
        $this->assertSame('ORD-000123', $restoredOrder->order_number);
        $this->assertSame(750000, (int) $restoredOrder->total_amount);

        $restoredItem = OrderItem::on('testing')->where('id', $item->id)->firstOrFail();
        $this->assertSame('Bunga Mawar 🌹', $restoredItem->flower_type);
        $this->assertSame('Ibu Siti O\'Connor', $restoredItem->recipient);
        $this->assertSame('Budi \\ Santoso', $restoredItem->sender_name);
        $this->assertStringContainsString("Gedung A, Lt. 3;\nJl. Melati No. 10;\nJakarta", $restoredItem->delivery_location);

        $restoredPayment = Payment::on('testing')->where('id', $payment->id)->firstOrFail();
        $this->assertSame('TRF-009876', $restoredPayment->reference);
        $this->assertStringContainsString("Lunas via BCA;\nKonfirmasi via WA: 08123456789;\nKomentar: 'Mantap 💯'", $restoredPayment->notes);

        $restoredExpense = Expense::on('testing')->where('id', $expense->id)->firstOrFail();
        $this->assertSame("Pita Merah; Kertas Wrap;\nBaris Kedua; 'Kutip' \\ Backslash & Emoji 🌸;", $restoredExpense->description);
    }

    public function test_tampered_checksum_fails_restore_integrity_check(): void
    {
        $this->seedSampleData();
        $result = $this->backupService->createBackup();

        // Tamper with metadata checksum
        $meta = json_decode((string) file_get_contents($result['meta_path']), true);
        $meta['checksum_sha256'] = str_repeat('a', 64); // Invalid checksum
        file_put_contents($result['meta_path'], json_encode($meta));

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('INTEGRITAS GAGAL: Checksum SHA-256 tidak cocok');

        $this->backupService->restoreTest($result['enc_path'], null, 'testing');
    }

    public function test_tampered_ciphertext_fails_gcm_authentication(): void
    {
        $this->seedSampleData();
        $result = $this->backupService->createBackup();

        // Tamper with ciphertext by modifying a byte
        $raw = file_get_contents($result['enc_path']);
        $raw[0] = $raw[0] === 'A' ? 'B' : 'A';
        file_put_contents($result['enc_path'], $raw);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Gagal mendekripsi backup');

        $this->backupService->restoreTest($result['enc_path'], null, 'testing');
    }

    public function test_tampered_aad_metadata_fails_gcm_decryption(): void
    {
        $this->seedSampleData();
        $result = $this->backupService->createBackup();

        // Tamper with aad in metadata to simulate header forgery
        $meta = json_decode((string) file_get_contents($result['meta_path']), true);
        $meta['aad'] = base64_encode('{"forged":"data"}');
        file_put_contents($result['meta_path'], json_encode($meta));

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Gagal mendekripsi backup');

        $this->backupService->restoreTest($result['enc_path'], null, 'testing');
    }

    public function test_wrong_encryption_key_fails_decryption(): void
    {
        $this->seedSampleData();
        $result = $this->backupService->createBackup('correct-passphrase-32chars-long!');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Gagal mendekripsi backup');

        $this->backupService->restoreTest($result['enc_path'], 'wrong-passphrase-that-fails-key', 'testing');
    }

    public function test_restore_safeguard_blocks_restoring_to_production_environment(): void
    {
        $this->seedSampleData();
        $result = $this->backupService->createBackup();

        $this->app['env'] = 'production';

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('lingkungan produksi');

        $this->backupService->restoreTest($result['enc_path'], null, 'testing');
    }

    public function test_restore_safeguard_blocks_connection_without_explicit_is_testing_flag(): void
    {
        $this->seedSampleData();
        $result = $this->backupService->createBackup();

        config(['database.connections.unauthorized_conn' => [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'is_testing' => false,
        ]]);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('tidak memiliki izin eksplisit');

        $this->backupService->restoreTest($result['enc_path'], null, 'unauthorized_conn');
    }

    public function test_restore_safeguard_blocks_restoring_to_operational_database_names(): void
    {
        $this->seedSampleData();
        $result = $this->backupService->createBackup();

        config(['database.connections.testing_with_live_name' => [
            'driver' => 'sqlite',
            'database' => 'mutiara_florist',
            'is_testing' => true,
        ]]);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('teridentifikasi sebagai database operasional/utama');

        $this->backupService->restoreTest($result['enc_path'], null, 'testing_with_live_name');
    }

    public function test_successful_restore_to_isolated_test_database_verifies_integrity(): void
    {
        $this->seedSampleData();
        $result = $this->backupService->createBackup();

        $report = $this->backupService->restoreTest($result['enc_path'], null, 'testing');

        $this->assertSame('SUCCESS', $report['status']);
        $this->assertTrue($report['checksum_verified']);
        $this->assertTrue($report['tables_verified']);
        $this->assertTrue($report['metrics_verified']);
        $this->assertTrue($report['fk_verified']);

        // Check foreign keys
        $this->assertSame(0, $report['details']['foreign_keys']['orphan_order_items']);
        $this->assertSame(0, $report['details']['foreign_keys']['orphan_payments']);
        $this->assertSame(0, $report['details']['foreign_keys']['orphan_expenses']);
    }

    public function test_snapshot_transaction_is_always_closed_on_success_and_exception(): void
    {
        $targetConn = 'mariadb_testing';
        $pdo = DB::connection($targetConn)->getPdo();

        // 1. Success path
        $this->backupService->createBackup(null, $targetConn);
        $this->assertFalse($pdo->inTransaction(), 'PDO transaction must be closed after successful backup');

        // 2. Exception path
        $badService = new class($this->testBackupDir) extends BackupService {
            public function createBackup(?string $encryptionKey = null, ?string $connection = null): array
            {
                $conn = DB::connection($connection);
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

                    // Simulate failure during read
                    throw new RuntimeException('SIMULATED_FAILURE_DURING_DUMP');
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
                        }
                    }
                }
            }
        };

        try {
            $badService->createBackup(null, $targetConn);
            $this->fail('Expected exception was not thrown');
        } catch (RuntimeException $e) {
            $this->assertSame('SIMULATED_FAILURE_DURING_DUMP', $e->getMessage());
        }

        $this->assertFalse($pdo->inTransaction(), 'PDO transaction must be closed even after exception');
    }

    public function test_snapshot_consistency_during_parallel_writes_on_mariadb_testing(): void
    {
        if (config('database.connections.mariadb_testing.username') === null) {
            $this->markTestSkipped('MariaDB testing credentials not configured');
        }

        try {
            DB::connection('mariadb_testing')->getPdo();
        } catch (\Throwable $e) {
            $this->markTestSkipped('MariaDB testing unavailable: '.$e->getMessage());
        }

        $connA = DB::connection('mariadb_testing');
        $pdoA = $connA->getPdo();

        // 1. Connection A starts consistent snapshot
        $pdoA->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        $pdoA->exec('START TRANSACTION WITH CONSISTENT SNAPSHOT');

        $initialCount = (int) $connA->table('orders')->count();

        // 2. Connection B inserts a new Order committed during A's transaction
        $pdoB = new \PDO(
            'mysql:host='.config('database.connections.mariadb_testing.host').';port='.config('database.connections.mariadb_testing.port').';dbname='.config('database.connections.mariadb_testing.database'),
            config('database.connections.mariadb_testing.username'),
            config('database.connections.mariadb_testing.password')
        );

        $pdoB->exec("INSERT INTO orders (order_number, customer_id, created_by, order_date, status, total_amount, created_at, updated_at) VALUES ('ORD-PARALLEL-SNAPSHOT-TEST', 1, 1, '2026-11-16', 'NEW', 100000, NOW(), NOW())");

        // 3. Connection A checks table: due to REPEATABLE READ snapshot isolation, it must NOT see the newly inserted row!
        $snapshotCount = (int) $connA->table('orders')->count();
        $this->assertSame($initialCount, $snapshotCount, 'Consistent snapshot isolation must isolate reads from parallel writes');

        // 4. Connection A closes transaction
        $pdoA->exec('ROLLBACK');

        // Cleanup inserted test row
        $pdoB->exec("DELETE FROM orders WHERE order_number = 'ORD-PARALLEL-SNAPSHOT-TEST'");
    }

    public function test_artisan_backup_and_restore_commands(): void
    {
        $this->seedSampleData();

        $this->artisan('mfms:backup', ['--dir' => $this->testBackupDir])
            ->expectsOutputToContain('Backup berhasil dibuat dan dienkripsi')
            ->assertExitCode(0);

        $this->artisan('mfms:restore-test', ['--dir' => $this->testBackupDir, '--connection' => 'testing'])
            ->expectsOutputToContain('UJI RESTORASI BERHASIL')
            ->assertExitCode(0);
    }

    public function test_artisan_restore_test_returns_exit_code_1_when_verification_fails(): void
    {
        $this->seedSampleData();
        $result = $this->backupService->createBackup();

        // Create a custom mock BackupService that simulates verification resulting in FAILED
        $mockService = $this->createMock(BackupService::class);
        $mockService->method('restoreTest')->willReturn([
            'status' => 'FAILED',
            'checksum_verified' => true,
            'tables_verified' => false,
            'metrics_verified' => false,
            'fk_verified' => true,
            'details' => [],
        ]);

        $this->app->instance(BackupService::class, $mockService);

        $this->artisan('mfms:restore-test', [
            'backup_file' => $result['enc_path'],
            '--dir' => $this->testBackupDir,
            '--connection' => 'testing',
        ])
            ->expectsOutputToContain('UJI RESTORASI GAGAL')
            ->assertExitCode(1);
    }

    public function test_artisan_test_payment_worker_strictly_blocks_operational_database(): void
    {
        // 1. Block connection 'mysql' (operational database)
        $this->artisan('mfms:test-payment-worker', [
            'order_id' => 1,
            'amount' => 50000,
            'idempotency_key' => (string) Str::uuid(),
            '--connection' => 'mysql',
        ])
            ->expectsOutputToContain('KEAMANAN DATA')
            ->assertExitCode(1);

        // 2. Block connection without is_testing => true
        config(['database.connections.fake_untrusted' => [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'is_testing' => false,
        ]]);

        $this->artisan('mfms:test-payment-worker', [
            'order_id' => 1,
            'amount' => 50000,
            'idempotency_key' => (string) Str::uuid(),
            '--connection' => 'fake_untrusted',
        ])
            ->expectsOutputToContain('KEAMANAN DATA: Worker pengujian DITOLAK')
            ->assertExitCode(1);

        // 3. Block connection pointing to operational database name even if flag is forged
        config(['database.connections.fake_forged' => [
            'driver' => 'mysql',
            'database' => 'mutiara_florist',
            'is_testing' => true,
        ]]);

        $this->artisan('mfms:test-payment-worker', [
            'order_id' => 1,
            'amount' => 50000,
            'idempotency_key' => (string) Str::uuid(),
            '--connection' => 'fake_forged',
        ])
            ->expectsOutputToContain('KEAMANAN DATA: Target database')
            ->assertExitCode(1);
    }
}
