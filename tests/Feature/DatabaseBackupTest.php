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

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create();

        // Use an isolated unique temporary directory for each test run
        $this->testBackupDir = storage_path('framework/testing/backups_test_'.Str::random(10));
        if (! is_dir($this->testBackupDir)) {
            mkdir($this->testBackupDir, 0750, true);
        }

        $this->backupService = new BackupService($this->testBackupDir);
    }

    protected function tearDown(): void
    {
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

        $testSqlite = database_path('test_restore.sqlite');
        if (file_exists($testSqlite)) {
            @unlink($testSqlite);
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

    public function test_create_encrypted_backup_generates_valid_enc_and_metadata_with_gcm(): void
    {
        $this->seedSampleData();

        $result = $this->backupService->createBackup();

        $this->assertFileExists($result['enc_path']);
        $this->assertFileExists($result['meta_path']);

        $meta = $result['meta'];
        $this->assertSame('AES-256-GCM', $meta['cipher']);
        $this->assertNotEmpty($meta['iv']);
        $this->assertNotEmpty($meta['tag']);
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
        $this->assertFileDoesNotExist($result['enc_path'].'.tmp');
        $this->assertFileDoesNotExist($result['meta_path'].'.tmp');
    }

    public function test_backup_and_cleanup_preserves_external_and_operational_backup_files(): void
    {
        $operationalDir = storage_path('app/backups');
        if (! is_dir($operationalDir)) {
            mkdir($operationalDir, 0750, true);
        }

        // Create a dummy operational backup file that must NOT be touched
        $mockFile = $operationalDir.'/mfms_backup_operational_mock_never_delete.enc';
        $mockMeta = $operationalDir.'/mfms_backup_operational_mock_never_delete.meta.json';
        $dummyContent = 'OPERATIONAL_BACKUP_PROTECTED_CONTENT_12345';
        file_put_contents($mockFile, $dummyContent);
        file_put_contents($mockMeta, '{"mock": true}');

        try {
            $this->seedSampleData();
            $result = $this->backupService->createBackup();

            // Run restore
            $this->backupService->restoreTest($result['enc_path'], null, 'testing');

            // Trigger tearDown cleanup on test directory
            $files = glob($this->testBackupDir.'/*');
            foreach ($files as $f) {
                @unlink($f);
            }

            // Assert that operational mock files remain completely untouched
            $this->assertFileExists($mockFile);
            $this->assertFileExists($mockMeta);
            $this->assertSame($dummyContent, file_get_contents($mockFile));
        } finally {
            @unlink($mockFile);
            @unlink($mockMeta);
        }
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

    public function test_wrong_encryption_key_fails_decryption(): void
    {
        $this->seedSampleData();
        $result = $this->backupService->createBackup('correct-passphrase-32chars-long!');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Gagal mendekripsi backup');

        $this->backupService->restoreTest($result['enc_path'], 'wrong-passphrase-that-fails-key', 'testing');
    }

    public function test_restore_safeguard_blocks_restoring_to_production_database(): void
    {
        $this->seedSampleData();
        $result = $this->backupService->createBackup();

        config(['database.connections.production_db.database' => 'mfms']);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('KEAMANAN DATA: Restorasi DITOLAK!');

        $this->backupService->restoreTest($result['enc_path'], null, 'production_db');
    }

    public function test_restore_safeguard_blocks_restoring_to_mutiara_florist_database(): void
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

    public function test_artisan_backup_and_restore_commands(): void
    {
        $this->seedSampleData();

        $this->artisan('mfms:backup', ['--dir' => $this->testBackupDir])
            ->expectsOutputToContain('Backup berhasil dibuat dan dienkripsi')
            ->assertExitCode(0);

        $this->artisan('mfms:restore-test', ['--dir' => $this->testBackupDir, '--connection' => 'testing'])
            ->expectsOutputToContain('UJI RESTORASI BERHASIL: Status SUCCESS')
            ->assertExitCode(0);
    }
}
