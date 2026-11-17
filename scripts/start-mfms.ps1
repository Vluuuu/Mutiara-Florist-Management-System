# ==============================================================================
# Mutiara Florist Management System (MFMS) - Local Windows Startup Script
# ==============================================================================
# Aman untuk operator harian:
# - Memeriksa MariaDB di port 3307 (tidak menjalankan instance ganda)
# - Tidak menjalankan migrasi, seeding, atau reset database otomatis
# - Memeriksa ketersediaan port 8000 & hasil build production (public/build)
# - Menjalankan server Laravel hanya di 127.0.0.1:8000
# ==============================================================================

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "============================================================" -ForegroundColor DarkGreen
Write-Host "  MUTIARA FLORIST MANAGEMENT SYSTEM (MFMS) - STARTUP LOKAL  " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor DarkGreen
Write-Host ""

function Test-LocalPort {
    param([int]$Port)
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return ($null -ne $conn)
    } catch {
        $output = netstat -ano | Select-String ":$Port\s+.*LISTENING"
        return ($null -ne $output)
    }
}

# 1. Deteksi XAMPP & PHP
$XamppDirs = @('D:\xampp', 'C:\xampp')
$XamppRoot = $null
foreach ($dir in $XamppDirs) {
    if (Test-Path "$dir\php\php.exe") {
        $XamppRoot = $dir
        break
    }
}

$PhpExe = if ($XamppRoot) { "$XamppRoot\php\php.exe" } else { (Get-Command php -ErrorAction SilentlyContinue).Source }
if (-not $PhpExe -or -not (Test-Path $PhpExe)) {
    Write-Host "[GAGAL] PHP tidak ditemukan. Pastikan XAMPP terpasang di D:\xampp atau C:\xampp." -ForegroundColor Red
    exit 1
}

# 2. Validasi file konfigurasi & production build
if (-not (Test-Path "$ProjectRoot\.env")) {
    Write-Host "[GAGAL] File konfigurasi .env tidak ditemukan di $ProjectRoot." -ForegroundColor Red
    Write-Host "        Hubungi pengelola sistem untuk memulihkan konfigurasi .env." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "$ProjectRoot\public\build\manifest.json")) {
    Write-Host "[GAGAL] Asset tampilan React (public/build/manifest.json) belum tersedia." -ForegroundColor Red
    Write-Host "        Jalankan 'npm run build' terlebih dahulu sebelum operasional." -ForegroundColor Yellow
    exit 1
}

if (Test-Path "$ProjectRoot\public\hot") {
    Write-Host "[PERINGATAN] File 'public/hot' terdeteksi. Menghapus sisa mode dev Vite agar memakai build produksi..." -ForegroundColor Yellow
    Remove-Item "$ProjectRoot\public\hot" -Force
}

# 3. Pastikan MariaDB aktif di port 3307 (tanpa menjalankan instance kedua)
$MysqlPort = 3307
$MysqlPidFile = "$ProjectRoot\storage\framework\mfms_mysql.pid"

if (Test-LocalPort -Port $MysqlPort) {
    Write-Host "[OK] MariaDB sudah aktif di port $MysqlPort." -ForegroundColor Green
} else {
    Write-Host "[INFO] MariaDB belum berjalan di port $MysqlPort. Mencoba menyalakan MariaDB XAMPP..." -ForegroundColor Yellow
    if (-not $XamppRoot -or -not (Test-Path "$XamppRoot\mysql\bin\mysqld.exe")) {
        Write-Host "[GAGAL] mysqld.exe XAMPP tidak ditemukan. Buka XAMPP Control Panel dan nyalakan MySQL secara manual." -ForegroundColor Red
        exit 1
    }

    $MysqlArgs = @("--defaults-file=$XamppRoot\mysql\bin\my.ini", "--standalone")
    $MysqlProc = Start-Process -FilePath "$XamppRoot\mysql\bin\mysqld.exe" -ArgumentList $MysqlArgs -WindowStyle Hidden -PassThru
    Set-Content -Path $MysqlPidFile -Value $MysqlProc.Id -Encoding ASCII

    $WaitSec = 0
    while (-not (Test-LocalPort -Port $MysqlPort) -and $WaitSec -lt 15) {
        Start-Sleep -Seconds 1
        $WaitSec++
    }

    if (-not (Test-LocalPort -Port $MysqlPort)) {
        Write-Host "[GAGAL] MariaDB gagal aktif di port $MysqlPort dalam 15 detik." -ForegroundColor Red
        Write-Host "        Periksa log error MariaDB di $XamppRoot\mysql\data\mysql_error.log." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "[OK] MariaDB berhasil dijalankan di port $MysqlPort (PID: $($MysqlProc.Id))." -ForegroundColor Green
}

# 4. Uji koneksi database Laravel (tanpa migrasi/seeding)
Write-Host "[INFO] Memeriksa koneksi database Laravel..." -ForegroundColor Cyan
$DbCheck = & $PhpExe artisan db:show --counts 2>&1
if ($LASTEXITCODE -ne 0) {
    # Fallback ke check PDO sederhana jika db:show butuh ekstensi tertentu
    $PdoCheck = & $PhpExe -r "require 'vendor/autoload.php'; `$app = require 'bootstrap/app.php'; `$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); Illuminate\Support\Facades\DB::connection()->getPdo(); echo 'OK';" 2>&1
    if ($LASTEXITCODE -ne 0 -or ($PdoCheck -notmatch 'OK')) {
        Write-Host "[GAGAL] Koneksi ke database MariaDB gagal. Periksa konfigurasi DB_PORT=3307 dan DB_DATABASE di .env." -ForegroundColor Red
        exit 1
    }
}
Write-Host "[OK] Koneksi database operasional terverifikasi." -ForegroundColor Green

# 5. Periksa port Laravel 8000 agar tidak bentrok
$LaravelPort = 8000
$LaravelPidFile = "$ProjectRoot\storage\framework\mfms_laravel.pid"

if (Test-LocalPort -Port $LaravelPort) {
    Write-Host ""
    Write-Host "[INFO] Server pada 127.0.0.1:$LaravelPort sudah berjalan." -ForegroundColor Yellow
    Write-Host "       Jika itu adalah MFMS, Anda dapat langsung membuka browser." -ForegroundColor Yellow
    Write-Host "       Jika ingin memulai ulang, jalankan Stop-MFMS.bat terlebih dahulu." -ForegroundColor Yellow
} else {
    Write-Host "[INFO] Menyalakan server MFMS di http://127.0.0.1:$LaravelPort ..." -ForegroundColor Cyan
    $ServeProc = Start-Process -FilePath $PhpExe -ArgumentList @("artisan", "serve", "--host=127.0.0.1", "--port=$LaravelPort") -WorkingDirectory $ProjectRoot -WindowStyle Minimized -PassThru
    Set-Content -Path $LaravelPidFile -Value $ServeProc.Id -Encoding ASCII

    $WaitWeb = 0
    while (-not (Test-LocalPort -Port $LaravelPort) -and $WaitWeb -lt 10) {
        Start-Sleep -Seconds 1
        $WaitWeb++
    }

    if (-not (Test-LocalPort -Port $LaravelPort)) {
        Write-Host "[GAGAL] Server Laravel gagal aktif di port $LaravelPort." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Server MFMS aktif (PID: $($ServeProc.Id))." -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGreen
Write-Host "  SISTEM SIAP DIGUNAKAN!" -ForegroundColor Green
Write-Host "  Buka Google Chrome / Edge dan kunjungi alamat:" -ForegroundColor White
Write-Host "  -->  http://127.0.0.1:8000  <--" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Untuk mematikan sistem dengan aman setelah toko tutup," -ForegroundColor Gray
Write-Host "  jalankan scripts\Stop-MFMS.bat" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor DarkGreen
