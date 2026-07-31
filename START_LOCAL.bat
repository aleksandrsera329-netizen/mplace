@echo off
title Start Mplace
echo Starting Mplace local server...
start "Mplace API" cmd /k "C:\Users\sasha\mplace\RUN_API.cmd"
timeout /t 5 /nobreak >nul
start "" "http://127.0.0.1:3000/"
echo.
echo Site:  http://127.0.0.1:3000/
echo Login: http://127.0.0.1:3000/login.html
echo.
echo IMPORTANT: do not close the black window "Mplace API"
echo.
pause
