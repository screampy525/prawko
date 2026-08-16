# -*- coding: utf-8 -*-
"""Składa katalog znaków drogowych w app/data/znaki.json.

Łączy trzy rzeczy:
  * narzedzia/znaki-nazwy.json  - kody i oficjalne nazwy z rozporządzenia,
  * narzedzia/znaki-opisy.py    - definicje pisane na potrzeby tej aplikacji,
  * media/znaki/*.png           - rysunki pobrane skryptem pobierz-znaki.py.

Uruchomienie:  python narzedzia/zbuduj-znaki.py
"""
import json
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'narzedzia'))

NAZWY = os.path.join(ROOT, 'narzedzia', 'znaki-nazwy.json')
RYSUNKI = os.path.join(ROOT, 'media', 'znaki')
OUT = os.path.join(ROOT, 'app', 'data', 'znaki.json')

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def wymiary_png(sciezka):
    """Szerokość i wysokość z nagłówka IHDR - bez wczytywania całego obrazka."""
    try:
        with open(sciezka, 'rb') as fh:
            fh.read(16)  # sygnatura PNG + długość i typ pierwszego chunku
            szer, wys = struct.unpack('>II', fh.read(8))
        return szer, wys
    except Exception:  # noqa: BLE001 - brak wymiarów to nie powód, żeby przerywać budowę
        return None, None


def main():
    # Plik z opisami ma myślnik w nazwie, więc wczytujemy go po ścieżce.
    import importlib.util
    sciezka = os.path.join(ROOT, 'narzedzia', 'znaki-opisy.py')
    spec = importlib.util.spec_from_file_location('znaki_opisy', sciezka)
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)

    with open(NAZWY, encoding='utf-8') as fh:
        nazwy = json.load(fh)

    rysunki = set(os.listdir(RYSUNKI)) if os.path.isdir(RYSUNKI) else set()

    znaki = []
    bez_opisu, bez_rysunku = [], []
    for kod, dane in nazwy.items():
        grupa = kod.split('-')[0]
        opis = modul.OPISY.get(kod)
        if not opis:
            bez_opisu.append(kod)
        plik = kod + '.png'
        if plik not in rysunki:
            bez_rysunku.append(kod)
            plik = None
        znak = {
            'kod': kod,
            'nazwa': dane['nazwa'],
            'grupa': grupa,
            'opis': opis or '',
            'rysunek': plik,
        }
        # Proporcje znaku zapisujemy do pliku, bo interfejs musi je znać zanim
        # obrazek się wczyta. Tablice bywają skrajnie szerokie (D-42 to 500x222),
        # a niektóre znaki wysokie (B-39 to 500x722) - jedna ramka nie mieści obu.
        if plik:
            szer, wys = wymiary_png(os.path.join(RYSUNKI, plik))
            if szer and wys:
                znak['szer'], znak['wys'] = szer, wys
        znaki.append(znak)

    # Opisy dla kodów, których nie ma w katalogu nazw - sygnał, że coś się rozjechało.
    nadmiarowe = sorted(set(modul.OPISY) - set(nazwy))

    grupy = []
    for kod, dane in modul.GRUPY.items():
        grupy.append({
            'kod': kod,
            'nazwa': dane['nazwa'],
            'ksztalt': dane['ksztalt'],
            'zasada': dane['zasada'],
            'ile': sum(1 for z in znaki if z['grupa'] == kod),
        })

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump({'grupy': grupy, 'znaki': znaki}, fh, ensure_ascii=False, separators=(',', ':'))

    print(f'zapisano {len(znaki)} znaków w {len(grupy)} grupach -> {OUT}')
    print(f'rozmiar: {os.path.getsize(OUT) / 1024:.0f} kB')
    for g in grupy:
        print(f"  {g['kod']:2} {g['nazwa']:34} {g['ile']:3}")
    if bez_opisu:
        print(f'\nBEZ OPISU ({len(bez_opisu)}): ' + ' '.join(bez_opisu))
    if bez_rysunku:
        print(f'\nBEZ RYSUNKU ({len(bez_rysunku)}): ' + ' '.join(bez_rysunku))
        print('Uruchom: python narzedzia/pobierz-znaki.py')
    if nadmiarowe:
        print(f'\nOPISY BEZ ZNAKU ({len(nadmiarowe)}): ' + ' '.join(nadmiarowe))
    if not (bez_opisu or bez_rysunku or nadmiarowe):
        print('\nKomplet: każdy znak ma nazwę, opis i rysunek.')


if __name__ == '__main__':
    sys.exit(main())
