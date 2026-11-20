<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class StagingMigrationAndAdminCommandTest extends TestCase
{
    public function test_migrate_staging_rejects_non_pgsql_connection(): void
    {
        config(['database.connections.fake_mysql' => [
            'driver' => 'mysql',
            'host' => '127.0.0.1',
            'port' => 3306,
            'database' => 'fake_db',
        ]]);

        $this->artisan('mfms:migrate-staging', ['--connection' => 'fake_mysql', '--force' => true])
            ->expectsOutputToContain('Target koneksi bukan PostgreSQL')
            ->assertExitCode(1);
    }

    public function test_migrate_staging_blocks_production_database(): void
    {
        config(['database.connections.dangerous_prod' => [
            'driver' => 'pgsql',
            'host' => '127.0.0.1',
            'port' => 3307,
            'database' => 'mutiara_florist_prod',
        ]]);

        $this->artisan('mfms:migrate-staging', ['--connection' => 'dangerous_prod', '--force' => true])
            ->expectsOutputToContain('PERINGATAN KERAS: Koneksi diarahkan ke database produksi lokal toko')
            ->assertExitCode(1);
    }

    public function test_migrate_staging_executes_on_pgsql_testing(): void
    {
        $this->artisan('mfms:migrate-staging', ['--connection' => 'pgsql_testing', '--force' => true])
            ->expectsOutputToContain('Migrasi skema database staging berhasil 100%')
            ->assertExitCode(0);
    }

    public function test_create_admin_blocks_production_database(): void
    {
        config(['database.connections.fake_prod_conn' => [
            'driver' => 'pgsql',
            'host' => '127.0.0.1',
            'port' => 3307,
            'database' => 'mutiara_florist_prod',
        ]]);

        $this->artisan('mfms:create-admin', ['--connection' => 'fake_prod_conn'])
            ->expectsOutputToContain('Dilarang keras membuat akun admin sembarangan pada database produksi toko!')
            ->assertExitCode(1);
    }

    public function test_create_admin_creates_user_on_pgsql_testing(): void
    {
        $conn = DB::connection('pgsql_testing');
        $conn->table('payments')->delete();
        $conn->table('order_items')->delete();
        $conn->table('orders')->delete();
        $conn->table('expenses')->delete();
        $conn->table('audit_logs')->delete();
        $conn->table('customers')->delete();
        $conn->table('users')->delete();

        $this->artisan('mfms:create-admin', ['--connection' => 'pgsql_testing'])
            ->expectsQuestion('Nama operator admin', 'Admin Staging Test')
            ->expectsQuestion('Email admin', 'staging-admin@mutiaraflorist.id')
            ->expectsQuestion('Password (minimal 12 karakter)', 'SecurePassword123!')
            ->expectsQuestion('Ulangi password', 'SecurePassword123!')
            ->expectsOutputToContain('Akun admin [staging-admin@mutiaraflorist.id] berhasil dibuat')
            ->assertExitCode(0);

        $this->assertDatabaseHas('users', [
            'email' => 'staging-admin@mutiaraflorist.id',
        ], 'pgsql_testing');
    }

    public function test_seed_staging_blocks_production_database(): void
    {
        config(['database.connections.fake_prod_conn' => [
            'driver' => 'pgsql',
            'host' => '127.0.0.1',
            'port' => 3307,
            'database' => 'mutiara_florist_prod',
        ]]);

        $this->artisan('mfms:seed-staging', ['--connection' => 'fake_prod_conn'])
            ->expectsOutputToContain('Dilarang keras melakukan seeding pada database produksi toko!')
            ->assertExitCode(1);
    }

    public function test_seed_staging_populates_synthetic_categories_and_customers_on_pgsql_testing(): void
    {
        $this->artisan('mfms:seed-staging', ['--connection' => 'pgsql_testing'])
            ->expectsOutputToContain('Kategori pengeluaran sintetis berhasil disiapkan')
            ->expectsOutputToContain('Pelanggan sintetis berhasil disiapkan (0 data riil digunakan)')
            ->assertExitCode(0);

        $this->assertDatabaseHas('expense_categories', [
            'name' => 'Bahan Bunga & Aksesoris',
        ], 'pgsql_testing');

        $this->assertDatabaseHas('customers', [
            'name' => 'Pelanggan Staging Mutiara A',
            'phone' => '081299990001',
        ], 'pgsql_testing');
    }

    protected function tearDown(): void
    {
        try {
            $conn = DB::connection('pgsql_testing');
            $conn->table('payments')->delete();
            $conn->table('order_items')->delete();
            $conn->table('orders')->delete();
            $conn->table('expenses')->delete();
            $conn->table('audit_logs')->delete();
            $conn->table('customers')->delete();
            $conn->table('expense_categories')->delete();
            $conn->table('users')->delete();
        } catch (\Throwable $e) {
            // Ignore if connection not ready
        }

        parent::tearDown();
    }
}
