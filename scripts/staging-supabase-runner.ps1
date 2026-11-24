# ==============================================================================
# MFMS - Safe Local Runner for Supabase PostgreSQL Staging
# ==============================================================================
# Script ini dijalankan secara lokal dan sementara untuk mengeksekusi migrasi,
# pembuatan admin, dan seeding sintetis ke Supabase staging tanpa mengubah .env
# lokal atau database produksi.
#
# Parameter/Env wajib disediakan saat runtime (tidak di-hardcode di repository):
#   -ProjectRef  atau $env:DB_STAGING_PROJECT_REF
#   -PoolerHost  atau $env:DB_STAGING_HOST (contoh: aws-0-ap-southeast-1.pooler.supabase.com)
#   -Port        atau $env:DB_STAGING_PORT (default: 5432)
# ==============================================================================

param(
    [string]$ProjectRef = $env:DB_STAGING_PROJECT_REF,
    [string]$PoolerHost = $env:DB_STAGING_HOST,
    [string]$Port = $(if ($env:DB_STAGING_PORT) { $env:DB_STAGING_PORT } else { '5432' })
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
    $ProjectRef = Read-Host -Prompt 'Masukkan Supabase Staging Project Ref'
}

if ([string]::IsNullOrWhiteSpace($PoolerHost)) {
    $PoolerHost = Read-Host -Prompt 'Masukkan Supabase Pooler Host (mis. aws-0-ap-southeast-1.pooler.supabase.com)'
}

if ([string]::IsNullOrWhiteSpace($ProjectRef) -or [string]::IsNullOrWhiteSpace($PoolerHost)) {
    Write-Host 'Batal: ProjectRef dan PoolerHost wajib diisi.' -ForegroundColor Red
    exit 1
}

Write-Host '================================================================' -ForegroundColor Cyan
Write-Host '  MFMS - Safe Supabase Staging Runner' -ForegroundColor Cyan
Write-Host "  Target Project Ref: $ProjectRef" -ForegroundColor Cyan
Write-Host "  Target Host       : $PoolerHost`:$Port" -ForegroundColor Cyan
Write-Host '  Catatan           : Hanya memakai variabel env sesi sementara.' -ForegroundColor Yellow
Write-Host '================================================================' -ForegroundColor Cyan
Write-Host ''

$securePwd = Read-Host -Prompt "Masukkan Password Database Supabase ($ProjectRef)" -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
$plainPwd = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if ([string]::IsNullOrWhiteSpace($plainPwd)) {
    Write-Host 'Batal: Password tidak boleh kosong.' -ForegroundColor Red
    exit 1
}

$env:DB_STAGING_HOST = $PoolerHost
$env:DB_STAGING_PORT = $Port
$env:DB_STAGING_DATABASE = 'postgres'
$env:DB_STAGING_USERNAME = "postgres.$ProjectRef"
$env:DB_STAGING_PASSWORD = $plainPwd
$env:DB_STAGING_SSLMODE = 'require'
$env:DB_STAGING_PROJECT_REF = $ProjectRef

try {
    Write-Host ''
    Write-Host '[1/4] Verifikasi koneksi dan identitas server Supabase...' -ForegroundColor Yellow
    $verifyCode = "try { `$pdo = DB::connection('pgsql_staging')->getPdo(); `$row = `$pdo->query('SELECT current_database() as db, current_user as usr, version() as ver')->fetch(PDO::FETCH_ASSOC); echo 'OK: db=' . `$row['db'] . ' user=' . `$row['usr'] . ' ver=' . substr(`$row['ver'], 0, 40) . PHP_EOL; } catch (\Throwable `$e) { fwrite(STDERR, 'FAIL: ' . `$e->getMessage() . PHP_EOL); exit(1); }"
    php -r "require 'vendor/autoload.php'; `$app = require 'bootstrap/app.php'; `$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); $verifyCode"
    if ($LASTEXITCODE -ne 0) {
        throw 'Koneksi ke Supabase staging gagal. Pastikan host, port, project ref, dan password benar.'
    }

    Write-Host ''
    Write-Host '[2/4] Menjalankan migrasi skema (mfms:migrate-staging)...' -ForegroundColor Yellow
    php artisan mfms:migrate-staging --connection=pgsql_staging --project-ref=$ProjectRef
    if ($LASTEXITCODE -ne 0) {
        throw 'Migrasi staging gagal atau dibatalkan.'
    }

    Write-Host ''
    Write-Host '[3/4] Membuat akun admin staging (mfms:create-admin)...' -ForegroundColor Yellow
    Write-Host 'Catatan: Password minimal 12 karakter, tidak akan ditampilkan di layar.' -ForegroundColor Gray
    php artisan mfms:create-admin --connection=pgsql_staging --project-ref=$ProjectRef
    if ($LASTEXITCODE -ne 0) {
        throw 'Pembuatan admin staging gagal.'
    }

    Write-Host ''
    Write-Host '[4/4] Mengisi data sintetis awal (mfms:seed-staging)...' -ForegroundColor Yellow
    php artisan mfms:seed-staging --connection=pgsql_staging --project-ref=$ProjectRef
    if ($LASTEXITCODE -ne 0) {
        throw 'Seeding data sintetis staging gagal.'
    }

    Write-Host ''
    Write-Host '================================================================' -ForegroundColor Green
    Write-Host '  SELESAI: Supabase Staging siap digunakan.' -ForegroundColor Green
    Write-Host '================================================================' -ForegroundColor Green
}
finally {
    $env:DB_STAGING_HOST = $null
    $env:DB_STAGING_PORT = $null
    $env:DB_STAGING_DATABASE = $null
    $env:DB_STAGING_USERNAME = $null
    $env:DB_STAGING_PASSWORD = $null
    $env:DB_STAGING_SSLMODE = $null
    $env:DB_STAGING_PROJECT_REF = $null
    $plainPwd = $null
    Write-Host '[CLEANUP] Variabel lingkungan sementara telah dibersihkan.' -ForegroundColor DarkGray
}
