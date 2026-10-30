@echo off
title AI Mentor Launcher

echo =====================================
echo       AI Mentor 1.0
echo =====================================
echo.

echo Starting AI Mentor backend...
start "AI Mentor Backend" cmd /k "cd /d E:\ai-mentor && start-backend.bat"

timeout /t 3 /nobreak >nul

echo Opening AI Mentor frontend...
start "" "E:\ai-mentor\frontend\index.html"

echo.
echo AI Mentor launcher finished.
echo Keep the backend terminal open while using the app.
pause