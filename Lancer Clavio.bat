@echo off
title Clavio - serveur local
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "serveur.ps1"
