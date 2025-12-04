# FocusWise APK Build Script
# This script helps you build the APK after setting up Java 11+

Write-Host "FocusWise APK Build Script" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Check Java version
Write-Host "Checking Java version..." -ForegroundColor Yellow
$javaVersion = java -version 2>&1 | Select-String "version"
Write-Host $javaVersion

$javaVersionNumber = [regex]::Match($javaVersion, 'version "(\d+)').Groups[1].Value
if ([int]$javaVersionNumber -lt 11) {
    Write-Host ""
    Write-Host "ERROR: Java 11 or higher is required!" -ForegroundColor Red
    Write-Host "Current version: Java $javaVersionNumber" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Java 11+ from:" -ForegroundColor Yellow
    Write-Host "  https://adoptium.net/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "After installing, set JAVA_HOME environment variable:" -ForegroundColor Yellow
    Write-Host "  1. Open System Properties > Environment Variables" -ForegroundColor White
    Write-Host "  2. Add JAVA_HOME = C:\Program Files\Java\jdk-11" -ForegroundColor White
    Write-Host "  3. Add %JAVA_HOME%\bin to PATH" -ForegroundColor White
    Write-Host "  4. Restart this terminal" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Java version OK!" -ForegroundColor Green
Write-Host ""

# Navigate to android directory
Write-Host "Building APK..." -ForegroundColor Yellow
Set-Location android

# Build debug APK
Write-Host "Building debug APK..." -ForegroundColor Cyan
.\gradlew assembleDebug

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS! APK built successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK Location:" -ForegroundColor Cyan
    Write-Host "  android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor White
    Write-Host ""
    Write-Host "To build release APK, run:" -ForegroundColor Yellow
    Write-Host "  .\gradlew assembleRelease" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Build failed. Check the error messages above." -ForegroundColor Red
}

Set-Location ..

