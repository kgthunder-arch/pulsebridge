@echo off
setlocal
cd /d "%~dp0"

echo Checking PulseBridge status...
call "%~dp0serve.cmd"
