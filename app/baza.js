'use strict';
// Warstwa danych: SQLite (wbudowany moduł node:sqlite, bez zależności zewnętrznych).

const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

// Domyślnie dane leżą obok kodu. Zmienna PRAWKO_DANE pozwala je przenieść -
// przydaje się na serwerze, gdzie postęp trzyma się na osobnym dysku, oraz
// przy testach, żeby nie ruszać prawdziwej bazy.
const KATALOG_DANYCH = process.env.PRAWKO_DANE || path.join(__dirname, 'dane');
fs.mkdirSync(KATALOG_DANYCH, { recursive: true });

const db = new DatabaseSync(path.join(KATALOG_DANYCH, 'postep.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS uzytkownicy (
  id         INTEGER PRIMARY KEY,
  login      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  hash       TEXT NOT NULL,
  sol        TEXT NOT NULL,
  utworzono  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sesje (
  token        TEXT PRIMARY KEY,
  uzytkownik   INTEGER NOT NULL REFERENCES uzytkownicy(id) ON DELETE CASCADE,
  wygasa       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ustawienia (
  uzytkownik   INTEGER PRIMARY KEY REFERENCES uzytkownicy(id) ON DELETE CASCADE,
  kategoria    TEXT NOT NULL DEFAULT 'B',
  motyw        TEXT NOT NULL DEFAULT 'auto',
  timery       INTEGER NOT NULL DEFAULT 1
);

-- Jeden wiersz na pytanie: bieżący stan wiedzy + harmonogram powtórek.
CREATE TABLE IF NOT EXISTS postep (
  uzytkownik   INTEGER NOT NULL REFERENCES uzytkownicy(id) ON DELETE CASCADE,
  pytanie      TEXT NOT NULL,
  dobre        INTEGER NOT NULL DEFAULT 0,
  zle          INTEGER NOT NULL DEFAULT 0,
  ostatnia_ok  INTEGER NOT NULL DEFAULT 0,   -- 1 jeśli ostatnia odpowiedź była poprawna
  poziom       INTEGER NOT NULL DEFAULT 0,   -- 0-5, stopień utrwalenia
  powtorka_do  INTEGER NOT NULL DEFAULT 0,   -- kiedy pytanie wraca w powtórkach (ms)
  kiedy        INTEGER NOT NULL DEFAULT 0,   -- ostatnia odpowiedź (ms)
  PRIMARY KEY (uzytkownik, pytanie)
);

-- Pełny dziennik odpowiedzi - potrzebny do wykresu postępu w czasie.
CREATE TABLE IF NOT EXISTS odpowiedzi (
  id           INTEGER PRIMARY KEY,
  uzytkownik   INTEGER NOT NULL REFERENCES uzytkownicy(id) ON DELETE CASCADE,
  pytanie      TEXT NOT NULL,
  poprawnie    INTEGER NOT NULL,
  tryb         TEXT NOT NULL,               -- nauka | egzamin | powtorki
  kiedy        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS zakladki (
  uzytkownik   INTEGER NOT NULL REFERENCES uzytkownicy(id) ON DELETE CASCADE,
  pytanie      TEXT NOT NULL,
  PRIMARY KEY (uzytkownik, pytanie)
);

CREATE TABLE IF NOT EXISTS notatki (
  uzytkownik   INTEGER NOT NULL REFERENCES uzytkownicy(id) ON DELETE CASCADE,
  pytanie      TEXT NOT NULL,
  tresc        TEXT NOT NULL,
  kiedy        INTEGER NOT NULL,
  PRIMARY KEY (uzytkownik, pytanie)
);

-- Pytania, które użytkownik sam uznał za podchwytliwe.
CREATE TABLE IF NOT EXISTS podchwytliwe (
  uzytkownik   INTEGER NOT NULL REFERENCES uzytkownicy(id) ON DELETE CASCADE,
  pytanie      TEXT NOT NULL,
  uwaga        TEXT NOT NULL DEFAULT '',
  kiedy        INTEGER NOT NULL,
  PRIMARY KEY (uzytkownik, pytanie)
);

-- Wyjaśnienia generowane raz i zapisywane na stałe - wspólne dla wszystkich kont.
CREATE TABLE IF NOT EXISTS wyjasnienia (
  pytanie      TEXT PRIMARY KEY,
  tresc        TEXT NOT NULL,
  model        TEXT NOT NULL,
  kiedy        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS egzaminy (
  id           INTEGER PRIMARY KEY,
  uzytkownik   INTEGER NOT NULL REFERENCES uzytkownicy(id) ON DELETE CASCADE,
  kategoria    TEXT NOT NULL,
  punkty       INTEGER NOT NULL,
  max_punkty   INTEGER NOT NULL,
  zdany        INTEGER NOT NULL,
  poprawne     INTEGER NOT NULL,
  czas         INTEGER NOT NULL,            -- sekundy
  kiedy        INTEGER NOT NULL,
  szczegoly    TEXT NOT NULL                -- JSON: lista pytań z odpowiedziami
);

CREATE INDEX IF NOT EXISTS idx_odp_uzytk ON odpowiedzi(uzytkownik, kiedy);
CREATE INDEX IF NOT EXISTS idx_egz_uzytk ON egzaminy(uzytkownik, kiedy);
CREATE INDEX IF NOT EXISTS idx_postep_powt ON postep(uzytkownik, powtorka_do);
`);

// ---------- hasła ----------

function zahaszuj(haslo, sol = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(haslo, sol, 64).toString('hex');
  return { hash, sol };
}

function sprawdzHaslo(haslo, hash, sol) {
  const wyliczony = crypto.scryptSync(haslo, sol, 64);
  const zapisany = Buffer.from(hash, 'hex');
  return zapisany.length === wyliczony.length && crypto.timingSafeEqual(wyliczony, zapisany);
}

// ---------- użytkownicy i sesje ----------

const TRWANIE_SESJI = 90 * 24 * 3600 * 1000; // 90 dni

function utworzUzytkownika(login, haslo) {
  const { hash, sol } = zahaszuj(haslo);
  const info = db.prepare(
    'INSERT INTO uzytkownicy (login, hash, sol, utworzono) VALUES (?, ?, ?, ?)'
  ).run(login, hash, sol, Date.now());
  const id = Number(info.lastInsertRowid);
  db.prepare('INSERT INTO ustawienia (uzytkownik) VALUES (?)').run(id);
  return id;
}

function znajdzUzytkownika(login) {
  return db.prepare('SELECT * FROM uzytkownicy WHERE login = ?').get(login);
}

function zaloguj(login, haslo) {
  const u = znajdzUzytkownika(login);
  if (!u || !sprawdzHaslo(haslo, u.hash, u.sol)) return null;
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sesje (token, uzytkownik, wygasa) VALUES (?, ?, ?)')
    .run(token, u.id, Date.now() + TRWANIE_SESJI);
  return { token, id: u.id, login: u.login };
}

function uzytkownikZTokenu(token) {
  if (!token) return null;
  const s = db.prepare(
    `SELECT u.id, u.login FROM sesje s
     JOIN uzytkownicy u ON u.id = s.uzytkownik
     WHERE s.token = ? AND s.wygasa > ?`
  ).get(token, Date.now());
  return s || null;
}

function wyloguj(token) {
  db.prepare('DELETE FROM sesje WHERE token = ?').run(token);
}

function usunWygasleSesje() {
  db.prepare('DELETE FROM sesje WHERE wygasa <= ?').run(Date.now());
}

// ---------- ustawienia ----------

function pobierzUstawienia(uid) {
  let u = db.prepare('SELECT kategoria, motyw, timery FROM ustawienia WHERE uzytkownik = ?').get(uid);
  if (!u) {
    db.prepare('INSERT INTO ustawienia (uzytkownik) VALUES (?)').run(uid);
    u = { kategoria: 'B', motyw: 'auto', timery: 1 };
  }
  return { kategoria: u.kategoria, motyw: u.motyw, timery: !!u.timery };
}

function zapiszUstawienia(uid, zmiany) {
  const obecne = pobierzUstawienia(uid);
  const nowe = {
    kategoria: zmiany.kategoria ?? obecne.kategoria,
    motyw: zmiany.motyw ?? obecne.motyw,
    timery: zmiany.timery === undefined ? obecne.timery : !!zmiany.timery,
  };
  db.prepare('UPDATE ustawienia SET kategoria = ?, motyw = ?, timery = ? WHERE uzytkownik = ?')
    .run(nowe.kategoria, nowe.motyw, nowe.timery ? 1 : 0, uid);
  return nowe;
}

// ---------- postęp i powtórki ----------

// Odstępy powtórek dla kolejnych poziomów utrwalenia.
const ODSTEPY = [
  10 * 60 * 1000,        // poziom 1 - 10 minut
  24 * 3600 * 1000,      // poziom 2 - 1 dzień
  3 * 24 * 3600 * 1000,  // poziom 3 - 3 dni
  7 * 24 * 3600 * 1000,  // poziom 4 - tydzień
  21 * 24 * 3600 * 1000, // poziom 5 - 3 tygodnie
  60 * 24 * 3600 * 1000, // poziom 6 - 2 miesiące
];

function zapiszOdpowiedz(uid, pytanie, poprawnie, tryb) {
  const teraz = Date.now();
  const ok = poprawnie ? 1 : 0;

  db.prepare('INSERT INTO odpowiedzi (uzytkownik, pytanie, poprawnie, tryb, kiedy) VALUES (?, ?, ?, ?, ?)')
    .run(uid, pytanie, ok, tryb, teraz);

  const stan = db.prepare('SELECT poziom FROM postep WHERE uzytkownik = ? AND pytanie = ?').get(uid, pytanie);
  const poprzedniPoziom = stan ? stan.poziom : 0;
  // Błąd cofa pytanie na start, poprawna odpowiedź przesuwa o jeden poziom wyżej.
  const poziom = ok ? Math.min(poprzedniPoziom + 1, ODSTEPY.length) : 0;
  const powtorkaDo = ok ? teraz + ODSTEPY[Math.min(poziom, ODSTEPY.length) - 1] : teraz;

  db.prepare(`
    INSERT INTO postep (uzytkownik, pytanie, dobre, zle, ostatnia_ok, poziom, powtorka_do, kiedy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(uzytkownik, pytanie) DO UPDATE SET
      dobre = dobre + ?, zle = zle + ?, ostatnia_ok = ?, poziom = ?, powtorka_do = ?, kiedy = ?
  `).run(uid, pytanie, ok, 1 - ok, ok, poziom, powtorkaDo, teraz,
         ok, 1 - ok, ok, poziom, powtorkaDo, teraz);

  return { poziom, powtorkaDo };
}

function pobierzPostep(uid) {
  const wiersze = db.prepare(
    'SELECT pytanie, dobre, zle, ostatnia_ok, poziom, powtorka_do, kiedy FROM postep WHERE uzytkownik = ?'
  ).all(uid);
  const mapa = {};
  for (const w of wiersze) {
    mapa[w.pytanie] = {
      dobre: w.dobre, zle: w.zle, ostatniaOk: !!w.ostatnia_ok,
      poziom: w.poziom, powtorkaDo: w.powtorka_do, kiedy: w.kiedy,
    };
  }
  return mapa;
}

function wyzerujPostep(uid) {
  db.prepare('DELETE FROM postep WHERE uzytkownik = ?').run(uid);
  db.prepare('DELETE FROM odpowiedzi WHERE uzytkownik = ?').run(uid);
  db.prepare('DELETE FROM egzaminy WHERE uzytkownik = ?').run(uid);
}

// ---------- zakładki i notatki ----------

function przelaczZakladke(uid, pytanie) {
  const jest = db.prepare('SELECT 1 AS x FROM zakladki WHERE uzytkownik = ? AND pytanie = ?').get(uid, pytanie);
  if (jest) {
    db.prepare('DELETE FROM zakladki WHERE uzytkownik = ? AND pytanie = ?').run(uid, pytanie);
    return false;
  }
  db.prepare('INSERT INTO zakladki (uzytkownik, pytanie) VALUES (?, ?)').run(uid, pytanie);
  return true;
}

function pobierzZakladki(uid) {
  return db.prepare('SELECT pytanie FROM zakladki WHERE uzytkownik = ?').all(uid).map(w => w.pytanie);
}

function zapiszNotatke(uid, pytanie, tresc) {
  const czysta = (tresc || '').trim();
  if (!czysta) {
    db.prepare('DELETE FROM notatki WHERE uzytkownik = ? AND pytanie = ?').run(uid, pytanie);
    return '';
  }
  db.prepare(`
    INSERT INTO notatki (uzytkownik, pytanie, tresc, kiedy) VALUES (?, ?, ?, ?)
    ON CONFLICT(uzytkownik, pytanie) DO UPDATE SET tresc = ?, kiedy = ?
  `).run(uid, pytanie, czysta, Date.now(), czysta, Date.now());
  return czysta;
}

function pobierzNotatki(uid) {
  const mapa = {};
  for (const w of db.prepare('SELECT pytanie, tresc FROM notatki WHERE uzytkownik = ?').all(uid)) {
    mapa[w.pytanie] = w.tresc;
  }
  return mapa;
}

// ---------- pytania podchwytliwe (oznaczone przez użytkownika) ----------

function przelaczPodchwytliwe(uid, pytanie, uwaga = '') {
  const jest = db.prepare('SELECT 1 AS x FROM podchwytliwe WHERE uzytkownik = ? AND pytanie = ?').get(uid, pytanie);
  if (jest) {
    db.prepare('DELETE FROM podchwytliwe WHERE uzytkownik = ? AND pytanie = ?').run(uid, pytanie);
    return false;
  }
  db.prepare('INSERT INTO podchwytliwe (uzytkownik, pytanie, uwaga, kiedy) VALUES (?, ?, ?, ?)')
    .run(uid, pytanie, String(uwaga || '').trim(), Date.now());
  return true;
}

function pobierzPodchwytliwe(uid) {
  const mapa = {};
  for (const w of db.prepare('SELECT pytanie, uwaga FROM podchwytliwe WHERE uzytkownik = ?').all(uid)) {
    mapa[w.pytanie] = w.uwaga;
  }
  return mapa;
}

function zapiszUwagePodchwytliwa(uid, pytanie, uwaga) {
  const czysta = String(uwaga || '').trim();
  db.prepare(`
    INSERT INTO podchwytliwe (uzytkownik, pytanie, uwaga, kiedy) VALUES (?, ?, ?, ?)
    ON CONFLICT(uzytkownik, pytanie) DO UPDATE SET uwaga = ?
  `).run(uid, pytanie, czysta, Date.now(), czysta);
  return czysta;
}

// ---------- wyjaśnienia ----------

function pobierzWyjasnienia() {
  const mapa = {};
  for (const w of db.prepare('SELECT pytanie, tresc FROM wyjasnienia').all()) {
    mapa[w.pytanie] = w.tresc;
  }
  return mapa;
}

function zapiszWyjasnienie(pytanie, tresc, model) {
  db.prepare(`
    INSERT INTO wyjasnienia (pytanie, tresc, model, kiedy) VALUES (?, ?, ?, ?)
    ON CONFLICT(pytanie) DO UPDATE SET tresc = ?, model = ?, kiedy = ?
  `).run(pytanie, tresc, model, Date.now(), tresc, model, Date.now());
}

function policzWyjasnienia() {
  return db.prepare('SELECT COUNT(*) AS ile FROM wyjasnienia').get().ile;
}

// ---------- egzaminy ----------

function zapiszEgzamin(uid, wynik) {
  const info = db.prepare(`
    INSERT INTO egzaminy (uzytkownik, kategoria, punkty, max_punkty, zdany, poprawne, czas, kiedy, szczegoly)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uid, wynik.kategoria, wynik.punkty, wynik.maxPunkty, wynik.zdany ? 1 : 0,
         wynik.poprawne, wynik.czas, Date.now(), JSON.stringify(wynik.szczegoly || []));
  return Number(info.lastInsertRowid);
}

function pobierzEgzaminy(uid, limit = 100) {
  return db.prepare(`
    SELECT id, kategoria, punkty, max_punkty AS maxPunkty, zdany, poprawne, czas, kiedy
    FROM egzaminy WHERE uzytkownik = ? ORDER BY kiedy DESC LIMIT ?
  `).all(uid, limit).map(e => ({ ...e, zdany: !!e.zdany }));
}

function pobierzEgzamin(uid, id) {
  const e = db.prepare('SELECT * FROM egzaminy WHERE uzytkownik = ? AND id = ?').get(uid, id);
  if (!e) return null;
  return { ...e, zdany: !!e.zdany, maxPunkty: e.max_punkty, szczegoly: JSON.parse(e.szczegoly) };
}

// ---------- statystyki ----------

function statystykiDzienne(uid, dni = 60) {
  const od = Date.now() - dni * 24 * 3600 * 1000;
  return db.prepare(`
    SELECT date(kiedy / 1000, 'unixepoch', 'localtime') AS dzien,
           COUNT(*) AS razem,
           SUM(poprawnie) AS dobre
    FROM odpowiedzi WHERE uzytkownik = ? AND kiedy >= ?
    GROUP BY dzien ORDER BY dzien
  `).all(uid, od);
}

module.exports = {
  db,
  utworzUzytkownika, znajdzUzytkownika, zaloguj, uzytkownikZTokenu, wyloguj, usunWygasleSesje,
  pobierzUstawienia, zapiszUstawienia,
  zapiszOdpowiedz, pobierzPostep, wyzerujPostep,
  przelaczZakladke, pobierzZakladki, zapiszNotatke, pobierzNotatki,
  przelaczPodchwytliwe, pobierzPodchwytliwe, zapiszUwagePodchwytliwa,
  pobierzWyjasnienia, zapiszWyjasnienie, policzWyjasnienia,
  zapiszEgzamin, pobierzEgzaminy, pobierzEgzamin,
  statystykiDzienne,
};
