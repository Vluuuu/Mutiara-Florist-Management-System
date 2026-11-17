@echo off
title Mutiara Florist Management System - Shutdown
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-mfms.ps1"
echo.
pause
