@echo off
title Mplace API - http://127.0.0.1:3000
cd /d "%~dp0apps\api"
set PORT=3000
set FRONTEND_DIR=%~dp0
set FRONTEND_DIR=%FRONTEND_DIR:~0,-1%
set SERVE_FRONTEND=true
set CORS_ORIGINS=*
set NODE_ENV=production
echo.
echo  ============================================
echo   Mplace API
echo   Open:  http://127.0.0.1:3000/
echo   Login: http://127.0.0.1:3000/login.html
echo   DO NOT CLOSE THIS WINDOW
echo  ============================================
echo.
if not exist "dist\src\main.js" (
  echo Building API...
  call npm run build
)
node dist\src\main.js
echo.
echo Server stopped.
pause
