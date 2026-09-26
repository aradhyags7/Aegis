@echo off
title Aegis Launcher
echo ========================================================
echo           STARTING AEGIS AI DESKTOP ASSISTANT
echo ========================================================

:: 1. Start Ollama in the background if not already running
echo [*] Checking Ollama service...
tasklist /fi "imagename eq ollama.exe" 2>NUL | find /i /n "ollama.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [✓] Ollama is already running.
) else (
    echo [*] Starting Ollama...
    start "" /b ollama serve
)

:: 2. Start FastAPI Backend in a new window
echo [*] Starting FastAPI Backend on port 8000...
start "Aegis Backend" cmd /k "cd /d "%~dp0backend" && venv\Scripts\activate && uvicorn main:app --port 8000"

:: Brief pause to let backend initialize
timeout /t 3 /nobreak >nul

:: 3. Start Electron Desktop HUD
echo [*] Launching Aegis Desktop App...
start "Aegis Frontend" cmd /k "cd /d "%~dp0frontend" && npm start"

echo.
echo [✓] All Aegis services have been launched!
timeout /t 4 >nul
exit
