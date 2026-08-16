# -*- coding: utf-8 -*-
"""Pobiera rysunki znaków drogowych z Wikimedia Commons do media/znaki/.

Polskie znaki drogowe pochodzą z rozporządzenia, a materiały urzędowe nie są
w Polsce przedmiotem prawa autorskiego (art. 4 ustawy o prawie autorskim) -
dlatego te pliki wolno trzymać i wyświetlać lokalnie.

Pobieramy miniatury PNG, a nie oryginalne pliki SVG. Nie z lenistwa: przy
hurtowym sięganiu po oryginały Wikimedia odpowiada błędem 429 i w samej
treści błędu prosi, żeby korzystać z miniatur o standardowych szerokościach.
Szerokość 500 px wystarcza, bo znak i tak jest wyświetlany mniejszy.

Skrypt jest idempotentny: pobiera tylko brakujące pliki, więc można go
uruchamiać wielokrotnie i przerywać w dowolnym momencie.

    python narzedzia/pobierz-znaki.py            # pobiera brakujące
    python narzedzia/pobierz-znaki.py --od-nowa  # pobiera wszystko ponownie
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAZWY = os.path.join(ROOT, 'narzedzia', 'znaki-nazwy.json')
CEL = os.path.join(ROOT, 'media', 'znaki')

# Wikimedia wymaga nagłówka, który pozwala ich administratorom skojarzyć ruch
# z konkretnym narzędziem. Anonimowe pobieranie hurtowe bywa blokowane.
UA = 'prawko-nauka/1.0 (lokalna aplikacja do nauki na prawo jazdy)'
SZEROKOSC = 500  # px - jedna z dozwolonych szerokości miniatur
PRZERWA = 1.0    # sekundy między pobraniami; przy krótszej przerwie dostajemy 429

# Konsola Windows domyślnie nie jest UTF-8, a komunikaty mają polskie znaki.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def otworz(url, proby=5):
    """GET z ponawianiem. 429 oznacza tylko „zwolnij", nie „nie ma pliku"."""
    zadanie = urllib.request.Request(url, headers={'User-Agent': UA})
    for proba in range(proby):
        try:
            with urllib.request.urlopen(zadanie, timeout=30) as odp:
                return odp.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or proba == proby - 1:
                raise
            czekaj = int(e.headers.get('Retry-After') or 0) or 2 ** proba * 2
            time.sleep(czekaj)
    raise RuntimeError('nieosiągalne')


def adresy_miniatur(nazwy):
    """Pyta API Commons o adresy miniatur - po 50 plików na zapytanie."""
    mapa = {}
    for i in range(0, len(nazwy), 50):
        paczka = nazwy[i:i + 50]
        url = ('https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo'
               f'&iiprop=url&iiurlwidth={SZEROKOSC}&format=json&formatversion=2&titles='
               + urllib.parse.quote('|'.join('File:' + n for n in paczka)))
        odp = json.loads(otworz(url))
        for strona in odp.get('query', {}).get('pages', []):
            info = strona.get('imageinfo')
            if info and info[0].get('thumburl'):
                mapa[strona['title'].removeprefix('File:')] = info[0]['thumburl']
        print(f'  adresy: {len(mapa)}/{len(nazwy)}')
        time.sleep(1.0)
    return mapa


def pobierz(url, docelowy):
    dane = otworz(url)
    if len(dane) < 200:
        raise ValueError(f'podejrzanie mały plik ({len(dane)} B)')
    with open(docelowy, 'wb') as fh:
        fh.write(dane)
    return len(dane)


def main():
    ap = argparse.ArgumentParser(description='Pobiera rysunki znaków z Wikimedia Commons.')
    ap.add_argument('--od-nowa', action='store_true', help='pobierz też pliki, które już są')
    args = ap.parse_args()

    with open(NAZWY, encoding='utf-8') as fh:
        znaki = json.load(fh)

    os.makedirs(CEL, exist_ok=True)

    do_pobrania = []
    for kod, dane in znaki.items():
        if not dane.get('plik'):
            continue
        docelowy = os.path.join(CEL, kod + '.png')
        if args.od_nowa or not os.path.exists(docelowy):
            do_pobrania.append((kod, dane['plik'], docelowy))

    if not do_pobrania:
        print(f'Wszystko już jest ({len(znaki)} znaków w {CEL}).')
        return

    print(f'Do pobrania: {len(do_pobrania)} z {len(znaki)} znaków.')
    print('Pytam Commons o adresy miniatur...')
    adresy = adresy_miniatur([plik for _, plik, _ in do_pobrania])
    print()

    bledy = []
    for i, (kod, plik, docelowy) in enumerate(do_pobrania, 1):
        try:
            url = adresy.get(plik.replace('_', ' '))
            if not url:
                raise LookupError('Commons nie zwrócił miniatury')
            rozmiar = pobierz(url, docelowy)
            print(f'[{i}/{len(do_pobrania)}] {kod:8} {rozmiar / 1024:6.1f} kB')
        except Exception as e:  # noqa: BLE001 - chcemy dokończyć resztę mimo pojedynczych wpadek
            bledy.append((kod, plik, str(e)))
            print(f'[{i}/{len(do_pobrania)}] {kod:8} BLAD: {e}')
        time.sleep(PRZERWA)

    print(f'\nPobrano {len(do_pobrania) - len(bledy)}, nieudanych {len(bledy)}.')
    if bledy:
        print('Uruchom skrypt ponownie - spróbuje tylko brakujących:')
        for kod, plik, e in bledy:
            print(f'  {kod}  ({plik})  {e}')


if __name__ == '__main__':
    sys.exit(main())
