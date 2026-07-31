@echo off
title Mplace API - http://127.0.0.1:3000
cd /d "%~dp0apps\api"

set PORT=3000
set FRONTEND_DIR=%~dp0
if "%FRONTEND_DIR:~-1%"=="\" set FRONTEND_DIR=%FRONTEND_DIR:~0,-1%
set SERVE_FRONTEND=true
set CORS_ORIGINS=*
set NODE_ENV=production

echo.
echo  ============================================
echo   Mplace API
echo   Site:  http://127.0.0.1:3000/
echo   Login: http://127.0.0.1:3000/login.html
echo.
echo   DO NOT CLOSE THIS WINDOW
echo  ============================================
echo.

if not exist "dist\src\main.js" (
  echo Building API...
  call npm run build
  if errorlevel 1 (
    echo BUILD FAILED
    pause
    exit /b 1
  )
)

:loop
echo Starting at %date% %time% ...
node dist\src\main.js
echo.
echo Server stopped with code %ERRORLEVEL%. Restart in 3 sec...
timeout /t 3 /nobreak >nul
goto loop
