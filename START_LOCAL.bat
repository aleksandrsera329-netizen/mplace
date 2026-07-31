@echo off
title Start Mplace
echo Starting Mplace local server...
start "Mplace API" cmd /k "C:\Users\sasha\mplace\tools\run-api.cmd"
timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:3000/"
echo Browser opened. Keep the black window open.
pause
