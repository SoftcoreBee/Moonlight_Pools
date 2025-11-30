# Launcher for Moonlight application (designed to run from publish directory)
param(
    [string]$Port = "5000",
    [string]$SecurePort = "5001",
    [switch]$NoWait = $false
)

# Check if we're in the right directory by looking for the main files
if (-not (Test-Path "Moonlight.exe") -and -not (Test-Path "Moonlight.dll")) {
    Write-Host "Error: Moonlight application files not found in current directory." -ForegroundColor Red
    Write-Host "Make sure this launcher is in the publish folder with the application." -ForegroundColor Red
    if (-not $NoWait) { Read-Host "Press Enter to exit" }
    exit 1
}

Write-Host "Starting Moonlight application..." -ForegroundColor Green

try {
    # Set environment variables for browser launch
    $env:LAUNCH_BROWSER = "true"
    $env:ASPNETCORE_URLS = "https://localhost:$SecurePort;http://localhost:$Port"
    $env:ASPNETCORE_ENVIRONMENT = "Production"
    
    Write-Host "Server starting on https://localhost:$SecurePort and http://localhost:$Port" -ForegroundColor Cyan
    Write-Host "Browser will auto-launch..." -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
    Write-Host ""
    
    # Start the application (we're already in the publish directory)
    if (Test-Path "Moonlight.exe") {
        & .\Moonlight.exe
    } else {
        dotnet .\Moonlight.dll
    }
}
catch {
    Write-Host "Error starting application: $($_.Exception.Message)" -ForegroundColor Red
    if (-not $NoWait) { Read-Host "Press Enter to exit" }
}
finally {
    Write-Host ""
    Write-Host "Application stopped." -ForegroundColor Yellow
    if (-not $NoWait) { Read-Host "Press Enter to close this window" }
}