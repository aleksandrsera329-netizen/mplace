@echo off
cd /d C:\Users\sasha\mplace\apps\api
set PORT=3000
set FRONTEND_DIR=C:\Users\sasha\mplace
set SERVE_FRONTEND=true
set CORS_ORIGINS=*
echo Starting Mplace on http://127.0.0.1:3000 ...
if not exist dist\src\main.js (
  call npm run build
)
node dist\src\main.js
pause
