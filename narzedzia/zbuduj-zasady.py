# -*- coding: utf-8 -*-
"""Buduje app/data/zasady.json - zasady ruchu drogowego przydatne na teście i na drodze.

Treść pisana pod dwa zastosowania naraz: rozstrzygnięcie pytania egzaminacyjnego
i decyzja za kierownicą. Stąd przy każdej zasadzie jest jednozdaniowe "sedno" -
to, co trzeba pamiętać, gdy nie ma czasu czytać.

Uruchomienie:  python narzedzia/zbuduj-zasady.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'app', 'data', 'zasady.json')

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

GRUPY = [
    ('pierwszenstwo', 'Pierwszeństwo', 'Kto jedzie pierwszy i dlaczego'),
    ('predkosc', 'Prędkość', 'Ile wolno jechać i gdzie'),
    ('odleglosci', 'Odległości', 'Metry, które trzeba znać na pamięć'),
    ('swiatla', 'Światła', 'Co i kiedy musi się świecić'),
    ('manewry', 'Manewry', 'Wyprzedzanie, omijanie, zawracanie, cofanie'),
    ('postoj', 'Zatrzymanie i postój', 'Gdzie wolno stanąć, a gdzie nie'),
    ('pieszy', 'Pieszy i rowerzysta', 'Najczęstsze źródło punktów karnych'),
    ('droga', 'Autostrada i ekspresowa', 'Inne zasady niż na zwykłej drodze'),
    ('kierowca', 'Kierujący i pojazd', 'Stan, dokumenty, wyposażenie'),
    ('zdarzenia', 'Wypadek i awaria', 'Co robić, gdy coś się stanie'),
]

# (grupa, tytuł, sedno, opis, tabela|None)
# tabela: (nagłówki, wiersze)
ZASADY = [
    # ---------------------------------------------------------- pierwszeństwo
    ('pierwszenstwo', 'Reguła prawej ręki',
     'Na skrzyżowaniu równorzędnym ustępujesz temu, kto nadjeżdża z prawej strony.',
     'Działa tylko wtedy, gdy żadna droga nie jest oznaczona jako z pierwszeństwem — czyli gdy nie ma '
     'znaków A-7, B-20, D-1 ani sygnalizacji. Skrzyżowanie równorzędne bywa oznaczone znakiem A-5, ale '
     'częściej nie ma tam żadnego znaku i właśnie brak znaku jest informacją. Reguła nie zależy od tego, '
     'czy jedziesz prosto, czy skręcasz.', None),

    ('pierwszenstwo', 'Hierarchia: kto ma ostatnie słowo',
     'Policjant przebija sygnalizację, sygnalizacja przebija znaki, znaki przebijają zasady ogólne.',
     'Kolejność jest sztywna i rozstrzyga większość podchwytliwych pytań. Gdy na skrzyżowaniu stoi '
     'policjant, czerwone światło nad Tobą nie obowiązuje. Gdy działa sygnalizacja, znak A-7 przy niej '
     'nie decyduje. Gdy sygnalizacja jest wyłączona albo miga żółte — wracasz o poziom niżej, do znaków.',
     None),

    ('pierwszenstwo', 'Skręcanie w lewo',
     'Skręcając w lewo, ustępujesz jadącym z naprzeciwka na wprost i skręcającym w prawo.',
     'Dotyczy to także sytuacji, gdy masz zielone światło — zielone zezwala na wjazd, ale nie daje '
     'pierwszeństwa przed nadjeżdżającymi z przeciwka. Ustępujesz również pieszym przechodzącym przez '
     'jezdnię, na którą wjeżdżasz.', None),

    ('pierwszenstwo', 'Rondo',
     'Sam znak ronda nie daje pierwszeństwa jadącym po nim — robi to dopiero A-7 lub B-20 na wlocie.',
     'Znak C-12 mówi tylko, w którą stronę objeżdżać wyspę. Jeżeli na wlocie nie ma A-7 ani B-20, '
     'na rondzie obowiązuje reguła prawej ręki, czyli to Ty masz pierwszeństwo przed jadącymi po rondzie '
     'z Twojej lewej strony. W praktyce prawie zawsze A-7 tam stoi, ale pytania egzaminacyjne lubią '
     'przypadek bez niego.', None),

    ('pierwszenstwo', 'Tabliczka T-6a: droga z pierwszeństwem skręca',
     'Gruba linia na tabliczce pokazuje, którędy biegnie pierwszeństwo — niekoniecznie prosto.',
     'To jedna z najczęstszych pułapek. Widzisz znak D-1 albo A-7 i odruchowo zakładasz, że droga '
     'z pierwszeństwem idzie na wprost. Tabliczka pod znakiem może pokazywać, że skręca ona w lewo lub '
     'w prawo — wtedy jadąc na wprost zjeżdżasz z drogi z pierwszeństwem i musisz ustąpić.', None),

    ('pierwszenstwo', 'Włączanie się do ruchu',
     'Wyjeżdżając z drogi gruntowej, posesji, parkingu lub strefy zamieszkania ustępujesz wszystkim.',
     'Włączanie się do ruchu to także wjazd z pobocza, z drogi dla rowerów i ruszanie po postoju '
     'w miejscu do tego nieprzeznaczonym. Ustępujesz nie tylko pojazdom, ale i pieszym oraz rowerzystom.',
     None),

    ('pierwszenstwo', 'Pojazd uprzywilejowany',
     'Ustępujesz zawsze — także wjeżdżając na czerwonym, jeśli inaczej nie da się zrobić miejsca.',
     'Warunek: pojazd musi mieć włączone światła błyskowe niebieskie i sygnał dźwiękowy o zmiennym tonie. '
     'Sam „kogut" bez syreny nie czyni pojazdu uprzywilejowanym. Ustępowanie nie zwalnia z ostrożności — '
     'nie wolno przy tym stworzyć zagrożenia.', None),

    ('pierwszenstwo', 'Tramwaj',
     'Tramwaj nie ma pierwszeństwa z urzędu, ale wygrywa tam, gdzie reguły są równe.',
     'Na skrzyżowaniu równorzędnym tramwaj ma pierwszeństwo niezależnie od tego, z której strony '
     'nadjeżdża — reguła prawej ręki go nie dotyczy. Natomiast znaki obowiązują go tak samo jak Ciebie: '
     'tramwaj na drodze podporządkowanej ustępuje.', None),

    # ---------------------------------------------------------------- prędkość
    ('predkosc', 'Dopuszczalne prędkości',
     'Poza tabelą jest jeszcze jedna reguła: prędkość ma być bezpieczna, nawet gdy limit pozwala więcej.',
     'Limity dotyczą samochodu osobowego i motocykla. Zespół pojazdów, samochód ciężarowy powyżej 3,5 t '
     'i autobus mają własne, niższe wartości. Znak B-33 może obniżyć limit w każdym miejscu, a znak D-42 '
     'wprowadza 50 km/h nawet bez B-33.',
     (['Gdzie', 'Prędkość'],
      [['Strefa zamieszkania', '20 km/h'],
       ['Obszar zabudowany (znak D-42), całą dobę', '50 km/h'],
       ['Poza obszarem zabudowanym, droga jednojezdniowa', '90 km/h'],
       ['Droga dwujezdniowa o co najmniej dwóch pasach w każdą stronę', '100 km/h'],
       ['Droga ekspresowa jednojezdniowa', '100 km/h'],
       ['Droga ekspresowa dwujezdniowa', '120 km/h'],
       ['Autostrada', '140 km/h'],
       ['Zespół pojazdów (samochód z przyczepą) — autostrada i ekspresowa', '80 km/h'],
       ['Zespół pojazdów — pozostałe drogi poza obszarem zabudowanym', '70 km/h']])),

    ('predkosc', 'Prędkość bezpieczna',
     'Limit to górna granica, nie zalecenie — w deszczu, mgle i nocą bezpieczna jest niższa.',
     'Przepis wymaga jazdy z prędkością zapewniającą panowanie nad pojazdem z uwzględnieniem warunków. '
     'Za jazdę 90 km/h we mgle przy widoczności 30 m można odpowiadać, mimo że limit wynosi 90. '
     'Zasada praktyczna: musisz być w stanie zatrzymać się na odcinku, który widzisz.', None),

    ('predkosc', 'Przekroczenie o ponad 50 km/h w terenie zabudowanym',
     'Zabranie prawa jazdy na 3 miesiące, na miejscu.',
     'Dotyczy wyłącznie obszaru zabudowanego. Jeżeli w tym czasie kierujesz mimo zatrzymania uprawnienia, '
     'okres wydłuża się do 6 miesięcy. Poza obszarem zabudowanym to samo przekroczenie oznacza mandat '
     'i punkty, ale nie odbiór dokumentu.', None),

    # ------------------------------------------------------------- odległości
    ('odleglosci', 'Metry, które trzeba znać',
     'Większość zakazów postoju sprowadza się do czterech liczb: 10, 15, 25 i 50 metrów.',
     'Te wartości wracają w pytaniach częściej niż jakiekolwiek inne. Warto je zapamiętać jako zestaw, '
     'a nie osobno.',
     (['Odległość', 'Czego dotyczy'],
      [['10 m', 'Zakaz zatrzymywania przed i za przejściem dla pieszych oraz skrzyżowaniem'],
       ['10 m', 'Zakaz zatrzymywania od przejazdu dla rowerzystów'],
       ['15 m', 'Zakaz zatrzymywania od słupka lub tablicy przystanku'],
       ['25 m', 'Zakaz zatrzymywania od przystanku z zatoką'],
       ['10 m', 'Zakaz zatrzymywania od przejazdu kolejowego (przed)'],
       ['50 m', 'Odległość, z której trzeba widzieć przejazd kolejowy bez zapór'],
       ['100 m', 'Odstęp w tunelu przy prędkości powyżej 50 km/h'],
       ['50 m', 'Odstęp w tunelu przy prędkości do 50 km/h']])),

    ('odleglosci', 'Odstęp na autostradzie i ekspresowej',
     'Połowa prędkościomierza w metrach: 140 km/h to 70 metrów.',
     'Reguła obowiązuje na autostradzie i drodze ekspresowej. Nie dotyczy manewru wyprzedzania. '
     'Poza tymi drogami nie ma sztywnej liczby — obowiązuje odstęp pozwalający uniknąć zderzenia '
     'przy hamowaniu poprzedzającego pojazdu.', None),

    ('odleglosci', 'Znak ostrzegawczy stoi wcześniej, niż myślisz',
     'Poza obszarem zabudowanym 150–300 m przed miejscem, w obszarze zabudowanym do 100 m.',
     'Jeśli odległość jest inna, pod znakiem wisi tabliczka T-1 z konkretną wartością. To wyjaśnia, '
     'dlaczego po minięciu znaku „roboty na drodze" nic jeszcze nie widać — do robót zostało pół kilometra.',
     None),

    # ----------------------------------------------------------------- światła
    ('swiatla', 'Światła mijania przez całą dobę',
     'W Polsce jeździsz na światłach zawsze — także w słoneczne południe.',
     'Zamiast świateł mijania wolno w dzień używać świateł do jazdy dziennej, ale tylko od świtu do '
     'zmierzchu i przy dobrej widoczności. Gdy tylko pojawi się mgła, deszcz lub zmierzch, muszą być '
     'światła mijania — światła dzienne nie oświetlają tyłu pojazdu.', None),

    ('swiatla', 'Światła drogowe (długie)',
     'Wolno ich używać poza obszarem zabudowanym, gdy nie oślepisz nikogo.',
     'Trzeba je wyłączyć, gdy jedziesz za innym pojazdem, mijasz się z pojazdem lub tramwajem, a także '
     'gdy oświetlisz pieszego lub zwierzę na drodze. W obszarze zabudowanym zasadniczo nie wolno ich '
     'używać, chyba że droga jest nieoświetlona.', None),

    ('swiatla', 'Przeciwmgłowe: przednie i tylne to dwie różne sprawy',
     'Tylne wolno włączyć dopiero przy widoczności poniżej 50 metrów.',
     'Przednie światła przeciwmgłowe wolno włączyć we mgle, przy opadach śniegu i deszczu — to warunek '
     'łagodniejszy. Tylne są bardzo jasne i oślepiają jadących za Tobą, dlatego próg jest ostry: '
     'widoczność poniżej 50 m. Po wyjściu z mgły trzeba je wyłączyć.', None),

    ('swiatla', 'Światła awaryjne',
     'Do ostrzegania, nie do parkowania.',
     'Włączasz je, gdy pojazd stoi w miejscu, gdzie jest to zabronione ze względu na awarię, gdy '
     'gwałtownie hamujesz i widzisz zagrożenie z tyłu, albo gdy holujesz. Postój w drugim rzędzie '
     '„na awaryjnych" nie staje się przez to legalny.', None),

    # ----------------------------------------------------------------- manewry
    ('manewry', 'Gdzie nie wolno wyprzedzać',
     'Na przejściu dla pieszych i bezpośrednio przed nim, na przejazdach i skrzyżowaniach.',
     'Pełna lista: przejście dla pieszych i przejazd dla rowerzystów oraz bezpośrednio przed nimi, '
     'skrzyżowanie (poza skrzyżowaniem o ruchu okrężnym i sytuacją, gdy jedziesz drogą z pierwszeństwem), '
     'przejazd kolejowy i tramwajowy oraz bezpośrednio przed nimi, wierzchołek wzniesienia, zakręt '
     'oznaczony znakiem ostrzegawczym, oraz wszędzie tam, gdzie stoi znak B-25.', None),

    ('manewry', 'Wyprzedzanie, omijanie, wymijanie',
     'Wyprzedzasz jadącego, omijasz stojącego, wymijasz jadącego z naprzeciwka.',
     'Ta różnica bywa jedyną treścią pytania. Zakazy dotyczące wyprzedzania nie przenoszą się na '
     'omijanie: znak B-25 nie zabrania ominięcia stojącego pojazdu. Za to omijanie pojazdu, który '
     'zatrzymał się przed przejściem, jest zabronione zawsze — bo zasłania on pieszego.', None),

    ('manewry', 'Zawracanie — gdzie nie wolno',
     'Na moście, w tunelu, na autostradzie i ekspresowej, przy złej widoczności.',
     'Zakaz obejmuje: mosty i wiadukty, tunele, przejazdy kolejowe i tramwajowe, drogi jednokierunkowe, '
     'autostrady i drogi ekspresowe oraz warunki ograniczonej widoczności drogi. Znak B-23 dokłada zakaz '
     'w konkretnym miejscu, a znak B-21 (zakaz skrętu w lewo) zakazuje również zawracania.', None),

    ('manewry', 'Cofanie',
     'Cofać wolno, jeśli to bezpieczne — ale nie na autostradzie, w tunelu i na skrzyżowaniu.',
     'Podczas cofania ustępujesz pierwszeństwa wszystkim. Zakaz obejmuje autostradę, drogę ekspresową, '
     'tunel, most, wiadukt oraz skrzyżowanie. Jeśli nie masz dostatecznej widoczności, potrzebna jest '
     'pomoc innej osoby.', None),

    ('manewry', 'Zmiana pasa i kierunku',
     'Kierunkowskaz przed manewrem, a nie w jego trakcie — i wyłączony zaraz po.',
     'Sygnalizowanie nie daje pierwszeństwa: włączenie migacza nie zmusza nikogo do przepuszczenia Cię. '
     'Zmieniając pas, ustępujesz jadącym po pasie, na który wjeżdżasz.', None),

    # ------------------------------------------------------------------ postój
    ('postoj', 'Zatrzymanie a postój',
     'Zatrzymanie to unieruchomienie do minuty, postój — dłuższe.',
     'Ta granica rozstrzyga, który znak Cię dotyczy. Przy znaku B-35 (zakaz postoju) wolno stanąć na '
     'minutę, a także dłużej, jeśli wsiadają lub wysiadają pasażerowie. Przy B-36 (zakaz zatrzymywania) '
     'nie wolno unieruchomić pojazdu nawet na chwilę.', None),

    ('postoj', 'Gdzie nie wolno zatrzymać się nigdy',
     'Na przejściu, na skrzyżowaniu, na przejeździe, w tunelu, na moście.',
     'Zakaz obowiązuje niezależnie od znaków: na przejściu dla pieszych i przejeździe dla rowerzystów '
     'oraz w odległości 10 m przed nimi, na skrzyżowaniu i 10 m od niego, na przejeździe kolejowym '
     'i tramwajowym, w tunelu, na moście i wiadukcie, na drodze dla rowerów, w miejscu utrudniającym '
     'wjazd i wyjazd oraz na obszarze oznaczonym P-21 (powierzchnia wyłączona).', None),

    ('postoj', 'Postój w strefie zamieszkania',
     'Tylko w miejscach wyznaczonych — nigdzie indziej.',
     'W strefie zamieszkania nie obowiązuje zasada „wolno, jeśli nie zabroniono". Jest odwrotnie: postój '
     'jest dozwolony wyłącznie tam, gdzie wyznaczono do tego miejsce. Dodatkowo pieszy ma pierwszeństwo '
     'na całej szerokości drogi, a limit prędkości wynosi 20 km/h.', None),

    # ------------------------------------------------------------------ pieszy
    ('pieszy', 'Pierwszeństwo pieszego wchodzącego na przejście',
     'Ustępujesz nie tylko temu, kto już idzie, ale i temu, kto wchodzi.',
     'Zasada obowiązuje od czerwca 2021. Pieszy zyskuje pierwszeństwo w chwili wejścia na przejście, '
     'a Ty masz obowiązek zmniejszyć prędkość i ustąpić. Wyjątkiem jest tramwaj — przed nim pieszy '
     'uzyskuje pierwszeństwo dopiero na samym przejściu. Pieszy nie może przy tym wtargnąć ani używać '
     'telefonu wchodząc na przejście.', None),

    ('pieszy', 'Zbliżanie się do przejścia',
     'Szczególna ostrożność i zakaz wyprzedzania — także wtedy, gdy nikogo nie widać.',
     'Obowiązek zachowania szczególnej ostrożności powstaje przy samym zbliżaniu się, nie dopiero na '
     'przejściu. Nie wolno wyprzedzać na przejściu ani bezpośrednio przed nim, a jeżeli inny pojazd '
     'zatrzymał się, by przepuścić pieszego — nie wolno go omijać.', None),

    ('pieszy', 'Rowerzysta na przejeździe',
     'Ustępujesz rowerzyście znajdującemu się na przejeździe — wjeżdżającemu już nie musisz.',
     'Różnica wobec pieszego jest wyraźna i bywa sprawdzana. Rowerzysta ma pierwszeństwo, gdy jest już '
     'na przejeździe. Skręcając w drogę poprzeczną, ustępujesz rowerzyście jadącemu na wprost po drodze '
     'dla rowerów.', None),

    ('pieszy', 'Wyprzedzanie rowerzysty',
     'Co najmniej metr odstępu.',
     'Przy wyprzedzaniu roweru, motoroweru, motocykla lub pieszego trzeba zachować odstęp nie mniejszy '
     'niż 1 m. W praktyce oznacza to zwykle zjechanie na sąsiedni pas — a więc wyprzedzenie tylko wtedy, '
     'gdy jest to możliwe i bezpieczne.', None),

    # ------------------------------------------------------------------- droga
    ('droga', 'Czego nie wolno na autostradzie i ekspresowej',
     'Zawracać, cofać, zatrzymywać się poza miejscami wyznaczonymi, holować na ekspresowej.',
     'Zakazany jest też ruch pieszych, rowerów, motorowerów, pojazdów wolnobieżnych i ciągników. '
     'Zatrzymanie jest dozwolone wyłącznie na parkingach, w zatokach i — w razie awarii — na pasie '
     'awaryjnym, z włączonymi światłami awaryjnymi.', None),

    ('droga', 'Korytarz życia',
     'Przy zatorze zjeżdżasz: lewy pas do lewej, pozostałe do prawej.',
     'Obowiązek powstaje, gdy ruch się zatrzymuje lub znacznie spowalnia na drodze o co najmniej dwóch '
     'pasach w jedną stronę. Korytarz tworzy się zawczasu, a nie dopiero gdy słychać syrenę. Wjazd do '
     'korytarza pojazdem nieuprzywilejowanym jest zabroniony.', None),

    ('droga', 'Jazda na suwak',
     'Przy zwężeniu wpuszczasz jeden pojazd z pasa, który się kończy.',
     'Zasada obowiązuje, gdy pas zanika na drodze o co najmniej dwóch pasach. Kierujący na pasie '
     'kończącym się ma prawo włączyć się na samym końcu pasa, a jadący obok ma obowiązek go wpuścić — '
     'jeden pojazd, naprzemiennie.', None),

    ('droga', 'Wjazd i zjazd',
     'Na pasie włączania ustępujesz jadącym po autostradzie — to Ty się dostosowujesz.',
     'Pas rozbiegowy służy do rozpędzenia się do prędkości ruchu na drodze głównej. Zjazd zaczyna się od '
     'tablic F-14: trzy kreski to 300 m, dwie 200 m, jedna 100 m. Hamować należy dopiero na pasie '
     'wyłączania, nie na drodze głównej.', None),

    # ---------------------------------------------------------------- kierowca
    ('kierowca', 'Alkohol: dwa progi',
     '0,2‰ to wykroczenie, 0,5‰ to przestępstwo.',
     'Od 0,2 do 0,5 promila to stan po użyciu alkoholu — wykroczenie. Powyżej 0,5 promila to stan '
     'nietrzeźwości — przestępstwo, zagrożone karą pozbawienia wolności i obowiązkowym zakazem '
     'prowadzenia. W przeliczeniu na wydychane powietrze progi wynoszą 0,1 mg/l i 0,25 mg/l.', None),

    ('kierowca', 'Dokumenty',
     'Prawa jazdy i dowodu rejestracyjnego nie musisz wozić — polisy OC też nie.',
     'Od 2018 roku w Polsce kontrola sprawdza uprawnienia w systemie CEPiK. Obowiązek posiadania '
     'dokumentu przy sobie pozostaje jednak przy wyjeździe za granicę. Samo uprawnienie musi oczywiście '
     'istnieć — brak dokumentu to nie to samo co brak prawa jazdy.', None),

    ('kierowca', 'Okres próbny',
     'Pierwsze 2 lata: 20 punktów zamiast 24 i zakaz przekraczania określonych prędkości w pierwszych miesiącach.',
     'Okres próbny trwa 2 lata od wydania pierwszego prawa jazdy kategorii B. Przekroczenie limitu '
     'punktów w tym czasie oznacza cofnięcie uprawnień. Przez pierwsze 8 miesięcy nie wolno podejmować '
     'pracy zarobkowej jako kierowca.', None),

    ('kierowca', 'Foteliki i pasy',
     'Fotelik do 150 cm wzrostu; pasy zapinają wszyscy, także z tyłu.',
     'Dziecko poniżej 150 cm przewozi się w foteliku lub innym urządzeniu przytrzymującym. Dziecka '
     'poniżej 3 lat nie wolno przewozić bez fotelika w ogóle. Fotelika tyłem do kierunku jazdy nie wolno '
     'montować na przednim siedzeniu przy aktywnej poduszce powietrznej.', None),

    ('kierowca', 'Obowiązkowe wyposażenie',
     'Gaśnica i trójkąt ostrzegawczy — to wszystko, czego wymaga prawo.',
     'Apteczka, kamizelka i zapasowe żarówki nie są w Polsce obowiązkowe, choć bywają wymagane za '
     'granicą. Gaśnica musi być sprawna i dostępna, trójkąt służy do zabezpieczenia miejsca postoju '
     'pojazdu unieruchomionego.', None),

    # --------------------------------------------------------------- zdarzenia
    ('zdarzenia', 'Kolizja czy wypadek',
     'Są ranni — to wypadek i wzywasz służby. Tylko blachy — to kolizja.',
     'Przy kolizji wystarczy spisać oświadczenie i usunąć pojazdy z drogi, żeby nie tarasować ruchu. '
     'Przy wypadku nie wolno przestawiać pojazdów przed przybyciem policji, chyba że jest to konieczne '
     'dla ratowania życia. W obu przypadkach masz obowiązek zatrzymać się i udzielić pomocy.', None),

    ('zdarzenia', 'Kolejność czynności na miejscu zdarzenia',
     'Zabezpiecz, sprawdź, wezwij, pomagaj — w tej kolejności.',
     'Najpierw zabezpieczenie miejsca: światła awaryjne, kamizelka, trójkąt. Potem ocena stanu '
     'poszkodowanych. Następnie wezwanie pomocy — 112. Dopiero potem pierwsza pomoc. Odwrócenie tej '
     'kolejności grozi kolejnym wypadkiem z Twoim udziałem.', None),

    ('zdarzenia', 'Ustawienie trójkąta',
     'Obszar zabudowany — za pojazdem; zwykła droga — 30–50 m; autostrada — 100 m.',
     'Na drodze ekspresowej i autostradzie trójkąt ustawia się 100 m za pojazdem, na jezdni albo '
     'poboczu. Poza obszarem zabudowanym 30–50 m. W obszarze zabudowanym wystarczy umieścić go za '
     'pojazdem lub na nim, na wysokości do 1 m.', None),

    ('zdarzenia', 'Awaria na pasie awaryjnym',
     'Wysiadaj stroną od jezdni i czekaj za barierą, nie w aucie.',
     'Statystycznie najniebezpieczniejszym miejscem po awarii jest wnętrze stojącego pojazdu na pasie '
     'awaryjnym. Włącz światła awaryjne, załóż kamizelkę przed wyjściem, wystaw trójkąt i przejdź za '
     'barierę ochronną.', None),
]

# Jawne klucze wyszukiwania dla zasad, w których samo porównywanie słów zawodzi.
# Polska odmiana psuje dopasowanie po rdzeniu ("zawrócić" kontra "zawracanie"),
# więc tam, gdzie to istotne, podajemy fragmenty wprost. Porównanie idzie po
# tekście bez znaków diakrytycznych, małymi literami.
KLUCZE = {
    'Reguła prawej ręki': ['z prawej strony', 'rownorzedn', 'prawej reki', 'skrzyzowaniu dróg rownorzednych'],
    'Hierarchia: kto ma ostatnie słowo': ['policjant', 'kierujacy ruchem', 'osoby kierujacej ruchem', 'sygnalizacja jest wylaczona'],
    'Skręcanie w lewo': ['skrec w lewo', 'skrecasz w lewo', 'skrecajac w lewo'],
    'Rondo': ['rondo', 'ruchu okreznym', 'okrezn'],
    'Tabliczka T-6a: droga z pierwszeństwem skręca': ['t-6', 'tabliczk'],
    'Włączanie się do ruchu': ['wlacza', 'wlaczasz', 'wyjezdza'],
    'Pojazd uprzywilejowany': ['uprzywilejowan', 'karetk', 'sygnal swietlny blyskow'],
    'Tramwaj': ['tramwaj'],
    'Dopuszczalne prędkości': ['dopuszczalna predkosc', 'km/h', 'obszarze zabudowanym'],
    'Prędkość bezpieczna': ['predkosc bezpieczn', 'we mgle', 'ograniczonej widocznosci'],
    'Przekroczenie o ponad 50 km/h w terenie zabudowanym': ['przekrocz', 'zatrzymanie prawa jazdy'],
    'Znak ostrzegawczy stoi wcześniej, niż myślisz': ['ostrzegawcz'],
    'Metry, które trzeba znać': ['w odleglosci mniejszej niz', 'jakiej odleglosci'],
    'Odstęp na autostradzie i ekspresowej': ['odstep'],
    'Światła mijania przez całą dobę': ['swiatla mijania', 'swiatel mijania', 'jazdy dziennej'],
    'Światła drogowe (długie)': ['swiatla drogowe', 'swiatel drogowych', 'dlugie'],
    'Przeciwmgłowe: przednie i tylne to dwie różne sprawy': ['przeciwmglow'],
    'Światła awaryjne': ['swiatla awaryjne', 'swiatel awaryjnych'],
    'Gdzie nie wolno wyprzedzać': ['wyprzedza', 'wyprzedzi'],
    'Wyprzedzanie, omijanie, wymijanie': ['omija', 'wymija'],
    'Zawracanie — gdzie nie wolno': ['zawraca', 'zawroc'],
    'Cofanie': ['cofac', 'cofanie', 'cofnac pojazd'],
    'Zmiana pasa i kierunku': ['kierunkowskaz', 'zmiana pasa', 'zmienia pas'],
    'Zatrzymanie a postój': ['postoj pojazdu', 'zakaz postoju', 'pozostawic pojazd'],
    'Gdzie nie wolno zatrzymać się nigdy': ['zakaz zatrzymywania', 'nie wolno zatrzymywac', 'zatrzymac pojazd na przejsciu'],
    'Postój w strefie zamieszkania': ['strefie zamieszkania', 'strefa zamieszkania'],
    'Pierwszeństwo pieszego wchodzącego na przejście': ['piesz', 'przejsciu dla pieszych'],
    'Zbliżanie się do przejścia': ['przejscia dla pieszych', 'przejscie dla pieszych'],
    'Rowerzysta na przejeździe': ['przejezdzie dla rowerzystow', 'przejazd dla rowerzystow'],
    'Wyprzedzanie rowerzysty': ['1 m', 'metr odstepu'],
    'Czego nie wolno na autostradzie i ekspresowej': ['autostrad', 'ekspresow'],
    'Korytarz życia': ['korytarz'],
    'Jazda na suwak': ['suwak', 'zwezenie'],
    'Wjazd i zjazd': ['pas wlaczania', 'pas rozbiegow', 'pas wylaczania'],
    'Alkohol: dwa progi': ['alkohol', 'promil', 'nietrzezw'],
    'Dokumenty': ['dowod rejestracyjny', 'polise oc', 'dokumenty przy sobie'],
    'Okres próbny': ['okres probny', 'punkt karn'],
    'Foteliki i pasy': ['fotelik', 'pasy bezpieczen', 'urzadzenie przytrzymujace'],
    'Obowiązkowe wyposażenie': ['gasnic', 'trojkat ostrzegawcz', 'apteczk'],
    'Kolizja czy wypadek': ['wypadku drogowego', 'kolizj', 'uczestnikiem wypadku'],
    'Kolejność czynności na miejscu zdarzenia': ['pierwsz pomoc', 'poszkodowan', '112'],
    'Ustawienie trójkąta': ['trojkat'],
    'Awaria na pasie awaryjnym': ['pasie awaryjnym', 'unieruchomiony pojazd'],
}


def main():
    grupy = [{'kod': k, 'nazwa': n, 'opis': o,
              'ile': sum(1 for z in ZASADY if z[0] == k)} for k, n, o in GRUPY]

    znane = {g['kod'] for g in grupy}
    zasady = []
    for grupa, tytul, sedno, opis, tabela in ZASADY:
        if grupa not in znane:
            print(f'UWAGA: nieznana grupa "{grupa}" przy "{tytul}"')
        wpis = {'grupa': grupa, 'tytul': tytul, 'sedno': sedno, 'opis': opis}
        if tytul in KLUCZE:
            wpis['klucze'] = KLUCZE[tytul]
        if tabela:
            wpis['tabela'] = {'naglowki': tabela[0], 'wiersze': tabela[1]}
        zasady.append(wpis)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump({'grupy': grupy, 'zasady': zasady}, fh, ensure_ascii=False, separators=(',', ':'))

    print(f'zapisano {len(zasady)} zasad w {len(grupy)} grupach -> {OUT}')
    print(f'rozmiar: {os.path.getsize(OUT) / 1024:.0f} kB')
    for g in grupy:
        print(f"  {g['nazwa']:28} {g['ile']:3}")
    bez_kluczy = [z['tytul'] for z in zasady if 'klucze' not in z]
    if bez_kluczy:
        print()
        print(f'BEZ KLUCZY WYSZUKIWANIA ({len(bez_kluczy)}): ' + ', '.join(bez_kluczy))
    nieznane = [t for t in KLUCZE if t not in {z['tytul'] for z in zasady}]
    if nieznane:
        print('KLUCZE DO NIEISTNIEJĄCYCH ZASAD: ' + ', '.join(nieznane))

    puste = [g['nazwa'] for g in grupy if g['ile'] == 0]
    if puste:
        print('\nGRUPY BEZ TREŚCI: ' + ', '.join(puste))


if __name__ == '__main__':
    sys.exit(main())
