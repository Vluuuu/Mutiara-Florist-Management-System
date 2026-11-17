# ==============================================================================
# Mutiara Florist Management System (MFMS) - Safe Shutdown Script
# ==============================================================================

$ErrorActionPreference = 'Continue'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LaravelPidFile = "$ProjectRoot\storage\framework\mfms_laravel.pid"
$MysqlPidFile = "$ProjectRoot\storage\framework\mfms_mysql.pid"

Write-Host "============================================================" -ForegroundColor DarkYellow
Write-Host "  MUTIARA FLORIST MANAGEMENT SYSTEM (MFMS) - SHUTDOWN AMAN  " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor DarkYellow
Write-Host ""

# 1. Hentikan Laravel Serve pada port 8000
$StoppedWeb = $false
try {
    $conns = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -eq 'php') {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "[OK] Server web MFMS (PID $($proc.Id)) pada port 8000 dihentikan." -ForegroundColor Green
            $StoppedWeb = $true
        }
    }
} catch {}

if (Test-Path $LaravelPidFile) {
    $TrackedPid = Get-Content $LaravelPidFile -ErrorAction SilentlyContinue
    if ($TrackedPid -and (Get-Process -Id $TrackedPid -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $TrackedPid -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] Proses induk Laravel (PID $TrackedPid) dihentikan." -ForegroundColor Green
        $StoppedWeb = $true
    }
    Remove-Item $LaravelPidFile -Force -ErrorAction SilentlyContinue
}

if (-not $StoppedWeb) {
    Write-Host "[INFO] Tidak ada server web MFMS yang aktif di port 8000." -ForegroundColor Gray
}

# 2. Hentikan MariaDB HANYA jika dijalankan oleh skrip Start-MFMS
if (Test-Path $MysqlPidFile) {
    $MysqlPid = Get-Content $MysqlPidFile -ErrorAction SilentlyContinue
    $XamppDirs = @('D:\xampp', 'C:\xampp')
    $MysqlAdmin = $null
    foreach ($dir in $XamppDirs) {
        if (Test-Path "$dir\mysql\bin\mysqladmin.exe") {
            $MysqlAdmin = "$dir\mysql\bin\mysqladmin.exe"
            break
        }
    }

    if ($MysqlPid -and (Get-Process -Id $MysqlPid -ErrorAction SilentlyContinue)) {
        Write-Host "[INFO] Menghentikan MariaDB secara aman..." -ForegroundColor Cyan
        if ($MysqlAdmin) {
            & $MysqlAdmin --host=127.0.0.1 --port=3307 -u root shutdown 2>$null
            Start-Sleep -Seconds 2
        }
        if (Get-Process -Id $MysqlPid -ErrorAction SilentlyContinue) {
            Stop-Process -Id $MysqlPid -Force -ErrorAction SilentlyContinue
        }
        Write-Host "[OK] MariaDB (PID $MysqlPid) telah dimatikan dengan aman." -ForegroundColor Green
    }
    Remove-Item $MysqlPidFile -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "[INFO] MariaDB dikelola secara eksternal (misal: XAMPP Control Panel)." -ForegroundColor Gray
    Write-Host "       Jika ingin mematikan database, klik 'Stop' pada MySQL di XAMPP Control Panel." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Shutdown selesai. Anda dapat menutup jendela ini." -ForegroundColor White
