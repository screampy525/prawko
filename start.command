#!/usr/bin/env bash
# Uruchamia Prawko na macOS i Linuksie. Odpowiednik START.bat z Windowsa.
#
# Na macOS wystarczy kliknąć dwukrotnie w Finderze. Jeśli system odmówi
# uruchomienia, nadaj plikowi prawo wykonywania jeden raz:
#   chmod +x start.command
set -u

cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1

blad() {
  echo
  echo "  $1"
  echo
  # Okno Findera zamyka się natychmiast po błędzie - bez tego nie zdążysz nic przeczytać.
  [ -t 0 ] && read -r -p "  Naciśnij Enter, żeby zamknąć. " _
  exit 1
}

# --- Node ---
if ! command -v node >/dev/null 2>&1; then
  blad "Nie znaleziono Node.js. Pobierz go z https://nodejs.org (wersja 22 lub nowsza) i uruchom ten plik ponownie."
fi

# Aplikacja trzyma dane w SQLite wbudowanym w Node (moduł node:sqlite).
# Starsze wersje Node go nie mają - lepiej powiedzieć to wprost niż wysypać się później.
if ! node -e 'require("node:sqlite")' >/dev/null 2>&1; then
  blad "Twoja wersja Node.js ($(node -v)) nie ma modułu node:sqlite. Zaktualizuj Node do wersji 22 lub nowszej: https://nodejs.org"
fi

# --- baza pytań ---
if [ ! -f "app/data/pytania.json" ]; then
  echo
  echo "  Brak bazy pytań - buduję ją z pliku XLSX..."
  echo
  if command -v python3 >/dev/null 2>&1; then
    PY=python3
  elif command -v python >/dev/null 2>&1; then
    PY=python
  else
    blad "Nie znaleziono Pythona. Zainstaluj go (macOS: brew install python) i uruchom ten plik ponownie."
  fi
  if ! "$PY" -c 'import openpyxl' >/dev/null 2>&1; then
    blad "Brakuje biblioteki openpyxl. Zainstaluj ją poleceniem: $PY -m pip install openpyxl"
  fi
  "$PY" narzedzia/zbuduj-baze.py || blad "Nie udało się zbudować bazy pytań."
fi

# --- przeglądarka ---
PORT="${PORT:-8080}"
if command -v open >/dev/null 2>&1; then
  PRZEGLADARKA=open          # macOS
elif command -v xdg-open >/dev/null 2>&1; then
  PRZEGLADARKA=xdg-open      # Linux
else
  PRZEGLADARKA=
fi
if [ -n "$PRZEGLADARKA" ]; then
  # Chwila zwłoki, żeby serwer zdążył zająć port, zanim przeglądarka zapuka.
  ( sleep 1; "$PRZEGLADARKA" "http://localhost:$PORT" >/dev/null 2>&1 ) &
fi

exec node app/serwer.js
