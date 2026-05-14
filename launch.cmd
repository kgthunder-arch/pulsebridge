@echo off
setlocal
cd /d "%~dp0"
echo Building PulseBridge...
call "C:\Program Files\nodejs\npm.cmd" run build
if errorlevel 1 goto :fail

echo Starting PulseBridge...
call "C:\Program Files\nodejs\node.exe" scripts\start-local-server.mjs
if errorlevel 1 goto :fail

echo.
echo PulseBridge is opening in your browser.
pause
goto :eof

:fail
echo.
echo PulseBridge failed to start. Check .pulsebridge\server.out.log and .pulsebridge\server.err.log
pause
