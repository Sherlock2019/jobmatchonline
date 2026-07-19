@echo off
title JobsMatchNow Expo Mobile Preview
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-expo-windows.ps1"
if errorlevel 1 pause
