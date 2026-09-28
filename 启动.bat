@echo off
title YINGZAO Launcher
cd /d "%~dp0"

:menu
cls
echo ==================================================
echo    YINGZAO  -  Digital Building System
echo    (Song Dynasty Dou-Gong and Joinery System)
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js not found.
  echo.
  echo  Please install Node.js LTS first: https://nodejs.org/
  echo  Then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo  [FIRST RUN] Installing dependencies, please wait...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [ERROR] npm install failed. Check your network and retry.
    pause
    exit /b 1
  )
  echo.
  echo  Dependencies installed.
  echo.
)

echo  Choose a mode (type a number, then press Enter):
echo.
echo    [1] DEMO mode     build + start  (closest to online version)
echo                      use for: presentation, video recording
echo.
echo    [2] DEV mode      hot reload
echo                      use for: further development
echo.
echo    [3] OFFLINE mode  start existing build, no network needed
echo                      use for: on-site defense (no internet)
echo.
echo    [4] Exit
echo.
set /p choice=  Your choice: 

if "%choice%"=="1" goto demo
if "%choice%"=="2" goto dev
if "%choice%"=="3" goto offline
if "%choice%"=="4" exit /b 0
echo.
echo  Invalid input, try again.
timeout /t 2 >nul
goto menu

:demo
echo.
echo  [DEMO] Building production version...
call npm run build
if errorlevel 1 (
  echo.
  echo  [ERROR] Build failed.
  pause
  exit /b 1
)
echo.
echo  Build OK. Starting local server, browser will open automatically...
echo  (Close this window to stop the server)
echo.
call npm run preview -- --port 4173 --open
goto end

:dev
echo.
echo  [DEV] Starting dev server, browser will open automatically...
echo  (Close this window to stop the server)
echo.
call npm run dev -- --open
goto end

:offline
if not exist "dist" (
  echo.
  echo  [INFO] No build found. Building once first...
  call npm run build
  if errorlevel 1 (
    echo.
    echo  [ERROR] Build failed.
    pause
    exit /b 1
  )
)
echo.
echo  [OFFLINE] Starting local server from existing build...
echo  (No network needed; close this window to stop)
echo.
call npm run preview -- --port 4173 --open
goto end

:end
echo.
echo  Server stopped.
pause
exit /b 0
