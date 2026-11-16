@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 24 LTS, then reopen this file.
  echo https://nodejs.org/
  pause
  exit /b 1
)
node scripts/start-admin.mjs
if errorlevel 1 pause
endlocal
