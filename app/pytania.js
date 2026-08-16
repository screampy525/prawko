'use strict';
// Wczytanie katalogu pytań i losowanie zestawów egzaminacyjnych.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PLIK = path.join(__dirname, 'data', 'pytania.json');

if (!fs.existsSync(PLIK)) {
  console.error(`\nBrak pliku ${PLIK}.\nUruchom najpierw:  python narzedzia/zbuduj-baze.py\n`);
  process.exit(1);
}

const katalog = JSON.parse(fs.readFileSync(PLIK, 'utf8'));
const pytania = katalog.pytania;
const wgId = new Map(pytania.map(p => [p.id, p]));

// Struktura egzaminu teoretycznego (rozporządzenie w sprawie egzaminowania):
// część podstawowa - 20 pytań TAK/NIE, część specjalistyczna - 12 pytań A/B/C.
const UKLAD_PODSTAWOWY = [
  { punkty: 3, ile: 10 },
  { punkty: 2, ile: 6 },
  { punkty: 1, ile: 4 },
];
const UKLAD_SPECJALISTYCZNY = [
  { punkty: 3, ile: 6 },
  { punkty: 2, ile: 4 },
  { punkty: 1, ile: 2 },
];
const MAX_PUNKTOW = 74;
const PROG_ZDANIA = 68;

// Limity czasu w sekundach.
const CZAS = {
  czytaniePodstawowe: 20,
  odpowiedzPodstawowa: 15,
  specjalistyczne: 50,
  calosc: 25 * 60,
};

function losowaKolejnosc(tablica) {
  const t = tablica.slice();
  for (let i = t.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

function pulaPytan(kategoria, zakres, typ, punkty) {
  return pytania.filter(p =>
    p.sprawne && !p.weryfikacja &&
    p.kategorie.includes(kategoria) &&
    p.zakres === zakres && p.typ === typ && p.punkty === punkty
  );
}

/**
 * Losuje zestaw egzaminacyjny dla danej kategorii.
 * Zwraca listę pozycji: { id, zakres, punkty, czasCzytania, czasOdpowiedzi }.
 */
function losujEgzamin(kategoria) {
  const pozycje = [];
  const uzyte = new Set();

  const dobierz = (zakres, typ, uklad) => {
    for (const { punkty, ile } of uklad) {
      const pula = pulaPytan(kategoria, zakres, typ, punkty).filter(p => !uzyte.has(p.id));
      if (pula.length < ile) {
        throw new Error(`Za mało pytań dla kategorii ${kategoria}: ${zakres}/${punkty} pkt (jest ${pula.length}, trzeba ${ile})`);
      }
      for (const p of losowaKolejnosc(pula).slice(0, ile)) {
        uzyte.add(p.id);
        pozycje.push({
          id: p.id,
          zakres: p.zakres,
          punkty: p.punkty,
          czasCzytania: zakres === 'P' ? CZAS.czytaniePodstawowe : 0,
          czasOdpowiedzi: zakres === 'P' ? CZAS.odpowiedzPodstawowa : CZAS.specjalistyczne,
        });
      }
    }
  };

  // Kolejność jest istotna: najpierw cała część podstawowa, potem specjalistyczna.
  const przedPodstawowe = pozycje.length;
  dobierz('P', 'tn', UKLAD_PODSTAWOWY);
  const podstawowe = losowaKolejnosc(pozycje.splice(przedPodstawowe));
  pozycje.push(...podstawowe);

  const przedSpec = pozycje.length;
  dobierz('S', 'abc', UKLAD_SPECJALISTYCZNY);
  const specjalistyczne = losowaKolejnosc(pozycje.splice(przedSpec));
  pozycje.push(...specjalistyczne);

  return { kategoria, pozycje, maxPunkty: MAX_PUNKTOW, progZdania: PROG_ZDANIA, czas: CZAS };
}

/** Przelicza wynik na serwerze - klient nie decyduje o punktacji. */
function policzWynik(pozycje, odpowiedzi) {
  let punkty = 0;
  let poprawne = 0;
  const szczegoly = [];
  for (const poz of pozycje) {
    const p = wgId.get(poz.id);
    const udzielona = odpowiedzi[poz.id] ?? null;
    const ok = p && udzielona !== null && udzielona === p.poprawna;
    if (ok) { punkty += poz.punkty; poprawne++; }
    szczegoly.push({
      id: poz.id,
      zakres: poz.zakres,
      punkty: poz.punkty,
      udzielona,
      poprawna: p ? p.poprawna : null,
      ok: !!ok,
    });
  }
  return {
    punkty,
    poprawne,
    maxPunkty: MAX_PUNKTOW,
    zdany: punkty >= PROG_ZDANIA,
    progZdania: PROG_ZDANIA,
    szczegoly,
  };
}

/** Nazwa klatki podglądowej wyciągniętej z filmu - filmu nie da się wydrukować. */
function klatkaFilmu(nazwaMedia) {
  return nazwaMedia.replace(/\.[^.]+$/, '') + '.jpg';
}

/**
 * Losuje zestaw arkuszy do wydruku. W przeciwieństwie do egzaminu w aplikacji
 * zwraca pełną treść pytań - wydruk nie ma dostępu do katalogu w przeglądarce.
 */
function losujArkusze(kategoria, ile) {
  const liczba = Math.min(Math.max(1, Math.round(Number(ile) || 1)), 50);
  const arkusze = [];

  for (let i = 0; i < liczba; i++) {
    const egzamin = losujEgzamin(kategoria);
    arkusze.push({
      numer: i + 1,
      kategoria,
      pytania: egzamin.pozycje.map((poz, indeks) => {
        const p = wgId.get(poz.id);
        return {
          lp: indeks + 1,
          id: p.id,
          tresc: p.tresc,
          typ: p.typ,
          poprawna: p.poprawna,
          odpowiedzi: p.odpowiedzi || null,
          zakres: p.zakres,
          punkty: p.punkty,
          // Do wydruku film zastępujemy klatką; zdjęcie idzie jak jest.
          obraz: p.media ? (p.mediaTyp === 'vid' ? 'klatki/' + klatkaFilmu(p.media) : p.media) : null,
          zFilmu: p.mediaTyp === 'vid',
        };
      }),
    });
  }

  return { kategoria, maxPunkty: MAX_PUNKTOW, progZdania: PROG_ZDANIA, arkusze };
}

module.exports = {
  katalog, pytania, wgId, losujEgzamin, losujArkusze, policzWynik,
  klatkaFilmu, CZAS, MAX_PUNKTOW, PROG_ZDANIA,
};
