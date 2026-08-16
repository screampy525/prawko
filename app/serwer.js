'use strict';
// Lokalny serwer aplikacji do nauki na egzamin teoretyczny.
// Bez zależności zewnętrznych - wystarczy Node 22+.

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const baza = require('./baza');
const katalogPytan = require('./pytania');

const PORT = Number(process.env.PORT || 8080);
const KATALOG_PUBLICZNY = path.join(__dirname, 'public');
const KATALOG_MEDIOW = path.join(__dirname, '..', 'media');

const TYPY_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// ---------- pomocnicze ----------

function odpowiedzJson(res, kod, dane) {
  const tresc = JSON.stringify(dane);
  res.writeHead(kod, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(tresc),
    'Cache-Control': 'no-store',
  });
  res.end(tresc);
}

function czytajCiasteczka(req) {
  const naglowek = req.headers.cookie;
  if (!naglowek) return {};
  const wynik = {};
  for (const czesc of naglowek.split(';')) {
    const i = czesc.indexOf('=');
    if (i > 0) wynik[czesc.slice(0, i).trim()] = decodeURIComponent(czesc.slice(i + 1).trim());
  }
  return wynik;
}

async function czytajCialo(req, limit = 512 * 1024) {
  const kawalki = [];
  let rozmiar = 0;
  for await (const kawalek of req) {
    rozmiar += kawalek.length;
    if (rozmiar > limit) throw new Error('Zbyt duże żądanie');
    kawalki.push(kawalek);
  }
  if (!kawalki.length) return {};
  try {
    return JSON.parse(Buffer.concat(kawalki).toString('utf8'));
  } catch {
    throw new Error('Nieprawidłowy JSON');
  }
}

const dodatkowe = new Map();

/** Wczytuje plik z app/data przy pierwszym żądaniu i po każdej jego przebudowie,
 *  żeby skrypty z narzedzia/ nie wymagały restartu serwera. */
function katalogDodatkowy(nazwa, pusty) {
  const plik = path.join(__dirname, 'data', nazwa);
  if (!fs.existsSync(plik)) return pusty;
  const znacznik = fs.statSync(plik).mtimeMs;
  const zapamietany = dodatkowe.get(nazwa);
  if (!zapamietany || zapamietany.znacznik !== znacznik) {
    const dane = JSON.parse(fs.readFileSync(plik, 'utf8'));
    dodatkowe.set(nazwa, { znacznik, dane });
    return dane;
  }
  return zapamietany.dane;
}

/** Blokuje wyjście poza wskazany katalog (np. przez ../ w adresie). */
function bezpiecznaSciezka(katalog, wzgledna) {
  const pelna = path.resolve(katalog, '.' + path.posix.normalize('/' + wzgledna));
  const korzen = path.resolve(katalog);
  if (pelna !== korzen && !pelna.startsWith(korzen + path.sep)) return null;
  return pelna;
}

// ---------- serwowanie plików (z obsługą Range dla wideo) ----------

async function wyslijPlik(req, res, pelnaSciezka, { cache = 'public, max-age=3600' } = {}) {
  let stat;
  try {
    stat = await fsp.stat(pelnaSciezka);
    if (!stat.isFile()) throw new Error('nie plik');
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Nie znaleziono pliku');
  }

  const typ = TYPY_MIME[path.extname(pelnaSciezka).toLowerCase()] || 'application/octet-stream';
  const etag = `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag, 'Cache-Control': cache });
    return res.end();
  }

  const zakres = req.headers.range;
  // Odtwarzacz wideo prosi o fragmenty pliku - bez tego przewijanie nie działa.
  if (zakres) {
    const dopasowanie = /^bytes=(\d*)-(\d*)$/.exec(zakres);
    if (dopasowanie) {
      let poczatek = dopasowanie[1] === '' ? null : Number(dopasowanie[1]);
      let koniec = dopasowanie[2] === '' ? null : Number(dopasowanie[2]);
      if (poczatek === null && koniec !== null) {
        poczatek = Math.max(0, stat.size - koniec);
        koniec = stat.size - 1;
      } else {
        if (poczatek === null) poczatek = 0;
        if (koniec === null || koniec >= stat.size) koniec = stat.size - 1;
      }
      if (poczatek > koniec || poczatek >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        return res.end();
      }
      res.writeHead(206, {
        'Content-Type': typ,
        'Content-Length': koniec - poczatek + 1,
        'Content-Range': `bytes ${poczatek}-${koniec}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': cache,
        ETag: etag,
      });
      return fs.createReadStream(pelnaSciezka, { start: poczatek, end: koniec }).pipe(res);
    }
  }

  res.writeHead(200, {
    'Content-Type': typ,
    'Content-Length': stat.size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': cache,
    ETag: etag,
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(pelnaSciezka).pipe(res);
}

// ---------- API ----------

function wymagajLogowania(req) {
  const ciasteczka = czytajCiasteczka(req);
  return baza.uzytkownikZTokenu(ciasteczka.sesja);
}

/** Adres klienta. Za tunelem albo proxy prawdziwy adres jest w nagłówku. */
function adresKlienta(req) {
  const przekazany = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return przekazany || req.socket.remoteAddress || 'nieznany';
}

// ---------- ograniczanie prób logowania ----------
// W sieci domowej zbędne, ale pod publicznym adresem (tunel, VPS) bez tego
// można zgadywać hasła bez końca. Licznik w pamięci wystarcza, bo serwer
// jest jednym procesem - restart czyści limity i to jest akceptowalne.
const nieudaneProby = new Map();          // adres -> { ile, wygasa }
const LIMIT_PROB = 10;
const OKNO_LIMITU = 15 * 60 * 1000;

/** Ile sekund zostało blokady; 0 gdy adres nie jest zablokowany. */
function blokadaLogowania(req) {
  const wpis = nieudaneProby.get(adresKlienta(req));
  if (!wpis || Date.now() > wpis.wygasa) return 0;
  return wpis.ile >= LIMIT_PROB ? Math.ceil((wpis.wygasa - Date.now()) / 1000) : 0;
}

function odnotujNieudanaProbe(req) {
  // Przy okazji usuwamy wygasłe wpisy - inaczej skaner pukający z wielu adresów
  // rozdmuchałby mapę bez ograniczeń.
  for (const [adres, wpis] of nieudaneProby) {
    if (Date.now() > wpis.wygasa) nieudaneProby.delete(adres);
  }
  const adres = adresKlienta(req);
  const wpis = nieudaneProby.get(adres);
  if (!wpis || Date.now() > wpis.wygasa) {
    nieudaneProby.set(adres, { ile: 1, wygasa: Date.now() + OKNO_LIMITU });
  } else {
    wpis.ile += 1;
  }
}

function ustawCiasteczkoSesji(res, token, req) {
  // Przez tunel klient łączy się po HTTPS, choć do serwera trafia zwykły HTTP -
  // poznajemy to po nagłówku od proxy. Flagi Secure nie ustawiamy na sztywno,
  // bo zablokowałaby logowanie z telefonu po http w sieci domowej.
  const poHttps = String(req?.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  res.setHeader('Set-Cookie',
    `sesja=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${90 * 24 * 3600}`
    + (poHttps ? '; Secure' : ''));
}

function stanUzytkownika(uid, login) {
  return {
    uzytkownik: { id: uid, login },
    ustawienia: baza.pobierzUstawienia(uid),
    postep: baza.pobierzPostep(uid),
    zakladki: baza.pobierzZakladki(uid),
    notatki: baza.pobierzNotatki(uid),
    podchwytliwe: baza.pobierzPodchwytliwe(uid),
    wyjasnienia: baza.pobierzWyjasnienia(),
  };
}

// Zestawy egzaminacyjne w pamięci - potrzebne, by wynik przeliczyć po stronie serwera.
const trwajaceEgzaminy = new Map();

function sprzatnijEgzaminy() {
  const granica = Date.now() - 3 * 3600 * 1000;
  for (const [klucz, egz] of trwajaceEgzaminy) {
    if (egz.rozpoczety < granica) trwajaceEgzaminy.delete(klucz);
  }
}

async function obsluzApi(req, res, sciezka) {
  const metoda = req.method;

  // --- publiczne ---
  if (sciezka === '/api/logowanie' && metoda === 'POST') {
    const blokada = blokadaLogowania(req);
    if (blokada) {
      return odpowiedzJson(res, 429,
        { blad: `Za dużo nieudanych prób. Spróbuj ponownie za ${Math.ceil(blokada / 60)} min.` });
    }
    const { login, haslo } = await czytajCialo(req);
    if (!login || !haslo) return odpowiedzJson(res, 400, { blad: 'Podaj login i hasło' });
    const sesja = baza.zaloguj(String(login).trim(), String(haslo));
    if (!sesja) {
      odnotujNieudanaProbe(req);
      return odpowiedzJson(res, 401, { blad: 'Nieprawidłowy login lub hasło' });
    }
    ustawCiasteczkoSesji(res, sesja.token, req);
    return odpowiedzJson(res, 200, stanUzytkownika(sesja.id, sesja.login));
  }

  if (sciezka === '/api/rejestracja' && metoda === 'POST') {
    // Ten sam limit chroni przed masowym zakładaniem kont z jednego adresu.
    const blokada = blokadaLogowania(req);
    if (blokada) {
      return odpowiedzJson(res, 429,
        { blad: `Za dużo prób. Spróbuj ponownie za ${Math.ceil(blokada / 60)} min.` });
    }
    const { login, haslo } = await czytajCialo(req);
    const l = String(login || '').trim();
    const h = String(haslo || '');
    if (l.length < 3) return odpowiedzJson(res, 400, { blad: 'Login musi mieć co najmniej 3 znaki' });
    if (h.length < 6) return odpowiedzJson(res, 400, { blad: 'Hasło musi mieć co najmniej 6 znaków' });
    if (baza.znajdzUzytkownika(l)) {
      odnotujNieudanaProbe(req);
      return odpowiedzJson(res, 409, { blad: 'Taki login już istnieje' });
    }
    baza.utworzUzytkownika(l, h);
    const sesja = baza.zaloguj(l, h);
    ustawCiasteczkoSesji(res, sesja.token, req);
    return odpowiedzJson(res, 200, stanUzytkownika(sesja.id, sesja.login));
  }

  if (sciezka === '/api/katalog' && metoda === 'GET') {
    // Największa odpowiedź w aplikacji - klient trzyma ją potem w pamięci.
    const tresc = JSON.stringify({
      wersja: katalogPytan.katalog.wersja,
      kategorie: katalogPytan.katalog.kategorie,
      pytania: katalogPytan.pytania,
      czas: katalogPytan.CZAS,
      maxPunkty: katalogPytan.MAX_PUNKTOW,
      progZdania: katalogPytan.PROG_ZDANIA,
    });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(tresc),
      'Cache-Control': 'no-cache',
    });
    return res.end(tresc);
  }

  // Katalogi znaków i zasad wczytujemy dopiero przy pierwszym wejściu w daną
  // zakładkę, żeby nie obciążać startu serwera czymś, czego sesja może nie użyć.
  if (sciezka === '/api/znaki' && metoda === 'GET') {
    return odpowiedzJson(res, 200, katalogDodatkowy('znaki.json', { grupy: [], znaki: [] }));
  }

  if (sciezka === '/api/zasady' && metoda === 'GET') {
    return odpowiedzJson(res, 200, katalogDodatkowy('zasady.json', { grupy: [], zasady: [] }));
  }

  // --- wymagające zalogowania ---
  const u = wymagajLogowania(req);

  if (sciezka === '/api/ja' && metoda === 'GET') {
    if (!u) return odpowiedzJson(res, 401, { blad: 'Nie zalogowano' });
    return odpowiedzJson(res, 200, stanUzytkownika(u.id, u.login));
  }

  if (!u) return odpowiedzJson(res, 401, { blad: 'Nie zalogowano' });

  if (sciezka === '/api/wyloguj' && metoda === 'POST') {
    baza.wyloguj(czytajCiasteczka(req).sesja);
    res.setHeader('Set-Cookie', 'sesja=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return odpowiedzJson(res, 200, { ok: true });
  }

  if (sciezka === '/api/ustawienia' && metoda === 'POST') {
    const zmiany = await czytajCialo(req);
    return odpowiedzJson(res, 200, baza.zapiszUstawienia(u.id, zmiany));
  }

  if (sciezka === '/api/odpowiedz' && metoda === 'POST') {
    const { pytanie, poprawnie, tryb } = await czytajCialo(req);
    if (!pytanie || !katalogPytan.wgId.has(String(pytanie))) {
      return odpowiedzJson(res, 400, { blad: 'Nieznane pytanie' });
    }
    const stan = baza.zapiszOdpowiedz(u.id, String(pytanie), !!poprawnie, tryb === 'powtorki' ? 'powtorki' : 'nauka');
    return odpowiedzJson(res, 200, stan);
  }

  if (sciezka === '/api/zakladka' && metoda === 'POST') {
    const { pytanie } = await czytajCialo(req);
    if (!pytanie) return odpowiedzJson(res, 400, { blad: 'Brak pytania' });
    return odpowiedzJson(res, 200, { aktywna: baza.przelaczZakladke(u.id, String(pytanie)) });
  }

  if (sciezka === '/api/notatka' && metoda === 'POST') {
    const { pytanie, tresc } = await czytajCialo(req);
    if (!pytanie) return odpowiedzJson(res, 400, { blad: 'Brak pytania' });
    return odpowiedzJson(res, 200, { tresc: baza.zapiszNotatke(u.id, String(pytanie), tresc) });
  }

  if (sciezka === '/api/egzamin/nowy' && metoda === 'POST') {
    const { kategoria } = await czytajCialo(req);
    const kat = String(kategoria || baza.pobierzUstawienia(u.id).kategoria).toUpperCase();
    try {
      const egzamin = katalogPytan.losujEgzamin(kat);
      const klucz = crypto.randomBytes(16).toString('hex');
      sprzatnijEgzaminy();
      trwajaceEgzaminy.set(klucz, { uzytkownik: u.id, pozycje: egzamin.pozycje, kategoria: kat, rozpoczety: Date.now() });
      return odpowiedzJson(res, 200, { klucz, ...egzamin });
    } catch (e) {
      return odpowiedzJson(res, 400, { blad: e.message });
    }
  }

  if (sciezka === '/api/egzamin/zakoncz' && metoda === 'POST') {
    const { klucz, odpowiedzi, czas } = await czytajCialo(req);
    const egz = trwajaceEgzaminy.get(klucz);
    if (!egz || egz.uzytkownik !== u.id) {
      return odpowiedzJson(res, 400, { blad: 'Egzamin wygasł lub nie istnieje' });
    }
    trwajaceEgzaminy.delete(klucz);
    const wynik = katalogPytan.policzWynik(egz.pozycje, odpowiedzi || {});
    for (const s of wynik.szczegoly) {
      if (s.udzielona !== null) baza.zapiszOdpowiedz(u.id, s.id, s.ok, 'egzamin');
    }
    const id = baza.zapiszEgzamin(u.id, {
      kategoria: egz.kategoria,
      punkty: wynik.punkty,
      maxPunkty: wynik.maxPunkty,
      zdany: wynik.zdany,
      poprawne: wynik.poprawne,
      czas: Math.max(0, Math.round(Number(czas) || 0)),
      szczegoly: wynik.szczegoly,
    });
    return odpowiedzJson(res, 200, { id, ...wynik });
  }

  if (sciezka === '/api/podchwytliwe' && metoda === 'POST') {
    const { pytanie, uwaga } = await czytajCialo(req);
    if (!pytanie || !katalogPytan.wgId.has(String(pytanie))) {
      return odpowiedzJson(res, 400, { blad: 'Nieznane pytanie' });
    }
    return odpowiedzJson(res, 200, { aktywne: baza.przelaczPodchwytliwe(u.id, String(pytanie), uwaga) });
  }

  if (sciezka === '/api/podchwytliwe/uwaga' && metoda === 'POST') {
    const { pytanie, uwaga } = await czytajCialo(req);
    if (!pytanie) return odpowiedzJson(res, 400, { blad: 'Brak pytania' });
    return odpowiedzJson(res, 200, { uwaga: baza.zapiszUwagePodchwytliwa(u.id, String(pytanie), uwaga) });
  }

  if (sciezka === '/api/arkusze' && metoda === 'POST') {
    const { kategoria, ile } = await czytajCialo(req);
    const kat = String(kategoria || baza.pobierzUstawienia(u.id).kategoria).toUpperCase();
    try {
      return odpowiedzJson(res, 200, katalogPytan.losujArkusze(kat, ile));
    } catch (e) {
      return odpowiedzJson(res, 400, { blad: e.message });
    }
  }

  if (sciezka === '/api/egzaminy' && metoda === 'GET') {
    return odpowiedzJson(res, 200, baza.pobierzEgzaminy(u.id));
  }

  if (sciezka.startsWith('/api/egzamin/') && metoda === 'GET') {
    const id = Number(sciezka.slice('/api/egzamin/'.length));
    const e = baza.pobierzEgzamin(u.id, id);
    if (!e) return odpowiedzJson(res, 404, { blad: 'Nie znaleziono egzaminu' });
    return odpowiedzJson(res, 200, e);
  }

  if (sciezka === '/api/statystyki' && metoda === 'GET') {
    return odpowiedzJson(res, 200, {
      dzienne: baza.statystykiDzienne(u.id),
      egzaminy: baza.pobierzEgzaminy(u.id, 30),
    });
  }

  if (sciezka === '/api/wyzeruj' && metoda === 'POST') {
    baza.wyzerujPostep(u.id);
    return odpowiedzJson(res, 200, { ok: true });
  }

  return odpowiedzJson(res, 404, { blad: 'Nieznany endpoint' });
}

// ---------- routing ----------

const serwer = http.createServer(async (req, res) => {
  let sciezka;
  try {
    sciezka = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400); return res.end('Zły adres');
  }

  try {
    if (sciezka.startsWith('/api/')) return await obsluzApi(req, res, sciezka);

    if (sciezka.startsWith('/media/')) {
      const plik = bezpiecznaSciezka(KATALOG_MEDIOW, sciezka.slice('/media'.length));
      if (!plik) { res.writeHead(403); return res.end('Zabroniony adres'); }
      return await wyslijPlik(req, res, plik, { cache: 'public, max-age=604800, immutable' });
    }

    const wzgledna = sciezka === '/' ? '/index.html' : sciezka;
    const plik = bezpiecznaSciezka(KATALOG_PUBLICZNY, wzgledna);
    if (!plik) { res.writeHead(403); return res.end('Zabroniony adres'); }
    if (fs.existsSync(plik) && fs.statSync(plik).isFile()) {
      return await wyslijPlik(req, res, plik, { cache: 'no-cache' });
    }
    // Aplikacja jednostronicowa - nieznane adresy obsługuje frontend.
    return await wyslijPlik(req, res, path.join(KATALOG_PUBLICZNY, 'index.html'), { cache: 'no-cache' });
  } catch (e) {
    console.error('Błąd żądania', req.method, sciezka, '-', e.message);
    if (!res.headersSent) odpowiedzJson(res, 500, { blad: 'Błąd serwera: ' + e.message });
    else res.end();
  }
});

// ---------- start ----------

function adresyLan() {
  const wynik = [];
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista || []) {
      if (i.family === 'IPv4' && !i.internal) wynik.push(i.address);
    }
  }
  return wynik;
}

baza.usunWygasleSesje();

// Konto zakładane przy pierwszym uruchomieniu, żeby było się czym zalogować.
// Hasła nie zapisujemy w kodzie - w repozytorium byłoby jawne dla każdego.
// Można je narzucić zmiennymi PRAWKO_LOGIN i PRAWKO_HASLO, a bez nich
// generuje się losowe i pokazuje raz, przy zakładaniu konta.
{
  const login = process.env.PRAWKO_LOGIN || 'kursant';
  if (!baza.znajdzUzytkownika(login)) {
    const haslo = process.env.PRAWKO_HASLO || crypto.randomBytes(6).toString('base64url');
    baza.utworzUzytkownika(login, haslo);
    console.log('');
    console.log(`  Założono konto startowe:  ${login}`);
    if (!process.env.PRAWKO_HASLO) {
      console.log(`  Hasło (zapisz je teraz):  ${haslo}`);
      console.log('  Więcej się nie pokaże - hasło jest w bazie tylko jako skrót.');
    }
  }
}

serwer.listen(PORT, '0.0.0.0', () => {
  const liczbaMediow = fs.existsSync(KATALOG_MEDIOW) ? fs.readdirSync(KATALOG_MEDIOW).length : 0;
  console.log('');
  console.log('  Prawko - aplikacja do nauki');
  console.log('  ---------------------------');
  console.log(`  pytania:     ${katalogPytan.pytania.length} (katalog ${katalogPytan.katalog.wersja})`);
  console.log(`  multimedia:  ${liczbaMediow} plików`);
  console.log('');
  console.log(`  na tym komputerze:  http://localhost:${PORT}`);
  for (const adres of adresyLan()) {
    console.log(`  z telefonu:         http://${adres}:${PORT}`);
  }
  console.log('');
  console.log('  Zatrzymanie: Ctrl+C');
  console.log('');
});
