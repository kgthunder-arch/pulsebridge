@echo off
setlocal
cd /d "%~dp0"
call "C:\Program Files\nodejs\node.exe" scripts\stop-local-server.mjs
pause
