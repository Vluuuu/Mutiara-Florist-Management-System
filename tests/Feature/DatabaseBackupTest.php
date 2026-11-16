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

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create();
        $this->backupService = new BackupService();
    }

    protected function tearDown(): void
    {
        // Cleanup test backup files
        $files = glob(storage_path('app/backups/mfms_backup_*'));
        foreach ($files as $file) {
            @unlink($file);
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

    public function test_create_encrypted_backup_generates_valid_enc_and_metadata(): void
    {
        $this->seedSampleData();

        $result = $this->backupService->createBackup();

        $this->assertFileExists($result['enc_path']);
        $this->assertFileExists($result['meta_path']);

        $meta = $result['meta'];
        $this->assertSame('AES-256-CBC', $meta['cipher']);
        $this->assertNotEmpty($meta['iv']);
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

        // Verify the .enc file is truly binary encrypted and does NOT contain plain text SQL
        $rawEnc = file_get_contents($result['enc_path']);
        $this->assertStringNotContainsString('INSERT INTO', $rawEnc);
        $this->assertStringNotContainsString('Florist Client ABC', $rawEnc);
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
        $this->expectExceptionMessage('KEAMANAN DATA: Target database');

        $this->backupService->restoreTest($result['enc_path'], null, 'production_db');
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

        $this->artisan('mfms:backup')
            ->expectsOutputToContain('Backup berhasil dibuat dan dienkripsi')
            ->assertExitCode(0);

        $this->artisan('mfms:restore-test', ['--connection' => 'testing'])
            ->expectsOutputToContain('UJI RESTORASI BERHASIL: Status SUCCESS')
            ->assertExitCode(0);
    }
}
