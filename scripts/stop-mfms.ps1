# ==============================================================================
# Mutiara Florist Management System (MFMS) - Safe Shutdown Script
# ==============================================================================
# Keamanan operasional:
# - Hanya menghentikan proses Laravel yang tercatat dimiliki oleh start-mfms.ps1
# - Memverifikasi PID, CreationDate (anti PID-reuse), ExecutablePath, dan CommandLine
# - Tidak menghentikan aplikasi lain di port 8000 atau file PID stale
# - Memverifikasi proses benar-benar berhenti sebelum melaporkan sukses
# - TIDAK PERNAH melakukan force-kill terhadap mysqld.exe (MariaDB)
# ==============================================================================

param(
    [string]$ProjectRootOverride = '',
    [int]$PortOverride = 0
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = if ($ProjectRootOverride) { $ProjectRootOverride } else { Split-Path -Parent $PSScriptRoot }
$LaravelPort = if ($PortOverride -gt 0) { $PortOverride } else { 8000 }

$LaravelStateFile = Join-Path $ProjectRoot 'storage\framework\mfms_laravel.state.json'
$MysqlStateFile = Join-Path $ProjectRoot 'storage\framework\mfms_mysql.state.json'

Write-Host "============================================================" -ForegroundColor DarkYellow
Write-Host "  MUTIARA FLORIST MANAGEMENT SYSTEM (MFMS) - SHUTDOWN AMAN  " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor DarkYellow
Write-Host ""

function Get-CimProcessInfo {
    param([int]$ProcessId)
    try {
        return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    } catch {
        return $null
    }
}

function Test-ProcessMatchesMetadata {
    param(
        $RecordedMeta,
        [string]$ExpectedExePattern,
        [string]$ExpectedCmdPattern
    )
    if ($null -eq $RecordedMeta -or -not $RecordedMeta.pid) {
        return @{ match = $false; reason = 'missing_metadata' }
    }

    $targetPid = [int]$RecordedMeta.pid
    $live = Get-CimProcessInfo -ProcessId $targetPid
    if ($null -eq $live) {
        return @{ match = $false; reason = 'not_running' }
    }

    # Anti PID-reuse: cocokkan waktu pembuatan proses (toleransi <= 2 detik)
    if ($RecordedMeta.start_time -and $live.CreationDate) {
        try {
            $recordedDt = [datetime]::Parse($RecordedMeta.start_time).ToUniversalTime()
            $liveDt = $live.CreationDate.ToUniversalTime()
            $diffSec = [math]::Abs(($liveDt - $recordedDt).TotalSeconds)
            if ($diffSec -gt 2) {
                return @{ match = $false; reason = "stale_pid_start_time_mismatch (diff=${diffSec}s)" }
            }
        } catch {
            return @{ match = $false; reason = 'invalid_start_time' }
        }
    } else {
        return @{ match = $false; reason = 'missing_start_time' }
    }

    $liveExe = [string]$live.ExecutablePath
    if ($ExpectedExePattern -and ($liveExe -notmatch $ExpectedExePattern)) {
        return @{ match = $false; reason = "executable_mismatch ($liveExe)" }
    }

    $liveCmd = [string]$live.CommandLine
    if ($ExpectedCmdPattern -and ($liveCmd -notmatch $ExpectedCmdPattern)) {
        return @{ match = $false; reason = "command_line_mismatch" }
    }

    return @{ match = $true; live = $live; pid = $targetPid }
}

function Stop-VerifiedProcess {
    param(
        [int]$TargetPid,
        [string]$Label
    )
    try {
        Stop-Process -Id $TargetPid -ErrorAction Stop
    } catch {
        return @{ stopped = $false; error = $_.Exception.Message }
    }

    $waited = 0
    while ($waited -lt 10) {
        $stillAlive = Get-Process -Id $TargetPid -ErrorAction SilentlyContinue
        if ($null -eq $stillAlive) {
            return @{ stopped = $true }
        }
        Start-Sleep -Milliseconds 500
        $waited++
    }

    return @{ stopped = $false; error = "Proses $Label (PID $TargetPid) masih aktif setelah 5 detik." }
}

$OverallExitCode = 0

# 1. Shutdown aman server web Laravel milik MFMS
if (-not (Test-Path $LaravelStateFile)) {
    Write-Host "[INFO] Tidak ada file status kepemilikan MFMS (mfms_laravel.state.json)." -ForegroundColor Gray
    try {
        $conns = Get-NetTCPConnection -LocalPort $LaravelPort -State Listen -ErrorAction SilentlyContinue
        if ($conns) {
            $otherPids = ($conns | Select-Object -ExpandProperty OwningProcess -Unique) -join ', '
            Write-Host "[PERINGATAN] Port $LaravelPort sedang digunakan oleh proses lain (PID: $otherPids) yang BUKAN milik startup MFMS." -ForegroundColor Yellow
            Write-Host "             Proses tersebut TIDAK dihentikan." -ForegroundColor Yellow
        }
    } catch {}
} else {
    $State = $null
    try {
        $State = Get-Content -Path $LaravelStateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        Write-Host "[GAGAL] File status $LaravelStateFile rusak dan tidak dapat dibaca. Tidak ada proses yang dihentikan." -ForegroundColor Red
        $OverallExitCode = 1
    }

    if ($State) {
        if ($State.project_root -ne $ProjectRoot -or $State.managed_by -ne 'mfms-start') {
            Write-Host "[PERINGATAN] Kepemilikan state file tidak cocok dengan $ProjectRoot. Tidak ada proses yang dihentikan." -ForegroundColor Yellow
        } else {
            $StoppedAny = $false
            $HadStale = $false
            $ShutdownFailed = $false

            $Candidates = @()
            if ($State.listener) { $Candidates += @{ label = 'Listener Laravel MFMS'; meta = $State.listener } }
            if ($State.parent -and (-not $State.listener -or $State.parent.pid -ne $State.listener.pid)) {
                $Candidates += @{ label = 'Parent Artisan Serve MFMS'; meta = $State.parent }
            }

            foreach ($cand in $Candidates) {
                $cmdPattern = "127\.0\.0\.1:$LaravelPort|artisan\s+serve|$([regex]::Escape($ProjectRoot))"
                $check = Test-ProcessMatchesMetadata -RecordedMeta $cand.meta -ExpectedExePattern 'php\.exe$' -ExpectedCmdPattern $cmdPattern

                if ($check.match) {
                    $res = Stop-VerifiedProcess -TargetPid $check.pid -Label $cand.label
                    if ($res.stopped) {
                        Write-Host "[OK] $($cand.label) (PID $($check.pid)) terverifikasi berhenti." -ForegroundColor Green
                        $StoppedAny = $true
                    } else {
                        Write-Host "[GAGAL] Gagal menghentikan $($cand.label) (PID $($check.pid)): $($res.error)" -ForegroundColor Red
                        $ShutdownFailed = $true
                        $OverallExitCode = 1
                    }
                } elseif ($check.reason -ne 'not_running') {
                    Write-Host "[PERINGATAN] $($cand.label) (PID $($cand.meta.pid)) dilewati karena identitas tidak cocok/stale ($($check.reason)). Tidak ada proses yang dihentikan." -ForegroundColor Yellow
                    $HadStale = $true
                }
            }

            if (-not $ShutdownFailed) {
                Remove-Item -Path $LaravelStateFile -Force -ErrorAction SilentlyContinue
                if (-not $StoppedAny -and -not $HadStale) {
                    Write-Host "[INFO] Proses MFMS sudah tidak aktif sebelumnya. State dibersihkan." -ForegroundColor Gray
                }
            }
        }
    }
}

# 2. Penanganan MariaDB (TANPA kill paksa mysqld.exe!)
if (Test-Path $MysqlStateFile) {
    $MysqlState = $null
    try {
        $MysqlState = Get-Content -Path $MysqlStateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {}

    if ($MysqlState -and $MysqlState.managed_by -eq 'mfms-start') {
        $mysqlCheck = Test-ProcessMatchesMetadata -RecordedMeta $MysqlState -ExpectedExePattern 'mysqld\.exe$' -ExpectedCmdPattern 'my\.ini'
        if ($mysqlCheck.match) {
            $XamppDirs = @('D:\xampp', 'C:\xampp')
            $MysqlAdmin = $null
            foreach ($dir in $XamppDirs) {
                if (Test-Path "$dir\mysql\bin\mysqladmin.exe") {
                    $MysqlAdmin = "$dir\mysql\bin\mysqladmin.exe"
                    break
                }
            }

            if ($MysqlAdmin) {
                Write-Host "[INFO] Mengirim sinyal shutdown aman ke MariaDB (mysqladmin)..." -ForegroundColor Cyan
                & $MysqlAdmin --host=127.0.0.1 --port=3307 shutdown 2>$null | Out-Null

                $waitedDb = 0
                while ($waitedDb -lt 10 -and (Get-Process -Id $mysqlCheck.pid -ErrorAction SilentlyContinue)) {
                    Start-Sleep -Seconds 1
                    $waitedDb++
                }

                if (-not (Get-Process -Id $mysqlCheck.pid -ErrorAction SilentlyContinue)) {
                    Write-Host "[OK] MariaDB (PID $($mysqlCheck.pid)) berhenti dengan aman." -ForegroundColor Green
                    Remove-Item -Path $MysqlStateFile -Force -ErrorAction SilentlyContinue
                } else {
                    Write-Host "[PERINGATAN] MariaDB belum berhenti otomatis lewat mysqladmin (tidak dilakukan kill paksa demi integritas data)." -ForegroundColor Yellow
                    Write-Host "             Gunakan tombol 'Stop' pada modul MySQL di XAMPP Control Panel." -ForegroundColor Yellow
                }
            } else {
                Write-Host "[PERINGATAN] mysqladmin.exe tidak ditemukan. Hentikan MySQL secara aman lewat XAMPP Control Panel." -ForegroundColor Yellow
            }
        } else {
            Write-Host "[INFO] File status MariaDB stale/tidak cocok ($($mysqlCheck.reason)). MariaDB eksternal dibiarkan tetap berjalan." -ForegroundColor Gray
            Remove-Item -Path $MysqlStateFile -Force -ErrorAction SilentlyContinue
        }
    }
} else {
    Write-Host "[INFO] MariaDB dikelola oleh XAMPP Control Panel (tidak dijalankan oleh skrip MFMS)." -ForegroundColor Gray
    Write-Host "       MariaDB dibiarkan tetap aktif. Untuk mematikannya secara aman," -ForegroundColor Gray
    Write-Host "       klik tombol 'Stop' pada MySQL di XAMPP Control Panel." -ForegroundColor Gray
}

Write-Host ""
if ($OverallExitCode -eq 0) {
    Write-Host "Shutdown selesai." -ForegroundColor White
} else {
    Write-Host "Shutdown selesai dengan PERINGATAN/GAGAL. Periksa pesan di atas." -ForegroundColor Red
}

exit $OverallExitCode
