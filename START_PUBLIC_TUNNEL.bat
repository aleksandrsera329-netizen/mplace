@echo off
chcp 65001 >nul
cd /d C:\Users\sasha\mplace
echo [1/2] Starting Mplace on port 3000...
start "mplace-api" /MIN powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\sasha\mplace\apps\api\start-tunnel-server.ps1"
timeout /t 6 /nobreak >nul
echo [2/2] Starting public tunnel bore.pub ...
echo.
echo After start you will see: listening at bore.pub:PORT
echo Share link: http://bore.pub:PORT
echo.
"C:\Users\sasha\mplace\tools\bore.exe" local 3000 --to bore.pub
pause