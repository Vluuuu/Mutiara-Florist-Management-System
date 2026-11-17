# ==============================================================================
# Mutiara Florist Management System (MFMS) - Local Windows Startup Script
# ==============================================================================
# Aman untuk operator harian:
# - Memastikan MariaDB aktif di port 3307 (prioritas dikelola XAMPP Control Panel)
# - Tidak menjalankan instance MariaDB atau Laravel ganda
# - Tidak menjalankan migrasi, seeding, atau reset database otomatis
# - Memeriksa identitas aplikasi pada port 8000 sebelum menyatakan SISTEM SIAP
# - Menyimpan metadata kepemilikan proses (PID + CreationDate + ExecutablePath + CommandLine)
# ==============================================================================

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "============================================================" -ForegroundColor DarkGreen
Write-Host "  MUTIARA FLORIST MANAGEMENT SYSTEM (MFMS) - STARTUP LOKAL  " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor DarkGreen
Write-Host ""

function Get-ListeningPids {
    param([int]$Port)
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($conns) {
            return @($conns | Select-Object -ExpandProperty OwningProcess -Unique)
        }
    } catch {}
    return @()
}

function Test-LocalPort {
    param([int]$Port)
    return ((Get-ListeningPids -Port $Port).Count -gt 0)
}

function Get-ProcessMetadata {
    param([int]$ProcessId)
    try {
        $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
        if ($null -eq $cim) { return $null }
        $createdIso = if ($cim.CreationDate) { $cim.CreationDate.ToUniversalTime().ToString('o') } else { '' }
        return @{
            pid             = [int]$cim.ProcessId
            parent_pid      = [int]$cim.ParentProcessId
            start_time      = $createdIso
            executable_path = [string]$cim.ExecutablePath
            command_line    = [string]$cim.CommandLine
            name            = [string]$cim.Name
        }
    } catch {
        return $null
    }
}

function Test-IsMfmsHttp {
    param([string]$Url)
    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 -MaximumRedirection 3
        return ($resp.StatusCode -eq 200 -and $resp.Content -match 'Mutiara Florist')
    } catch {
        return $false
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

# 3. Pastikan MariaDB aktif di port 3307 (tanpa instance kedua)
$MysqlPort = 3307
$MysqlStateFile = "$ProjectRoot\storage\framework\mfms_mysql.state.json"

if (Test-LocalPort -Port $MysqlPort) {
    Write-Host "[OK] MariaDB sudah aktif di port $MysqlPort." -ForegroundColor Green
} else {
    Write-Host "[INFO] MariaDB belum berjalan di port $MysqlPort. Mencoba menyalakan MariaDB XAMPP..." -ForegroundColor Yellow
    Write-Host "       (Disarankan menyalakan modul MySQL melalui XAMPP Control Panel)." -ForegroundColor Gray
    if (-not $XamppRoot -or -not (Test-Path "$XamppRoot\mysql\bin\mysqld.exe")) {
        Write-Host "[GAGAL] mysqld.exe XAMPP tidak ditemukan. Buka XAMPP Control Panel dan nyalakan MySQL secara manual." -ForegroundColor Red
        exit 1
    }

    $MysqlExe = "$XamppRoot\mysql\bin\mysqld.exe"
    $MysqlArgs = @("--defaults-file=$XamppRoot\mysql\bin\my.ini", "--standalone")
    $MysqlProc = Start-Process -FilePath $MysqlExe -ArgumentList $MysqlArgs -WindowStyle Hidden -PassThru

    $WaitSec = 0
    while (-not (Test-LocalPort -Port $MysqlPort) -and $WaitSec -lt 15) {
        Start-Sleep -Seconds 1
        $WaitSec++
    }

    if (-not (Test-LocalPort -Port $MysqlPort)) {
        Write-Host "[GAGAL] MariaDB gagal aktif di port $MysqlPort dalam 15 detik." -ForegroundColor Red
        Write-Host "        Periksa log error MariaDB di $XamppRoot\mysql\data\mysql_error.log atau nyalakan lewat XAMPP Control Panel." -ForegroundColor Yellow
        exit 1
    }

    $mysqlMeta = Get-ProcessMetadata -ProcessId $MysqlProc.Id
    if ($mysqlMeta) {
        $mysqlMeta['port'] = $MysqlPort
        $mysqlMeta['managed_by'] = 'mfms-start'
        $mysqlMeta | ConvertTo-Json -Depth 3 | Set-Content -Path $MysqlStateFile -Encoding UTF8
    }
    Write-Host "[OK] MariaDB berhasil dijalankan di port $MysqlPort (PID: $($MysqlProc.Id))." -ForegroundColor Green
}

# 4. Uji koneksi database Laravel (READ-ONLY, tanpa migrasi/seeding/reset)
Write-Host "[INFO] Memeriksa koneksi database Laravel..." -ForegroundColor Cyan
$PdoCheck = & $PhpExe -r "require 'vendor/autoload.php'; `$app = require 'bootstrap/app.php'; `$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); Illuminate\Support\Facades\DB::connection()->getPdo(); echo 'OK';" 2>&1
if ($LASTEXITCODE -ne 0 -or ($PdoCheck -notmatch 'OK')) {
    Write-Host "[GAGAL] Koneksi ke database MariaDB gagal. Periksa DB_PORT=3307 dan DB_DATABASE di .env." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Koneksi database operasional terverifikasi." -ForegroundColor Green

# 5. Periksa port Laravel 8000 agar tidak bentrok dengan aplikasi lain
$LaravelPort = 8000
$LaravelStateFile = "$ProjectRoot\storage\framework\mfms_laravel.state.json"
$ExistingPids = Get-ListeningPids -Port $LaravelPort

if ($ExistingPids.Count -gt 0) {
    $VerifiedExistingMfms = $false
    foreach ($p in $ExistingPids) {
        $meta = Get-ProcessMetadata -ProcessId $p
        if ($meta -and $meta.executable_path -match 'php\.exe$' -and ($meta.command_line -match [regex]::Escape($ProjectRoot) -or (Test-IsMfmsHttp -Url "http://127.0.0.1:$LaravelPort/login"))) {
            $VerifiedExistingMfms = $true
            break
        }
    }

    if (-not $VerifiedExistingMfms) {
        $firstMeta = Get-ProcessMetadata -ProcessId $ExistingPids[0]
        $procDesc = if ($firstMeta) { "$($firstMeta.name) (PID $($firstMeta.pid))" } else { "PID $($ExistingPids[0])" }
        Write-Host ""
        Write-Host "[GAGAL] Port $LaravelPort sudah dipakai oleh aplikasi lain: $procDesc." -ForegroundColor Red
        Write-Host "        Skrip tidak akan mematikan aplikasi tersebut. Tutup aplikasi lain di port $LaravelPort terlebih dahulu." -ForegroundColor Yellow
        exit 1
    }

    Write-Host "[OK] Server MFMS sudah berjalan aktif pada http://127.0.0.1:$LaravelPort (tidak menjalankan instance ganda)." -ForegroundColor Green
} else {
    Write-Host "[INFO] Menyalakan server MFMS di http://127.0.0.1:$LaravelPort ..." -ForegroundColor Cyan
    $ServeProc = Start-Process -FilePath $PhpExe -ArgumentList @("artisan", "serve", "--host=127.0.0.1", "--port=$LaravelPort") -WorkingDirectory $ProjectRoot -WindowStyle Minimized -PassThru

    $WaitWeb = 0
    while (-not (Test-LocalPort -Port $LaravelPort) -and $WaitWeb -lt 10) {
        Start-Sleep -Seconds 1
        $WaitWeb++
    }

    if (-not (Test-LocalPort -Port $LaravelPort)) {
        Write-Host "[GAGAL] Server Laravel gagal aktif di port $LaravelPort." -ForegroundColor Red
        exit 1
    }

    # Cari proses listener anak yang terikat ke port 8000 dan catat metadata kepemilikan
    $ListenerPids = Get-ListeningPids -Port $LaravelPort
    $ListenerMeta = $null
    foreach ($lp in $ListenerPids) {
        $m = Get-ProcessMetadata -ProcessId $lp
        if ($m -and ($m.pid -eq $ServeProc.Id -or $m.parent_pid -eq $ServeProc.Id -or $m.command_line -match '127\.0\.0\.1:8000')) {
            $ListenerMeta = $m
            break
        }
    }

    $ParentMeta = Get-ProcessMetadata -ProcessId $ServeProc.Id
    $StateObj = @{
        managed_by   = 'mfms-start'
        project_root = $ProjectRoot
        port         = $LaravelPort
        created_at   = (Get-Date).ToUniversalTime().ToString('o')
        parent       = $ParentMeta
        listener     = $ListenerMeta
    }
    $StateObj | ConvertTo-Json -Depth 4 | Set-Content -Path $LaravelStateFile -Encoding UTF8

    if (-not (Test-IsMfmsHttp -Url "http://127.0.0.1:$LaravelPort/login")) {
        Write-Host "[GAGAL] Server di port $LaravelPort aktif namun halaman login MFMS tidak merespons dengan benar." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Server MFMS aktif & terverifikasi (Parent PID: $($ServeProc.Id), Listener PID: $(if ($ListenerMeta) { $ListenerMeta.pid } else { 'N/A' }))." -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGreen
Write-Host "  SISTEM SIAP DIGUNAKAN!" -ForegroundColor Green
Write-Host "  Buka Google Chrome / Edge dan kunjungi alamat:" -ForegroundColor White
Write-Host "  -->  http://127.0.0.1:8000  <--" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Untuk mematikan server web MFMS secara aman setelah tutup toko," -ForegroundColor Gray
Write-Host "  jalankan scripts\Stop-MFMS.bat" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor DarkGreen
