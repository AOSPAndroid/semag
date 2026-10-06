@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto missingnode
where npm >nul 2>nul
if errorlevel 1 goto missingnode
node -e "if (Number(process.versions.node.split('.')[0]) < 20) process.exit(1)"
if errorlevel 1 goto oldnode

if not exist "node_modules\ws\package.json" (
  call npm install
  if errorlevel 1 goto failed
)

echo Starting FIRESIDE on this PC...
call npm start
if errorlevel 1 goto failed
exit /b 0

:missingnode
echo Install Node.js 20 or newer from https://nodejs.org, then run this script again.
pause
exit /b 1

:oldnode
echo Node.js 20 or newer is required. Update Node.js, then run this script again.
pause
exit /b 1

:failed
echo The server could not start. Review the error above.
pause
exit /b 1
