#!/usr/bin/env bash
# Wyciąga z każdego filmu jedną klatkę do wydruku arkusza egzaminacyjnego
# (na papierze filmu nie da się odtworzyć) i jako plakat przed odtworzeniem.
# Klatka pochodzi z 92% długości: rozstrzygający moment sytuacji drogowej jest
# niemal zawsze na końcu ujęcia. Nie z samego końca, bo ostatnie klatki bywają
# przyciemnione albo rozmyte.
set -u

# Katalog projektu liczony od położenia skryptu - działa niezależnie od tego,
# skąd go uruchomisz i na jakim systemie.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MEDIA="$ROOT/media"
KLATKI="$MEDIA/klatki"
JOBS=10

if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  echo "Nie znaleziono ffmpeg/ffprobe w PATH." >&2
  echo "  macOS:   brew install ffmpeg" >&2
  echo "  Windows: winget install Gyan.FFmpeg  (potem otwórz nowy terminal)" >&2
  echo "  Linux:   sudo apt install ffmpeg" >&2
  exit 1
fi

mkdir -p "$KLATKI"

find "$MEDIA" -maxdepth 1 -type f -iname '*.mp4' -print0 |
  xargs -0 -P "$JOBS" -I{} bash -c '
    f="$1"; nazwa=$(basename "${f%.*}"); out="$2/$nazwa.jpg"
    if [ -s "$out" ]; then exit 0; fi
    czas=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
    moment=$(awk -v d="$czas" "BEGIN{printf \"%.2f\", (d>0 ? d*0.92 : 0)}")
    ffmpeg -y -v error -ss "$moment" -i "$f" -frames:v 1 \
      -vf "scale=800:-2" -q:v 4 "$out" || echo "BLAD: $f" >&2
  ' _ {} "$KLATKI"

echo "klatki gotowe: $(find "$KLATKI" -type f -iname '*.jpg' | wc -l)"
du -sh "$KLATKI"
