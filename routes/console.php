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

Artisan::command('mfms:backup {--key= : Kunci enkripsi khusus} {--connection= : Nama koneksi database}', function (\App\Services\BackupService $backupService): int {
    $this->info('Memulai backup database terenkripsi (AES-256-CBC)...');
    try {
        $result = $backupService->createBackup($this->option('key'), $this->option('connection'));
        $meta = $result['meta'];

        $this->newLine();
        $this->info('✓ Backup berhasil dibuat dan dienkripsi!');
        $this->table(['Properti', 'Nilai'], [
            ['File Enkripsi', $result['enc_path']],
            ['File Metadata', $result['meta_path']],
            ['Waktu Pembuatan', $meta['created_at']],
            ['Algoritma Sandi', $meta['cipher']],
            ['Checksum SHA-256', $meta['checksum_sha256']],
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
})->purpose('Membuat backup database terenkripsi AES-256-CBC dengan verifikasi checksum SHA-256');

Artisan::command('mfms:restore-test {backup_file? : Path atau nama file backup .enc} {--key= : Kunci enkripsi khusus} {--connection=testing : Nama koneksi pengujian}', function (\App\Services\BackupService $backupService): int {
    $file = $this->argument('backup_file');
    if (! $file) {
        $files = glob(storage_path('app/backups/*.enc'));
        if (empty($files)) {
            $this->error('Tidak ada file backup .enc yang ditemukan di storage/app/backups.');

            return 1;
        }
        rsort($files);
        $file = $files[0];
    } elseif (! file_exists($file)) {
        $file = storage_path('app/backups/'.basename($file));
    }

    if (! file_exists($file)) {
        $this->error("File backup tidak ditemukan: {$file}");

        return 1;
    }

    $targetConn = (string) $this->option('connection');
    $this->info("Menjalankan uji restorasi pada database terisolasi: [{$targetConn}]...");

    try {
        $report = $backupService->restoreTest($file, $this->option('key'), $targetConn);

        $this->newLine();
        $this->info("✓ UJI RESTORASI BERHASIL: Status {$report['status']}");
        $this->table(['Pemeriksaan Integritas', 'Status'], [
            ['Checksum SHA-256', $report['checksum_verified'] ? 'VALID' : 'INVALID'],
            ['Rekonsiliasi Baris Tabel', $report['tables_verified'] ? 'VALID' : 'MISMATCH'],
            ['Integritas Metrik Keuangan', $report['metrics_verified'] ? 'VALID' : 'MISMATCH'],
            ['Relasi Foreign Key (No Orphans)', $report['fk_verified'] ? 'VALID' : 'ORPHANS FOUND'],
        ]);

        return 0;
    } catch (\Throwable $e) {
        $this->error('Uji restorasi gagal: '.$e->getMessage());

        return 1;
    }
})->purpose('Menjalankan uji restorasi backup terenkripsi HANYA pada database pengujian terisolasi');

