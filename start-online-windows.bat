@echo off
setlocal
cd /d "%~dp0"
title semaG - Internet game host

if not exist "%~dp0tools\start-online-windows.ps1" (
  echo The online launcher is missing. Extract the complete semaG PC download first.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start-online-windows.ps1"
set "semagExit=%errorlevel%"
if not "%semagExit%"=="0" pause
exit /b %semagExit%
