'use strict';
/* Renderowanie arkuszy egzaminacyjnych do wydruku / zapisu w PDF. */

function el(tag, wlasciwosci = {}, ...dzieci) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(wlasciwosci)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'klasa') e.className = v;
    else if (k === 'tekst') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const d of dzieci.flat()) {
    if (d === null || d === undefined || d === false) continue;
    e.append(d.nodeType ? d : document.createTextNode(String(d)));
  }
  return e;
}

const parametry = new URLSearchParams(location.search);
const USTAWIENIA = {
  kategoria: (parametry.get('kategoria') || 'B').toUpperCase(),
  ile: Math.min(Math.max(1, Number(parametry.get('ile')) || 1), 50),
  obrazki: parametry.get('obrazki') !== '0',
  klucz: parametry.get('klucz') !== '0',
};

const dataPL = () => new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });

function blokPytania(p) {
  const klucze = p.typ === 'tn' ? ['T', 'N'] : ['A', 'B', 'C'];

  let obraz = null;
  if (USTAWIENIA.obrazki && p.obraz) {
    obraz = [
      el('img', { src: '/media/' + encodeURI(p.obraz).replace(/#/g, '%23'), alt: '' }),
      p.zFilmu && el('div', { klasa: 'podpis-klatki', tekst: 'kadr z filmu' }),
    ];
  } else if (p.obraz) {
    obraz = el('div', { klasa: 'brak-obrazu',
      tekst: p.zFilmu ? 'pytanie z filmem — obejrzyj w aplikacji' : 'pytanie ze zdjęciem — obejrzyj w aplikacji' });
  }

  return el('div', { klasa: 'pytanie' },
    el('div', { klasa: 'pytanie-gora' },
      el('span', { klasa: 'lp', tekst: p.lp + '.' }),
      el('span', { tekst: p.zakres === 'P' ? 'podstawowe' : 'specjalistyczne' }),
      el('span', { klasa: 'pkt', tekst: p.punkty + ' pkt' })),
    obraz,
    el('div', { klasa: 'pytanie-tresc', tekst: p.tresc }),
    el('div', { klasa: 'odpowiedzi' + (p.typ === 'tn' ? ' tak-nie' : '') },
      klucze.map(k => el('div', { klasa: 'odpowiedz' },
        el('span', { klasa: 'kratka' }),
        p.typ === 'tn'
          ? el('span', { tekst: k === 'T' ? 'TAK' : 'NIE' })
          : [el('span', { klasa: 'klucz-odp', tekst: k + '.' }), el('span', { tekst: p.odpowiedzi[k] })]))));
}

function stronaArkusza(arkusz, dane) {
  const podstawowe = arkusz.pytania.filter(p => p.zakres === 'P');
  const specjalistyczne = arkusz.pytania.filter(p => p.zakres === 'S');

  return el('section', { klasa: 'strona' },
    el('div', { klasa: 'naglowek-arkusza' },
      el('h1', { tekst: `Arkusz egzaminacyjny nr ${arkusz.numer}` }),
      el('div', { klasa: 'meta' },
        el('div', { tekst: `kategoria ${arkusz.kategoria}` }),
        el('div', { tekst: `${dane.maxPunkty} pkt · zdane od ${dane.progZdania} pkt` }),
        el('div', { tekst: '25 minut' }))),

    el('div', { klasa: 'linie-na-dane' },
      'Imię i nazwisko: ', el('span'), ' Data: ', el('span', { style: 'min-width:34mm' })),

    el('div', { klasa: 'naglowek-czesci',
      tekst: `Część podstawowa — ${podstawowe.length} pytań TAK/NIE (20 s na zapoznanie + 15 s na odpowiedź)` }),
    el('div', { klasa: 'pytania' }, podstawowe.map(blokPytania)),

    el('div', { klasa: 'naglowek-czesci',
      tekst: `Część specjalistyczna — ${specjalistyczne.length} pytań A/B/C (50 s na pytanie)` }),
    el('div', { klasa: 'pytania' }, specjalistyczne.map(blokPytania)),

    el('div', { klasa: 'stopka-arkusza' },
      el('span', { tekst: `Arkusz ${arkusz.numer} z ${dane.arkusze.length} · kategoria ${arkusz.kategoria}` }),
      el('span', { tekst: `wygenerowano ${dataPL()}` })));
}

function stronaKlucza(dane) {
  return el('section', { klasa: 'strona klucz' },
    el('h2', { tekst: 'Klucz odpowiedzi' }),
    el('p', { klasa: 'podtytul',
      tekst: `${dane.arkusze.length} ${dane.arkusze.length === 1 ? 'arkusz' : 'arkuszy'} · kategoria ${dane.kategoria} · wygenerowano ${dataPL()}` }),
    dane.arkusze.map(arkusz => el('div', { style: 'margin-bottom:7mm;break-inside:avoid' },
      el('div', { klasa: 'naglowek-czesci', tekst: `Arkusz ${arkusz.numer}` }),
      el('div', { klasa: 'tabela-klucza' },
        arkusz.pytania.map(p => el('div', { klasa: 'wiersz-klucza' },
          el('span', { klasa: 'lp', tekst: p.lp + '.' }),
          el('span', { klasa: 'odp',
            tekst: p.typ === 'tn' ? (p.poprawna === 'T' ? 'TAK' : 'NIE') : p.poprawna }),
          el('span', { klasa: 'pkt', tekst: p.punkty })))))),
    el('div', { klasa: 'stopka-arkusza' },
      el('span', { tekst: 'Klucz odpowiedzi' }),
      el('span', { tekst: 'wydrukuj osobno, żeby nie podglądać podczas rozwiązywania' })));
}

/** Druk startuje dopiero po wczytaniu obrazków — inaczej strony wychodzą puste. */
async function poczekajNaObrazki(korzen) {
  const obrazki = [...korzen.querySelectorAll('img')];
  await Promise.all(obrazki.map(img => img.complete
    ? Promise.resolve()
    : new Promise(res => { img.onload = res; img.onerror = res; })));
  return obrazki.length;
}

async function start() {
  const info = document.getElementById('pasek-info');
  const pojemnik = document.getElementById('arkusze');
  const przycisk = document.getElementById('przycisk-drukuj');

  let dane;
  try {
    const odp = await fetch('/api/arkusze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kategoria: USTAWIENIA.kategoria, ile: USTAWIENIA.ile }),
    });
    dane = await odp.json();
    if (!odp.ok) throw new Error(dane.blad || 'Błąd serwera');
  } catch (blad) {
    info.textContent = 'Nie udało się wygenerować arkuszy: ' + blad.message;
    return;
  }

  const strony = dane.arkusze.map(a => stronaArkusza(a, dane));
  if (USTAWIENIA.klucz) strony.push(stronaKlucza(dane));
  pojemnik.replaceChildren(...strony);

  info.textContent = 'Wczytywanie obrazków…';
  const ile = await poczekajNaObrazki(pojemnik);

  const liczbaPytan = dane.arkusze.length * 32;
  info.textContent = `${dane.arkusze.length} ${dane.arkusze.length === 1 ? 'arkusz' : 'arkuszy'}`
    + ` · ${liczbaPytan} pytań · kategoria ${dane.kategoria}`
    + (USTAWIENIA.obrazki ? ` · ${ile} obrazków` : ' · bez obrazków');
  przycisk.disabled = false;
  przycisk.onclick = () => window.print();
  document.title = `Arkusze egzaminacyjne (${dane.arkusze.length}) — kategoria ${dane.kategoria}`;
}

start();
