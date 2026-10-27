# SP3FCK — strona stacji krótkofalarskiej

Statyczna strona (HTML + CSS + vanilla JS) pod GitHub Pages. Dwujęzyczna: domyślnie EN, przełącznik PL w pasku u góry.

## Struktura

- `index.html` – strona główna (o mnie, stacja, mapa łączności bez filtrów, najnowsze filmy, pasek galerii)
- `ham-tools.html` – przegląd narzędzi; w menu „Ham Tools” jest podmenu:
  - `ham-map.html` – pełna mapa łączności z filtrami i statystykami DXCC/WAZ/ITU
  - `propagation.html` – propagacja (N0NBH/HamQSL) i pogoda (Windy + wyszukiwarka Open-Meteo)
  - `qrz-builder/` – kreator strony bio na QRZ.com
- `gallery.html`, `youtube.html`, `other.html`, `contact.html`, `privacy.html`, `404.html`
- `ham-map-embed.html` – sama mapa (ramka na stronie głównej; zoom tylko Ctrl + kółko / dwa palce)
- `ham-map-qrz.html` – statyczna mapa bez JS do osadzenia na QRZ.com (generowana)
- `qrz/` – materiały robocze do strony QRZ (`qrz_bio.html` itd.)
- `assets/js/components.js` – wspólny pasek stacji, header i footer (`<body data-page="...">` = aktywne menu)
- `assets/css/style.css` – motyw „Night Shack”; `assets/css/ham-map.css` – mapa

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
