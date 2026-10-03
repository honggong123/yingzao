@echo off
title 营造 · 数字营造系统 启动器
cd /d "%~dp0"

:menu
cls
echo ==================================================
echo    营造 · 数字营造系统  启动器
echo    宋《营造法式》斗栱榫卯数字营造系统
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [错误] 未检测到 Node.js
  echo.
  echo  请先安装 Node.js LTS 版本：https://nodejs.org/
  echo  安装后重新双击本文件即可。
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo  [首次运行] 正在安装依赖，可能需要几分钟，请稍候...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [错误] 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
  echo.
  echo  依赖安装完成。
  echo.
)

echo  请选择启动模式——输入数字后回车：
echo.
echo    [1] 演示模式   构建生产版本并启动，最接近线上效果
echo                   适合：答辩演示、录制视频、给别人看
echo.
echo    [2] 开发模式   带热更新，改代码即时生效
echo                   适合：继续开发、修改作品
echo.
echo    [3] 离线模式   直接用已构建的版本启动，无需联网
echo                   适合：现场答辩——无网环境
echo.
echo    [4] 退出
echo.
set /p choice=  请输入并回车：

if "%choice%"=="1" goto demo
if "%choice%"=="2" goto dev
if "%choice%"=="3" goto offline
if "%choice%"=="4" exit /b 0
echo.
echo  输入无效，请重新选择。
timeout /t 2 >nul
goto menu

:demo
echo.
echo  [演示模式] 正在构建生产版本...
call npm run build
if errorlevel 1 (
  echo.
  echo  [错误] 构建失败，请截图反馈错误信息。
  pause
  exit /b 1
)
echo.
echo  构建完成。正在启动本地服务，浏览器将自动打开...
echo  关闭本窗口即停止服务。
echo.
call npm run preview -- --port 4173 --open
goto end

:dev
echo.
echo  [开发模式] 正在启动开发服务器，浏览器将自动打开...
echo  关闭本窗口即停止服务。
echo.
call npm run dev -- --open
goto end

:offline
if not exist "dist" (
  echo.
  echo  [提示] 尚未构建过，先执行一次构建...
  call npm run build
  if errorlevel 1 (
    echo.
    echo  [错误] 构建失败。
    pause
    exit /b 1
  )
)
echo.
echo  [离线模式] 正在用本地服务启动，浏览器将自动打开...
echo  无需联网；关闭本窗口即停止服务。
echo.
call npm run preview -- --port 4173 --open
goto end

:end
echo.
echo  服务已停止。
pause
exit /b 0
