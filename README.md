# SP3FCK — strona stacji krótkofalarskiej

Statyczna strona (HTML + CSS + vanilla JS) pod GitHub Pages. Dwujęzyczna: domyślnie EN, przełącznik PL w pasku u góry.

## Struktura

- `index.html` – strona główna (o mnie z animowanym globem QSO, pasek danych stacji, mapa łączności bez filtrów, najnowsze filmy, pasek galerii)- `ham-tools.html` – przegląd narzędzi; w menu „Ham Tools” jest podmenu:
  - `ham-map.html` – pełna mapa łączności z filtrami i statystykami DXCC/WAZ/ITU
  - `propagation.html` – propagacja (N0NBH/HamQSL) i pogoda (Windy + wyszukiwarka Open-Meteo)
  - `q-codes.html` – ściąga: kody Q, skróty CW, znaki proceduralne i liczby skrócone z wyszukiwarką (dane w `data/cw-codes.js`, logika w `assets/js/cw-codes.js`)
  - `qrz-builder/` – kreator strony bio na QRZ.com
  - `cw-trainer.html` – gra do nauki CW: Koch, znaki wywoławcze, skróty i kody Q oraz gry Szybki palec, Morze Morse'a (klucz podwójny: Z/← kropka, X/→ kreska albo przyciski na ekranie, z zamianą stron dla leworęcznych; keyer jambiczny w JS) i Symulator pasma (strojenie gałką VFO po paśmie 80 m z panoramą, wodospadem i S-metrem; stacje mają prawdziwe znaki z logu – lista w `data/cw-calls.js` – coraz dłuższych w kolejnych etapach, od etapu 4 z raportem RST na kafelku i „bliźniakiem” – tym samym znakiem z innym raportem; poziom łatwy / średni / trudny; każda znaleziona stacja +30 s, pomyłka −10 s; gra na czas albo trening bez czasu, który nie liczy się do rekordów; opcja „na ślepo” – bez kafelków, znaki wszystkich stacji na paśmie wpisuje się w pole i zatwierdza OK) (`assets/js/cw-trainer.js`, Web Audio; ustawienia i rekordy w `localStorage` `sp3fck-cw`; wersja w stałej `VERSION` na początku skryptu, widoczna pod alfabetem – podbijaj przy każdej zmianie gry)
    - prawdziwy klucz (panel „Klucz” na górze ustawień: połączenie i zamiana łopatek; nadaje się w Morzu Morse'a): klawiatura (także lewy/prawy Ctrl), Arduino przez Web Serial (Chrome/Edge), ESP32 jako klawiatura Bluetooth
- `klucz/` – interfejsy klucza CW do pobrania ze strony trenera: `arduino/` (szkic `paddle_uno.ino` + README PL/EN), `esp32/` (README z planem CYD, szkic w przygotowaniu)
- `gallery.html`, `youtube.html`, `other.html`, `contact.html`, `privacy.html`, `404.html`
- `ham-map-embed.html` – sama mapa (ramka na stronie głównej; zoom tylko Ctrl + kółko / dwa palce)
- `ham-map-qrz.html` – statyczna mapa bez JS do osadzenia na QRZ.com (generowana)
- `qrz/` – materiały robocze do strony QRZ (`qrz_bio.html` itd.)
- `assets/js/components.js` – wspólny pasek stacji, header i footer (`<body data-page="...">` = aktywne menu)
- `assets/css/style.css` – motyw „Night Shack”; `assets/css/ham-map.css` – mapa
- `assets/js/qso-globe.js` – glob w hero strony głównej; lista łączności wpisana na stałe w `CONFIG` (wybrana raz z logu, nie synchronizuje się), kontury lądów w `data/qso-globe-world.js`

## Dwujęzyczność

Treść jest w HTML w obu językach, widoczny jest tylko język z `<html lang>`:

```html
<h2><span lang="en">Gallery</span><span lang="pl">Galeria</span></h2>
<p lang="en">…</p><p lang="pl">…</p>
```

Tytuł karty po polsku: `<meta name="title-pl" content="…">`. Atrybuty: `data-pl-placeholder`, `data-pl-alt` itd.
Wybór języka zapisuje się w `localStorage` (`sp3fck-lang`). Kontrolki samej mapy są po angielsku.

## Galeria i filmy

- `data/gallery.js` – lista zdjęć (`assets/img/gallery/`), kategorie `awards` / `station`, teksty `[EN, PL]`
- `data/youtube.js` – lista filmów, miniatury w `assets/img/youtube/{id}.jpg`

Zdjęcia i miniatury są skopiowane lokalnie (nie ciągniemy z QRZ/YouTube).

## Mapa łączności i synchronizacja z QRZ.com

Workflow `.github/workflows/qrz-sync.yml` (codziennie 00:07 UTC + ręcznie „Run workflow”):
pobiera log z QRZ Logbook API, zapisuje `data/qso.latest.json`, `data/qso.latest.js` i przebudowuje `ham-map-qrz.html`.

- Mapa pokazuje **tylko KF (160–10 m)** – łączności UKF (6 m, 2 m, 70 cm…) są odrzucane już w `scripts/qrz-sync.mjs`.
- Sekret repo: `QRZ_API_KEY` (wymagany), opcjonalnie `QRZ_FETCH_OPTIONS`.
- Przebudowa strony QRZ lokalnie bez API: `npm install --no-save d3-geo@3 topojson-client@3`, potem `node scripts/qrz-static-page.mjs`.
- Dane referencyjne (DXCC, strefy CQ/ITU) generuje jednorazowo `scripts/build-ham-reference.mjs`.

## Lokalny podgląd

```powershell
python -m http.server 8090
```

i `http://localhost:8090/`.
