@echo off
setlocal
cd /d "%~dp0"
call "C:\Program Files\nodejs\node.exe" scripts\start-local-server.mjs
if errorlevel 1 (
  echo.
  echo PulseBridge failed to start. Check .pulsebridge\server.out.log and .pulsebridge\server.err.log
)
pause
