# ============================================================
#  run-android.ps1 — One-click Pakyaw launcher
#  Run from the project root: .\run-android.ps1
# ============================================================

# Set correct Java / Android environment
$env:JAVA_HOME   = "C:\Program Files\Android\Android Studio3\jbr"
$env:PATH        = "C:\Program Files\Android\Android Studio3\jbr\bin;" + $env:PATH
$env:ANDROID_HOME = "C:\Users\gabri\AppData\Local\Android\Sdk"

Write-Host ""
Write-Host "=== Pakyaw Android Launcher ===" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Make sure an emulator / device is running ──────
$deviceLine = (adb devices) | Where-Object { $_ -match "\bdevice\b" -and $_ -notmatch "List of" }
if (-not $deviceLine) {
    Write-Host "[1/3] No device found. Starting Pixel_4a emulator..." -ForegroundColor Yellow
    Start-Process -FilePath "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" `
                  -ArgumentList "-avd", "Pixel_4a" -WindowStyle Hidden
    Write-Host "      Waiting for emulator to boot (this can take ~60 s)..." -ForegroundColor Yellow
    adb wait-for-device
    # Extra wait for boot to complete
    $bootComplete = ""
    while ($bootComplete -ne "1") {
        Start-Sleep -Seconds 3
        $bootComplete = (adb shell getprop sys.boot_completed 2>$null).Trim()
    }
    Write-Host "[1/3] Emulator is ready!" -ForegroundColor Green
} else {
    Write-Host "[1/3] Device ready: $($deviceLine.Trim())" -ForegroundColor Green
}

# ── Step 2: Forward Metro port from emulator → host ────────
Write-Host "[2/3] Setting up network (adb reverse)..." -ForegroundColor Yellow
adb reverse tcp:8081 tcp:8081 | Out-Null
Write-Host "[2/3] Done. Emulator will find Metro at localhost:8081" -ForegroundColor Green

# ── Step 3: Build + install + launch ───────────────────────
Write-Host "[3/3] Building and launching app (npm run android)..." -ForegroundColor Yellow
Write-Host "      (First run takes longer — subsequent runs are fast)" -ForegroundColor Gray
Write-Host ""
npm run android
