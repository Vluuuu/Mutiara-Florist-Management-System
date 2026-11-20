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
            ->expectsOutputToContain('PERINGATAN KERAS: Target koneksi adalah database produksi toko (mutiara_florist_prod)')
            ->assertExitCode(1);
    }

    public function test_migrate_staging_blocks_production_port_even_with_different_db_name(): void
    {
        config(['database.connections.dangerous_port' => [
            'driver' => 'pgsql',
            'host' => '127.0.0.1',
            'port' => 3307,
            'database' => 'random_test_name',
        ]]);

        $this->artisan('mfms:migrate-staging', ['--connection' => 'dangerous_port', '--force' => true])
            ->expectsOutputToContain('PERINGATAN KERAS: Target koneksi diarahkan ke port database produksi lokal toko (:3307)')
            ->assertExitCode(1);
    }

    public function test_migrate_staging_blocks_forbidden_external_supabase_project(): void
    {
        config(['database.connections.foreign_supabase' => [
            'driver' => 'pgsql',
            'host' => 'aws-0-ap-southeast-1.pooler.supabase.com',
            'port' => 5432,
            'database' => 'postgres',
            'username' => 'postgres.slqwyjtcmlinnrbdsxkb',
        ]]);

        $this->artisan('mfms:migrate-staging', ['--connection' => 'foreign_supabase', '--force' => true])
            ->expectsOutputToContain('DITOLAK: Proyek Supabase ini teridentifikasi sebagai proyek eksternal/terlarang (\'slqwyjtcmlinnrbdsxkb\')')
            ->assertExitCode(1);
    }

    public function test_migrate_staging_blocks_mismatched_project_ref(): void
    {
        config(['database.connections.wrong_ref_supabase' => [
            'driver' => 'pgsql',
            'host' => 'aws-0-ap-southeast-1.pooler.supabase.com',
            'port' => 5432,
            'database' => 'postgres',
            'username' => 'postgres.unauthorized_project_123',
        ]]);

        $this->artisan('mfms:migrate-staging', [
            '--connection' => 'wrong_ref_supabase',
            '--project-ref' => 'mfms-staging-valid-ref',
            '--force' => true,
        ])
            ->expectsOutputToContain('Target koneksi Supabase tidak cocok dengan project ref staging yang diizinkan')
            ->assertExitCode(1);
    }

    public function test_migrate_staging_blocks_invalid_pooler_username_format(): void
    {
        config(['database.connections.bad_user_supabase' => [
            'driver' => 'pgsql',
            'host' => 'aws-0-ap-southeast-1.pooler.supabase.com',
            'port' => 5432,
            'database' => 'postgres',
            'username' => 'postgres', // Missing .<project_ref>
        ]]);

        $this->artisan('mfms:migrate-staging', ['--connection' => 'bad_user_supabase', '--force' => true])
            ->expectsOutputToContain('Koneksi Supabase Pooler wajib menggunakan format username \'postgres.<project_ref>\'')
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
            ->expectsOutputToContain('PERINGATAN KERAS: Target koneksi adalah database produksi toko (mutiara_florist_prod)')
            ->assertExitCode(1);
    }

    public function test_create_admin_blocks_mismatched_project_ref(): void
    {
        config(['database.connections.wrong_ref_admin' => [
            'driver' => 'pgsql',
            'host' => 'aws-0-ap-southeast-1.pooler.supabase.com',
            'port' => 5432,
            'database' => 'postgres',
            'username' => 'postgres.other_project_999',
        ]]);

        $this->artisan('mfms:create-admin', [
            '--connection' => 'wrong_ref_admin',
            '--project-ref' => 'mfms-staging-target',
        ])
            ->expectsOutputToContain('Target koneksi Supabase tidak cocok dengan project ref staging yang diizinkan')
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
            ->expectsOutputToContain('PERINGATAN KERAS: Target koneksi adalah database produksi toko (mutiara_florist_prod)')
            ->assertExitCode(1);
    }

    public function test_seed_staging_blocks_mismatched_project_ref(): void
    {
        config(['database.connections.wrong_ref_seeder' => [
            'driver' => 'pgsql',
            'host' => 'aws-0-ap-southeast-1.pooler.supabase.com',
            'port' => 5432,
            'database' => 'postgres',
            'username' => 'postgres.alien_project_555',
        ]]);

        $this->artisan('mfms:seed-staging', [
            '--connection' => 'wrong_ref_seeder',
            '--project-ref' => 'mfms-staging-target',
        ])
            ->expectsOutputToContain('Target koneksi Supabase tidak cocok dengan project ref staging yang diizinkan')
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
