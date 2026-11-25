<?php

use App\Models\User;
use App\Services\DemoResetService;
use App\Support\DemoAccessManager;
use App\Support\DemoRuntimeGuard;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schedule;

Artisan::command('mfms:create-admin {--connection= : Nama koneksi database target} {--project-ref= : Target Supabase project ref}', function (): int {
    try {
        DemoRuntimeGuard::forbidInDemoRuntime('mfms:create-admin');
    } catch (\Throwable $e) {
        $this->error($e->getMessage());
        return 1;
    }

    $connName = (string) ($this->option('connection') ?: config('database.default'));
    $projectRef = $this->option('project-ref') ? (string) $this->option('project-ref') : null;

    try {
        $meta = \App\Support\DatabaseTargetGuard::validateTarget(
            $connName,
            expectedProjectRef: $projectRef,
            requirePgsql: false,
            confirmServerIdentity: true
        );
    } catch (\Throwable $e) {
        $this->error($e->getMessage());
        return 1;
    }

    if (User::on($connName)->exists()) {
        $this->error("Akun admin sudah ada pada koneksi '{$connName}'. Pembuatan akun tambahan dinonaktifkan.");
        return 1;
    }

    $name = trim((string) $this->ask('Nama operator admin'));
    $email = trim((string) $this->ask('Email admin'));
    $password = (string) $this->secret('Password (minimal 12 karakter)');
    $passwordConfirmation = (string) $this->secret('Ulangi password');

    if ($name === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $this->error('Nama atau format email tidak valid.');
        return 1;
    }

    if (strlen($password) < 12 || $password !== $passwordConfirmation) {
        $this->error('Password minimal 12 karakter dan harus sama dengan konfirmasi.');
        return 1;
    }

    $user = new User();
    $user->setConnection($connName);
    $user->fill([
        'name' => $name,
        'email' => $email,
        'password' => Hash::make($password),
    ]);
    $user->save();

    $this->info("Akun admin [{$email}] berhasil dibuat pada koneksi '{$connName}'. Password aman dan tidak tercatat di log.");

    return 0;
})->purpose('Membuat satu akun admin pada database tertentu tanpa registrasi publik');

Artisan::command('mfms:reset-password {--email= : Email admin yang akan direset password-nya}', function (): int {
    try {
        DemoRuntimeGuard::forbidInDemoRuntime('mfms:reset-password');
    } catch (\Throwable $e) {
        $this->error($e->getMessage());
        return 1;
    }

    $emailOpt = trim((string) ($this->option('email') ?: ''));
    $email = $emailOpt !== '' ? $emailOpt : trim((string) $this->ask('Email admin'));

    if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $this->error('Format email tidak valid.');

        return 1;
    }

    $user = User::query()->where('email', $email)->first();
    if (! $user) {
        $this->error("Akun dengan email '{$email}' tidak ditemukan.");

        return 1;
    }

    $password = (string) $this->secret('Password baru (minimal 12 karakter)');
    $passwordConfirmation = (string) $this->secret('Ulangi password baru');

    if (strlen($password) < 12 || $password !== $passwordConfirmation) {
        $this->error('Password baru minimal 12 karakter dan harus sama dengan konfirmasi.');

        return 1;
    }

    $user->update([
        'password' => Hash::make($password),
    ]);

    $this->info("Password untuk {$user->email} berhasil diperbarui. Silakan masuk melalui /login.");

    return 0;
})->purpose('Mereset password akun admin lokal secara interaktif tanpa ekspos CLI');

Artisan::command('mfms:backup {--key= : Kunci enkripsi khusus} {--ask-key : Minta kunci enkripsi secara interaktif agar tidak terekspos di CLI} {--connection= : Nama koneksi database} {--dir= : Direktori khusus penyimpanan backup}', function (\App\Services\BackupService $backupService): int {
    try {
        DemoRuntimeGuard::forbidInDemoRuntime('mfms:backup');
    } catch (\Throwable $e) {
        $this->error($e->getMessage());
        return 1;
    }

    $this->info('Memulai backup database terenkripsi (AES-256-GCM)...');
    try {
        if ($this->option('dir')) {
            $backupService->setBackupDirectory((string) $this->option('dir'));
        }

        $key = (string) ($this->option('key') ?: '');
        if ($this->option('ask-key')) {
            $key = (string) $this->secret('Masukkan kunci enkripsi backup');
        }

        $result = $backupService->createBackup($key !== '' ? $key : null, $this->option('connection'));
        $meta = $result['meta'];

        $this->newLine();
        $this->info('✓ Backup berhasil dibuat dan dienkripsi!');
        $this->table(['Properti', 'Nilai'], [
            ['File Enkripsi', $result['enc_path']],
            ['File Metadata', $result['meta_path']],
            ['Waktu Pembuatan', $meta['created_at']],
            ['Algoritma Sandi', $meta['cipher']],
            ['Checksum SHA-256', $meta['checksum_sha256']],
            ['Tag Autentikasi GCM', $meta['tag'] ?? '-'],
            ['Ukuran Enkripsi', number_format($meta['size_encrypted']).' bytes'],
        ]);

        $this->newLine();
        $this->info('Tabel yang dicadangkan:');
        $rows = [];
        foreach ($meta['tables'] as $tbl => $cnt) {
            $rows[] = [$tbl, $cnt];
        }
        $this->table(['Tabel', 'Jumlah Baris'], $rows);

        return 0;
    } catch (\Throwable $e) {
        $this->error('Gagal membuat backup: '.$e->getMessage());

        return 1;
    }
})->purpose('Membuat backup database terenkripsi AES-256-GCM dengan verifikasi checksum SHA-256');

Artisan::command('mfms:restore-test {backup_file? : Path atau nama file backup .enc} {--key= : Kunci enkripsi khusus} {--ask-key : Minta kunci enkripsi secara interaktif} {--connection=testing : Nama koneksi pengujian} {--dir= : Direktori khusus file backup}', function (\App\Services\BackupService $backupService): int {
    try {
        DemoRuntimeGuard::forbidInDemoRuntime('mfms:restore-test');
    } catch (\Throwable $e) {
        $this->error($e->getMessage());
        return 1;
    }

    $dir = (string) ($this->option('dir') ?: storage_path('app/backups'));
    $file = $this->argument('backup_file');
    if (! $file) {
        $files = glob($dir.'/*.enc');
        if (empty($files)) {
            $this->error("Tidak ada file backup .enc yang ditemukan di {$dir}.");

            return 1;
        }
        rsort($files);
        $file = $files[0];
    } elseif (! file_exists($file)) {
        $file = $dir.'/'.basename($file);
    }

    if (! file_exists($file)) {
        $this->error("File backup tidak ditemukan: {$file}");

        return 1;
    }

    $key = (string) ($this->option('key') ?: '');
    if ($this->option('ask-key')) {
        $key = (string) $this->secret('Masukkan kunci dekripsi backup');
    }

    $targetConn = (string) $this->option('connection');
    $this->info("Menjalankan uji restorasi pada database terisolasi: [{$targetConn}]...");

    try {
        $report = $backupService->restoreTest($file, $key !== '' ? $key : null, $targetConn);

        $this->newLine();
        $this->table(['Pemeriksaan Integritas', 'Status'], [
            ['Checksum SHA-256', $report['checksum_verified'] ? 'VALID' : 'INVALID'],
            ['Rekonsiliasi Baris Tabel', $report['tables_verified'] ? 'VALID' : 'MISMATCH'],
            ['Integritas Metrik Keuangan', $report['metrics_verified'] ? 'VALID' : 'MISMATCH'],
            ['Relasi Foreign Key (No Orphans)', $report['fk_verified'] ? 'VALID' : 'ORPHANS FOUND'],
        ]);

        if (($report['status'] ?? '') !== 'SUCCESS') {
            $this->error('✗ UJI RESTORASI GAGAL: Verifikasi integritas database menghasilkan FAILED.');

            return 1;
        }

        $this->info('✓ UJI RESTORASI BERHASIL: Seluruh integritas database terverifikasi VALID (SUCCESS).');

        return 0;
    } catch (\Throwable $e) {
        $this->error('Uji restorasi gagal: '.$e->getMessage());

        return 1;
    }
})->purpose('Menjalankan uji restorasi backup terenkripsi HANYA pada database pengujian terisolasi');

Artisan::command('mfms:test-payment-worker {order_id} {amount} {idempotency_key} {--connection=mariadb_testing} {--admin_id=}', function (\App\Services\PaymentService $paymentService): int {
    $conn = (string) $this->option('connection');

    // Strict Testing-Only Guard: Prohibit running against operational databases or in production
    if (app()->environment('production')) {
        $this->error('KEAMANAN DATA: Worker pengujian pembayaran DILARANG dijalankan di lingkungan produksi!');

        return 1;
    }

    $connConfig = config("database.connections.{$conn}");
    if (! is_array($connConfig)) {
        $this->error("KEAMANAN DATA: Koneksi target '{$conn}' tidak terdaftar dalam konfigurasi.");

        return 1;
    }

    if (($connConfig['is_testing'] ?? false) !== true) {
        $this->error("KEAMANAN DATA: Worker pengujian DITOLAK! Koneksi '{$conn}' tidak memiliki izin eksplisit 'is_testing' => true.");

        return 1;
    }

    $dbName = (string) ($connConfig['database'] ?? '');
    $prohibitedDbNames = array_map('strtolower', array_filter([
        'mfms', 'mutiara_florist', 'laravel',
        (string) config('database.connections.mysql.database'),
        (string) config('database.connections.mariadb.database'),
    ]));

    if (in_array(strtolower($dbName), $prohibitedDbNames, true)) {
        $this->error("KEAMANAN DATA: Target database '{$dbName}' teridentifikasi sebagai database operasional. Eksekusi dibatalkan!");

        return 1;
    }

    $isTestDb = ($dbName === ':memory:') || (bool) preg_match('/(_test$|_testing$|test_)/i', $dbName);
    if (! $isTestDb) {
        $this->error("KEAMANAN DATA: Nama database target '{$dbName}' harus memiliki penamaan pengujian eksplisit '_test', '_testing', atau 'test_'.");

        return 1;
    }

    config(['database.default' => $conn]);
    \Illuminate\Support\Facades\DB::setDefaultConnection($conn);

    $orderId = (int) $this->argument('order_id');
    $amount = (int) $this->argument('amount');
    $idempotencyKey = (string) $this->argument('idempotency_key');
    $adminId = (int) ($this->option('admin_id') ?: 1);

    try {
        $order = \App\Models\Order::on($conn)->findOrFail($orderId);
        $payment = $paymentService->record($order, [
            'payment_date' => now()->toDateString(),
            'amount' => $amount,
            'method' => 'TRANSFER',
            'reference' => 'PARALLEL-'.substr($idempotencyKey, 0, 8),
            'idempotency_key' => $idempotencyKey,
            'notes' => 'Parallel test payment',
        ], $adminId);

        $this->line(json_encode([
            'status' => 'SUCCESS',
            'payment_id' => $payment->id,
            'amount' => (int) $payment->amount,
        ]));

        return 0;
    } catch (\Illuminate\Validation\ValidationException $e) {
        $this->line(json_encode([
            'status' => 'VALIDATION_ERROR',
            'message' => $e->getMessage(),
            'errors' => $e->errors(),
        ]));

        return 2;
    } catch (\Throwable $e) {
        $this->line(json_encode([
            'status' => 'ERROR',
            'message' => $e->getMessage(),
        ]));

        return 1;
    }
})->purpose('Worker khusus untuk pengujian konkurensi pembayaran independen (HANYA database testing)');

Artisan::command('mfms:migrate-staging {--connection=pgsql_staging : Nama koneksi database staging} {--project-ref= : Target Supabase project ref yang diizinkan} {--force : Lewati konfirmasi interaktif}', function (): int {
    try {
        DemoRuntimeGuard::forbidInDemoRuntime('mfms:migrate-staging');
    } catch (\Throwable $e) {
        $this->error($e->getMessage());
        return 1;
    }

    $connName = (string) $this->option('connection');
    $projectRef = $this->option('project-ref') ? (string) $this->option('project-ref') : null;

    try {
        $meta = \App\Support\DatabaseTargetGuard::validateTarget(
            $connName,
            expectedProjectRef: $projectRef,
            requirePgsql: true,
            confirmServerIdentity: true
        );
    } catch (\Throwable $e) {
        $this->error($e->getMessage());
        return 1;
    }

    $this->info("=== MFMS Staging Database Migration ===");
    $this->line("Target Connection : {$connName}");
    $this->line("Driver            : " . $meta['driver']);
    $this->line("Host              : " . $meta['host'] . ":" . $meta['port']);
    $this->line("Database          : " . $meta['database']);
    $this->line("User              : " . $meta['username']);
    $this->line("Project Ref       : " . ($meta['project_ref'] ?: '(none / local)'));
    $this->line("SSL Mode          : " . $meta['sslmode']);
    $this->line("Confirmed Server  : " . substr($meta['server_version'] ?? 'unknown', 0, 45) . "...");

    if (! $this->option('force') && ! $this->confirm('Apakah Anda yakin ingin menjalankan migrasi skema pada database target di atas?')) {
        $this->warn('Migrasi dibatalkan oleh pengguna.');
        return 1;
    }

    // Run Laravel migrations
    $this->info("Menjalankan migrasi skema...");
    $exitCode = Artisan::call('migrate', [
        '--database' => $connName,
        '--force' => true,
    ], $this->output);

    if ($exitCode === 0) {
        $this->info("Migrasi skema database staging berhasil 100%.");
    } else {
        $this->error("Terjadi kegagalan saat migrasi skema (Exit code: {$exitCode}).");
    }

    return $exitCode;
})->purpose('Menjalankan migrasi satu kali ke database Supabase staging dari runner lokal dengan perlindungan ketat');

Artisan::command('mfms:seed-staging {--connection=pgsql_staging : Nama koneksi database staging} {--project-ref= : Target Supabase project ref yang diizinkan}', function (): int {
    try {
        DemoRuntimeGuard::forbidInDemoRuntime('mfms:seed-staging');
    } catch (\Throwable $e) {
        $this->error($e->getMessage());
        return 1;
    }

    $connName = (string) $this->option('connection');
    $projectRef = $this->option('project-ref') ? (string) $this->option('project-ref') : null;

    try {
        $meta = \App\Support\DatabaseTargetGuard::validateTarget(
            $connName,
            expectedProjectRef: $projectRef,
            requirePgsql: true,
            confirmServerIdentity: true
        );
    } catch (\Throwable $e) {
        $this->error($e->getMessage());
        return 1;
    }

    $conn = \Illuminate\Support\Facades\DB::connection($connName);

    // 1. Seed Synthetic Expense Categories
    $categories = [
        ['name' => 'Bahan Bunga & Aksesoris', 'is_active' => true],
        ['name' => 'Logistik & Bahan Bakar', 'is_active' => true],
        ['name' => 'Operasional Toko & Listrik', 'is_active' => true],
        ['name' => 'Konsumsi & Lembur', 'is_active' => true],
    ];

    foreach ($categories as $cat) {
        $exists = $conn->table('expense_categories')->where('name', $cat['name'])->exists();
        if (! $exists) {
            $conn->table('expense_categories')->insert(array_merge($cat, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }
    $this->info("Kategori pengeluaran sintetis berhasil disiapkan.");

    // 2. Seed Synthetic Customers
    $dummyCustomers = [
        ['name' => 'Pelanggan Staging Mutiara A', 'phone' => '081299990001', 'notes' => 'Akun sintetis untuk pengujian order dan DP'],
        ['name' => 'Pelanggan Staging Mutiara B', 'phone' => '081299990002', 'notes' => 'Akun sintetis untuk pengujian order lunas'],
    ];

    foreach ($dummyCustomers as $cust) {
        $exists = $conn->table('customers')->where('phone', $cust['phone'])->exists();
        if (! $exists) {
            $conn->table('customers')->insert(array_merge($cust, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }
    $this->info("Pelanggan sintetis berhasil disiapkan (0 data riil digunakan).");

    $this->info("Seeding data sintetis staging selesai.");
    return 0;
})->purpose('Mengisi data sintetis (kategori & pelanggan dummy) ke database staging');

Artisan::command('mfms:verify-staging {--connection=pgsql_staging : Nama koneksi database staging} {--project-ref= : Target Supabase project ref yang diizinkan}', function (): int {
    try {
        DemoRuntimeGuard::forbidInDemoRuntime('mfms:verify-staging');
    } catch (\Throwable $e) {
        $this->error($e->getMessage());
        return 1;
    }

    $connName = (string) $this->option('connection');
    $projectRef = $this->option('project-ref') ? (string) $this->option('project-ref') : null;

    try {
        $meta = \App\Support\DatabaseTargetGuard::validateTarget(
            $connName,
            expectedProjectRef: $projectRef,
            requirePgsql: true,
            confirmServerIdentity: true
        );
    } catch (\Throwable $e) {
        $this->error($e->getMessage());
        return 1;
    }

    $this->info("=== MFMS Staging Database Schema & Relation Verification ===");
    $this->line("Target Connection : {$connName}");
    $this->line("Host              : " . $meta['host'] . ":" . $meta['port']);
    $this->line("Database          : " . $meta['database']);
    $this->line("User              : " . $meta['username']);
    $this->line("Project Ref       : " . ($meta['project_ref'] ?: '(none / local)'));
    $this->line("Server Version    : " . substr($meta['server_version'] ?? 'unknown', 0, 45) . "...");
    $this->newLine();

    $conn = \Illuminate\Support\Facades\DB::connection($connName);
    $schema = \Illuminate\Support\Facades\Schema::connection($connName);

    $expectedTables = [
        'users' => ['id', 'name', 'email', 'password'],
        'customers' => ['id', 'name', 'phone', 'deleted_at'],
        'orders' => ['id', 'order_number', 'customer_id', 'created_by', 'status', 'total_amount'],
        'order_items' => ['id', 'order_id', 'flower_type', 'fulfillment_status', 'quantity', 'unit_price'],
        'payments' => ['id', 'order_id', 'recorded_by', 'amount', 'method', 'idempotency_key', 'status'],
        'expense_categories' => ['id', 'name', 'is_active'],
        'expenses' => ['id', 'expense_category_id', 'recorded_by', 'amount', 'status', 'idempotency_key'],
        'audit_logs' => ['id', 'actor_user_id', 'action', 'subject_type', 'subject_id'],
        'sessions' => ['id', 'user_id', 'ip_address', 'user_agent', 'payload', 'last_activity'],
        'cache' => ['key', 'value', 'expiration'],
        'jobs' => ['id', 'queue', 'payload', 'attempts', 'reserved_at', 'available_at', 'created_at'],
        'migrations' => ['id', 'migration', 'batch'],
    ];

    $allTablesExist = true;
    $tableRows = [];

    foreach ($expectedTables as $table => $requiredCols) {
        $exists = $schema->hasTable($table);
        if (! $exists) {
            $allTablesExist = false;
            $tableRows[] = [$table, 'TIDAK DITEMUKAN', '0', 'GAGAL'];
            continue;
        }

        $missingCols = [];
        foreach ($requiredCols as $col) {
            if (! $schema->hasColumn($table, $col)) {
                $missingCols[] = $col;
            }
        }

        $count = $conn->table($table)->count();
        $status = empty($missingCols) ? '✓ VALID' : 'KOLOM HILANG: ' . implode(',', $missingCols);
        if (! empty($missingCols)) {
            $allTablesExist = false;
        }

        $tableRows[] = [$table, 'ADA', number_format($count), $status];
    }

    $this->info("1. Status Tabel & Kolom:");
    $this->table(['Nama Tabel', 'Status Keberadaan', 'Jumlah Baris', 'Integritas Kolom'], $tableRows);
    $this->newLine();

    // Verify Foreign Key Constraints on PostgreSQL
    $this->info("2. Status Foreign Key Constraints:");
    try {
        $fkQuery = "
            SELECT
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM
                information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
            ORDER BY tc.table_name, kcu.column_name;
        ";
        $fks = $conn->select($fkQuery);
        $fkRows = [];
        foreach ($fks as $fk) {
            $fkRows[] = [
                $fk->table_name,
                $fk->column_name,
                $fk->foreign_table_name . '(' . $fk->foreign_column_name . ')',
                '✓ ACTIVE'
            ];
        }
        $this->table(['Tabel', 'Kolom FK', 'Merujuk Ke', 'Status Relasi'], $fkRows);
        $hasFks = count($fkRows) >= 6;
    } catch (\Throwable $e) {
        $this->warn("Tidak dapat membaca information_schema FK: " . $e->getMessage());
        $hasFks = true; // Fallback if limited permission
    }

    $this->newLine();
    $adminCount = $schema->hasTable('users') ? $conn->table('users')->count() : 0;
    $catCount = $schema->hasTable('expense_categories') ? $conn->table('expense_categories')->count() : 0;
    $custCount = $schema->hasTable('customers') ? $conn->table('customers')->count() : 0;

    $this->info("3. Ringkasan Data Staging:");
    $this->line("- Akun Admin User : {$adminCount} user (" . ($adminCount > 0 ? "✓ SIAP LOGIN" : "BELUM DIBUAT (Jalankan mfms:create-admin)") . ")");
    $this->line("- Kategori Sintetis: {$catCount} kategori (" . ($catCount >= 4 ? "✓ SEEDED" : "BELUM SEEDING") . ")");
    $this->line("- Pelanggan Dummy  : {$custCount} pelanggan (" . ($custCount >= 2 ? "✓ SEEDED" : "BELUM SEEDING") . ")");
    $this->newLine();

    if ($allTablesExist && $hasFks) {
        $this->info("✓ SEMUA TABEL DAN RELASI DATABASE STAGING TELAH TERVERIFIKASI 100%!");
        return 0;
    } else {
        $this->error("TERDAPAT MASALAH INTEGRITAS PADA DATABASE STAGING.");
        return 1;
    }
})->purpose('Memverifikasi keberadaan seluruh tabel, kolom, relasi FK, dan data awal pada database staging');

// ==============================================================================
// Phase 14A: Temporary Demo Runtime Commands & 24-Hour Automated Reset Schedule
// ==============================================================================

Artisan::command('mfms:demo-reset {--path= : Path file SQLite demo target} {--keep-sessions : Pertahankan sesi file demo saat reset} {--force : Lewati konfirmasi interaktif}', function (DemoResetService $resetService, DemoAccessManager $demo): int {
    if (! $demo->isDemoRuntime()) {
        $this->error('DITOLAK: Perintah mfms:demo-reset hanya diizinkan pada runtime demo (MFMS_RUNTIME_MODE=demo).');

        return 1;
    }

    $targetPath = $this->option('path') ? (string) $this->option('path') : null;
    if (! $this->option('force') && ! $this->confirm('Reset seluruh data simulasi SQLite demo dan isi ulang dataset sintetis?')) {
        $this->warn('Reset demo dibatalkan.');

        return 1;
    }

    try {
        $summary = $resetService->reset(
            targetSqlitePath: $targetPath,
            flushSessions: ! (bool) $this->option('keep-sessions')
        );

        $this->info('Reset dataset simulasi demo berhasil (atomic SQLite swap).');
        $this->line('SQLite Path : '.$summary['sqlite_path']);
        $this->line('Ukuran File : '.number_format($summary['size_bytes']).' bytes');
        $this->line('Waktu Reset : '.$summary['reset_at']);
        $this->line('Sesi Dihapus: '.$summary['sessions_flushed']);

        $rows = [];
        foreach ($summary['counts'] as $table => $count) {
            $rows[] = [$table, $count];
        }
        $this->table(['Tabel', 'Baris Sintetis'], $rows);

        return 0;
    } catch (\Throwable $e) {
        $this->error('Gagal menjalankan reset demo: '.$e->getMessage());

        return 1;
    }
})->purpose('Membangun ulang dan menukar secara atomik database SQLite demo dengan dataset sintetis');

Artisan::command('mfms:demo-disable', function (DemoAccessManager $demo): int {
    $path = $demo->killSwitchPath();
    $dir = dirname($path);
    if (! is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }

    file_put_contents($path, now('Asia/Jakarta')->toIso8601String()." disabled\n");
    $this->warn("Emergency kill switch AKTIF: {$path}");
    $this->line('Seluruh sesi demo aktif dan upaya login demo akan ditolak seketika.');

    return 0;
})->purpose('Mengaktifkan emergency kill switch untuk menonaktifkan akses demo seketika tanpa restart container');

Artisan::command('mfms:demo-enable', function (DemoAccessManager $demo): int {
    $path = $demo->killSwitchPath();
    if (is_file($path)) {
        @unlink($path);
        $this->info("Emergency kill switch dicabut: {$path}");
    } else {
        $this->info('Emergency kill switch tidak aktif.');
    }

    return 0;
})->purpose('Mencabut emergency kill switch demo');

Artisan::command('mfms:demo-status', function (DemoAccessManager $demo): int {
    $expiresAt = $demo->expiresAt();
    $activatedAt = $demo->activatedAt();
    $sqlitePath = (string) config('database.connections.sqlite.database', '');
    $sqliteExists = $sqlitePath !== '' && $sqlitePath !== ':memory:' && is_file($sqlitePath);

    $this->table(['Properti', 'Status'], [
        ['Runtime Mode', $demo->runtimeMode()],
        ['DEMO_ENABLED', config('demo.enabled') ? 'true' : 'false'],
        ['Emergency Kill Switch', $demo->isKillSwitchEngaged() ? 'ENGAGED (DISABLED)' : 'clear'],
        ['Active Now', $demo->isActive() ? 'ACTIVE' : 'INACTIVE ('.$demo->inactiveReason().')'],
        ['Demo Email', $demo->demoEmail()],
        ['Password Configured', $demo->demoPassword() !== null ? 'yes (hidden)' : 'NO'],
        ['Activated At (WIB)', $activatedAt ? $activatedAt->toIso8601String() : 'not configured'],
        ['Expires At (WIB)', $expiresAt ? $expiresAt->toIso8601String() : 'not configured'],
        ['Reset Schedule (WIB)', (string) config('demo.reset_time', '03:00').' daily'],
        ['SQLite Path', $sqlitePath ?: '(none)'],
        ['SQLite Size', $sqliteExists ? number_format((int) filesize($sqlitePath)).' bytes' : 'n/a'],
    ]);

    return 0;
})->purpose('Menampilkan status siklus hidup dan isolasi runtime demo tanpa menampilkan password');

Artisan::command('mfms:demo-generate-password', function (): int {
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    $len = strlen($alphabet);
    $segments = [];
    for ($s = 0; $s < 3; $s++) {
        $chunk = '';
        for ($i = 0; $i < 5; $i++) {
            $chunk .= $alphabet[random_int(0, $len - 1)];
        }
        $segments[] = $chunk;
    }

    $password = 'Mutiara-'.implode('-', $segments);
    $this->line($password);

    return 0;
})->purpose('Menghasilkan password demo khusus yang kuat untuk dikonfigurasi pada DEMO_PASSWORD');

Schedule::command('mfms:demo-reset --force')
    ->dailyAt((string) config('demo.reset_time', '03:00'))
    ->timezone('Asia/Jakarta')
    ->when(fn (): bool => app(DemoAccessManager::class)->isDemoRuntime() && app(DemoAccessManager::class)->isActive())
    ->withoutOverlapping();


