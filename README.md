# Prawko — nauka na egzamin teoretyczny

Lokalna aplikacja webowa do nauki na egzamin na prawo jazdy: nauka w paczkach,
egzaminy próbne zgodne z prawdziwymi, powtórki błędów, baza wszystkich pytań
z odpowiedziami, zakładki, notatki i statystyki.

## Po pobraniu z repozytorium

Multimedia nie są trzymane w repozytorium (3,6 GB filmów i zdjęć), więc świeża kopia
wymaga dwóch kroków odtworzenia:

```
bash narzedzia/konwertuj-media.sh   # filmy i zdjęcia z katalogu źródłowego → media/
bash narzedzia/klatki-z-filmow.sh   # kadry z filmów → media/klatki/
python narzedzia/pobierz-znaki.py   # rysunki znaków → media/znaki/
```

Postęp nauki (`app/dane/postep.db`) też jest poza repozytorium — zawiera konta i hasła.
Przy przenosinach na inny komputer skopiuj ten plik ręcznie.

## Uruchomienie

| System | Jak uruchomić |
| --- | --- |
| **Windows** | Kliknij dwukrotnie **`START.bat`** |
| **macOS** | Kliknij dwukrotnie **`start.command`** |
| **Linux** | `./start.command` w terminalu |

Otworzy się przeglądarka pod `http://localhost:8080`. Oba pliki robią to samo:
sprawdzają Node.js, w razie potrzeby budują bazę pytań z pliku XLSX i startują serwer.

Serwer wypisze też adres do wpisania na telefonie, np. `http://192.168.0.12:8080` —
działa, gdy telefon i komputer są w tej samej sieci Wi-Fi, a komputer jest włączony.

Zatrzymanie serwera: `Ctrl+C` w oknie konsoli.

Port zmienisz zmienną środowiskową, np. `PORT=3000 ./start.command`.

### Pierwsze uruchomienie na macOS

Jeśli Finder odmówi uruchomienia pliku, nadaj mu raz prawo wykonywania:

```
chmod +x start.command
```

Gdy macOS zablokuje plik jako pobrany z internetu, kliknij go prawym przyciskiem
i wybierz **Otwórz** — wtedy pojawi się przycisk pozwalający uruchomić mimo ostrzeżenia.

Przy pierwszym uruchomieniu zakładane jest konto **kursant** — hasło zobaczysz raz
w konsoli, przy starcie. Możesz je narzucić zmiennymi `PRAWKO_LOGIN` i `PRAWKO_HASLO`.
Nowe konta można zakładać
z ekranu logowania — każde ma własny, niezależny postęp.

## Co jest w środku

| Sekcja | Do czego służy |
| --- | --- |
| **Pulpit** | Podsumowanie postępu, skrót do nauki i egzaminu |
| **Nauka** | Osobno pytania podstawowe i specjalistyczne, w paczkach po 35 — wracasz do wybranej i powtarzasz tylko ją |
| **Egzamin** | 32 pytania, punktacja i limity czasu jak na egzaminie państwowym |
| **Arkusze do druku** | Losowe arkusze na papier — do wydrukowania albo zapisania jako PDF |
| **Powtórki** | Pytania po błędzie oraz zaplanowane powtórki w rosnących odstępach |
| **Podchwytliwe** | Pytania, które sam oznaczyłeś jako pułapki, z własnym opisem |
| **Baza pytań** | Wszystkie pytania z poprawnymi odpowiedziami, wyszukiwarka i filtry |
| **Znaki drogowe** | Wszystkie znaki pionowe i poziome z rysunkiem, nazwą i wyjaśnieniem |
| **Zasady** | Reguły ruchu — pierwszeństwo, prędkości, odległości, manewry, obowiązki |
| **Statystyki** | Wykres odpowiedzi dzień po dniu, wyniki egzaminów, historia podejść |
| **Ustawienia** | Kategoria, motyw, limity czasu, stan wyjaśnień, czyszczenie postępu |

### Arkusze do druku

Sekcja **Arkusze do druku** losuje od 1 do 50 arkuszy naraz — każdy to inny zestaw
32 pytań o takim samym układzie jak na egzaminie. Arkusze otwierają się w nowej
karcie; przycisk *Drukuj / zapisz jako PDF* otwiera okno drukowania, w którym
wystarczy wybrać drukarkę **„Zapisz jako PDF"**.

Filmu nie da się wydrukować, więc w jego miejsce trafia kadr z 92% długości —
czyli z momentu, który zwykle rozstrzyga sytuację. Klucz odpowiedzi jest na
osobnych stronach na końcu; wydrukuj go oddzielnie, żeby nie podglądać w trakcie.

### Znaki drogowe

Osobna zakładka z całym katalogiem znaków z rozporządzenia — 373 znaki w dziewięciu
grupach: ostrzegawcze (A), zakazu (B), nakazu (C), informacyjne (D), kierunku
i miejscowości (E), uzupełniające (F), przed przejazdami kolejowymi (G), tabliczki (T)
i poziome (P). Każdy znak ma rysunek, kod, oficjalną nazwę i wyjaśnienie napisane
pod kątem egzaminu — co znak nakazuje, jak daleko obowiązuje i gdzie zwykle zastawia
pułapkę. Na górze każdej grupy jest jej wspólna zasada, np. że znak ostrzegawczy
sam w sobie nie zmienia pierwszeństwa ani nie ogranicza prędkości.

Wyszukiwarka przeszukuje kody, nazwy i treść wyjaśnień, więc wpisanie `pierwszeństwo`
albo `T-6a` znajduje znak od ręki.

Rysunki pochodzą z Wikimedia Commons. Polskie znaki drogowe są załącznikiem do
rozporządzenia, a materiały urzędowe nie podlegają w Polsce prawu autorskiemu
(art. 4 ustawy o prawie autorskim), więc wolno je trzymać i wyświetlać lokalnie.

Katalog buduje się tak:

```
python narzedzia/pobierz-znaki.py    # rysunki do media/znaki/ (raz, ~25 min)
python narzedzia/zbuduj-znaki.py     # app/data/znaki.json
```

Pobieranie jest idempotentne — można je przerwać i uruchomić ponownie, dociągnie
tylko brakujące pliki. Definicje znaków leżą w `narzedzia/znaki-opisy.py`; jeśli
któraś wyda Ci się nieprecyzyjna, popraw ją tam i uruchom `zbuduj-znaki.py`.

### Zasady

Zakładka **Zasady** to 43 reguły w dziesięciu grupach: pierwszeństwo, prędkość,
odległości, światła, manewry, zatrzymanie i postój, pieszy i rowerzysta, autostrada,
kierujący i pojazd, wypadek i awaria.

Każda zasada ma **sedno** — jedno zdanie do zapamiętania, wyróżnione na górze karty —
a pod nim rozwinięcie z wyjątkami i typowymi pułapkami. Prędkości i odległości są
w tabelach, bo to materiał do zapamiętania jako zestaw, a nie do czytania zdaniami.

Treść jest w `narzedzia/zbuduj-zasady.py`. Żeby dopisać własną zasadę, dodaj krotkę
do listy `ZASADY` i uruchom:

```
python narzedzia/zbuduj-zasady.py
```

Serwer wykryje nowy plik sam — restart nie jest potrzebny.

### Podpowiedzi w nauce

W sekcji **Nauka** pod każdym nieodsłoniętym pytaniem jest przycisk **Podpowiedź**,
a na pasku sesji przełącznik **💡 Podpowiedzi**, który włącza tryb pokazujący regułę
od razu przy każdym pytaniu. Ustawienie jest pamiętane między sesjami.

Podpowiedź działa dwustopniowo i nigdy nie podaje odpowiedzi wprost:

1. **Reguła** — pokazuje zasadę z sekcji Zasady, która rozstrzyga ten typ sytuacji,
   wraz z odnośnikiem do pełnego opisu.
2. **Odrzuć jedną odpowiedź** — tylko przy pytaniach A/B/C; wykreśla jeden błędny
   wariant, zostawiając go widocznym.

Dopasowanie reguły do pytania idzie po jawnych kluczach zapisanych przy każdej
zasadzie w `narzedzia/zbuduj-zasady.py` (pole `KLUCZE`). Klucze są bez znaków
diakrytycznych, bo polska odmiana psuje porównywanie rdzeni — „zawrócić" i
„zawracanie" nie mają wspólnego początku. Jeśli któreś pytanie dostaje nietrafioną
regułę, dopisz fragment do `KLUCZE` i przebuduj katalog.

Wyjaśnienie do konkretnego pytania nadal pojawia się dopiero po odpowiedzi —
podpowiedź ma naprowadzić, a nie rozwiązać.

### Pytania podchwytliwe

Lista pytań, które **sam** oznaczysz przyciskiem **⚠ Podchwytliwe** — dostępnym
w nauce, w bazie pytań i przy przeglądzie egzaminu. Program niczego tu nie zgaduje:
o tym, czy pytanie jest pułapką, decydujesz Ty. (Pomyłka to nie to samo co pułapka —
często oznacza po prostu lukę w wiedzy przy zupełnie zwyczajnym pytaniu. Błędne
odpowiedzi masz osobno, w **Powtórkach** i pod filtrem *Do poprawy* w bazie pytań.)

Po oznaczeniu możesz dopisać, **na czym polega pułapka**. Ta uwaga pokaże się
później pod pytaniem — po udzieleniu odpowiedzi, żeby nie podpowiadać.
`Ctrl+Enter` zapisuje bez sięgania po mysz.

### Utrwalenie oznaczeń

Oznaczenia trzymane są w bazie postępu, więc znikają przy jej wyczyszczeniu i nie
widać ich na innym koncie. Gdy uznasz swoją listę za gotową, możesz ją zapisać
na stałe:

```
python narzedzia/zapisz-podchwytliwe.py            # podgląd, nic nie zapisuje
python narzedzia/zapisz-podchwytliwe.py --zapisz   # zapis do narzedzia/podchwytliwe.json
python narzedzia/zbuduj-baze.py                    # wbudowanie w katalog
```

Od tego momentu oznaczenia są domyślne: przetrwają czyszczenie postępu, aktualizację
katalogu i pojawią się na każdym koncie. Nadal możesz oznaczać kolejne pytania —
uwaga z bieżącego konta ma pierwszeństwo przed utrwaloną.

### Jak zbudowany jest egzamin próbny

Zgodnie z zasadami egzaminu państwowego — najpierw cała część podstawowa, potem
specjalistyczna, bez możliwości powrotu do wcześniejszego pytania:

* **część podstawowa** — 20 pytań TAK/NIE: 10 × 3 pkt, 6 × 2 pkt, 4 × 1 pkt,
  20 s na zapoznanie się z pytaniem + 15 s na odpowiedź,
* **część specjalistyczna** — 12 pytań A/B/C: 6 × 3 pkt, 4 × 2 pkt, 2 × 1 pkt,
  50 s na pytanie,
* razem **74 punkty**, próg zdania **68**, łączny limit **25 minut**.

Odwzorowane są też mniej oczywiste szczegóły prawdziwego egzaminu.
**Odpowiedzieć można już w czasie na zapoznanie się z pytaniem** — nie trzeba czekać
na fazę odpowiedzi.

Pytanie z filmem ma **trzy fazy, nie dwie**:

1. **zapoznanie** — 20 s na przeczytanie pytania, film jeszcze nie leci,
2. **projekcja** — film odtwarza się raz, w całości; w tym czasie nic nie odlicza,
   a zegar pokazuje ▶ zamiast sekund,
3. **odpowiedź** — 15 s liczone dopiero **od ostatniej klatki**, która zostaje
   na ekranie przez cały ten czas.

Przycisk *Start* nie skraca czasu na odpowiedź — jedynie przyspiesza projekcję
kosztem reszty czasu na zapoznanie. Jeśli go nie naciśniesz, film puści się sam
po 20 sekundach. Odpowiedzieć można w każdej z trzech faz, również w trakcie
projekcji. Czas projekcji wlicza się natomiast do łącznych 25 minut.

Limity czasu można wyłączyć w ustawieniach, jeśli chcesz przećwiczyć zestaw bez presji zegara.

### Powtórki

Pytanie, na które odpowiesz źle, wraca natychmiast. Każda kolejna poprawna odpowiedź
odsuwa je dalej: 10 minut → 1 dzień → 3 dni → tydzień → 3 tygodnie → 2 miesiące.

### Wyjaśnienia do pytań

Pod każdym pytaniem może się pojawić blok **„Dlaczego tak"** — krótkie wyjaśnienie,
co przesądza o poprawnej odpowiedzi. Wyjaśnienia generuje się **raz**: lądują w bazie
i od tej pory zawsze widzisz dokładnie to samo. Nic nie jest tworzone na nowo przy
każdym wyświetleniu.

Generowanie wymaga własnego klucza API Anthropic i jest jednorazowo płatne. Zmierzone
koszty przy pełnym przebiegu (Claude Opus 5 przez Batch API, o połowę tańsze):
**12 USD** za kategorię B (2134 pytania) i **20 USD** za całą bazę (3516 pytań).

1. Załóż konto na [console.anthropic.com](https://console.anthropic.com), doładuj środki
   i utwórz klucz w *Settings → API keys*. Kredyty są **bezzwrotne** i wygasają po roku,
   więc doładuj tyle, ile zamierzasz wydać, i **zostaw auto-doładowanie wyłączone** —
   wtedy saldo jest twardym limitem wydatku.
2. Wklej klucz do pliku `narzedzia/klucz-api.txt` (sam klucz, nic więcej). Plik jest
   w `.gitignore`. Nie podawaj klucza w argumencie polecenia — argumenty lądują
   w historii powłoki.
3. Sprawdź kosztorys, nic jeszcze nie wysyłając:

   ```
   python narzedzia/generuj-wyjasnienia.py --wycen
   ```

   Kosztorys podaje widełki, bo tokenów myślenia nie da się przewidzieć przed wysłaniem.
   Po każdej paczce skrypt drukuje **faktyczne** zużycie i koszt.

4. Zacznij od próbki na najtrudniejszym materiale i przeczytaj wyniki:

   ```
   python narzedzia/generuj-wyjasnienia.py --tylko-kadry --limit 30
   ```

5. Uruchom generowanie:

   ```
   python narzedzia/generuj-wyjasnienia.py                 # cała baza
   python narzedzia/generuj-wyjasnienia.py --kategoria B   # tylko kategoria B
   python narzedzia/generuj-wyjasnienia.py --tak           # bez pytania o potwierdzenie
   ```

6. Odśwież stronę — serwera nie trzeba restartować, bo czyta wyjaśnienia przy każdym
   żądaniu.

Skrypt pyta o potwierdzenie przed wysłaniem czegokolwiek; w uruchomieniu bez terminala
(w tle, z potoku) przerywa zamiast wysyłać — do takich przebiegów służy `--tak`.
Można go przerwać i uruchomić ponownie — dopisze tylko brakujące pytania, a rozpoczęte
paczki podejmie z pliku stanu, zamiast płacić za nie drugi raz. Odpowiedzi urwane na
limicie tokenów nie trafiają do bazy: pytanie zostaje niezrobione i wraca w kolejnym
przebiegu. Przetwarzanie wsadowe trwa zwykle od kilkunastu minut do kilku godzin.

Baza z wyjaśnieniami jest warta tyle, ile za nią zapłaciłeś — zrób kopię, zanim coś
przy niej zmajstrujesz. Zwykłe skopiowanie `postep.db` **nie wystarczy**, bo dane siedzą
w pliku WAL obok. Poprawnie robi to jedno polecenie:

```
python -c "import sqlite3; sqlite3.connect(r'app/dane/postep.db').execute('VACUUM INTO ?', ('app/dane/kopia.db',))"
```

Wymaga `pip install anthropic pillow`.

### Skróty klawiszowe

`T` / `N` — odpowiedź na pytanie podstawowe · `A` `B` `C` (lub `1` `2` `3`) — pytanie
specjalistyczne · `→` lub `Enter` — następne pytanie · `←` — poprzednie (tylko w nauce).

## Układ plików

```
braknazwy/
├─ START.bat                  uruchamia serwer i otwiera przeglądarkę (Windows)
├─ start.command              to samo dla macOS i Linuksa
├─ media/                     wszystkie multimedia (zdjęcia + filmy MP4)
│  ├─ klatki/                 kadry z filmów — do wydruku i jako plakat przed odtworzeniem
│  └─ znaki/                  rysunki znaków drogowych
├─ app/
│  ├─ serwer.js               serwer HTTP, API, logowanie, strumieniowanie wideo
│  ├─ baza.js                 SQLite: użytkownicy, postęp, notatki, egzaminy, wyjaśnienia
│  ├─ pytania.js              wczytanie katalogu, losowanie egzaminów i arkuszy
│  ├─ data/pytania.json       baza pytań wygenerowana z XLSX
│  ├─ dane/postep.db          Twój postęp (SQLite) — warto kopiować przy przenosinach
│  └─ public/                 interfejs (HTML, CSS, JS) + widok wydruku (druk.*)
├─ narzedzia/
│  ├─ zbuduj-baze.py          XLSX → pytania.json
│  ├─ konwertuj-media.sh      scalanie folderów i konwersja WMV → MP4
│  ├─ klatki-z-filmow.sh      wycinanie kadrów z filmów
│  ├─ generuj-wyjasnienia.py  jednorazowe wygenerowanie wyjaśnień (wymaga klucza API)
│  ├─ zapisz-podchwytliwe.py  utrwalenie Twoich oznaczeń jako domyślnych
│  ├─ pobierz-znaki.py        rysunki znaków z Wikimedia Commons
│  ├─ zbuduj-znaki.py         znaki-nazwy.json + znaki-opisy.py → app/data/znaki.json
│  ├─ znaki-nazwy.json        kody i oficjalne nazwy znaków
│  └─ znaki-opisy.py          definicje znaków (do poprawiania ręcznie)
├─ multimedia do pytań/       oryginalne pliki źródłowe (WMV, już przekonwertowane)
└─ cz. 2/                     oryginalne pliki źródłowe
```

## Aktualizacja katalogu pytań

Gdy pojawi się nowsza wersja katalogu:

1. podmień plik `KATALOG_dla_kandydatów_na_kierowców_*.xlsx`,
2. wrzuć nowe multimedia do folderu źródłowego i uruchom `bash narzedzia/konwertuj-media.sh`,
3. uruchom `bash narzedzia/klatki-z-filmow.sh` (kadry dla nowych filmów),
4. uruchom `python narzedzia/zbuduj-baze.py`,
5. jeśli korzystasz z wyjaśnień — `python narzedzia/generuj-wyjasnienia.py` dopisze je
   tylko dla nowych pytań,
6. zrestartuj serwer.

Postęp nauki jest trzymany osobno (`app/dane/postep.db`) i przetrwa aktualizację bazy pytań.

## Wymagania

Działa na Windowsie, macOS i Linuksie — kod serwera nie zawiera niczego zależnego
od systemu, a skrypty pomocnicze same znajdują katalog projektu i `ffmpeg` w `PATH`.

* **Node.js 22+** — serwer nie ma żadnych zależności npm, nie trzeba nic instalować.
  Wersja 22 jest minimum, bo aplikacja korzysta z wbudowanego modułu `node:sqlite`
* **Python 3** z `openpyxl` — tylko do przebudowania bazy pytań z XLSX
* **ffmpeg** — tylko do konwersji nowych filmów WMV i wycinania kadrów

Instalacja brakujących narzędzi:

| | macOS | Windows | Linux (Debian/Ubuntu) |
| --- | --- | --- | --- |
| Node.js | `brew install node` | [nodejs.org](https://nodejs.org) | `sudo apt install nodejs` |
| Python | `brew install python` | [python.org](https://python.org) | `sudo apt install python3` |
| ffmpeg | `brew install ffmpeg` | `winget install Gyan.FFmpeg` | `sudo apt install ffmpeg` |
| openpyxl | `pip3 install openpyxl` | `pip install openpyxl` | `pip3 install openpyxl` |

## Uwagi o danych

Źródłem jest oficjalny katalog pytań egzaminacyjnych. Pominięte zostały tłumaczenia
na język migowy (PJM) oraz wersje obcojęzyczne pytań.

Pytania z arkusza „W trakcie weryfikacji" są oznaczone plakietką **w weryfikacji** i widoczne
tylko w bazie pytań — nie trafiają do nauki ani do egzaminów, bo w katalogu brakuje
do nich większości multimediów.
