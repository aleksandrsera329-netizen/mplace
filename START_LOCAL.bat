@echo off
title Start Mplace
cd /d "%~dp0"

echo Stopping old node on port 3000 if any...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%p >nul 2>&1
)

echo Starting Mplace server...
start "Mplace API" cmd /k "%~dp0RUN_API.cmd"

echo Waiting for server...
set /a n=0
:wait
set /a n+=1
if %n% gtr 20 goto open
powershell -NoProfile -Command "try { (Invoke-WebRequest http://127.0.0.1:3000/api/health -UseBasicParsing -TimeoutSec 1).StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  timeout /t 1 /nobreak >nul
  goto wait
)

:open
echo Opening browser...
start "" "http://127.0.0.1:3000/"
echo.
echo Site is running at http://127.0.0.1:3000/
echo Keep the black "Mplace API" window open.
echo.
pause
