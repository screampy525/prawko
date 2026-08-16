#!/usr/bin/env bash
# Scala multimedia z dwóch folderów źródłowych do jednego folderu media/.
# Zdjęcia kopiuje 1:1, filmy WMV konwertuje do MP4 (H.264) — WMV nie działa w przeglądarkach.
# Skrypt jest idempotentny: pomija pliki, które już są w media/.
set -u

# Katalog projektu liczony od położenia skryptu - działa niezależnie od tego,
# skąd go uruchomisz i na jakim systemie.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MEDIA="$ROOT/media"
JOBS=10
CRF=24

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Nie znaleziono ffmpeg w PATH." >&2
  echo "  macOS:   brew install ffmpeg" >&2
  echo "  Windows: winget install Gyan.FFmpeg  (potem otwórz nowy terminal)" >&2
  echo "  Linux:   sudo apt install ffmpeg" >&2
  exit 1
fi

mkdir -p "$MEDIA"

# --- zdjęcia ---
find "$ROOT/multimedia do pytań" "$ROOT/cz. 2" -maxdepth 1 -type f \
  \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -print0 |
while IFS= read -r -d '' f; do
  out="$MEDIA/$(basename "$f")"
  [ -f "$out" ] || cp -p "$f" "$out"
done
echo "zdjęcia gotowe: $(find "$MEDIA" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | wc -l)"

# --- filmy ---
find "$ROOT/multimedia do pytań" "$ROOT/cz. 2" -maxdepth 1 -type f -iname '*.wmv' -print0 |
  xargs -0 -P "$JOBS" -I{} bash -c '
    f="$1"; out="$2/$(basename "${f%.*}").mp4"
    if [ -s "$out" ]; then exit 0; fi
    ffmpeg -y -v error -i "$f" -c:v libx264 -preset medium -crf '"$CRF"' \
      -pix_fmt yuv420p -movflags +faststart -an "$out" || echo "BLAD: $f" >&2
  ' _ {} "$MEDIA"

echo "filmy gotowe: $(find "$MEDIA" -maxdepth 1 -type f -iname '*.mp4' | wc -l)"
du -sh "$MEDIA"
