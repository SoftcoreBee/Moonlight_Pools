@echo off
title Moonlight - Published Application Launcher

echo Starting Moonlight application...

REM Check if we're in the publish directory by looking for the main executable
if not exist "Moonlight.exe" (
    if not exist "Moonlight.dll" (
        echo Error: Moonlight application files not found in current directory.
        echo Make sure this launcher is in the publish folder with the application.
        pause
        exit /b 1
    )
)

REM Set environment variables for browser launch
set LAUNCH_BROWSER=true
set ASPNETCORE_URLS=https://localhost:5001;http://localhost:5000
set ASPNETCORE_ENVIRONMENT=Production

echo Server starting on https://localhost:5001 and http://localhost:5000
echo Browser will auto-launch...
echo Press Ctrl+C to stop the server
echo.

REM Start the application (we're already in the publish directory)
if exist Moonlight.exe (
    echo Starting Moonlight.exe...
    Moonlight.exe
) else (
    echo Starting with dotnet...
    dotnet Moonlight.dll
)

echo.
echo Application stopped.
pause