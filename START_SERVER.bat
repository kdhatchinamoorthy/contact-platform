echo @echo off
title ContactHub Intelligence - Launcher
color 0B
echo.
echo  =========================================
echo   ContactHub Intelligence Platform
echo   Starting local server on port 8080...
echo  =========================================
echo.
echo  Opening in browser: http://localhost:8080
echo  Press Ctrl+C in the PowerShell window to stop.
echo.
powershell.exe -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
