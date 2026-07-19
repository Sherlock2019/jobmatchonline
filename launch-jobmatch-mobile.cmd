@echo off
title JobMatch Mobile Preview
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-mobile-windows.ps1"
if errorlevel 1 pause
