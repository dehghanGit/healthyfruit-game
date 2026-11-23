@echo off
chcp 65001 > nul
cd /d "%~dp0"
python -c "import flask, waitress" >nul 2>&1
if errorlevel 1 (
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        pause
        exit /b 1
    )
)
if not defined PORT set PORT=8080
title نبرد سلامت - سرور و بازی
echo ==================================================
echo   ⚔️ نبرد سلامت | Health Battle Ninja Game 🍉
echo ==================================================
echo در حال راه‌اندازی سرور پایتون و باز کردن بازی در مرورگر...
start "" http://localhost:%PORT%
python server.py
pause
