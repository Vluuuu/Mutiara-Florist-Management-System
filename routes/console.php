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
