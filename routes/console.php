<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;

Artisan::command('mfms:create-admin', function (): int {
    if (User::query()->exists()) {
        $this->error('Akun admin sudah ada. Pembuatan akun tambahan dinonaktifkan untuk MVP.');

        return 1;
    }

    $name = trim((string) $this->ask('Nama operator'));
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

    User::query()->create([
        'name' => $name,
        'email' => $email,
        'password' => Hash::make($password),
    ]);

    $this->info('Akun admin berhasil dibuat. Silakan masuk melalui /login.');

    return 0;
})->purpose('Membuat satu akun admin lokal tanpa registrasi publik');

Artisan::command('mfms:reset-password {--email= : Email admin yang akan direset password-nya}', function (): int {
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

