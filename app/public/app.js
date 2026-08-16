'use strict';
/* Prawko — aplikacja do nauki na egzamin teoretyczny na prawo jazdy. */

const ROZMIAR_PACZKI = 35;
const NA_STRONE = 25;

const stan = {
  katalog: null,
  wgId: new Map(),
  uzytkownik: null,
  ustawienia: { kategoria: 'B', motyw: 'auto', timery: true },
  postep: {},
  zakladki: new Set(),
  notatki: {},
  podchwytliwe: {},   // pytanie -> własna uwaga (oznaczone ręcznie)
  wyjasnienia: {},    // pytanie -> treść wyjaśnienia
  zakresNauki: 'P',   // P = podstawowe (TAK/NIE), S = specjalistyczne (A/B/C)
  sesja: null,
  egzamin: null,
  filtryBazy: { szukaj: '', zakres: '', punkty: '', stan: '', strona: 0 },
  znaki: null,        // katalog znaków drogowych - wczytywany przy pierwszym wejściu
  filtryZnakow: { szukaj: '', grupa: 'A' },
  zasady: null,       // katalog zasad ruchu - wczytywany przy pierwszym wejściu
  filtryZasad: { szukaj: '', grupa: 'pierwszenstwo' },
  trybPodpowiedzi: localStorage.getItem('trybPodpowiedzi') === '1',
};

// ---------------------------------------------------------------- narzędzia

const $ = (sel, korzen = document) => korzen.querySelector(sel);

/** Tworzy element. Teksty trafiają przez textContent, więc treść pytań nie jest interpretowana jako HTML. */
function el(tag, wlasciwosci = {}, ...dzieci) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(wlasciwosci)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'klasa') e.className = v;
    else if (k === 'tekst') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dane') Object.assign(e.dataset, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const d of dzieci.flat()) {
    if (d === null || d === undefined || d === false) continue;
    e.append(d.nodeType ? d : document.createTextNode(String(d)));
  }
  return e;
}

function svg(tag, wlasciwosci = {}, ...dzieci) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(wlasciwosci)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'klasa') e.setAttribute('class', v);
    else if (k === 'tekst') e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const d of dzieci.flat()) if (d) e.append(d);
  return e;
}

// ---------------------------------------------------------------- listy wyboru

/* Rozwinięta lista natywnego <select> jest rysowana przez system, nie przez
   przeglądarkę - CSS jej nie dotyczy, stąd niebieskie podświetlenie z Windows
   pośrodku ciepłej palety. Dlatego budujemy własną listę, a natywny element
   zostaje ukryty jako źródło prawdy: reszta kodu nadal czyta .value i słucha
   zdarzenia change, więc nic poza wyglądem się nie zmienia. */

function upiekszSelecty(korzen = document) {
  for (const s of korzen.querySelectorAll('select:not([data-upiekszony])')) upiekszSelect(s);
}

function upiekszSelect(s) {
  s.dataset.upiekszony = '1';

  const opakowanie = el('div', { klasa: 'wybor' });
  s.replaceWith(opakowanie);
  opakowanie.append(s);

  const etykieta = el('span', { klasa: 'wybor-etykieta' });
  const przycisk = el('button', {
    type: 'button', klasa: 'wybor-przycisk',
    'aria-haspopup': 'listbox', 'aria-expanded': 'false',
  }, etykieta, svg('svg', { klasa: 'wybor-strzalka', viewBox: '0 0 24 24' },
    svg('path', { d: 'M6 9.5l6 6 6-6' })));
  const lista = el('div', { klasa: 'wybor-lista ukryty', role: 'listbox', tabindex: '-1' });
  opakowanie.append(przycisk, lista);

  let podswietlony = -1;

  const odswiez = () => { etykieta.textContent = s.options[s.selectedIndex]?.textContent ?? ''; };
  s.odswiez = odswiez;
  odswiez();
  s.addEventListener('change', odswiez);

  const otwarta = () => !lista.classList.contains('ukryty');

  function zbudujPozycje() {
    lista.replaceChildren(...[...s.options].map((o, i) => el('div', {
      klasa: 'wybor-pozycja' + (i === s.selectedIndex ? ' wybrana' : ''),
      role: 'option', 'aria-selected': i === s.selectedIndex,
      tekst: o.textContent,
      onmousedown: (e) => { e.preventDefault(); wybierz(i); },
      onmousemove: () => ustawPodswietlenie(i),
    })));
  }

  function ustawPodswietlenie(i) {
    podswietlony = i;
    [...lista.children].forEach((el_, j) => el_.classList.toggle('podswietlona', j === i));
    lista.children[i]?.scrollIntoView({ block: 'nearest' });
  }

  function otworz() {
    if (otwarta()) return;
    zbudujPozycje();
    lista.classList.remove('ukryty');
    przycisk.setAttribute('aria-expanded', 'true');
    // Lista o stałej wysokości nie zmieści się przy dolnej krawędzi okna -
    // wtedy rozwijamy ją do góry, zamiast pozwolić jej wyjść poza ekran.
    const pod = window.innerHeight - przycisk.getBoundingClientRect().bottom;
    lista.classList.toggle('w-gore', pod < Math.min(260, s.options.length * 36 + 12));
    ustawPodswietlenie(s.selectedIndex);
  }

  function zamknij() {
    if (!otwarta()) return;
    lista.classList.add('ukryty');
    przycisk.setAttribute('aria-expanded', 'false');
  }

  function wybierz(i) {
    zamknij();
    if (i < 0 || i >= s.options.length) return;
    if (i !== s.selectedIndex) {
      s.selectedIndex = i;
      odswiez();
      s.dispatchEvent(new Event('change', { bubbles: true }));
    }
    przycisk.focus();
  }

  przycisk.addEventListener('click', () => (otwarta() ? zamknij() : otworz()));

  przycisk.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!otwarta()) return otworz();
      if (e.key === 'Enter' || e.key === ' ') return wybierz(podswietlony);
      ustawPodswietlenie(Math.min(s.options.length - 1, Math.max(0,
        podswietlony + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Escape') {
      zamknij();
    } else if (e.key === 'Home' || e.key === 'End') {
      if (otwarta()) { e.preventDefault(); ustawPodswietlenie(e.key === 'Home' ? 0 : s.options.length - 1); }
    } else if (otwarta() && e.key.length === 1) {
      // Wpisanie litery przeskakuje do pierwszej pasującej pozycji - tak samo
      // jak w liście natywnej, więc odruch użytkownika nadal działa.
      const szukaj = e.key.toLowerCase();
      const i = [...s.options].findIndex(o => o.textContent.toLowerCase().startsWith(szukaj));
      if (i >= 0) ustawPodswietlenie(i);
    }
  });

  // Utrata skupienia zamyka listę, co obsługuje też kliknięcie gdzie indziej -
  // celowo bez nasłuchu na document, bo widoki przebudowują się często i takie
  // nasłuchy zostawałyby po każdej nieistniejącej już liście.
  przycisk.addEventListener('blur', () => setTimeout(zamknij, 0));
}

async function api(sciezka, metoda = 'GET', dane) {
  const opcje = { method: metoda, headers: {} };
  if (dane !== undefined) {
    opcje.headers['Content-Type'] = 'application/json';
    opcje.body = JSON.stringify(dane);
  }
  const odp = await fetch(sciezka, opcje);
  const tresc = odp.status === 204 ? {} : await odp.json().catch(() => ({}));
  if (!odp.ok) {
    const blad = new Error(tresc.blad || `Błąd ${odp.status}`);
    blad.status = odp.status;
    throw blad;
  }
  return tresc;
}

let uchwytPowiadomienia;
function powiadom(tekst) {
  const e = $('#powiadomienie');
  e.textContent = tekst;
  e.classList.remove('ukryty');
  clearTimeout(uchwytPowiadomienia);
  uchwytPowiadomienia = setTimeout(() => e.classList.add('ukryty'), 2600);
}

const czasMMSS = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

const dataPL = ms => new Date(ms).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
const dataGodzinaPL = ms => new Date(ms).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function odmiana(n, jeden, kilka, wiele) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (n === 1) return jeden;
  if (b >= 2 && b <= 4 && (a < 10 || a >= 20)) return kilka;
  return wiele;
}

// ---------------------------------------------------------------- dane pytań

/** Pytania bieżącej kategorii, nadające się do nauki — w stałej kolejności. */
function pytaniaKategorii(kategoria = stan.ustawienia.kategoria) {
  return stan.katalog.pytania.filter(p =>
    p.sprawne && !p.weryfikacja && p.kategorie.includes(kategoria));
}

/**
 * Paczki nauki w obrębie jednego zakresu. Podstawowe i specjalistyczne są
 * numerowane osobno, bo to zupełnie inny typ pytań: TAK/NIE kontra A/B/C.
 */
function paczki(zakres = stan.zakresNauki) {
  const lista = pytaniaKategorii().filter(p => p.zakres === zakres);
  const wynik = [];
  for (let i = 0; i < lista.length; i += ROZMIAR_PACZKI) {
    wynik.push(lista.slice(i, i + ROZMIAR_PACZKI));
  }
  return wynik;
}

const stanPytania = id => stan.postep[id] || null;
const opanowane = id => { const s = stanPytania(id); return !!s && s.ostatniaOk; };
const przerobione = id => !!stanPytania(id);

// Oznaczenie bieżącego konta albo utrwalone wcześniej jako domyślne.
const oznaczonePrzezeMnie = id =>
  Object.prototype.hasOwnProperty.call(stan.podchwytliwe, id) || !!stan.wgId.get(id)?.podchwytliwe;
const jakiekolwiekPodchwytliwe = p => oznaczonePrzezeMnie(p.id);

/** Ostrzeżenie o pułapce — pokazywane dopiero po odpowiedzi, żeby nie podpowiadać. */
function ostrzezeniePodchwytliwe(p) {
  if (!oznaczonePrzezeMnie(p.id)) return null;
  // Uwaga z bieżącego konta ma pierwszeństwo przed utrwaloną wcześniej.
  const opis = stan.podchwytliwe[p.id] || p.podchwytliwe?.powod || '';

  return el('div', { klasa: 'ostrzezenie-pulapka' },
    el('div', { klasa: 'naglowek-pulapki' }, '⚠ Pytanie podchwytliwe'),
    opis
      ? el('p', { tekst: opis })
      : el('p', { klasa: 'moja-uwaga', tekst: 'Oznaczone przez Ciebie. Możesz dopisać, na czym polega pułapka.' }));
}

/** Wyjaśnienie wygenerowane raz i zapisane na stałe. */
function blokWyjasnienia(p) {
  const tresc = stan.wyjasnienia[p.id];
  if (!tresc) return null;
  return el('div', { klasa: 'wyjasnienie' },
    el('div', { klasa: 'naglowek-wyjasnienia', tekst: 'Dlaczego tak' }),
    el('p', { tekst: tresc }));
}

/** Pytania czekające na powtórkę: błędne wracają od razu, poprawne po upływie odstępu. */
function doPowtorki() {
  const teraz = Date.now();
  return pytaniaKategorii()
    .filter(p => {
      const s = stanPytania(p.id);
      return s && s.powtorkaDo <= teraz && s.poziom < 6;
    })
    .sort((a, b) => {
      const sa = stanPytania(a.id), sb = stanPytania(b.id);
      // Najpierw to, co najsłabiej opanowane, potem najdłużej zaległe.
      return sa.poziom - sb.poziom || sa.powtorkaDo - sb.powtorkaDo;
    });
}

function podsumowanieKategorii() {
  const lista = pytaniaKategorii();
  let ok = 0, zrobione = 0, bledne = 0;
  for (const p of lista) {
    const s = stanPytania(p.id);
    if (!s) continue;
    zrobione++;
    if (s.ostatniaOk) ok++; else bledne++;
  }
  return { razem: lista.length, zrobione, ok, bledne, powtorki: doPowtorki().length };
}

// ---------------------------------------------------------------- logowanie

function pokazLogowanie(komunikat) {
  $('#ladowanie').classList.add('ukryty');
  $('#aplikacja').classList.add('ukryty');
  $('#ekran-logowania').classList.remove('ukryty');
  if (komunikat) {
    const b = $('#blad-logowania');
    b.textContent = komunikat;
    b.classList.remove('ukryty');
  }
}

let trybRejestracji = false;

function ustawTrybLogowania() {
  $('#przycisk-zaloguj').textContent = trybRejestracji ? 'Załóż konto' : 'Zaloguj się';
  $('#przelacz-rejestracje').textContent = trybRejestracji
    ? 'Mam już konto — wróć do logowania'
    : 'Nie mam konta — załóż nowe';
  $('#pole-haslo').setAttribute('autocomplete', trybRejestracji ? 'new-password' : 'current-password');
  $('#blad-logowania').classList.add('ukryty');
}

$('#przelacz-rejestracje').addEventListener('click', () => {
  trybRejestracji = !trybRejestracji;
  ustawTrybLogowania();
});

$('#formularz-logowania').addEventListener('submit', async e => {
  e.preventDefault();
  const login = $('#pole-login').value.trim();
  const haslo = $('#pole-haslo').value;
  const przycisk = $('#przycisk-zaloguj');
  przycisk.disabled = true;
  try {
    const dane = await api(trybRejestracji ? '/api/rejestracja' : '/api/logowanie', 'POST', { login, haslo });
    przyjmijStanUzytkownika(dane);
    $('#ekran-logowania').classList.add('ukryty');
    $('#pole-haslo').value = '';
    uruchomAplikacje();
  } catch (blad) {
    const b = $('#blad-logowania');
    b.textContent = blad.message;
    b.classList.remove('ukryty');
  } finally {
    przycisk.disabled = false;
  }
});

$('#przycisk-wyloguj').addEventListener('click', async () => {
  await api('/api/wyloguj', 'POST').catch(() => {});
  location.hash = '';
  location.reload();
});

function przyjmijStanUzytkownika(dane) {
  stan.uzytkownik = dane.uzytkownik;
  stan.ustawienia = dane.ustawienia;
  stan.postep = dane.postep || {};
  stan.zakladki = new Set(dane.zakladki || []);
  stan.notatki = dane.notatki || {};
  stan.podchwytliwe = dane.podchwytliwe || {};
  stan.wyjasnienia = dane.wyjasnienia || {};
  zastosujMotyw();
}

function zastosujMotyw() {
  const m = stan.ustawienia.motyw;
  if (m === 'auto') document.documentElement.removeAttribute('data-motyw');
  else document.documentElement.setAttribute('data-motyw', m);
}

async function zapiszUstawienia(zmiany) {
  Object.assign(stan.ustawienia, zmiany);
  zastosujMotyw();
  try {
    stan.ustawienia = await api('/api/ustawienia', 'POST', zmiany);
    zastosujMotyw();
  } catch { powiadom('Nie udało się zapisać ustawień'); }
}

// ---------------------------------------------------------------- start

async function start() {
  ustawTrybLogowania();
  try {
    const katalog = await api('/api/katalog');
    stan.katalog = katalog;
    stan.wgId = new Map(katalog.pytania.map(p => [p.id, p]));
  } catch {
    $('#ladowanie').innerHTML = '<p style="color:var(--zle)">Nie udało się wczytać bazy pytań. Sprawdź, czy serwer działa.</p>';
    return;
  }

  try {
    przyjmijStanUzytkownika(await api('/api/ja'));
    uruchomAplikacje();
  } catch (blad) {
    if (blad.status === 401) pokazLogowanie();
    else pokazLogowanie('Błąd połączenia z serwerem');
  }
}

function uruchomAplikacje() {
  $('#ladowanie').classList.add('ukryty');
  $('#aplikacja').classList.remove('ukryty');
  $('#nazwa-uzytkownika').textContent = stan.uzytkownik.login;
  zbudujWyborKategorii();
  if (!location.hash) location.hash = '#/pulpit';
  else przeladujWidok();
}

function zbudujWyborKategorii() {
  for (const s of [$('#wybor-kategorii-select'), $('#wybor-kategorii-mobilny')]) {
    s.replaceChildren(...stan.katalog.kategorie.map(k => el('option', { value: k, tekst: k })));
    s.value = stan.ustawienia.kategoria;
    s.onchange = async () => {
      await zapiszUstawienia({ kategoria: s.value });
      // Oba selektory pokazują ten sam stan, więc drugi trzeba zsynchronizować.
      for (const inny of [$('#wybor-kategorii-select'), $('#wybor-kategorii-mobilny')]) {
        inny.value = stan.ustawienia.kategoria;
        inny.odswiez?.();
      }
      stan.filtryBazy.strona = 0;
      przeladujWidok();
    };
  }
  upiekszSelecty($('.panel-boczny'));
  upiekszSelecty($('.pasek-mobilny'));
}

// ---------------------------------------------------------------- routing

window.addEventListener('hashchange', przeladujWidok);

function trasa() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

function przeladujWidok() {
  const czesci = trasa();
  const widok = czesci[0] || 'pulpit';

  // Wyjście z trwającego egzaminu w inne miejsce kończy go bez zapisu.
  if (stan.egzamin && !(widok === 'egzamin' && czesci[1] === 'trwa')) {
    zatrzymajZegaryEgzaminu();
    stan.egzamin = null;
  }
  if (stan.sesja && widok !== 'nauka' && widok !== 'powtorki' && widok !== 'zakladki') {
    stan.sesja = null;
  }

  for (const a of document.querySelectorAll('#nawigacja a, #nawigacja-dolna a, .przycisk-paska')) {
    a.classList.toggle('aktywny', a.dataset.widok === widok);
  }
  odswiezLicznikPowtorek();

  const tresc = $('#tresc');
  tresc.scrollTop = 0;
  window.scrollTo(0, 0);

  const widoki = {
    pulpit: widokPulpit,
    // #/nauka/paczka/<zakres>/<numer>
    nauka: () => czesci[1] === 'paczka' ? widokSesja('paczka', czesci[2], czesci[3]) : widokNauka(),
    powtorki: () => czesci[1] === 'start' ? widokSesja('powtorki') : widokPowtorki(),
    zakladki: () => czesci[1] === 'start' ? widokSesja('zakladki') : widokPulpit(),
    egzamin: () => {
      if (czesci[1] === 'trwa') return widokEgzaminTrwa();
      if (czesci[1] === 'wynik') return widokWynikEgzaminu(czesci[2]);
      return widokEgzamin();
    },
    arkusze: widokArkusze,
    pulapki: widokPodchwytliwe,
    baza: widokBaza,
    // #/znaki/<grupa>
    znaki: () => {
      if (czesci[1]) stan.filtryZnakow.grupa = czesci[1].toUpperCase();
      widokZnaki();
    },
    // #/zasady/<grupa>
    zasady: () => {
      if (czesci[1]) stan.filtryZasad.grupa = czesci[1];
      widokZasady();
    },
    statystyki: widokStatystyki,
    ustawienia: widokUstawienia,
  };

  (widoki[widok] || widokPulpit)();
}

function odswiezLicznikPowtorek() {
  if (!stan.katalog) return;
  const n = doPowtorki().length;
  $('#licznik-powtorek').textContent = n > 0 ? (n > 99 ? '99+' : n) : '';
}

function ustawTresc(...dzieci) {
  $('#tresc').replaceChildren(el('div', { klasa: 'kontener' }, ...dzieci.flat().filter(Boolean)));
  upiekszSelecty($('#tresc'));
}

const kontenerTresci = () => $('.kontener') || $('#tresc');

function naglowek(tytul, podtytul, akcje) {
  return el('div', { klasa: 'naglowek-widoku' },
    el('div', { klasa: 'naglowek-rzad' },
      el('div', {},
        el('h1', { tekst: tytul }),
        podtytul && el('p', { tekst: podtytul })),
      akcje && el('div', { klasa: 'naglowek-akcje' }, akcje)));
}

function pusto(znak, tekst, akcja) {
  return el('div', { klasa: 'pusto' }, el('span', { klasa: 'znak', tekst: znak }), el('p', { tekst }), akcja);
}

// ---------------------------------------------------------------- pulpit

function widokPulpit() {
  const p = podsumowanieKategorii();
  const procent = p.razem ? Math.round(p.ok / p.razem * 100) : 0;
  const skutecznosc = p.zrobione ? Math.round(p.ok / p.zrobione * 100) : 0;

  const kafelek = (etykieta, wartosc, dopisek, klasa) =>
    el('div', { klasa: 'karta kafelek-liczby' },
      el('div', { klasa: 'etykieta', tekst: etykieta }),
      el('div', { klasa: 'wartosc' + (klasa ? ' ' + klasa : ''), tekst: wartosc }),
      dopisek && el('div', { klasa: 'dopisek', tekst: dopisek }));

  const kartaPostepu = el('div', { klasa: 'karta' },
    el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px' },
      el('h3', { tekst: `Opanowane pytania — kategoria ${stan.ustawienia.kategoria}` }),
      el('span', { style: 'font-variant-numeric:tabular-nums;color:var(--tekst-2)', tekst: `${p.ok} / ${p.razem}` })),
    el('div', { klasa: 'pasek gruby zielony' }, el('i', { style: `width:${procent}%` })),
    el('p', { style: 'margin-top:10px;color:var(--tekst-2);font-size:.88rem',
      tekst: `Przerobiłeś ${p.zrobione} ${odmiana(p.zrobione, 'pytanie', 'pytania', 'pytań')}, `
           + `${p.bledne} czeka na poprawę.` }));

  const akcje = el('div', { klasa: 'siatka kolumny-2', style: 'margin-top:16px' },
    el('a', { href: '#/nauka', klasa: 'karta', style: 'display:block' },
      el('h3', { tekst: '▤  Ucz się dalej' }),
      el('p', { style: 'color:var(--tekst-2);font-size:.88rem;margin-top:5px',
        tekst: `Pytania podzielone na paczki po ${ROZMIAR_PACZKI} — wracaj do wybranej i powtarzaj.` })),
    el('a', { href: '#/egzamin', klasa: 'karta', style: 'display:block' },
      el('h3', { tekst: '✓  Egzamin próbny' }),
      el('p', { style: 'color:var(--tekst-2);font-size:.88rem;margin-top:5px',
        tekst: '32 pytania i punktacja dokładnie jak na egzaminie państwowym.' })));

  const przypomnienie = p.powtorki > 0
    ? el('a', { href: '#/powtorki', klasa: 'karta', style: 'display:flex;gap:14px;align-items:center;margin-top:16px;border-color:var(--akcent)' },
        el('span', { style: 'font-size:26px', tekst: '↻' }),
        el('div', {},
          el('h3', { tekst: `${p.powtorki} ${odmiana(p.powtorki, 'pytanie czeka', 'pytania czekają', 'pytań czeka')} na powtórkę` }),
          el('p', { style: 'color:var(--tekst-2);font-size:.88rem', tekst: 'Najpierw te, z którymi masz największy problem.' })))
    : null;

  ustawTresc(
    naglowek(`Cześć, ${stan.uzytkownik.login}`, 'Twój postęp w nauce na kategorię ' + stan.ustawienia.kategoria),
    el('div', { klasa: 'siatka kolumny-4' },
      kafelek('Opanowane', `${procent}%`, `${p.ok} z ${p.razem}`, 'akcent'),
      kafelek('Skuteczność', p.zrobione ? `${skutecznosc}%` : '—', 'ostatnie odpowiedzi', skutecznosc >= 80 ? 'dobrze' : (p.zrobione ? 'zle' : '')),
      kafelek('Do poprawy', p.bledne, 'ostatnia odpowiedź błędna', p.bledne ? 'zle' : ''),
      kafelek('Powtórki', p.powtorki, 'zaplanowane na dziś')),
    el('div', { style: 'margin-top:16px' }, kartaPostepu),
    przypomnienie,
    akcje);
}

// ---------------------------------------------------------------- nauka

function widokNauka() {
  const zakres = stan.zakresNauki;
  const lista = paczki(zakres);
  const wszystkie = pytaniaKategorii().filter(p => p.zakres === zakres);

  const licznik = z => pytaniaKategorii().filter(p => p.zakres === z).length;
  const opanowaneW = z => pytaniaKategorii().filter(p => p.zakres === z && opanowane(p.id)).length;

  const przelacz = (z, etykieta) => el('button', {
    klasa: zakres === z ? 'wybrany' : '',
    tekst: `${etykieta} (${opanowaneW(z)}/${licznik(z)})`,
    onclick: () => { stan.zakresNauki = z; widokNauka(); },
  });

  const kafelki = lista.map((paczka, i) => {
    const ok = paczka.filter(p => opanowane(p.id)).length;
    const zrobione = paczka.filter(p => przerobione(p.id)).length;
    const procent = Math.round(ok / paczka.length * 100);
    const od = i * ROZMIAR_PACZKI + 1;
    const doNr = i * ROZMIAR_PACZKI + paczka.length;
    return el('button', {
      klasa: 'paczka' + (ok === paczka.length ? ' ukonczona' : ''),
      onclick: () => { location.hash = `#/nauka/paczka/${zakres}/${i}`; },
    },
      el('div', { klasa: 'paczka-gora' },
        el('span', { klasa: 'paczka-nazwa', tekst: `Paczka ${i + 1}` }),
        el('span', { klasa: 'paczka-zakres', tekst: `${od}–${doNr}` })),
      el('div', { klasa: 'pasek' + (ok === paczka.length ? ' zielony' : '') }, el('i', { style: `width:${procent}%` })),
      el('div', { klasa: 'paczka-dol' },
        el('span', { tekst: `${ok}/${paczka.length} opanowanych` }),
        el('span', { tekst: zrobione ? `${procent}%` : 'nowa' })));
  });

  const opis = zakres === 'P'
    ? 'Pytania TAK/NIE ze zdjęciem lub filmem — na egzaminie jest ich 20 i decydują o większości punktów.'
    : 'Pytania A/B/C o przepisy, znaki i technikę jazdy — na egzaminie jest ich 12.';

  ustawTresc(
    naglowek('Nauka',
      `${wszystkie.length} ${odmiana(wszystkie.length, 'pytanie', 'pytania', 'pytań')} dla kategorii ${stan.ustawienia.kategoria}, `
      + `podzielone na ${lista.length} ${odmiana(lista.length, 'paczkę', 'paczki', 'paczek')} po ${ROZMIAR_PACZKI}.`),
    el('div', { klasa: 'grupa-przyciskow', style: 'margin-bottom:12px' },
      przelacz('P', 'Podstawowe'),
      przelacz('S', 'Specjalistyczne')),
    el('p', { klasa: 'opis', style: 'margin-bottom:18px', tekst: opis }),
    el('div', { klasa: 'siatka-paczek' }, kafelki));
}

function widokPowtorki() {
  const lista = doPowtorki();
  if (!lista.length) {
    return ustawTresc(
      naglowek('Powtórki', 'Pytania wracają tu po błędzie i w zaplanowanych odstępach.'),
      pusto('✓', 'Nic nie czeka na powtórkę. Wróć tu po kolejnej sesji nauki.',
        el('a', { href: '#/nauka', klasa: 'przycisk glowny', style: 'margin-top:14px', tekst: 'Przejdź do nauki' })));
  }
  const bledne = lista.filter(p => !stanPytania(p.id).ostatniaOk).length;
  ustawTresc(
    naglowek('Powtórki', `${lista.length} ${odmiana(lista.length, 'pytanie', 'pytania', 'pytań')} do powtórzenia, w tym ${bledne} po błędzie.`),
    el('div', { klasa: 'karta' },
      el('p', { style: 'color:var(--tekst-2);margin-bottom:14px',
        tekst: 'Pytanie, na które odpowiesz źle, wraca natychmiast. Każda poprawna odpowiedź odsuwa je dalej: 10 minut, dzień, 3 dni, tydzień, 3 tygodnie, 2 miesiące.' }),
      el('button', { klasa: 'przycisk glowny', onclick: () => { location.hash = '#/powtorki/start'; },
        tekst: `Rozpocznij powtórkę (${Math.min(lista.length, 50)})` })));
}

// ---------------------------------------------------------------- sesja nauki

function widokSesja(zrodlo, parametr, parametr2) {
  let pytania, tytul;

  if (zrodlo === 'paczka') {
    const zakres = (parametr === 'P' || parametr === 'S') ? parametr : 'P';
    const nr = Number(parametr2);
    const lista = paczki(zakres);
    if (!Number.isInteger(nr) || nr < 0 || nr >= lista.length) { location.hash = '#/nauka'; return; }
    stan.zakresNauki = zakres;
    pytania = lista[nr];
    tytul = `${zakres === 'P' ? 'Podstawowe' : 'Specjalistyczne'} · paczka ${nr + 1}`;
  } else if (zrodlo === 'powtorki') {
    pytania = doPowtorki().slice(0, 50);
    tytul = 'Powtórka';
  } else {
    pytania = pytaniaKategorii().filter(p => stan.zakladki.has(p.id));
    tytul = 'Zakładki';
  }

  if (!pytania.length) { location.hash = '#/nauka'; return; }

  // Sesje złożone gdzie indziej (pułapki, błędy z egzaminu) mają własną listę
  // pytań — routing nie może ich podmienić na domyślną zawartość.
  if (stan.sesja && stan.sesja.wlasna && stan.sesja.zrodlo === zrodlo) {
    rysujSesje();
    return;
  }

  const klucz = `${zrodlo}|${parametr ?? ''}|${parametr2 ?? ''}`;
  if (!stan.sesja || stan.sesja.klucz !== klucz) {
    stan.sesja = {
      zrodlo, parametr, klucz, tytul,
      pytania,
      indeks: 0,
      odpowiedzi: {},
      dobre: 0,
      notatkaOtwarta: false,
    };
  }
  rysujSesje();
}

function rysujSesje() {
  const s = stan.sesja;
  if (stan.trybPodpowiedzi && !stan.zasady && !stan.zasadyWLocie) {
    stan.zasadyWLocie = true;
    api('/api/zasady')
      .then(d => { stan.zasady = d; })
      .catch(() => { stan.zasady = { grupy: [], zasady: [] }; })
      .finally(() => { stan.zasadyWLocie = false; if (stan.sesja) rysujSesje(); });
  }
  const p = s.pytania[s.indeks];
  const udzielona = s.odpowiedzi[p.id];
  const odslonieta = udzielona !== undefined;
  // W trybie z podpowiedziami reguła pokazuje się od razu; ręczne kliknięcia
  // mogą ją tylko podnieść o kolejny stopień.
  const poziomPodpowiedzi = Math.max(s.podpowiedzi?.[p.id] || 0, stan.trybPodpowiedzi ? 1 : 0);
  // Odpowiedzi odrzucone podpowiedzią drugiego poziomu - wyszarzone, nie do kliknięcia.
  const odrzucone = poziomPodpowiedzi >= 2 ? odrzuconeOdpowiedzi(p) : [];

  const pasek = el('div', { klasa: 'pasek-sesji' },
    el('button', { klasa: 'przycisk tekstowy maly', tekst: '‹ Wyjdź',
      onclick: () => { location.hash = s.zrodlo === 'paczka' ? '#/nauka' : '#/powtorki'; } }),
    el('span', { klasa: 'licznik-sesji', tekst: `${s.tytul} · ${s.indeks + 1}/${s.pytania.length}` }),
    el('div', { klasa: 'pasek' }, el('i', { style: `width:${(s.indeks + 1) / s.pytania.length * 100}%` })),
    el('span', { klasa: 'licznik-sesji', tekst: `${s.dobre} popr.` }),
    el('button', {
      klasa: 'przycisk-ikona' + (stan.trybPodpowiedzi ? ' wlaczony' : ''),
      tekst: '💡 Podpowiedzi',
      title: 'Pokazuj regułę od razu przy każdym pytaniu',
      onclick: () => {
        stan.trybPodpowiedzi = !stan.trybPodpowiedzi;
        localStorage.setItem('trybPodpowiedzi', stan.trybPodpowiedzi ? '1' : '0');
        if (stan.trybPodpowiedzi && !stan.zasady) {
          api('/api/zasady').then(d => { stan.zasady = d; rysujSesje(); })
            .catch(() => { stan.zasady = { grupy: [], zasady: [] }; rysujSesje(); });
        }
        rysujSesje();
      },
    }));

  const karta = el('div', { klasa: 'karta-pytania' },
    mediaPytania(p, { kontrolki: true }),
    el('div', { klasa: 'tresc-pytania' },
      znacznikiPytania(p),
      el('div', { klasa: 'pytanie-tekst', tekst: p.tresc }),
      przyciskiOdpowiedzi(p, {
        wybrana: udzielona,
        odslonieta,
        odrzucone,
        naKlik: odp => odpowiedzWSesji(p, odp),
      }),
      !odslonieta && przyciskPodpowiedzi(p, poziomPodpowiedzi),
      !odslonieta && poziomPodpowiedzi >= 1 && blokPodpowiedzi(p),
      odslonieta && el('div', {
        klasa: 'werdykt ' + (udzielona === p.poprawna ? 'dobrze' : 'zle'),
        tekst: udzielona === p.poprawna
          ? 'Dobrze!'
          : `Błędnie. Poprawna odpowiedź: ${nazwaOdpowiedzi(p, p.poprawna)}`,
      }),
      // Podpowiedzi dopiero po odsłonięciu odpowiedzi — inaczej zdradzałyby wynik.
      odslonieta && ostrzezeniePodchwytliwe(p),
      odslonieta && edytorUwagiPulapki(p, () => rysujSesje()),
      odslonieta && blokWyjasnienia(p)),
    stopkaSesji(p, odslonieta),
    s.notatkaOtwarta ? obszarNotatki(p) : null);

  const podpowiedz = el('p', { klasa: 'podpowiedz-klawiszy' });
  podpowiedz.innerHTML = p.typ === 'tn'
    ? 'Klawisze: <kbd>T</kbd> tak · <kbd>N</kbd> nie · <kbd>→</kbd> dalej'
    : 'Klawisze: <kbd>A</kbd> <kbd>B</kbd> <kbd>C</kbd> · <kbd>→</kbd> dalej';

  ustawTresc(el('div', { klasa: 'scena-pytania' }, pasek, karta, podpowiedz));
}

function stopkaSesji(p, odslonieta) {
  const s = stan.sesja;
  const wZakladkach = stan.zakladki.has(p.id);
  const maNotatke = !!stan.notatki[p.id];

  return el('div', { klasa: 'stopka-pytania' },
    el('button', {
      klasa: 'przycisk-ikona' + (wZakladkach ? ' wlaczony' : ''),
      tekst: (wZakladkach ? '★' : '☆') + ' Zakładka',
      onclick: async e => {
        const wynik = await api('/api/zakladka', 'POST', { pytanie: p.id });
        if (wynik.aktywna) stan.zakladki.add(p.id); else stan.zakladki.delete(p.id);
        e.currentTarget.classList.toggle('wlaczony', wynik.aktywna);
        e.currentTarget.textContent = (wynik.aktywna ? '★' : '☆') + ' Zakładka';
      },
    }),
    el('button', {
      klasa: 'przycisk-ikona' + (maNotatke || s.notatkaOtwarta ? ' wlaczony' : ''),
      tekst: '✎ Notatka',
      onclick: () => { s.notatkaOtwarta = !s.notatkaOtwarta; rysujSesje(); },
    }),
    przyciskPodchwytliwe(p, () => rysujSesje()),
    el('span', { klasa: 'licznik-sesji', style: 'color:var(--tekst-3)', tekst: `nr ${p.id}` }),
    el('div', { klasa: 'z-prawej' },
      s.indeks > 0 && el('button', { klasa: 'przycisk', tekst: '‹ Wstecz', onclick: () => { s.indeks--; rysujSesje(); } }),
      el('button', {
        klasa: 'przycisk' + (odslonieta ? ' glowny' : ''),
        tekst: s.indeks === s.pytania.length - 1 ? 'Zakończ' : 'Dalej ›',
        onclick: dalejWSesji,
      })));
}

/** Przycisk oznaczania pytania jako podchwytliwe — używany w nauce, bazie i przeglądzie egzaminu. */
function przyciskPodchwytliwe(p, poZmianie) {
  const oznaczone = oznaczonePrzezeMnie(p.id);
  return el('button', {
    klasa: 'przycisk-ikona' + (oznaczone ? ' pulapka' : ''),
    title: oznaczone ? 'Usuń z podchwytliwych' : 'Oznacz jako podchwytliwe',
    tekst: '⚠ Podchwytliwe',
    onclick: async () => {
      try {
        const wynik = await api('/api/podchwytliwe', 'POST', { pytanie: p.id });
        if (wynik.aktywne) stan.podchwytliwe[p.id] = '';
        else delete stan.podchwytliwe[p.id];
        powiadom(wynik.aktywne ? 'Oznaczone jako podchwytliwe' : 'Usunięte z podchwytliwych');
        if (poZmianie) poZmianie();
      } catch { powiadom('Nie udało się zapisać'); }
    },
  });
}

/** Pole na opis pułapki — te uwagi da się później zapisać jako domyślne. */
function edytorUwagiPulapki(p, poZapisie) {
  if (!oznaczonePrzezeMnie(p.id)) return null;

  const pole = el('textarea', { placeholder: 'Na czym polega pułapka? (opcjonalnie)', rows: '2' });
  pole.value = stan.podchwytliwe[p.id] || '';

  const zapisz = async () => {
    try {
      const wynik = await api('/api/podchwytliwe/uwaga', 'POST', { pytanie: p.id, uwaga: pole.value });
      stan.podchwytliwe[p.id] = wynik.uwaga;
      powiadom(wynik.uwaga ? 'Uwaga zapisana' : 'Uwaga usunięta');
      if (poZapisie) poZapisie();
    } catch { powiadom('Nie udało się zapisać'); }
  };
  // Ctrl+Enter zapisuje — wygodne, gdy opisujesz pułapkę w trakcie nauki.
  pole.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); zapisz(); } };

  return el('div', { klasa: 'uwaga-pulapki' },
    pole,
    el('button', { klasa: 'przycisk maly', tekst: 'Zapisz uwagę', onclick: zapisz }));
}

function obszarNotatki(p) {
  const pole = el('textarea', { placeholder: 'Własna notatka do tego pytania…' });
  pole.value = stan.notatki[p.id] || '';
  return el('div', { klasa: 'notatka-obszar' },
    pole,
    el('div', { klasa: 'rzad' },
      el('button', {
        klasa: 'przycisk glowny maly', tekst: 'Zapisz notatkę',
        onclick: async () => {
          const wynik = await api('/api/notatka', 'POST', { pytanie: p.id, tresc: pole.value });
          if (wynik.tresc) stan.notatki[p.id] = wynik.tresc; else delete stan.notatki[p.id];
          stan.sesja.notatkaOtwarta = false;
          powiadom(wynik.tresc ? 'Notatka zapisana' : 'Notatka usunięta');
          rysujSesje();
        },
      }),
      el('button', { klasa: 'przycisk maly', tekst: 'Anuluj',
        onclick: () => { stan.sesja.notatkaOtwarta = false; rysujSesje(); } })));
}

async function odpowiedzWSesji(p, odp) {
  const s = stan.sesja;
  if (s.odpowiedzi[p.id] !== undefined) return;
  s.odpowiedzi[p.id] = odp;
  const ok = odp === p.poprawna;
  if (ok) s.dobre++;
  rysujSesje();

  try {
    const wynik = await api('/api/odpowiedz', 'POST', {
      pytanie: p.id, poprawnie: ok, tryb: s.zrodlo === 'powtorki' ? 'powtorki' : 'nauka',
    });
    const poprzedni = stan.postep[p.id] || { dobre: 0, zle: 0 };
    stan.postep[p.id] = {
      dobre: poprzedni.dobre + (ok ? 1 : 0),
      zle: poprzedni.zle + (ok ? 0 : 1),
      ostatniaOk: ok,
      poziom: wynik.poziom,
      powtorkaDo: wynik.powtorkaDo,
      kiedy: Date.now(),
    };
    odswiezLicznikPowtorek();
  } catch { powiadom('Nie zapisano odpowiedzi — brak połączenia'); }
}

function dalejWSesji() {
  const s = stan.sesja;
  if (s.indeks < s.pytania.length - 1) {
    s.indeks++;
    s.notatkaOtwarta = false;
    rysujSesje();
  } else {
    zakonczSesje();
  }
}

function zakonczSesje() {
  const s = stan.sesja;
  const odpowiedziano = Object.keys(s.odpowiedzi).length;
  const procent = odpowiedziano ? Math.round(s.dobre / odpowiedziano * 100) : 0;
  const bledne = s.pytania.filter(p => s.odpowiedzi[p.id] !== undefined && s.odpowiedzi[p.id] !== p.poprawna);

  ustawTresc(el('div', { klasa: 'scena-pytania' },
    el('div', { klasa: 'karta wynik-egzaminu' },
      el('div', { klasa: 'wynik-znak', tekst: procent >= 80 ? '🎉' : '📖' }),
      el('div', { klasa: 'wynik-punkty', tekst: `${procent}%` }),
      el('p', { klasa: 'wynik-podpis',
        tekst: `${s.dobre} z ${odpowiedziano} poprawnie — ${s.tytul}` }),
      el('div', { klasa: 'wynik-akcje' },
        bledne.length > 0 && el('button', {
          klasa: 'przycisk glowny', tekst: `Powtórz ${bledne.length} ${odmiana(bledne.length, 'błędne', 'błędne', 'błędnych')}`,
          onclick: () => {
            stan.sesja = { zrodlo: s.zrodlo, parametr: s.parametr, wlasna: true, tytul: s.tytul + ' — poprawa',
              pytania: bledne, indeks: 0, odpowiedzi: {}, dobre: 0, notatkaOtwarta: false };
            rysujSesje();
          },
        }),
        el('button', { klasa: 'przycisk', tekst: 'Jeszcze raz od początku',
          onclick: () => {
            stan.sesja = { ...s, indeks: 0, odpowiedzi: {}, dobre: 0, notatkaOtwarta: false };
            rysujSesje();
          } }),
        el('a', { klasa: 'przycisk', href: s.zrodlo === 'paczka' ? '#/nauka' : '#/pulpit', tekst: 'Wróć' })))));
  stan.sesja = null;
}

// ---------------------------------------------------------------- elementy pytania

function mediaPytania(p, { kontrolki = true, automat = false, klucz = '', naStart = null } = {}) {
  if (!p.media) return null;
  const url = '/media/' + encodeURIComponent(p.media);
  if (p.mediaTyp === 'vid') {
    // Bez zapętlenia: film ma zatrzymać się na ostatniej klatce, bo to zwykle
    // ona rozstrzyga sytuację. Plakat to kadr z końcówki, więc przed
    // odtworzeniem widać sytuację, a nie czarny prostokąt.
    const v = el('video', {
      src: url, playsinline: true, muted: true, preload: 'auto',
      poster: '/media/klatki/' + encodeURIComponent(p.media.replace(/\.[^.]+$/, '') + '.jpg'),
      controls: kontrolki ? true : null,
    });
    v.muted = true;
    if (automat) v.autoplay = true;
    if (klucz) v.dataset.klucz = klucz;

    // Na egzaminie film uruchamia się przyciskiem Start, a nie sam - i to
    // uruchomienie kończy czas na zapoznanie się z pytaniem.
    if (naStart) {
      const nakladka = el('button', { klasa: 'przycisk-start', tekst: '▶ Start' });
      nakladka.onclick = () => {
        nakladka.remove();
        v.play().catch(() => {});
        naStart();
      };
      return el('div', { klasa: 'media-pytania z-nakladka' }, v, nakladka);
    }
    return el('div', { klasa: 'media-pytania' }, v);
  }
  return el('div', { klasa: 'media-pytania' }, el('img', { src: url, alt: 'Ilustracja do pytania', loading: 'lazy' }));
}

function znacznikiPytania(p) {
  const s = stanPytania(p.id);
  return el('div', { klasa: 'znaczniki' },
    el('span', { klasa: 'znacznik' + (p.zakres === 'S' ? ' akcent' : ''),
      tekst: p.zakres === 'P' ? 'podstawowe' : 'specjalistyczne' }),
    el('span', { klasa: 'znacznik', tekst: `${p.punkty} pkt` }),
    s && el('span', { klasa: 'znacznik' + (s.ostatniaOk ? '' : ' uwaga'),
      tekst: s.ostatniaOk ? `opanowane ${'●'.repeat(Math.min(s.poziom, 6))}` : 'do poprawy' }));
}

function nazwaOdpowiedzi(p, klucz) {
  if (p.typ === 'tn') return klucz === 'T' ? 'TAK' : 'NIE';
  return `${klucz} — ${p.odpowiedzi[klucz]}`;
}

function przyciskiOdpowiedzi(p, { wybrana, odslonieta, naKlik, zablokowane = false, odrzucone = [] }) {
  const klucze = p.typ === 'tn' ? ['T', 'N'] : ['A', 'B', 'C'];
  const przyciski = klucze.map(k => {
    let klasa = 'odpowiedz';
    if (odslonieta) {
      if (k === p.poprawna) klasa += ' poprawna';
      else if (k === wybrana) klasa += ' bledna';
    } else if (k === wybrana) {
      klasa += ' wybrana';
    }
    if (!odslonieta && odrzucone.includes(k)) klasa += ' odrzucona';
    return el('button', {
      klasa,
      dane: { klucz: k },
      disabled: (odslonieta || zablokowane || (!odslonieta && odrzucone.includes(k))) ? true : null,
      onclick: () => naKlik(k),
    },
      el('span', { klasa: 'klucz', tekst: k === 'T' ? 'T' : k === 'N' ? 'N' : k }),
      el('span', { klasa: 'etykieta-odp', tekst: p.typ === 'tn' ? (k === 'T' ? 'TAK' : 'NIE') : p.odpowiedzi[k] }));
  });
  return el('div', { klasa: 'odpowiedzi' + (p.typ === 'tn' ? ' tak-nie' : '') }, przyciski);
}

// ------------------------------------------------------- podpowiedzi w nauce

/* Podpowiedź ma naprowadzić, a nie odpowiedzieć za uczącego się. Stąd dwa stopnie:
   najpierw reguła z sekcji Zasady, która rozstrzyga ten typ sytuacji, a dopiero
   potem zawężenie wariantów. Wyjaśnienie do konkretnego pytania pozostaje ukryte
   do momentu udzielenia odpowiedzi - inaczej podawałoby wynik wprost. */

const SLOWA_POMIJANE = new Set([
  'czy', 'tym', 'tej', 'ten', 'tego', 'jest', 'jesteś', 'jesteś', 'masz', 'mozesz', 'możesz',
  'wolno', 'nalezy', 'należy', 'sytuacji', 'przedstawionej', 'kierujacy', 'kierujący',
  'pojazdem', 'pojazdu', 'droga', 'drodze', 'ktory', 'który', 'ktora', 'która', 'przez',
  'przed', 'jego', 'jesli', 'jeśli', 'moze', 'może', 'przy', 'jako', 'takiej', 'takim',
]);

function slowaKluczowe(tekst) {
  return new Set(
    tekst.toLowerCase()
      .replace(/[^a-ząćęłńóśźż0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4 && !SLOWA_POMIJANE.has(w))
      .map(w => w.slice(0, 7)));   // przycięcie zamiast odmiany: "pierwszenstwa" ~ "pierwszenstwo"
}

/** Usuwa znaki diakrytyczne - klucze zasad są zapisane bez nich, żeby dopasowanie
 *  nie zależało od tego, czy w pytaniu napisano „przejściu" czy „przejsciu". */
function bezOgonkow(t) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
}

/** Szuka zasady najlepiej pasującej do treści pytania. Null, gdy żadna nie pasuje sensownie. */
function dopasujZasade(p) {
  if (!stan.zasady) return null;
  const slowaPytania = slowaKluczowe(p.tresc);
  const trescBezOgonkow = bezOgonkow(p.tresc);
  if (!slowaPytania.size) return null;

  let najlepsza = null;
  let najlepszyWynik = 0;
  for (const z of stan.zasady.zasady) {
    // Klucze jawne biją porównywanie słów: polska odmiana psuje rdzenie
    // ("zawrócić" kontra "zawracanie"), więc te przypadki opisujemy wprost.
    // Dłuższy klucz znaczy trafienie bardziej jednoznaczne: fraza "zakaz
    // zatrzymywania" identyfikuje sytuację lepiej niż samo "postoj".
    let trafienia = 0;
    let dlugosc = 0;
    for (const k of z.klucze || []) {
      if (trescBezOgonkow.includes(k)) { trafienia++; dlugosc = Math.max(dlugosc, k.length); }
    }
    if (trafienia) {
      const wynikKluczy = 4 + trafienia * 2 + dlugosc / 4;
      if (wynikKluczy > najlepszyWynik) { najlepszyWynik = wynikKluczy; najlepsza = z; }
      continue;
    }
    const slowaZasady = slowaKluczowe(z.tytul + ' ' + z.sedno + ' ' + z.opis);
    let wynik = 0;
    for (const w of slowaPytania) if (slowaZasady.has(w)) wynik++;
    // Tytuł waży więcej: trafienie w nagłówek zasady jest mocniejszym sygnałem.
    const slowaTytulu = slowaKluczowe(z.tytul);
    for (const w of slowaPytania) if (slowaTytulu.has(w)) wynik += 2;
    if (wynik > najlepszyWynik) { najlepszyWynik = wynik; najlepsza = z; }
  }
  return najlepszyWynik >= 3 ? najlepsza : null;
}

/** Warianty do wyszarzenia: dla A/B/C jeden błędny, dla TAK/NIE żaden. */
function odrzuconeOdpowiedzi(p) {
  if (p.typ !== 'abc') return [];
  const bledne = ['A', 'B', 'C'].filter(k => k !== p.poprawna);
  // Wybór stały dla danego pytania, żeby podpowiedź nie zmieniała się przy przerysowaniu.
  const i = Number(p.id) % bledne.length;
  return [bledne[i]];
}

function przyciskPodpowiedzi(p, poziom) {
  const s = stan.sesja;
  const maDrugi = p.typ === 'abc';
  if (poziom >= (maDrugi ? 2 : 1)) return null;

  const etykieta = poziom === 0 ? 'Podpowiedź' : 'Odrzuć jedną odpowiedź';
  return el('div', { klasa: 'rzad-podpowiedzi' },
    el('button', {
      klasa: 'przycisk maly',
      tekst: '💡 ' + etykieta,
      onclick: async () => {
        if (!stan.zasady) {
          try { stan.zasady = await api('/api/zasady'); } catch { stan.zasady = { grupy: [], zasady: [] }; }
        }
        s.podpowiedzi = s.podpowiedzi || {};
        s.podpowiedzi[p.id] = (s.podpowiedzi[p.id] || 0) + 1;
        rysujSesje();
      },
    }));
}

function blokPodpowiedzi(p) {
  const z = dopasujZasade(p);
  if (!z) {
    return el('div', { klasa: 'blok-podpowiedzi brak' },
      el('p', { tekst: 'Do tego pytania nie mam dopasowanej reguły. Zerknij do sekcji Zasady.' }));
  }
  return el('div', { klasa: 'blok-podpowiedzi' },
    el('div', { klasa: 'naglowek-podpowiedzi' },
      el('span', { klasa: 'znacznik', tekst: 'Reguła' }),
      el('strong', { tekst: z.tytul })),
    el('p', { klasa: 'sedno-zasady', tekst: z.sedno }),
    el('button', {
      klasa: 'przycisk tekstowy maly',
      tekst: 'Otwórz w Zasadach →',
      onclick: () => { stan.filtryZasad.szukaj = ''; location.hash = '#/zasady/' + z.grupa; },
    }));
}

// ---------------------------------------------------------------- egzamin

function widokEgzamin() {
  const historia = el('div', {});
  api('/api/egzaminy').then(lista => {
    if (!lista.length) return;
    const zdane = lista.filter(e => e.zdany).length;
    historia.replaceChildren(
      el('h2', { style: 'margin:26px 0 12px', tekst: 'Ostatnie podejścia' }),
      el('div', { klasa: 'karta', style: 'padding:6px 14px' },
        el('table', { klasa: 'tabela' },
          el('thead', {}, el('tr', {},
            el('th', { tekst: 'Data' }), el('th', { tekst: 'Kat.' }),
            el('th', { klasa: 'prawo', tekst: 'Punkty' }),
            el('th', { klasa: 'prawo', tekst: 'Czas' }),
            el('th', { klasa: 'prawo', tekst: 'Wynik' }))),
          el('tbody', {}, lista.slice(0, 10).map(e =>
            el('tr', { onclick: () => { location.hash = `#/egzamin/wynik/${e.id}`; } },
              el('td', { tekst: dataGodzinaPL(e.kiedy) }),
              el('td', { tekst: e.kategoria }),
              el('td', { klasa: 'prawo', tekst: `${e.punkty}/${e.maxPunkty}` }),
              el('td', { klasa: 'prawo', tekst: czasMMSS(e.czas) }),
              el('td', { klasa: 'prawo' },
                el('span', { klasa: 'oznaka ' + (e.zdany ? 'zdany' : 'oblany'), tekst: e.zdany ? 'zdany' : 'niezdany' })))))))
      ,
      el('p', { style: 'color:var(--tekst-2);font-size:.86rem;margin-top:10px',
        tekst: `Zdane ${zdane} z ${lista.length} ${odmiana(lista.length, 'podejścia', 'podejść', 'podejść')}.` }));
  }).catch(() => {});

  const wiersz = (etykieta, wartosc) => el('div', { klasa: 'rzad-ustawien' },
    el('div', {}, el('div', { tekst: etykieta })),
    el('div', { klasa: 'sterowanie', style: 'color:var(--tekst-2)', tekst: wartosc }));

  ustawTresc(
    naglowek('Egzamin próbny', 'Przebieg, punktacja i limity czasu takie jak na egzaminie państwowym.'),
    el('div', { klasa: 'karta' },
      wiersz('Część podstawowa', '20 pytań TAK/NIE — 10×3 pkt, 6×2 pkt, 4×1 pkt'),
      wiersz('Część specjalistyczna', '12 pytań A/B/C — 6×3 pkt, 4×2 pkt, 2×1 pkt'),
      wiersz('Do zdobycia', `${stan.katalog.maxPunkty} pkt, próg zaliczenia ${stan.katalog.progZdania} pkt`),
      wiersz('Czas na pytanie podstawowe', '20 s na zapoznanie + 15 s na odpowiedź'),
      wiersz('Czas na pytanie specjalistyczne', '50 s łącznie'),
      wiersz('Łączny czas', '25 minut'),
      el('div', { klasa: 'rzad-ustawien' },
        el('div', {},
          el('div', { tekst: 'Limity czasu' }),
          el('div', { klasa: 'opis', tekst: 'Wyłącz, jeśli chcesz przećwiczyć zestaw bez presji zegara.' })),
        el('div', { klasa: 'sterowanie' }, przelacznik(stan.ustawienia.timery, v => zapiszUstawienia({ timery: v }))))),
    el('div', { style: 'margin-top:18px;display:flex;gap:10px;flex-wrap:wrap' },
      el('button', { klasa: 'przycisk glowny', tekst: `Rozpocznij egzamin — kategoria ${stan.ustawienia.kategoria}`,
        onclick: rozpocznijEgzamin })),
    historia);
}

// ---------------------------------------------------------------- pytania podchwytliwe

function widokPodchwytliwe() {
  // Wyłącznie pytania oznaczone ręcznie. Pomyłka nie znaczy, że pytanie jest
  // podchwytliwe — bywa, że po prostu czegoś jeszcze nie wiesz, a samo pytanie
  // jest banalne. Ta ocena należy do Ciebie; błędy masz osobno w Powtórkach.
  const lista = pytaniaKategorii().filter(p => oznaczonePrzezeMnie(p.id));
  const zNotatka = lista.filter(p => stan.podchwytliwe[p.id]).length;

  ustawTresc(
    naglowek('Pytania podchwytliwe',
      `Pytania, które sam uznałeś za pułapki — kategoria ${stan.ustawienia.kategoria}.`),
    el('p', { klasa: 'opis', style: 'margin-bottom:18px',
      tekst: 'Oznaczaj przyciskiem „⚠ Podchwytliwe” w nauce, bazie pytań albo przy przeglądzie egzaminu. '
           + 'Możesz dopisać, na czym polega pułapka — ta uwaga pokaże się później pod pytaniem.' }),
    lista.length
      ? [
          el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px' },
            el('button', {
              klasa: 'przycisk glowny',
              tekst: `Przerób te pytania (${Math.min(lista.length, 50)})`,
              onclick: () => {
                stan.sesja = {
                  zrodlo: 'powtorki', parametr: 'moje-pulapki', wlasna: true, tytul: 'Moje pułapki',
                  pytania: lista.slice(0, 50), indeks: 0, odpowiedzi: {}, dobre: 0, notatkaOtwarta: false,
                };
                location.hash = '#/powtorki/start';
                rysujSesje();
              },
            }),
            el('span', { klasa: 'licznik-sesji',
              tekst: `${lista.length} ${odmiana(lista.length, 'pytanie', 'pytania', 'pytań')}`
                   + (zNotatka ? `, ${zNotatka} z uwagą` : '') })),
          el('div', { klasa: 'lista-pytan' }, lista.map(pozycjaBazy)),
        ]
      : pusto('⚠', 'Nie oznaczyłeś jeszcze żadnego pytania jako podchwytliwe.'));
}

// ---------------------------------------------------------------- arkusze do druku

function widokArkusze() {
  const poleIle = el('input', { type: 'number', min: '1', max: '50', value: '5', style: 'width:90px' });
  const zObrazkami = el('input', { type: 'checkbox', checked: true });
  const zKluczem = el('input', { type: 'checkbox', checked: true });

  const wyborKat = el('select', {}, stan.katalog.kategorie.map(k =>
    el('option', { value: k, tekst: k })));
  wyborKat.value = stan.ustawienia.kategoria;

  const podsumowanie = el('p', { klasa: 'opis', style: 'margin-top:10px' });
  const odswiezPodsumowanie = () => {
    const ile = Math.min(Math.max(1, Number(poleIle.value) || 1), 50);
    // Przy dwóch kolumnach na stronę wchodzi około sześciu pytań z obrazkiem.
    const stronNaArkusz = zObrazkami.checked ? 6 : 2;
    const stron = ile * stronNaArkusz + (zKluczem.checked ? Math.ceil(ile / 6) : 0);
    podsumowanie.textContent = `${ile} ${odmiana(ile, 'arkusz', 'arkusze', 'arkuszy')} × 32 pytania `
      + `= ${ile * 32} pytań, orientacyjnie ${stron} ${odmiana(stron, 'strona', 'strony', 'stron')} A4.`;
  };
  poleIle.oninput = odswiezPodsumowanie;
  zObrazkami.onchange = odswiezPodsumowanie;
  zKluczem.onchange = odswiezPodsumowanie;
  odswiezPodsumowanie();

  const otworz = () => {
    const ile = Math.min(Math.max(1, Number(poleIle.value) || 1), 50);
    const adres = `/druk.html?kategoria=${encodeURIComponent(wyborKat.value)}&ile=${ile}`
      + `&obrazki=${zObrazkami.checked ? 1 : 0}&klucz=${zKluczem.checked ? 1 : 0}`;
    window.open(adres, '_blank', 'noopener');
  };

  const rzad = (tytul, opis, sterowanie) => el('div', { klasa: 'rzad-ustawien' },
    el('div', {}, el('div', { tekst: tytul }), opis && el('div', { klasa: 'opis', tekst: opis })),
    el('div', { klasa: 'sterowanie' }, sterowanie));

  ustawTresc(
    naglowek('Arkusze do druku',
      'Losowe arkusze egzaminacyjne na papier — do rozwiązywania długopisem albo zapisania jako PDF.'),
    el('div', { klasa: 'karta' },
      rzad('Ile arkuszy', 'Każdy arkusz to inny, losowo dobrany zestaw 32 pytań. Maksymalnie 50 naraz.', poleIle),
      rzad('Kategoria', null, wyborKat),
      rzad('Zdjęcia i kadry z filmów',
        'Filmów nie da się wydrukować, więc trafia do arkusza kadr z rozstrzygającego momentu. Bez obrazków arkusz jest dużo krótszy, ale pytania sytuacyjne stają się nieczytelne.',
        el('label', { klasa: 'przelacznik' }, zObrazkami, el('span', { klasa: 'suwak' }))),
      rzad('Klucz odpowiedzi na końcu',
        'Osobne strony na końcu — wydrukuj je oddzielnie, żeby nie podglądać w trakcie.',
        el('label', { klasa: 'przelacznik' }, zKluczem, el('span', { klasa: 'suwak' }))),
      podsumowanie),
    el('div', { style: 'margin-top:18px;display:flex;gap:10px;flex-wrap:wrap' },
      el('button', { klasa: 'przycisk glowny', tekst: 'Wygeneruj arkusze', onclick: otworz })),
    el('div', { klasa: 'karta', style: 'margin-top:20px' },
      el('h3', { tekst: 'Jak zapisać do PDF' }),
      el('p', { style: 'color:var(--tekst-2);font-size:.9rem;margin-top:6px',
        tekst: 'Arkusze otworzą się w nowej karcie. Kliknij „Drukuj / zapisz jako PDF”, a w oknie drukowania '
             + 'wybierz jako drukarkę „Zapisz jako PDF”. Plik wyląduje na dysku i możesz go wydrukować kiedy chcesz.' })));
}

function przelacznik(wartosc, naZmiane) {
  const input = el('input', { type: 'checkbox', checked: wartosc ? true : null });
  input.addEventListener('change', () => naZmiane(input.checked));
  return el('label', { klasa: 'przelacznik' }, input, el('span', { klasa: 'suwak' }));
}

let zegarGlowny = null;
let zegarPytania = null;

function zatrzymajZegaryEgzaminu() {
  clearInterval(zegarGlowny); zegarGlowny = null;
  clearInterval(zegarPytania); zegarPytania = null;
}

async function rozpocznijEgzamin() {
  try {
    const dane = await api('/api/egzamin/nowy', 'POST', { kategoria: stan.ustawienia.kategoria });
    stan.egzamin = {
      klucz: dane.klucz,
      pozycje: dane.pozycje,
      czas: dane.czas,
      kategoria: dane.kategoria,
      indeks: 0,
      odpowiedzi: {},
      faza: 'czytanie',
      pozostaloPytanie: 0,
      pozostaloCalosc: dane.czas.calosc,
      start: Date.now(),
      timery: stan.ustawienia.timery,
      zakonczony: false,
    };
    location.hash = '#/egzamin/trwa';
    if (trasa()[1] === 'trwa') widokEgzaminTrwa();
  } catch (blad) {
    powiadom(blad.message);
  }
}

function widokEgzaminTrwa() {
  if (!stan.egzamin) { location.hash = '#/egzamin'; return; }
  ustawFazePytania();
  rysujEgzamin();
  uruchomZegarGlowny();
}

function uruchomZegarGlowny() {
  clearInterval(zegarGlowny);
  if (!stan.egzamin.timery) return;
  zegarGlowny = setInterval(() => {
    const e = stan.egzamin;
    if (!e || e.zakonczony) return clearInterval(zegarGlowny);
    e.pozostaloCalosc--;
    const zegar = $('#zegar-calosci');
    if (zegar) {
      zegar.textContent = czasMMSS(e.pozostaloCalosc);
      zegar.classList.toggle('alarm', e.pozostaloCalosc <= 120);
    }
    if (e.pozostaloCalosc <= 0) zakonczEgzamin();
  }, 1000);
}

/** Ustawia fazę i licznik dla bieżącego pytania (czytanie / odpowiedź). */
function ustawFazePytania() {
  const e = stan.egzamin;
  const poz = e.pozycje[e.indeks];
  e.faza = poz.czasCzytania > 0 ? 'czytanie' : 'odpowiedz';
  e.pozostaloPytanie = e.faza === 'czytanie' ? poz.czasCzytania : poz.czasOdpowiedzi;
  uruchomZegarPytania();
}

/* Kolejność faz przy pytaniu z filmem jest taka jak na egzaminie państwowym:
   zapoznanie (20 s) → projekcja filmu → dopiero potem 15 s na odpowiedź.
   Czas projekcji nie jest odliczany od czasu na odpowiedź; przycisk Start
   jedynie przyspiesza start filmu, kosztem reszty czasu na zapoznanie.
   Źródło: WORD - "Projekcja filmu kończy się stop klatką, która trwa przez
   cały czas przeznaczony na udzielenie odpowiedzi". */

/** Zapisuje odpowiedź na egzaminie.
 *  W czasie projekcji filmu nie przerysowujemy widoku, bo przebudowa DOM
 *  przerwałaby odtwarzanie - zaznaczenie podmieniamy wtedy w miejscu. */
function ustawOdpowiedzEgzaminu(klucz) {
  const e = stan.egzamin;
  if (!e || e.zakonczony) return;
  const poz = e.pozycje[e.indeks];
  e.odpowiedzi[poz.id] = klucz;

  if (e.faza !== 'film') return rysujEgzamin();

  for (const b of document.querySelectorAll('.karta-pytania .odpowiedz')) {
    b.classList.toggle('wybrana', b.dataset.klucz === klucz);
  }
}

/** Rozpoczyna projekcję filmu: zegar pytania staje na czas odtwarzania. */
function uruchomFilmEgzaminu() {
  const e = stan.egzamin;
  if (!e || (e.faza !== 'czytanie' && e.faza !== 'oczekiwanie')) return;

  const v = $('.karta-pytania video');
  if (!v) return zacznijOdpowiadanie();

  e.faza = 'film';
  clearInterval(zegarPytania);
  $('.przycisk-start')?.remove();

  // Widoku nie przerysowujemy, bo przebudowa DOM zabiłaby odtwarzany film -
  // podmieniamy tylko te fragmenty, które muszą się zmienić.
  const info = $('.faza-czytania');
  if (info) info.textContent = 'Projekcja filmu. Odpowiadać możesz już teraz; 15 s ruszy po ostatniej klatce.';
  odswiezZegarPytania();

  const koniec = () => zacznijOdpowiadanie();
  v.addEventListener('ended', koniec, { once: true });
  v.addEventListener('error', koniec, { once: true });
  v.play().catch(koniec);
}

/** Przechodzi do właściwego odliczania odpowiedzi - po filmie albo od razu. */
function zacznijOdpowiadanie() {
  const e = stan.egzamin;
  if (!e || e.faza === 'odpowiedz') return;
  e.faza = 'odpowiedz';
  e.pozostaloPytanie = e.pozycje[e.indeks].czasOdpowiedzi;
  const info = $('.faza-czytania');
  if (info) info.remove();
  uruchomZegarPytania();
  odswiezZegarPytania();
}

function uruchomZegarPytania() {
  clearInterval(zegarPytania);
  if (!stan.egzamin.timery) return;
  zegarPytania = setInterval(() => {
    const e = stan.egzamin;
    if (!e || e.zakonczony) return clearInterval(zegarPytania);
    e.pozostaloPytanie--;
    if (e.pozostaloPytanie <= 0) {
      if (e.faza === 'czytanie') {
        // Film puszcza się sam po upływie czasu na zapoznanie, jeśli zdający
        // nie nacisnął Start - tak jak na egzaminie.
        const p = stan.wgId.get(e.pozycje[e.indeks].id);
        if (p && p.mediaTyp === 'vid' && $('.karta-pytania video')) return uruchomFilmEgzaminu();
        e.faza = 'odpowiedz';
        e.pozostaloPytanie = e.pozycje[e.indeks].czasOdpowiedzi;
        rysujEgzamin();
      } else {
        nastepnePytanieEgzaminu();
      }
      return;
    }
    odswiezZegarPytania();
  }, 1000);
}

function odswiezZegarPytania() {
  const e = stan.egzamin;
  const tekst = $('#zegar-pytania-tekst');
  const wskaz = $('#zegar-pytania-wskaz');
  if (!tekst || !wskaz) return;
  const poz = e.pozycje[e.indeks];
  const obwod = 2 * Math.PI * 14;

  // W czasie projekcji nic nie odlicza - zegar pokazuje, że film trwa.
  if (e.faza === 'film') {
    tekst.textContent = '▶';
    wskaz.setAttribute('stroke-dasharray', obwod);
    wskaz.setAttribute('stroke-dashoffset', 0);
    wskaz.classList.remove('alarm');
    return;
  }

  const pelny = e.faza === 'czytanie' ? poz.czasCzytania : poz.czasOdpowiedzi;
  tekst.textContent = `${e.pozostaloPytanie} s`;
  wskaz.setAttribute('stroke-dasharray', obwod);
  wskaz.setAttribute('stroke-dashoffset', obwod * (1 - e.pozostaloPytanie / pelny));
  wskaz.classList.toggle('alarm', e.pozostaloPytanie <= 5);
}

function rysujEgzamin() {
  const e = stan.egzamin;
  const poz = e.pozycje[e.indeks];
  const p = stan.wgId.get(poz.id);
  const wCzytaniu = e.timery && e.faza === 'czytanie';
  const nrCzesci = poz.zakres === 'P' ? e.indeks + 1 : e.indeks - 19;
  const wCzesci = poz.zakres === 'P' ? 20 : 12;

  const obwod = 2 * Math.PI * 14;
  const zegarKolowy = e.timery
    ? el('div', { klasa: 'zegar-pytania' },
        svg('svg', { klasa: 'pierscien', viewBox: '0 0 34 34' },
          svg('circle', { klasa: 'tor', cx: 17, cy: 17, r: 14 }),
          svg('circle', { id: 'zegar-pytania-wskaz', klasa: 'wskaz', cx: 17, cy: 17, r: 14,
            'stroke-dasharray': obwod, 'stroke-dashoffset': 0 })),
        el('span', { id: 'zegar-pytania-tekst', tekst: `${e.pozostaloPytanie} s` }))
    : null;

  const pasek = el('div', { klasa: 'pasek-egzaminu' },
    el('span', { id: 'zegar-calosci', klasa: 'zegar' + (e.pozostaloCalosc <= 120 ? ' alarm' : ''),
      tekst: e.timery ? czasMMSS(e.pozostaloCalosc) : '—' }),
    el('span', { klasa: 'etap-egzaminu',
      tekst: `${poz.zakres === 'P' ? 'Część podstawowa' : 'Część specjalistyczna'} · pytanie ${nrCzesci}/${wCzesci}` }),
    el('div', { klasa: 'z-prawej' },
      el('span', { klasa: 'etap-egzaminu', tekst: `${poz.punkty} pkt` }),
      zegarKolowy));

  const karta = el('div', { klasa: 'karta-pytania' },
    mediaPytania(p, {
      kontrolki: !e.timery,
      automat: !e.timery,
      klucz: `${e.indeks}`,
      // Start przyspiesza projekcję; czas na odpowiedź ruszy dopiero po filmie.
      naStart: (e.timery && p.mediaTyp === 'vid') ? uruchomFilmEgzaminu : null,
    }),
    el('div', { klasa: 'tresc-pytania' },
      el('div', { klasa: 'pytanie-tekst', tekst: p.tresc }),
      wCzytaniu
        ? el('div', { klasa: 'faza-czytania',
            tekst: p.mediaTyp === 'vid'
              ? 'Zapoznaj się z pytaniem. Możesz już odpowiedzieć. Start puszcza film — 15 s ruszy po jego końcu.'
              : 'Zapoznaj się z pytaniem. Możesz już odpowiedzieć.' })
        : null,
      przyciskiOdpowiedzi(p, {
        wybrana: e.odpowiedzi[poz.id],
        odslonieta: false,
        // Odpowiadać wolno przez cały czas trwania pytania - także w trakcie filmu.
        zablokowane: false,
        naKlik: ustawOdpowiedzEgzaminu,
      })),
    el('div', { klasa: 'stopka-pytania' },
      el('span', { klasa: 'licznik-sesji',
        tekst: `Pytanie ${e.indeks + 1} z ${e.pozycje.length}` }),
      el('div', { klasa: 'z-prawej' },
        el('button', { klasa: 'przycisk tekstowy maly', tekst: 'Przerwij egzamin',
          onclick: () => { if (confirm('Przerwać egzamin? Wynik nie zostanie zapisany.')) { zatrzymajZegaryEgzaminu(); stan.egzamin = null; location.hash = '#/egzamin'; } } }),
        el('button', {
          klasa: 'przycisk glowny',
          tekst: e.indeks === e.pozycje.length - 1 ? 'Zakończ egzamin' : 'Następne ›',
          onclick: nastepnePytanieEgzaminu,
        }))));

  ustawTresc(el('div', { klasa: 'scena-pytania' }, pasek, karta,
    el('p', { klasa: 'podpowiedz-klawiszy',
      tekst: 'Na egzaminie nie można wrócić do wcześniejszego pytania — tutaj jest tak samo.' })));

  if (e.timery) odswiezZegarPytania();
}

function nastepnePytanieEgzaminu() {
  const e = stan.egzamin;
  if (e.indeks < e.pozycje.length - 1) {
    e.indeks++;
    ustawFazePytania();
    rysujEgzamin();
  } else {
    zakonczEgzamin();
  }
}

async function zakonczEgzamin() {
  const e = stan.egzamin;
  if (!e || e.zakonczony) return;
  e.zakonczony = true;
  zatrzymajZegaryEgzaminu();
  const czas = Math.round((Date.now() - e.start) / 1000);
  try {
    const wynik = await api('/api/egzamin/zakoncz', 'POST', {
      klucz: e.klucz, odpowiedzi: e.odpowiedzi, czas,
    });
    for (const s of wynik.szczegoly) {
      if (s.udzielona === null) continue;
      const poprzedni = stan.postep[s.id] || { dobre: 0, zle: 0 };
      stan.postep[s.id] = {
        dobre: poprzedni.dobre + (s.ok ? 1 : 0),
        zle: poprzedni.zle + (s.ok ? 0 : 1),
        ostatniaOk: s.ok,
        poziom: s.ok ? Math.min((poprzedni.poziom || 0) + 1, 6) : 0,
        powtorkaDo: s.ok ? Date.now() + 600000 : Date.now(),
        kiedy: Date.now(),
      };
    }
    stan.egzamin = null;
    odswiezLicznikPowtorek();
    location.hash = `#/egzamin/wynik/${wynik.id}`;
  } catch (blad) {
    stan.egzamin = null;
    powiadom('Nie udało się zapisać wyniku: ' + blad.message);
    location.hash = '#/egzamin';
  }
}

async function widokWynikEgzaminu(id) {
  ustawTresc(el('div', { klasa: 'pusto' }, el('div', { klasa: 'spinner' })));
  let e;
  try {
    e = await api('/api/egzamin/' + Number(id));
  } catch {
    return ustawTresc(naglowek('Wynik', 'Nie znaleziono tego egzaminu.'),
      el('a', { klasa: 'przycisk', href: '#/egzamin', tekst: 'Wróć' }));
  }

  const bledne = e.szczegoly.filter(s => !s.ok);
  const przeglad = e.szczegoly.map((s, i) => {
    const p = stan.wgId.get(s.id);
    return el('button', { klasa: 'przeglad-wiersz', onclick: () => pokazPytanieZPrzegladu(s) },
      el('span', { klasa: 'stan ' + (s.ok ? 'ok' : s.udzielona === null ? 'brak' : 'zle'),
        tekst: s.ok ? '✓' : s.udzielona === null ? '–' : '✕' }),
      el('span', { klasa: 'tekst', tekst: `${i + 1}. ${p ? p.tresc : 'pytanie ' + s.id}` }),
      el('span', { klasa: 'pkt', tekst: `${s.ok ? s.punkty : 0}/${s.punkty}` }));
  });

  ustawTresc(el('div', { klasa: 'scena-pytania' },
    el('div', { klasa: 'karta wynik-egzaminu' },
      el('div', { klasa: 'wynik-znak', tekst: e.zdany ? '🎉' : '😕' }),
      el('div', { klasa: 'wynik-punkty ' + (e.zdany ? 'zdany' : 'oblany'), tekst: `${e.punkty}/${e.maxPunkty}` }),
      el('p', { klasa: 'wynik-podpis',
        tekst: `${e.zdany ? 'Zdane!' : 'Niezdane.'} Próg to 68 punktów. Poprawnych odpowiedzi: ${e.poprawne}/32, czas: ${czasMMSS(e.czas)}.` }),
      el('div', { klasa: 'wynik-akcje' },
        el('button', { klasa: 'przycisk glowny', tekst: 'Kolejny egzamin', onclick: rozpocznijEgzamin }),
        bledne.length > 0 && el('button', {
          klasa: 'przycisk', tekst: `Przerób ${bledne.length} ${odmiana(bledne.length, 'błąd', 'błędy', 'błędów')}`,
          onclick: () => {
            const pytania = bledne.map(s => stan.wgId.get(s.id)).filter(Boolean);
            if (!pytania.length) return;
            stan.sesja = { zrodlo: 'powtorki', parametr: 'egzamin' + id, wlasna: true, tytul: 'Błędy z egzaminu',
              pytania, indeks: 0, odpowiedzi: {}, dobre: 0, notatkaOtwarta: false };
            location.hash = '#/powtorki/start';
            rysujSesje();
          },
        }),
        el('a', { klasa: 'przycisk', href: '#/statystyki', tekst: 'Statystyki' }))),
    el('h2', { style: 'margin:26px 0 4px', tekst: 'Przegląd pytań' }),
    el('p', { style: 'color:var(--tekst-2);font-size:.88rem', tekst: 'Kliknij pytanie, aby zobaczyć treść i poprawną odpowiedź.' }),
    el('div', { klasa: 'przeglad-lista' }, przeglad)));
}

function pokazPytanieZPrzegladu(s) {
  const p = stan.wgId.get(s.id);
  if (!p) return;
  const karta = el('div', { klasa: 'karta-pytania', style: 'margin-top:16px' },
    mediaPytania(p, { kontrolki: true }),
    el('div', { klasa: 'tresc-pytania' },
      znacznikiPytania(p),
      el('div', { klasa: 'pytanie-tekst', tekst: p.tresc }),
      przyciskiOdpowiedzi(p, { wybrana: s.udzielona, odslonieta: true, naKlik: () => {} }),
      el('div', { klasa: 'werdykt ' + (s.ok ? 'dobrze' : 'zle'),
        tekst: s.ok ? 'Odpowiedziałeś poprawnie.'
          : s.udzielona === null ? `Bez odpowiedzi. Poprawna: ${nazwaOdpowiedzi(p, p.poprawna)}`
          : `Błędnie. Poprawna odpowiedź: ${nazwaOdpowiedzi(p, p.poprawna)}` }),
      ostrzezeniePodchwytliwe(p),
      blokWyjasnienia(p)),
    el('div', { klasa: 'stopka-pytania' },
      przyciskPodchwytliwe(p, () => pokazPytanieZPrzegladu(s)),
      el('span', { klasa: 'licznik-sesji', style: 'color:var(--tekst-3)', tekst: `nr ${p.id}` })));
  const okno = el('div', { klasa: 'karta', style: 'margin-top:16px;padding:0;border:none;box-shadow:none' }, karta);
  const stare = $('#podglad-pytania');
  if (stare) stare.remove();
  okno.id = 'podglad-pytania';
  kontenerTresci().append(okno);
  okno.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------------------------------------------------------------- baza pytań

function widokBaza() {
  const f = stan.filtryBazy;

  const poleSzukaj = el('input', { type: 'search', placeholder: 'Szukaj w treści pytania lub po numerze…', value: f.szukaj });
  let uchwyt;
  poleSzukaj.addEventListener('input', () => {
    clearTimeout(uchwyt);
    uchwyt = setTimeout(() => { f.szukaj = poleSzukaj.value; f.strona = 0; rysujListeBazy(); }, 220);
  });

  const wybor = (klucz, opcje) => {
    const s = el('select', {}, opcje.map(([w, t]) => el('option', { value: w, tekst: t, selected: f[klucz] === w })));
    s.value = f[klucz];
    s.onchange = () => { f[klucz] = s.value; f.strona = 0; rysujListeBazy(); };
    return s;
  };

  const filtry = el('div', { klasa: 'filtry' },
    poleSzukaj,
    wybor('zakres', [['', 'Cały zakres'], ['P', 'Podstawowe'], ['S', 'Specjalistyczne']]),
    wybor('punkty', [['', 'Punkty'], ['3', '3 pkt'], ['2', '2 pkt'], ['1', '1 pkt']]),
    wybor('stan', [['', 'Wszystkie'], ['nowe', 'Nieprzerobione'], ['bledne', 'Do poprawy'],
      ['opanowane', 'Opanowane'], ['zakladki', 'Zakładki'], ['notatki', 'Z notatką'],
      ['pulapki', 'Podchwytliwe'], ['wyjasnione', 'Z wyjaśnieniem'], ['media', 'Z multimediami']]));

  ustawTresc(
    naglowek('Baza pytań', `Wszystkie pytania dla kategorii ${stan.ustawienia.kategoria} wraz z poprawnymi odpowiedziami.`),
    filtry,
    el('div', { id: 'wyniki-bazy' }));
  rysujListeBazy();
}

function przefiltrowanePytania() {
  const f = stan.filtryBazy;
  const szukaj = f.szukaj.trim().toLowerCase();
  return stan.katalog.pytania.filter(p => {
    if (!p.kategorie.includes(stan.ustawienia.kategoria)) return false;
    if (f.zakres && p.zakres !== f.zakres) return false;
    if (f.punkty && String(p.punkty) !== f.punkty) return false;

    const s = stanPytania(p.id);
    if (f.stan === 'nowe' && s) return false;
    if (f.stan === 'bledne' && (!s || s.ostatniaOk)) return false;
    if (f.stan === 'opanowane' && (!s || !s.ostatniaOk)) return false;
    if (f.stan === 'zakladki' && !stan.zakladki.has(p.id)) return false;
    if (f.stan === 'notatki' && !stan.notatki[p.id]) return false;
    if (f.stan === 'media' && !p.media) return false;
    if (f.stan === 'pulapki' && !jakiekolwiekPodchwytliwe(p)) return false;
    if (f.stan === 'wyjasnione' && !stan.wyjasnienia[p.id]) return false;

    if (szukaj) {
      const wTresci = p.tresc.toLowerCase().includes(szukaj);
      const wOdp = p.odpowiedzi && Object.values(p.odpowiedzi).some(o => o.toLowerCase().includes(szukaj));
      if (!wTresci && !wOdp && p.id !== szukaj) return false;
    }
    return true;
  });
}

function rysujListeBazy() {
  const f = stan.filtryBazy;
  const lista = przefiltrowanePytania();
  const stron = Math.max(1, Math.ceil(lista.length / NA_STRONE));
  f.strona = Math.min(f.strona, stron - 1);
  const widoczne = lista.slice(f.strona * NA_STRONE, (f.strona + 1) * NA_STRONE);

  const pojemnik = $('#wyniki-bazy');
  if (!pojemnik) return;

  if (!lista.length) {
    return pojemnik.replaceChildren(pusto('☰', 'Żadne pytanie nie pasuje do wybranych filtrów.'));
  }

  // replaceChildren zamienia null na dosłowny tekst "null" — trzeba odfiltrować.
  pojemnik.replaceChildren(...[
    el('p', { style: 'color:var(--tekst-2);font-size:.86rem;margin-bottom:12px',
      tekst: `${lista.length} ${odmiana(lista.length, 'pytanie', 'pytania', 'pytań')}` }),
    el('div', { klasa: 'lista-pytan' }, widoczne.map(pozycjaBazy)),
    stron > 1 ? el('div', { klasa: 'stronicowanie' },
      el('button', { klasa: 'przycisk maly', disabled: f.strona === 0 ? true : null, tekst: '‹ Poprzednia',
        onclick: () => { f.strona--; rysujListeBazy(); window.scrollTo(0, 0); } }),
      el('span', { tekst: `${f.strona + 1} / ${stron}` }),
      el('button', { klasa: 'przycisk maly', disabled: f.strona >= stron - 1 ? true : null, tekst: 'Następna ›',
        onclick: () => { f.strona++; rysujListeBazy(); window.scrollTo(0, 0); } })) : null,
  ].filter(Boolean));
}

function pozycjaBazy(p) {
  const s = stanPytania(p.id);
  const wZakladkach = stan.zakladki.has(p.id);

  const odpowiedzi = p.typ === 'tn'
    ? el('div', { klasa: 'pozycja-odpowiedzi' },
        el('div', { klasa: 'odp' + (p.poprawna === 'T' ? ' ok' : ''), tekst: 'TAK' }),
        el('div', { klasa: 'odp' + (p.poprawna === 'N' ? ' ok' : ''), tekst: 'NIE' }))
    : el('div', { klasa: 'pozycja-odpowiedzi' },
        ['A', 'B', 'C'].map(k => el('div', { klasa: 'odp' + (p.poprawna === k ? ' ok' : '') },
          el('span', { klasa: 'k', tekst: k }), el('span', { tekst: p.odpowiedzi[k] }))));

  const pojemnikMediow = el('div', { klasa: 'pozycja-media' });
  if (p.media) {
    const przycisk = el('button', { klasa: 'przycisk-ikona',
      tekst: p.mediaTyp === 'vid' ? '▶ Pokaż film' : '🖼 Pokaż zdjęcie' });
    przycisk.onclick = () => {
      pojemnikMediow.replaceChildren(p.mediaTyp === 'vid'
        ? el('video', {
            src: '/media/' + encodeURIComponent(p.media),
            poster: '/media/klatki/' + encodeURIComponent(p.media.replace(/\.[^.]+$/, '') + '.jpg'),
            controls: true, playsinline: true, muted: true, autoplay: true,
          })
        : el('img', { src: '/media/' + encodeURIComponent(p.media), alt: 'Ilustracja do pytania' }));
    };
    pojemnikMediow.append(przycisk);
  }

  return el('div', { klasa: 'pozycja-pytania' },
    el('div', { klasa: 'pozycja-gora' },
      el('span', { klasa: 'znacznik', tekst: 'nr ' + p.id }),
      el('span', { klasa: 'znacznik' + (p.zakres === 'S' ? ' akcent' : ''),
        tekst: p.zakres === 'P' ? 'podstawowe' : 'specjalistyczne' }),
      el('span', { klasa: 'znacznik', tekst: `${p.punkty} pkt` }),
      p.weryfikacja && el('span', { klasa: 'znacznik uwaga', tekst: 'w weryfikacji' }),
      p.brakMediow && el('span', { klasa: 'znacznik uwaga', tekst: 'brak pliku multimediów' }),
      s && el('span', { klasa: 'znacznik' + (s.ostatniaOk ? '' : ' uwaga'), tekst: s.ostatniaOk ? 'opanowane' : 'do poprawy' }),
      jakiekolwiekPodchwytliwe(p) && el('span', { klasa: 'znacznik pulapka', tekst: '⚠ podchwytliwe' }),
      el('span', { klasa: 'z-prawej' },
        przyciskPodchwytliwe(p, () => rysujListeBazy()),
        el('button', {
          klasa: 'przycisk-ikona' + (wZakladkach ? ' wlaczony' : ''),
          tekst: wZakladkach ? '★' : '☆',
          title: 'Zakładka',
          onclick: async ev => {
            const wynik = await api('/api/zakladka', 'POST', { pytanie: p.id });
            if (wynik.aktywna) stan.zakladki.add(p.id); else stan.zakladki.delete(p.id);
            ev.currentTarget.classList.toggle('wlaczony', wynik.aktywna);
            ev.currentTarget.textContent = wynik.aktywna ? '★' : '☆';
          },
        }))),
    el('div', { klasa: 'pozycja-tresc', tekst: p.tresc }),
    odpowiedzi,
    ostrzezeniePodchwytliwe(p),
    edytorUwagiPulapki(p, () => rysujListeBazy()),
    blokWyjasnienia(p),
    stan.notatki[p.id] && el('div', { klasa: 'pozycja-notatka', tekst: stan.notatki[p.id] }),
    p.media ? pojemnikMediow : null);
}

// ---------------------------------------------------------------- znaki drogowe

async function wczytajZnaki() {
  if (stan.znaki) return stan.znaki;
  stan.znaki = await api('/api/znaki');
  return stan.znaki;
}

async function widokZnaki() {
  const f = stan.filtryZnakow;

  ustawTresc(
    naglowek('Znaki drogowe', 'Wszystkie znaki pionowe i poziome z rozporządzenia, wraz z wyjaśnieniem.'),
    el('div', { id: 'zawartosc-znakow' }, el('p', { klasa: 'przygaszony', tekst: 'Wczytywanie katalogu znaków…' })));

  let dane;
  try {
    dane = await wczytajZnaki();
  } catch {
    const p = $('#zawartosc-znakow');
    if (p) p.replaceChildren(pusto('▲', 'Nie udało się wczytać katalogu znaków.'));
    return;
  }
  if (trasa()[0] !== 'znaki') return;   // użytkownik zdążył przejść dalej

  if (!dane.znaki.length) {
    const p = $('#zawartosc-znakow');
    if (p) {
      p.replaceChildren(pusto('▲', 'Katalog znaków jest pusty. Uruchom: python narzedzia/zbuduj-znaki.py'));
    }
    return;
  }

  const poleSzukaj = el('input', { type: 'search', placeholder: 'Szukaj po kodzie, nazwie lub treści…', value: f.szukaj });
  let uchwyt;
  poleSzukaj.addEventListener('input', () => {
    clearTimeout(uchwyt);
    uchwyt = setTimeout(() => { f.szukaj = poleSzukaj.value; rysujZnaki(); }, 200);
  });

  // Szukanie po całym katalogu ma sens tylko wtedy, gdy nie jesteśmy zamknięci
  // w jednej grupie - dlatego wpisanie czegokolwiek przełącza na „wszystkie".
  const zakladki = el('div', { klasa: 'zakladki-znakow' },
    [{ kod: '', nazwa: 'Wszystkie', ile: dane.znaki.length }, ...dane.grupy].map(g =>
      el('button', {
        klasa: 'zakladka-znakow' + (f.grupa === g.kod ? ' aktywna' : ''),
        dane: { grupa: g.kod },
        onclick: () => { f.grupa = g.kod; rysujZnaki(); },
      },
        el('span', { klasa: 'kod', tekst: g.kod || '＊' }),
        el('span', { klasa: 'opis', tekst: g.nazwa }),
        el('span', { klasa: 'ile', tekst: g.ile }))));

  $('#zawartosc-znakow').replaceChildren(
    zakladki,
    el('div', { klasa: 'filtry' }, poleSzukaj),
    el('div', { id: 'lista-znakow' }));
  rysujZnaki();
}

function rysujZnaki() {
  const f = stan.filtryZnakow;
  const dane = stan.znaki;
  const pojemnik = $('#lista-znakow');
  if (!pojemnik || !dane) return;

  for (const b of document.querySelectorAll('.zakladka-znakow')) {
    b.classList.toggle('aktywna', (b.dataset.grupa || '') === f.grupa);
  }

  const szukaj = f.szukaj.trim().toLowerCase();
  const lista = dane.znaki.filter(z => {
    if (f.grupa && z.grupa !== f.grupa) return false;
    if (!szukaj) return true;
    return z.kod.toLowerCase().includes(szukaj)
      || z.nazwa.toLowerCase().includes(szukaj)
      || z.opis.toLowerCase().includes(szukaj);
  });

  const grupa = f.grupa && dane.grupy.find(g => g.kod === f.grupa);
  const wstep = grupa && !szukaj && el('div', { klasa: 'karta wstep-grupy' },
    el('h3', { tekst: grupa.nazwa }),
    el('p', { klasa: 'ksztalt', tekst: grupa.ksztalt }),
    el('p', { tekst: grupa.zasada }));

  if (!lista.length) {
    return pojemnik.replaceChildren(wstep || '', pusto('▲', 'Żaden znak nie pasuje do wyszukiwania.'));
  }

  const siatka = el('div', { klasa: 'siatka-znakow' }, lista.map(kartaZnaku));
  pojemnik.replaceChildren(...[
    wstep,
    szukaj && el('p', { klasa: 'przygaszony', tekst: `Znaleziono ${lista.length} ${odmiana(lista.length, 'znak', 'znaki', 'znaków')}.` }),
    siatka,
  ].filter(Boolean));
}

function kartaZnaku(z) {
  const rysunek = z.rysunek
    ? el('img', { src: `/media/znaki/${encodeURIComponent(z.rysunek)}`, alt: `Znak ${z.kod}`, loading: 'lazy' })
    : el('div', { klasa: 'brak-rysunku', tekst: z.kod });

  // Tablice są za szerokie, żeby zmieścić je obok tekstu w czytelnym rozmiarze -
  // dostają wtedy całą szerokość karty i lądują nad opisem.
  const proporcja = z.szer && z.wys ? z.szer / z.wys : 1;
  const uklad = proporcja > 1.35 ? ' szeroki' : (proporcja < 0.8 ? ' wysoki' : '');

  return el('article', { klasa: 'karta karta-znaku' + uklad },
    el('div', { klasa: 'rysunek-znaku' }, rysunek),
    el('div', { klasa: 'tresc-znaku' },
      el('div', { klasa: 'naglowek-znaku' },
        el('span', { klasa: 'kod-znaku', tekst: z.kod }),
        el('span', { klasa: 'nazwa-znaku', tekst: z.nazwa })),
      el('p', { klasa: 'opis-znaku', tekst: z.opis })));
}

// ---------------------------------------------------------------- zasady ruchu

async function widokZasady() {
  const f = stan.filtryZasad;

  ustawTresc(
    naglowek('Zasady', 'Reguły, które rozstrzygają pytania na teście i decyzje na drodze.'),
    el('div', { id: 'zawartosc-zasad' }, el('p', { klasa: 'przygaszony', tekst: 'Wczytywanie zasad…' })));

  let dane;
  try {
    dane = stan.zasady || (stan.zasady = await api('/api/zasady'));
  } catch {
    $('#zawartosc-zasad')?.replaceChildren(pusto('§', 'Nie udało się wczytać zasad.'));
    return;
  }
  if (trasa()[0] !== 'zasady') return;

  if (!dane.zasady.length) {
    $('#zawartosc-zasad')?.replaceChildren(
      pusto('§', 'Brak zasad. Uruchom: python narzedzia/zbuduj-zasady.py'));
    return;
  }

  const poleSzukaj = el('input', { type: 'search', placeholder: 'Szukaj w zasadach…', value: f.szukaj });
  let uchwyt;
  poleSzukaj.addEventListener('input', () => {
    clearTimeout(uchwyt);
    uchwyt = setTimeout(() => { f.szukaj = poleSzukaj.value; rysujZasady(); }, 200);
  });

  const zakladki = el('div', { klasa: 'zakladki-znakow' },
    [{ kod: '', nazwa: 'Wszystkie', ile: dane.zasady.length }, ...dane.grupy].map(g =>
      el('button', {
        klasa: 'zakladka-znakow' + (f.grupa === g.kod ? ' aktywna' : ''),
        dane: { grupa: g.kod },
        onclick: () => { f.grupa = g.kod; rysujZasady(); },
      },
        el('span', { klasa: 'opis', tekst: g.nazwa }),
        el('span', { klasa: 'ile', tekst: g.ile }))));

  $('#zawartosc-zasad').replaceChildren(
    zakladki,
    el('div', { klasa: 'filtry' }, poleSzukaj),
    el('div', { id: 'lista-zasad' }));
  rysujZasady();
}

function rysujZasady() {
  const f = stan.filtryZasad;
  const dane = stan.zasady;
  const pojemnik = $('#lista-zasad');
  if (!pojemnik || !dane) return;

  for (const b of document.querySelectorAll('.zakladki-znakow .zakladka-znakow')) {
    b.classList.toggle('aktywna', (b.dataset.grupa || '') === f.grupa);
  }

  const szukaj = f.szukaj.trim().toLowerCase();
  const lista = dane.zasady.filter(z => {
    if (f.grupa && z.grupa !== f.grupa) return false;
    if (!szukaj) return true;
    return (z.tytul + ' ' + z.sedno + ' ' + z.opis).toLowerCase().includes(szukaj);
  });

  const grupa = f.grupa && dane.grupy.find(g => g.kod === f.grupa);
  const wstep = grupa && !szukaj && el('p', { klasa: 'przygaszony', tekst: grupa.opis });

  if (!lista.length) {
    return pojemnik.replaceChildren(pusto('§', 'Żadna zasada nie pasuje do wyszukiwania.'));
  }

  pojemnik.replaceChildren(...[
    wstep,
    szukaj && el('p', { klasa: 'przygaszony',
      tekst: `Znaleziono ${lista.length} ${odmiana(lista.length, 'zasadę', 'zasady', 'zasad')}.` }),
    el('div', { klasa: 'lista-zasad' }, lista.map(kartaZasady)),
  ].filter(Boolean));
}

function kartaZasady(z) {
  return el('article', { klasa: 'karta karta-zasady' },
    el('h3', { tekst: z.tytul }),
    // Sedno jest wyróżnione, bo przy powtórce przed egzaminem czyta się tylko je.
    el('p', { klasa: 'sedno-zasady', tekst: z.sedno }),
    el('p', { klasa: 'opis-zasady', tekst: z.opis }),
    z.tabela ? tabelaZasady(z.tabela) : null);
}

function tabelaZasady(t) {
  return el('div', { klasa: 'tabela-zasady-otoczka' },
    el('table', { klasa: 'tabela-zasady' },
      el('thead', {}, el('tr', {}, t.naglowki.map(h => el('th', { tekst: h })))),
      el('tbody', {}, t.wiersze.map(w => el('tr', {}, w.map(k => el('td', { tekst: k })))))));
}

// ---------------------------------------------------------------- statystyki

async function widokStatystyki() {
  ustawTresc(el('div', { klasa: 'pusto' }, el('div', { klasa: 'spinner' })));
  let dane;
  try { dane = await api('/api/statystyki'); }
  catch { return ustawTresc(naglowek('Statystyki'), pusto('◗', 'Nie udało się wczytać statystyk.')); }

  const p = podsumowanieKategorii();
  const skutecznosc = p.zrobione ? Math.round(p.ok / p.zrobione * 100) : 0;
  const egz = dane.egzaminy;
  const zdane = egz.filter(e => e.zdany).length;
  const sredniaEgz = egz.length ? Math.round(egz.reduce((s, e) => s + e.punkty, 0) / egz.length) : 0;

  const kafelek = (etykieta, wartosc, dopisek, klasa) =>
    el('div', { klasa: 'karta kafelek-liczby' },
      el('div', { klasa: 'etykieta', tekst: etykieta }),
      el('div', { klasa: 'wartosc' + (klasa ? ' ' + klasa : ''), tekst: wartosc }),
      dopisek && el('div', { klasa: 'dopisek', tekst: dopisek }));

  ustawTresc(
    naglowek('Statystyki', `Postęp dla kategorii ${stan.ustawienia.kategoria}.`),
    el('div', { klasa: 'siatka kolumny-4' },
      kafelek('Przerobione', `${p.zrobione}`, `z ${p.razem} pytań`),
      kafelek('Skuteczność', p.zrobione ? `${skutecznosc}%` : '—', 'ostatnie odpowiedzi', skutecznosc >= 80 ? 'dobrze' : (p.zrobione ? 'zle' : '')),
      kafelek('Egzaminy', `${zdane}/${egz.length}`, 'zdanych podejść', zdane === egz.length && egz.length ? 'dobrze' : ''),
      kafelek('Średni wynik', egz.length ? `${sredniaEgz}` : '—', `próg ${stan.katalog.progZdania} pkt`,
        sredniaEgz >= stan.katalog.progZdania ? 'dobrze' : (egz.length ? 'zle' : ''))),

    el('h2', { style: 'margin:26px 0 12px', tekst: 'Odpowiedzi dzień po dniu' }),
    el('div', { klasa: 'karta' },
      dane.dzienne.length
        ? [wstawWykres(S => wykresDzienny(dane.dzienne, S)),
           el('div', { klasa: 'legenda' },
             el('span', {}, el('i', { style: 'background:var(--akcent)' }), 'poprawne'),
             el('span', {}, el('i', { style: 'background:color-mix(in srgb, var(--zle) 70%, transparent)' }), 'błędne'))]
        : pusto('◗', 'Brak danych — zacznij naukę, a wykres pojawi się tutaj.')),

    el('h2', { style: 'margin:26px 0 12px', tekst: 'Wyniki egzaminów' }),
    el('div', { klasa: 'karta' },
      egz.length
        ? [wstawWykres(S => wykresEgzaminow(egz.slice().reverse(), S)),
           el('div', { klasa: 'legenda' },
             el('span', {}, el('i', { style: 'background:var(--dobrze)' }), `próg zdania (${stan.katalog.progZdania} pkt)`))]
        : pusto('✓', 'Nie masz jeszcze żadnego podejścia do egzaminu.',
            el('a', { href: '#/egzamin', klasa: 'przycisk glowny', style: 'margin-top:14px', tekst: 'Rozpocznij egzamin' }))),

    egz.length ? el('h2', { style: 'margin:26px 0 12px', tekst: 'Historia podejść' }) : null,
    egz.length ? el('div', { klasa: 'karta', style: 'padding:6px 14px' },
      el('table', { klasa: 'tabela' },
        el('thead', {}, el('tr', {},
          el('th', { tekst: 'Data' }), el('th', { tekst: 'Kat.' }),
          el('th', { klasa: 'prawo', tekst: 'Punkty' }),
          el('th', { klasa: 'prawo', tekst: 'Poprawne' }),
          el('th', { klasa: 'prawo', tekst: 'Czas' }),
          el('th', { klasa: 'prawo', tekst: 'Wynik' }))),
        el('tbody', {}, egz.map(e =>
          el('tr', { onclick: () => { location.hash = `#/egzamin/wynik/${e.id}`; } },
            el('td', { tekst: dataGodzinaPL(e.kiedy) }),
            el('td', { tekst: e.kategoria }),
            el('td', { klasa: 'prawo', tekst: `${e.punkty}/${e.maxPunkty}` }),
            el('td', { klasa: 'prawo', tekst: `${e.poprawne}/32` }),
            el('td', { klasa: 'prawo', tekst: czasMMSS(e.czas) }),
            el('td', { klasa: 'prawo' },
              el('span', { klasa: 'oznaka ' + (e.zdany ? 'zdany' : 'oblany'), tekst: e.zdany ? 'zdany' : 'niezdany' }))))))) : null);
}

/**
 * Osadza wykres, rysując go w rzeczywistej szerokości kontenera.
 * Dzięki temu podpisy osi nie są rozciągane, a wykres reaguje na zmianę rozmiaru okna.
 */
function wstawWykres(rysuj) {
  const host = el('div', { klasa: 'host-wykresu' });
  let ostatniaSzerokosc = 0;
  const przerysuj = () => {
    const szerokosc = Math.max(300, Math.round(host.clientWidth));
    if (Math.abs(szerokosc - ostatniaSzerokosc) < 5) return;
    ostatniaSzerokosc = szerokosc;
    host.replaceChildren(rysuj(szerokosc));
  };
  requestAnimationFrame(przerysuj);
  new ResizeObserver(przerysuj).observe(host);
  return host;
}

function wykresDzienny(dzienne, S = 620) {
  const dane = dzienne.slice(-30);
  const W = 190, margines = { g: 10, d: 22, l: 30, p: 6 };
  const maks = Math.max(5, ...dane.map(d => d.razem));
  const szerokoscPola = (S - margines.l - margines.p) / dane.length;
  const szerokoscSlupka = Math.max(3, Math.min(26, szerokoscPola - 4));
  const skala = w => (W - margines.g - margines.d) * (w / maks);

  const elementy = [];
  for (let i = 0; i <= 2; i++) {
    const y = margines.g + (W - margines.g - margines.d) * (i / 2);
    elementy.push(svg('line', { klasa: 'siatka-linia', x1: margines.l, x2: S - margines.p, y1: y, y2: y }));
    elementy.push(svg('text', { klasa: 'podpis', x: margines.l - 6, y: y + 3, 'text-anchor': 'end',
      tekst: String(Math.round(maks * (1 - i / 2))) }));
  }

  dane.forEach((d, i) => {
    const x = margines.l + i * szerokoscPola + (szerokoscPola - szerokoscSlupka) / 2;
    const dobre = Number(d.dobre) || 0;
    const zle = (Number(d.razem) || 0) - dobre;
    const wysDobre = skala(dobre), wysZle = skala(zle);
    const podstawa = W - margines.d;
    if (wysZle > 0) {
      elementy.push(svg('rect', { klasa: 'slupek zle', x, y: podstawa - wysZle - wysDobre, width: szerokoscSlupka, height: wysZle, rx: 2 }));
    }
    if (wysDobre > 0) {
      elementy.push(svg('rect', { klasa: 'slupek', x, y: podstawa - wysDobre, width: szerokoscSlupka, height: wysDobre, rx: 2 }));
    }
    if (dane.length <= 12 || i % Math.ceil(dane.length / 8) === 0) {
      const [, m, dd] = d.dzien.split('-');
      elementy.push(svg('text', { klasa: 'podpis', x: x + szerokoscSlupka / 2, y: W - 7, 'text-anchor': 'middle', tekst: `${dd}.${m}` }));
    }
  });

  return svg('svg', { klasa: 'wykres', viewBox: `0 0 ${S} ${W}`, width: S, height: W }, elementy);
}

function wykresEgzaminow(egzaminy, S = 620) {
  const dane = egzaminy.slice(-25);
  const W = 190, margines = { g: 12, d: 22, l: 30, p: 10 };
  const maks = stan.katalog.maxPunkty;
  const doY = pkt => margines.g + (W - margines.g - margines.d) * (1 - pkt / maks);
  const doX = i => dane.length === 1
    ? (margines.l + S - margines.p) / 2
    : margines.l + (S - margines.l - margines.p) * (i / (dane.length - 1));

  const elementy = [];
  for (const pkt of [0, Math.round(maks / 2), maks]) {
    elementy.push(svg('line', { klasa: 'siatka-linia', x1: margines.l, x2: S - margines.p, y1: doY(pkt), y2: doY(pkt) }));
    elementy.push(svg('text', { klasa: 'podpis', x: margines.l - 6, y: doY(pkt) + 3, 'text-anchor': 'end', tekst: String(pkt) }));
  }
  const yProg = doY(stan.katalog.progZdania);
  elementy.push(svg('line', { klasa: 'prog', x1: margines.l, x2: S - margines.p, y1: yProg, y2: yProg }));

  if (dane.length > 1) {
    const sciezka = dane.map((e, i) => `${i ? 'L' : 'M'}${doX(i).toFixed(1)},${doY(e.punkty).toFixed(1)}`).join(' ');
    elementy.push(svg('path', { klasa: 'linia', d: sciezka }));
  }
  dane.forEach((e, i) => {
    elementy.push(svg('circle', { klasa: 'punkt' + (e.zdany ? '' : ' oblany'), cx: doX(i), cy: doY(e.punkty), r: 4 }));
  });

  return svg('svg', { klasa: 'wykres', viewBox: `0 0 ${S} ${W}`, width: S, height: W }, elementy);
}

// ---------------------------------------------------------------- ustawienia

function widokUstawienia() {
  const wybieraczMotywu = el('div', { klasa: 'grupa-przyciskow' },
    [['auto', 'Auto'], ['jasny', 'Jasny'], ['ciemny', 'Ciemny']].map(([w, t]) =>
      el('button', {
        klasa: stan.ustawienia.motyw === w ? 'wybrany' : '',
        tekst: t,
        onclick: async () => { await zapiszUstawienia({ motyw: w }); widokUstawienia(); },
      })));

  const wyborKat = el('select', {}, stan.katalog.kategorie.map(k =>
    el('option', { value: k, tekst: k, selected: k === stan.ustawienia.kategoria })));
  wyborKat.value = stan.ustawienia.kategoria;
  wyborKat.onchange = async () => {
    await zapiszUstawienia({ kategoria: wyborKat.value });
    zbudujWyborKategorii();
    widokUstawienia();
  };

  const p = podsumowanieKategorii();

  ustawTresc(
    naglowek('Ustawienia', `Zalogowany jako ${stan.uzytkownik.login}.`),
    el('div', { klasa: 'karta' },
      el('div', { klasa: 'rzad-ustawien' },
        el('div', {},
          el('div', { tekst: 'Kategoria prawa jazdy' }),
          el('div', { klasa: 'opis', tekst: 'Decyduje o tym, które pytania widzisz w nauce, egzaminie i bazie.' })),
        el('div', { klasa: 'sterowanie', style: 'min-width:110px' }, wyborKat)),
      el('div', { klasa: 'rzad-ustawien' },
        el('div', {},
          el('div', { tekst: 'Motyw' }),
          el('div', { klasa: 'opis', tekst: 'Auto dopasowuje się do ustawień systemu.' })),
        el('div', { klasa: 'sterowanie' }, wybieraczMotywu)),
      el('div', { klasa: 'rzad-ustawien' },
        el('div', {},
          el('div', { tekst: 'Limity czasu na egzaminie' }),
          el('div', { klasa: 'opis', tekst: '20 s + 15 s na pytanie podstawowe, 50 s na specjalistyczne, 25 minut łącznie.' })),
        el('div', { klasa: 'sterowanie' }, przelacznik(stan.ustawienia.timery, v => zapiszUstawienia({ timery: v }))))),

    el('h2', { style: 'margin:26px 0 12px', tekst: 'Zakładki' }),
    el('div', { klasa: 'karta' },
      el('p', { style: 'color:var(--tekst-2);font-size:.9rem',
        tekst: `Masz ${stan.zakladki.size} ${odmiana(stan.zakladki.size, 'zakładkę', 'zakładki', 'zakładek')}.` }),
      stan.zakladki.size > 0 && el('button', {
        klasa: 'przycisk glowny', style: 'margin-top:12px', tekst: 'Ucz się z zakładek',
        onclick: () => { location.hash = '#/zakladki/start'; } })),

    el('h2', { style: 'margin:26px 0 12px', tekst: 'Wyjaśnienia do pytań' }),
    el('div', { klasa: 'karta' }, (() => {
      const wszystkie = pytaniaKategorii();
      const zWyjasnieniem = wszystkie.filter(p => stan.wyjasnienia[p.id]).length;
      const procent = wszystkie.length ? Math.round(zWyjasnieniem / wszystkie.length * 100) : 0;
      return [
        el('p', { style: 'color:var(--tekst-2);font-size:.9rem',
          tekst: zWyjasnieniem
            ? `${zWyjasnieniem} z ${wszystkie.length} pytań kategorii ${stan.ustawienia.kategoria} ma wyjaśnienie `
              + `(${procent}%). Pokazuje się pod pytaniem po udzieleniu odpowiedzi oraz w bazie pytań.`
            : 'Żadne pytanie nie ma jeszcze wyjaśnienia. Wyjaśnienia generuje się raz — potem są zapisane '
              + 'na stałe i za każdym razem widzisz dokładnie to samo.' }),
        !zWyjasnieniem && el('div', { klasa: 'pasek gruby', style: 'margin-top:12px' },
          el('i', { style: 'width:0%' })),
        zWyjasnieniem > 0 && el('div', { klasa: 'pasek gruby zielony', style: 'margin-top:12px' },
          el('i', { style: `width:${procent}%` })),
        el('p', { style: 'color:var(--tekst-3);font-size:.84rem;margin-top:12px',
          tekst: 'Generowanie wymaga własnego klucza API Anthropic i jest jednorazowo płatne '
               + '(orientacyjnie 11 USD za kategorię B, 18 USD za całą bazę). Instrukcja w pliku README.' }),
      ];
    })()),

    el('h2', { style: 'margin:26px 0 12px', tekst: 'Dane' }),
    el('div', { klasa: 'karta' },
      el('div', { klasa: 'rzad-ustawien' },
        el('div', {},
          el('div', { tekst: 'Wyczyść cały postęp' }),
          el('div', { klasa: 'opis',
            tekst: `Usuwa historię odpowiedzi (${p.zrobione} przerobionych pytań), wyniki egzaminów i harmonogram powtórek. Zakładki i notatki zostają.` })),
        el('div', { klasa: 'sterowanie' },
          el('button', {
            klasa: 'przycisk niebezpieczny', tekst: 'Wyczyść',
            onclick: async () => {
              if (!confirm('Na pewno wyczyścić cały postęp? Tej operacji nie da się cofnąć.')) return;
              await api('/api/wyzeruj', 'POST');
              stan.postep = {};
              odswiezLicznikPowtorek();
              powiadom('Postęp wyczyszczony');
              widokUstawienia();
            },
          })))),

    el('p', { style: 'color:var(--tekst-3);font-size:.82rem;margin-top:26px;text-align:center',
      tekst: `Katalog pytań ${stan.katalog.wersja} · ${stan.katalog.pytania.length} pytań w bazie` }));
}

// ---------------------------------------------------------------- klawiatura

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const cel = e.target;
  if (cel && (cel.tagName === 'INPUT' || cel.tagName === 'TEXTAREA' || cel.tagName === 'SELECT')) return;

  const klawisz = e.key.toLowerCase();

  if (stan.sesja) {
    const p = stan.sesja.pytania[stan.sesja.indeks];
    const odslonieta = stan.sesja.odpowiedzi[p.id] !== undefined;
    if (!odslonieta) {
      if (p.typ === 'tn' && (klawisz === 't' || klawisz === '1')) { e.preventDefault(); return odpowiedzWSesji(p, 'T'); }
      if (p.typ === 'tn' && (klawisz === 'n' || klawisz === '2')) { e.preventDefault(); return odpowiedzWSesji(p, 'N'); }
      if (p.typ === 'abc') {
        const mapa = { a: 'A', b: 'B', c: 'C', 1: 'A', 2: 'B', 3: 'C' };
        if (mapa[klawisz]) { e.preventDefault(); return odpowiedzWSesji(p, mapa[klawisz]); }
      }
    }
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); return dalejWSesji(); }
    if (e.key === 'ArrowLeft' && stan.sesja.indeks > 0) {
      e.preventDefault(); stan.sesja.indeks--; return rysujSesje();
    }
    return;
  }

  if (stan.egzamin && !stan.egzamin.zakonczony) {
    const ee = stan.egzamin;
    const poz = ee.pozycje[ee.indeks];
    const p = stan.wgId.get(poz.id);
    if (!p) return;
    if (p.typ === 'tn' && (klawisz === 't' || klawisz === '1')) { e.preventDefault(); return ustawOdpowiedzEgzaminu('T'); }
    if (p.typ === 'tn' && (klawisz === 'n' || klawisz === '2')) { e.preventDefault(); return ustawOdpowiedzEgzaminu('N'); }
    if (p.typ === 'abc') {
      const mapa = { a: 'A', b: 'B', c: 'C', 1: 'A', 2: 'B', 3: 'C' };
      if (mapa[klawisz]) { e.preventDefault(); return ustawOdpowiedzEgzaminu(mapa[klawisz]); }
    }
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); return nastepnePytanieEgzaminu(); }
  }
});

start();
