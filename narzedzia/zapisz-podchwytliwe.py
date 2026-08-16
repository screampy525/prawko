# -*- coding: utf-8 -*-
"""Zapisuje Twoje oznaczenia pytań podchwytliwych jako domyślne.

Oznaczenia robione podczas nauki leżą w bazie postępu i znikają przy jej
wyczyszczeniu albo na nowym koncie. Ten skrypt przenosi je do pliku
narzedzia/podchwytliwe.json, który zbuduj-baze.py wczyta przy każdej
przebudowie katalogu - dzięki temu przetrwają wszystko.

Uruchom dopiero wtedy, gdy uznasz swoją listę za gotową:
    python narzedzia/zapisz-podchwytliwe.py                # podgląd
    python narzedzia/zapisz-podchwytliwe.py --zapisz       # zapis do pliku
"""
import argparse
import json
import os
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BAZA = os.path.join(ROOT, 'app', 'dane', 'postep.db')
WYNIK = os.path.join(ROOT, 'narzedzia', 'podchwytliwe.json')
PYTANIA = os.path.join(ROOT, 'app', 'data', 'pytania.json')


def main():
    ap = argparse.ArgumentParser(description='Zapisuje oznaczenia podchwytliwych jako domyślne.')
    ap.add_argument('--zapisz', action='store_true', help='faktycznie zapisz plik (bez tego tylko podgląd)')
    ap.add_argument('--login', default='kursant', help='z którego konta wziąć oznaczenia')
    args = ap.parse_args()

    if not os.path.exists(BAZA):
        print(f'Brak bazy {BAZA}.', file=sys.stderr)
        sys.exit(1)

    db = sqlite3.connect(BAZA)
    uzytkownik = db.execute('SELECT id FROM uzytkownicy WHERE login = ? COLLATE NOCASE', (args.login,)).fetchone()
    if not uzytkownik:
        print(f'Nie ma konta "{args.login}".', file=sys.stderr)
        sys.exit(1)

    oznaczenia = dict(db.execute(
        'SELECT pytanie, uwaga FROM podchwytliwe WHERE uzytkownik = ? ORDER BY kiedy', (uzytkownik[0],)))
    if not oznaczenia:
        print('Nie masz jeszcze żadnych oznaczeń — nie ma czego zapisywać.')
        return

    katalog = json.load(open(PYTANIA, encoding='utf-8'))
    wg_id = {p['id']: p for p in katalog['pytania']}

    zUwaga = sum(1 for u in oznaczenia.values() if u.strip())
    print(f'Oznaczonych pytań:  {len(oznaczenia)}')
    print(f'Z opisem pułapki:   {zUwaga}')
    print(f'Bez opisu:          {len(oznaczenia) - zUwaga}\n')

    for pid, uwaga in list(oznaczenia.items())[:5]:
        p = wg_id.get(pid)
        print(f'  nr {pid}: {(p["tresc"][:62] + "…") if p else "(brak w katalogu)"}')
        if uwaga.strip():
            print(f'      → {uwaga[:80]}')
    if len(oznaczenia) > 5:
        print(f'  … i {len(oznaczenia) - 5} więcej')

    if not args.zapisz:
        print('\nTo tylko podgląd. Dodaj --zapisz, żeby zapisać do pliku.')
        return

    with open(WYNIK, 'w', encoding='utf-8') as fh:
        json.dump(oznaczenia, fh, ensure_ascii=False, indent=1, sort_keys=True)

    print(f'\nZapisano do {WYNIK}.')
    print('Uruchom teraz: python narzedzia/zbuduj-baze.py')
    print('Od tej pory oznaczenia przetrwają czyszczenie postępu i pojawią się na każdym koncie.')


if __name__ == '__main__':
    sys.exit(main())
