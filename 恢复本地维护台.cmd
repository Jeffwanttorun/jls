@echo off
if "%~1"=="" (
 echo Please drag your full.zip backup onto this file.
 pause
 exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0outputs\wuyishan-map-phase1\scripts\restore-local.ps1" -BackupPath "%~1"
pause
