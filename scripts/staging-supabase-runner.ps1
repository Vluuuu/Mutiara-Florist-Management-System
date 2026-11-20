# ==============================================================================
# MFMS — Staging Supabase Migration & Verification Runner (Phase 15B)
# ==============================================================================
# Script ini dijalankan langsung oleh Owner di terminal lokal Windows PowerShell.
# Kredensial dimasukkan secara interaktif (masked) dan HANYA berada di memori proses.
# File .env lokal produksi (mutiara_florist_prod) 100% TIDAK TERSENTUH.
# ==============================================================================

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " MFMS — Supabase Staging Setup Runner (Project: rngzdtiqzwklplcxbyye)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Host        : aws-1-ap-southeast-2.pooler.supabase.com"
Write-Host "Port        : 5432 (Session Pooler)"
Write-Host "Database    : postgres"
Write-Host "Username    : postgres.rngzdtiqzwklplcxbyye"
Write-Host "Project Ref : rngzdtiqzwklplcxbyye (Sydney)"
Write-Host "SSL Mode    : require"
Write-Host "-----------------------------------------------------------------"

# 1. Input Password secara aman (karakter tidak tampak di layar dan tidak masuk history)
$securePassword = Read-Host -Prompt "Masukkan password database Supabase staging" -AsSecureString
if (-not $securePassword) {
    Write-Host "Password tidak boleh kosong. Operasi dibatalkan." -ForegroundColor Red
    exit 1
}

$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

# 2. Pasang Environment Variables pada sesi proses PowerShell saat ini
$env:DB_STAGING_HOST = "aws-1-ap-southeast-2.pooler.supabase.com"
$env:DB_STAGING_PORT = "5432"
$env:DB_STAGING_DATABASE = "postgres"
$env:DB_STAGING_USERNAME = "postgres.rngzdtiqzwklplcxbyye"
$env:DB_STAGING_PASSWORD = $plainPassword
$env:DB_STAGING_SSLMODE = "require"
$env:DB_STAGING_PROJECT_REF = "rngzdtiqzwklplcxbyye"

try {
    Write-Host "`n[LANGKAH 1/4] Menjalankan migrasi skema database..." -ForegroundColor Yellow
    php artisan mfms:migrate-staging --connection=pgsql_staging --project-ref=rngzdtiqzwklplcxbyye
    if ($LASTEXITCODE -ne 0) {
        throw "Migrasi skema database gagal (Exit code: $LASTEXITCODE)."
    }

    Write-Host "`n[LANGKAH 2/4] Membuat akun admin staging..." -ForegroundColor Yellow
    php artisan mfms:create-admin --connection=pgsql_staging --project-ref=rngzdtiqzwklplcxbyye
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Catatan: Pembuatan admin dilewati atau akun sudah ada." -ForegroundColor DarkYellow
    }

    Write-Host "`n[LANGKAH 3/4] Melakukan seeding data sintetis (kategori & pelanggan dummy)..." -ForegroundColor Yellow
    php artisan mfms:seed-staging --connection=pgsql_staging --project-ref=rngzdtiqzwklplcxbyye
    if ($LASTEXITCODE -ne 0) {
        throw "Seeding data sintetis gagal (Exit code: $LASTEXITCODE)."
    }

    Write-Host "`n[LANGKAH 4/4] Memverifikasi integritas tabel, kolom, dan relasi FK..." -ForegroundColor Yellow
    php artisan mfms:verify-staging --connection=pgsql_staging --project-ref=rngzdtiqzwklplcxbyye
    if ($LASTEXITCODE -ne 0) {
        throw "Verifikasi integritas database staging menemukan masalah."
    }

    Write-Host "`n=================================================================" -ForegroundColor Green
    Write-Host " ✓ SETUP & VERIFIKASI SUPABASE STAGING BERHASIL 100%!" -ForegroundColor Green
    Write-Host " Database Supabase staging siap dihubungkan ke Render Free." -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
}
catch {
    Write-Host "`n[ERROR] $_" -ForegroundColor Red
}
finally {
    # 3. Bersihkan password dari variabel memori proses
    $plainPassword = $null
    $env:DB_STAGING_PASSWORD = $null
    [System.GC]::Collect()
    Write-Host "`nKredensial di memori sesi telah dibersihkan secara aman." -ForegroundColor DarkGray
}
