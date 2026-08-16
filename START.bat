@echo off
title Prawko - serwer nauki
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Nie znaleziono Node.js. Pobierz go z https://nodejs.org i uruchom ten plik ponownie.
  echo.
  pause
  exit /b 1
)

if not exist "app\data\pytania.json" (
  echo.
  echo   Brak bazy pytan - buduje ja z pliku XLSX...
  echo.
  python narzedzia\zbuduj-baze.py
  if errorlevel 1 (
    echo.
    echo   Nie udalo sie zbudowac bazy pytan.
    pause
    exit /b 1
  )
)

start "" http://localhost:8080
node app\serwer.js
pause
