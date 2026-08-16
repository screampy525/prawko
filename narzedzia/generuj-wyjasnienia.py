# -*- coding: utf-8 -*-
"""Generuje wyjaśnienia do pytań egzaminacyjnych i zapisuje je na stałe.

Każde pytanie jest tłumaczone raz. Wyjaśnienie ląduje w bazie postępu
(tabela `wyjasnienia`) i od tej pory aplikacja pokazuje zawsze to samo -
nic nie jest generowane w locie przy każdym wyświetleniu.

Uruchomienie:
    python narzedzia/generuj-wyjasnienia.py                 # cała baza
    python narzedzia/generuj-wyjasnienia.py --kategoria B   # tylko kategoria B
    python narzedzia/generuj-wyjasnienia.py --wycen         # sam kosztorys, bez wysyłania

Klucz API bierze z ANTHROPIC_API_KEY albo z pliku narzedzia/klucz-api.txt.

Skrypt można przerwać i uruchomić ponownie - dopisze tylko brakujące pytania,
a rozpoczęte paczki podejmie z pliku stanu zamiast płacić za nie drugi raz.
"""
import argparse
import base64
import io
import json
import os
import sqlite3
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTANIA = os.path.join(ROOT, 'app', 'data', 'pytania.json')
BAZA = os.path.join(ROOT, 'app', 'dane', 'postep.db')
MEDIA = os.path.join(ROOT, 'media')
PLIK_KLUCZA = os.path.join(ROOT, 'narzedzia', 'klucz-api.txt')
PLIK_STANU = os.path.join(ROOT, 'narzedzia', 'stan-wyjasnien.json')

MODEL = 'claude-opus-5'
# Paczka po 700 pytań: Batch API przyjmuje żądania do 256 MB, a obrazki
# zakodowane w base64 szybko się sumują.
NA_PACZKE = 700
# Zdjęcia w katalogu mają 1024 px szerokości, kadry z filmów 800 px - przy tej
# wartości nic nie jest zmniejszane i model dostaje materiał w oryginale.
# Rozliczenie idzie po wymiarach obrazu, nie po bajtach, więc wyższa jakość JPEG
# nie kosztuje ani tokena, a drobne znaki w tle zostają czytelne.
SZEROKOSC_OBRAZU = 1024
JAKOSC_JPEG = 85

INSTRUKCJA = """Jesteś doświadczonym instruktorem nauki jazdy i egzaminatorem w Polsce.
Tłumaczysz kursantowi pytania z oficjalnego katalogu pytań egzaminacyjnych.

Dostajesz pytanie, warianty odpowiedzi, odpowiedź prawidłową i - jeśli pytanie ją ma -
ilustrację (zdjęcie albo kadr z filmu, zwykle z rozstrzygającego momentu sytuacji).

Napisz wyjaśnienie, dlaczego prawidłowa jest właśnie ta odpowiedź:
- od 2 do 4 zdań, zwykłym językiem, bez wstępów w rodzaju "W tej sytuacji...",
- zacznij od sedna: co konkretnie przesądza o odpowiedzi,
- powołaj się na przepis lub znak, jeśli to on rozstrzyga,
- kod znaku (np. "B-33") podaj TYLKO wtedy, gdy naprawdę odczytujesz go z obrazu albo
  wynika wprost z treści pytania; w przeciwnym razie opisz znak słowami ("trójkątny znak
  ostrzegający o przejściu") albo w ogóle go nie wspominaj,
- przy pytaniach ze zdjęciem lub kadrem wskaż, co na obrazie jest rozstrzygające,
- nie dopisuj obserwacji, które niczego nie rozstrzygają - żadnych zdań w rodzaju
  "dodatkowo widać...". Każdy taki dopisek to okazja do pomyłki, a nic nie wnosi,
- jeśli łatwo tu o pomyłkę, dopisz na końcu jednym zdaniem, na czym polega pułapka,
- pisz do kursanta na "ty", rzeczowo, bez lania wody i bez powtarzania treści pytania.

Bardzo ważne przy ilustracjach: opisuj wyłącznie to, co widzisz pewnie. Jeżeli
rozstrzygającego szczegółu nie da się jednoznacznie odczytać z obrazu - dokładnej
pozycji rąk kierującego ruchem, treści małego znaku w tle, tego, czy pieszy już
wszedł na jezdnię - NIE zgaduj i nie opisuj go. Oprzyj wtedy wyjaśnienie na regule,
którą to pytanie sprawdza, bo znasz prawidłową odpowiedź i wiesz, do czego zmierza.
Zdanie o zasadzie, która rozstrzyga, jest warte więcej niż zmyślony szczegół -
błędny opis obrazu nauczy kursanta czegoś nieprawdziwego.

Zwróć wyłącznie samo wyjaśnienie - bez nagłówków, bez wypunktowań, bez cudzysłowów."""


def wczytaj_klucz():
    klucz = os.environ.get('ANTHROPIC_API_KEY', '').strip()
    if klucz:
        return klucz
    if os.path.exists(PLIK_KLUCZA):
        klucz = open(PLIK_KLUCZA, encoding='utf-8').read().strip()
        if klucz:
            return klucz
    print(
        'Brak klucza API.\n\n'
        'Wejdź na https://console.anthropic.com → Settings → API keys, utwórz klucz\n'
        f'i wklej go do pliku:\n  {PLIK_KLUCZA}\n\n'
        'albo ustaw zmienną środowiskową ANTHROPIC_API_KEY.',
        file=sys.stderr)
    sys.exit(1)


def polacz_z_baza():
    if not os.path.exists(BAZA):
        print(f'Brak bazy {BAZA}. Uruchom najpierw aplikację (START.bat), żeby ją założyła.', file=sys.stderr)
        sys.exit(1)
    db = sqlite3.connect(BAZA)
    db.execute("""CREATE TABLE IF NOT EXISTS wyjasnienia (
        pytanie TEXT PRIMARY KEY, tresc TEXT NOT NULL, model TEXT NOT NULL, kiedy INTEGER NOT NULL)""")
    db.commit()
    return db


def sciezka_obrazu(p):
    """Zdjęcie bierzemy wprost, dla filmu - wygenerowany wcześniej kadr."""
    if not p.get('media'):
        return None
    if p.get('mediaTyp') == 'vid':
        kadr = os.path.join(MEDIA, 'klatki', os.path.splitext(p['media'])[0] + '.jpg')
        return kadr if os.path.exists(kadr) else None
    sciezka = os.path.join(MEDIA, p['media'])
    return sciezka if os.path.exists(sciezka) else None


def obraz_base64(sciezka):
    """Zmniejsza obraz - pełna rozdzielczość niepotrzebnie podnosi koszt i rozmiar paczki."""
    from PIL import Image
    with Image.open(sciezka) as img:
        img = img.convert('RGB')
        if img.width > SZEROKOSC_OBRAZU:
            wysokosc = round(img.height * SZEROKOSC_OBRAZU / img.width)
            img = img.resize((SZEROKOSC_OBRAZU, wysokosc), Image.LANCZOS)
        bufor = io.BytesIO()
        img.save(bufor, format='JPEG', quality=JAKOSC_JPEG, optimize=True)
    return base64.standard_b64encode(bufor.getvalue()).decode('ascii')


def opis_pytania(p):
    linie = [f'Pytanie: {p["tresc"]}']
    if p['typ'] == 'tn':
        linie.append('Warianty odpowiedzi: TAK / NIE')
        linie.append(f'Odpowiedź prawidłowa: {"TAK" if p["poprawna"] == "T" else "NIE"}')
    else:
        for k in ('A', 'B', 'C'):
            linie.append(f'{k}. {p["odpowiedzi"][k]}')
        linie.append(f'Odpowiedź prawidłowa: {p["poprawna"]}')
    linie.append(f'Zakres: {"podstawowy" if p["zakres"] == "P" else "specjalistyczny"}, {p["punkty"]} pkt')
    return '\n'.join(linie)


def zbuduj_zadanie(p):
    """Jedno żądanie do Batch API."""
    from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
    from anthropic.types.messages.batch_create_params import Request

    tresc = []
    sciezka = sciezka_obrazu(p)
    if sciezka:
        tresc.append({
            'type': 'image',
            'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': obraz_base64(sciezka)},
        })
    tresc.append({'type': 'text', 'text': opis_pytania(p)})

    return Request(
        custom_id=f'pyt-{p["id"]}',
        params=MessageCreateParamsNonStreaming(
            model=MODEL,
            # Wyjaśnienie ma 2-4 zdania, ale limit obejmuje też tokeny myślenia.
            # Zapas chroni przed urwaniem odpowiedzi w połowie zdania; płaci się
            # za tokeny faktycznie wygenerowane, więc sam zapas nic nie kosztuje.
            max_tokens=2000,
            # Instrukcja jest identyczna w każdym z kilku tysięcy żądań, więc
            # trafia do cache'u - odczyt kosztuje 10% ceny wejścia. W Batch API
            # trafienia nie są gwarantowane; sprawdzamy je po pierwszej paczce.
            system=[{
                'type': 'text',
                'text': INSTRUKCJA,
                'cache_control': {'type': 'ephemeral'},
            }],
            # Niski nakład pracy: to zwięzłe wyjaśnienie, nie zadanie wymagające
            # rozbudowanego rozumowania. Trzyma koszt i czas w ryzach.
            output_config={'effort': 'low'},
            thinking={'type': 'adaptive'},
            messages=[{'role': 'user', 'content': tresc}],
        ),
    )


def tokeny_tekstu(tekst):
    """Zgrubnie: polszczyzna to około 2,5 znaku na token."""
    return round(len(tekst) / 2.5)


def tokeny_obrazu(sciezka):
    """Obraz rozlicza się po wymiarach: szerokość × wysokość / 750 - nie po bajtach."""
    from PIL import Image
    with Image.open(sciezka) as img:
        w, h = img.size
    if w > SZEROKOSC_OBRAZU:
        h = round(h * SZEROKOSC_OBRAZU / w)
        w = SZEROKOSC_OBRAZU
    return round(w * h / 750)


def kosztorys(pytania):
    """Widełki kosztu w USD.

    Dwóch rzeczy nie da się policzyć bez wysłania paczki: ile tokenów zajmie
    myślenie modelu i czy Batch API trafi w cache instrukcji. Dolna granica
    zakłada krótkie myślenie i działający cache, górna - odwrotnie.
    """
    instrukcja = tokeny_tekstu(INSTRUKCJA)
    tresc = sum(tokeny_tekstu(opis_pytania(p)) for p in pytania)
    obrazy = sum(tokeny_obrazu(s) for s in (sciezka_obrazu(p) for p in pytania) if s)

    # Instrukcja powtarza się w każdym żądaniu: z cache'em płacimy 10% stawki.
    stale_z_cache = instrukcja * len(pytania) * 0.1
    stale_bez_cache = instrukcja * len(pytania)
    # Samo wyjaśnienie to około 190 tokenów; reszta to myślenie.
    wyjscie_min = len(pytania) * (190 + 100)
    wyjscie_max = len(pytania) * (190 + 500)

    def usd(wejscie, wyjscie):
        # Batch API to połowa cennika; claude-opus-5 kosztuje 5/25 USD za milion.
        return wejscie / 1e6 * 2.50 + wyjscie / 1e6 * 12.50

    return (usd(tresc + obrazy + stale_z_cache, wyjscie_min),
            usd(tresc + obrazy + stale_bez_cache, wyjscie_max),
            {'instrukcja': instrukcja, 'tresc': tresc, 'obrazy': obrazy})


def wczytaj_stan():
    if os.path.exists(PLIK_STANU):
        try:
            return json.load(open(PLIK_STANU, encoding='utf-8'))
        except (ValueError, OSError):
            pass
    return {'paczki': []}


def zapisz_stan(stan):
    with open(PLIK_STANU, 'w', encoding='utf-8') as fh:
        json.dump(stan, fh, ensure_ascii=False, indent=1)


def odbierz_wyniki(klient, db, batch_id):
    """Pobiera gotową paczkę i zapisuje wyjaśnienia. Zwraca (zapisane, błędy, zużycie).

    Urwanych odpowiedzi nie zapisujemy: `stop_reason == 'max_tokens'` znaczy, że
    model nie dokończył zdania, a taki tekst w bazie wygląda jak gotowy i nikt go
    już nie sprawdzi. Lepiej zostawić pytanie niezrobione - kolejne uruchomienie
    weźmie je jeszcze raz.
    """
    zapisane = bledy = urwane = 0
    zuzycie = {'wejscie': 0, 'wyjscie': 0, 'zapis_cache': 0, 'odczyt_cache': 0}
    for wynik in klient.messages.batches.results(batch_id):
        pid = wynik.custom_id.removeprefix('pyt-')
        if wynik.result.type != 'succeeded':
            bledy += 1
            continue

        wiadomosc = wynik.result.message
        u = wiadomosc.usage
        zuzycie['wejscie'] += u.input_tokens or 0
        zuzycie['wyjscie'] += u.output_tokens or 0
        zuzycie['zapis_cache'] += getattr(u, 'cache_creation_input_tokens', 0) or 0
        zuzycie['odczyt_cache'] += getattr(u, 'cache_read_input_tokens', 0) or 0

        if wiadomosc.stop_reason == 'max_tokens':
            urwane += 1
            continue
        tekst = '\n'.join(b.text for b in wiadomosc.content if b.type == 'text').strip()
        if not tekst:
            bledy += 1
            continue
        db.execute(
            'INSERT INTO wyjasnienia (pytanie, tresc, model, kiedy) VALUES (?, ?, ?, ?) '
            'ON CONFLICT(pytanie) DO UPDATE SET tresc = excluded.tresc, model = excluded.model, kiedy = excluded.kiedy',
            (pid, tekst, MODEL, int(time.time() * 1000)))
        zapisane += 1
    db.commit()
    return zapisane, bledy + urwane, zuzycie


def podsumuj_zuzycie(z):
    """Faktyczny rachunek za paczkę - jedyne wiarygodne źródło do dalszych szacunków."""
    # Batch API: połowa ceny cennikowej. Odczyt z cache'u to 10% ceny wejścia,
    # zapis 125%. Stawki claude-opus-5: 5 USD za milion wejścia, 25 za wyjście.
    koszt = ((z['wejscie'] + z['zapis_cache'] * 1.25 + z['odczyt_cache'] * 0.1) / 1e6 * 2.50
             + z['wyjscie'] / 1e6 * 12.50)
    czesci = [f"wejście {z['wejscie']:,}", f"wyjście {z['wyjscie']:,}"]
    if z['zapis_cache'] or z['odczyt_cache']:
        czesci.append(f"cache: zapis {z['zapis_cache']:,}, odczyt {z['odczyt_cache']:,}")
    else:
        czesci.append('cache: brak trafień')
    return f"   tokeny: {', '.join(czesci)}  →  około {koszt:.2f} USD"


def czekaj_na_paczke(klient, batch_id):
    poprzedni = None
    while True:
        paczka = klient.messages.batches.retrieve(batch_id)
        if paczka.processing_status == 'ended':
            return paczka
        liczniki = paczka.request_counts
        stan = f'{liczniki.succeeded} gotowych, {liczniki.processing} w toku, {liczniki.errored} błędnych'
        if stan != poprzedni:
            print(f'   … {stan}', flush=True)
            poprzedni = stan
        time.sleep(30)


def main():
    ap = argparse.ArgumentParser(description='Generuje wyjaśnienia do pytań egzaminacyjnych.')
    ap.add_argument('--kategoria', help='ogranicz do jednej kategorii, np. B')
    ap.add_argument('--wycen', action='store_true', help='pokaż kosztorys i zakończ')
    ap.add_argument('--limit', type=int, help='przetwórz najwyżej tyle pytań (do próbnego uruchomienia)')
    ap.add_argument('--tylko-kadry', action='store_true',
                    help='tylko pytania z kadrem z filmu - najtrudniejszy materiał do oceny jakości')
    ap.add_argument('--tak', action='store_true',
                    help='pomiń pytanie o potwierdzenie (do uruchomień w tle - wydaje pieniądze bez pytania)')
    args = ap.parse_args()

    katalog = json.load(open(PYTANIA, encoding='utf-8'))
    pytania = [p for p in katalog['pytania'] if p['sprawne'] and not p['weryfikacja']]
    if args.kategoria:
        kat = args.kategoria.upper()
        pytania = [p for p in pytania if kat in p['kategorie']]
        if not pytania:
            print(f'Brak pytań dla kategorii {kat}.', file=sys.stderr)
            sys.exit(1)
    if args.tylko_kadry:
        pytania = [p for p in pytania if p.get('mediaTyp') == 'vid' and sciezka_obrazu(p)]
        if not pytania:
            print('Brak pytań z kadrem z filmu.', file=sys.stderr)
            sys.exit(1)

    db = polacz_z_baza()
    gotowe = {w[0] for w in db.execute('SELECT pytanie FROM wyjasnienia')}
    doZrobienia = [p for p in pytania if p['id'] not in gotowe]
    if args.limit:
        doZrobienia = doZrobienia[:args.limit]

    zObrazem = sum(1 for p in doZrobienia if sciezka_obrazu(p))
    print(f'Pytań w zakresie:      {len(pytania)}')
    print(f'Wyjaśnionych już:      {len(pytania) - len([p for p in pytania if p["id"] not in gotowe])}')
    print(f'Do wygenerowania:      {len(doZrobienia)}  (z tego {zObrazem} z ilustracją)')

    if not doZrobienia:
        print('\nWszystko już wyjaśnione — nie ma czego wysyłać.')
        return

    print('\nLiczę tokeny…', flush=True)
    dolna, gorna, skladniki = kosztorys(doZrobienia)
    print(f'\nModel:                 {MODEL} (Batch API, -50%)')
    print(f"Tokeny wejścia:        obrazy {skladniki['obrazy']:,}, treść pytań {skladniki['tresc']:,}, "
          f"instrukcja {skladniki['instrukcja']:,} × {len(doZrobienia)}")
    print(f'Szacowany koszt:       {dolna:.2f} – {gorna:.2f} USD')
    print('\nWidełki biorą się z tokenów myślenia i z tego, czy Batch API trafi w cache')
    print('instrukcji — obu nie da się policzyć bez wysłania. Puść najpierw --limit 30,')
    print('a skrypt pokaże faktyczne zużycie i koszt tej próbki.')

    if args.wycen:
        return

    if args.tak:
        print('\n--tak: wysyłam bez pytania.')
    else:
        try:
            odpowiedz = input('\nWysłać do przetworzenia? [t/N] ').strip().lower()
        except EOFError:
            # Brak terminala (uruchomienie w tle) - milczenie to nie zgoda na wydatek.
            print('\nBrak potwierdzenia (nieinteraktywne wejście). Użyj --tak, żeby wysłać.')
            return
        if odpowiedz not in ('t', 'tak', 'y', 'yes'):
            print('Przerwane — nic nie wysłano.')
            return

    import anthropic
    klient = anthropic.Anthropic(api_key=wczytaj_klucz())
    stan = wczytaj_stan()

    # Najpierw dokończ paczki wysłane przy wcześniejszym uruchomieniu.
    for paczka in [p for p in stan['paczki'] if not p.get('odebrana')]:
        print(f'\nWznawiam paczkę {paczka["id"]} z poprzedniego uruchomienia…')
        czekaj_na_paczke(klient, paczka['id'])
        zapisane, bledy, zuzycie = odbierz_wyniki(klient, db, paczka['id'])
        paczka['odebrana'] = True
        zapisz_stan(stan)
        print(f'   zapisano {zapisane}, błędów {bledy}')
        print(podsumuj_zuzycie(zuzycie))

    gotowe = {w[0] for w in db.execute('SELECT pytanie FROM wyjasnienia')}
    doZrobienia = [p for p in doZrobienia if p['id'] not in gotowe]

    porcje = [doZrobienia[i:i + NA_PACZKE] for i in range(0, len(doZrobienia), NA_PACZKE)]
    print(f'\nDo wysłania: {len(porcje)} {"paczka" if len(porcje) == 1 else "paczek"} po maks. {NA_PACZKE} pytań.')

    for nr, porcja in enumerate(porcje, 1):
        print(f'\n[{nr}/{len(porcje)}] przygotowuję {len(porcja)} pytań…', flush=True)
        zadania = [zbuduj_zadanie(p) for p in porcja]

        paczka = klient.messages.batches.create(requests=zadania)
        stan['paczki'].append({'id': paczka.id, 'ile': len(porcja), 'odebrana': False})
        zapisz_stan(stan)
        print(f'   wysłane jako {paczka.id} — czekam na wynik (zwykle kilka–kilkadziesiąt minut)')

        czekaj_na_paczke(klient, paczka.id)
        zapisane, bledy, zuzycie = odbierz_wyniki(klient, db, paczka.id)
        stan['paczki'][-1]['odebrana'] = True
        zapisz_stan(stan)
        print(f'   zapisano {zapisane}, błędów {bledy}')
        print(podsumuj_zuzycie(zuzycie))

    razem = db.execute('SELECT COUNT(*) FROM wyjasnienia').fetchone()[0]
    print(f'\nGotowe. W bazie jest {razem} wyjaśnień.')
    # Serwer czyta tabelę przy każdym żądaniu (baza.pobierzWyjasnienia), więc
    # restart nie jest potrzebny - wystarczy odświeżyć stronę.
    print('Odśwież stronę w przeglądarce - serwera nie trzeba restartować.')


if __name__ == '__main__':
    main()
