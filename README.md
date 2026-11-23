# SP3FCK — strona stacji krótkofalarskiej

Statyczna strona (HTML + CSS + vanilla JS) pod GitHub Pages. Dwujęzyczna: domyślnie EN, przełącznik PL w pasku u góry.

## Struktura

- `index.html` – strona główna (o mnie z animowanym globem QSO, pasek danych stacji, najnowsze filmy, pasek galerii)
- `ham-tools.html` – przegląd narzędzi i sekcja **Projekty IoT** (`#iot`, w podmenu „Ham Tools”): przystawka BT CW – ESP32-C3 SuperMini jako klucz Bluetooth, zdjęcia w `assets/img/iot/`, schemat połączeń jako SVG w HTML; w menu „Ham Tools” jest podmenu:
  - `ham-map.html` – pełna mapa łączności z filtrami i statystykami DXCC/WAZ/ITU
  - `propagation.html` – propagacja (N0NBH/HamQSL) i pogoda (Windy + wyszukiwarka Open-Meteo)
  - `q-codes.html` – ściąga: kody Q, skróty CW, znaki proceduralne i liczby skrócone z wyszukiwarką (dane w `data/cw-codes.js`, logika w `assets/js/cw-codes.js`)
  - `qrz-builder/` – kreator strony bio na QRZ.com
  - `cw-trainer.html` – gra do nauki CW: Koch, znaki wywoławcze, skróty i kody Q oraz gry Szybki palec, Morze Morse'a (klucz podwójny: Z/← kropka, X/→ kreska albo przyciski na ekranie, z zamianą stron dla leworęcznych; keyer jambiczny w JS) i Symulator pasma (strojenie gałką VFO po paśmie 80 m z panoramą, wodospadem i S-metrem; stacje mają prawdziwe znaki z logu – lista w `data/cw-calls.js` – coraz dłuższych w kolejnych etapach, od etapu 4 z raportem RST na kafelku i „bliźniakiem” – tym samym znakiem z innym raportem; poziom łatwy / średni / trudny; każda znaleziona stacja +30 s, pomyłka −10 s; gra na czas albo trening bez czasu, który nie liczy się do rekordów; opcja „na ślepo” – bez kafelków, znaki wszystkich stacji na paśmie wpisuje się w pole i zatwierdza OK) (`assets/js/cw-trainer.js`, Web Audio; ustawienia i rekordy w `localStorage` `sp3fck-cw`; wersja w stałej `VERSION` na początku skryptu, widoczna pod alfabetem – podbijaj przy każdej zmianie gry)
    - prawdziwy klucz (panel „Klucz” na górze ustawień: połączenie i zamiana łopatek; nadaje się w Morzu Morse'a): klawiatura (także lewy/prawy Ctrl), Arduino przez Web Serial (Chrome/Edge), ESP32 jako klawiatura Bluetooth (strzałki)
- `klucz/` – interfejsy klucza CW do pobrania ze strony trenera: `arduino/` (szkic `paddle_uno.ino` + README PL/EN), `esp32/` (szkic `paddle_ble.ino` – ESP32-C3 SuperMini jako klawiatura Bluetooth „CW Paddle”, strzałki ←/→ – + README PL/EN)
- `gallery.html`, `youtube.html`, `other.html`, `contact.html`, `privacy.html`, `404.html`
- `ham-map-embed.html` – sama mapa do osadzenia w ramce (zoom tylko Ctrl + kółko / dwa palce); obecnie nieużywana na stronie
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
- Opcjonalne sekrety `LOTW_USERNAME` i `LOTW_PASSWORD`: sync dociąga potwierdzenia z LoTW i oznacza QSO polem `lotw` (kafelek „DXCC confirmed (LoTW)" i mocniej wypełnione komórki macierzy).
- Przebudowa strony QRZ lokalnie bez API: `npm install --no-save d3-geo@3 topojson-client@3`, potem `node scripts/qrz-static-page.mjs`.
- Dane referencyjne (DXCC, strefy CQ/ITU) generuje jednorazowo `scripts/build-ham-reference.mjs`.

## Meshtastic

`meshtastic.html` (w menu: **LoRa → Meshtastic**) pokazuje moje nody: companion `9254eab8` (SP3FCK_companion) i bazę `e0a76739` (SP3FCK_Base; wcześniej miała ID `0e0f16cf`, jego historia zostaje w `mesh.history.json`).
Przełącznik na górze strony wybiera node, a status, bramki, graf ścieżek w meshu, wykres SNR i ostatnie pakiety pokazują dane tylko dla niego
(wybór trafia do adresu jako `?node=<id>`). Na dole jest krótki opis sprzętu (zdjęcie w `assets/img/mesh/`).
Listę nodów ustawia `MESH_NODE_IDS` w workflow.

Graf ścieżek składa się z dwóch źródeł: pełnych ścieżek z pakietów traceroute (`routes`) i raportów odbioru – liczby skoków
oraz ostatniego bajtu ID przekaźnika (`relay`), rozpoznawanego, gdy pasuje do dokładnie jednego znanego noda.
Odcinki, których sieć nie zgłosiła, są rysowane przerywaną linią. Raporty sprzed zapisu przekaźników (bez pola `relay`) trafiają do grafu tylko wtedy, gdy były odebrane bezpośrednio.

Workflow `.github/workflows/mesh-sync.yml` (co 30 minut przez Cloudflare Worker, zapasowo harmonogram GitHuba, ręcznie „Run workflow”) uruchamia `scripts/mesh-sync.mjs`:
pobiera z API [lorastats.pl](https://lorastats.pl/API) status nodów i raporty odbioru (każdy raport ma pole `from` – ID mojego noda), dopisuje je do `data/mesh.history.json` (pełna historia – API oddaje tylko ostatnie 24 h)
i zapisuje `data/mesh.latest.js` (ostatnie 30 dni, czyta to strona). Commit powstaje tylko wtedy, gdy przybył raport albo zmienił się czas ostatniej aktywności.

- API nie wysyła nagłówków CORS, dlatego strona nie pyta go bezpośrednio z przeglądarki.
- Pozycji nodów ani treści wiadomości nie zapisujemy – na stronie jest tylko lokator. Ze ścieżek traceroute zapisujemy same ID nodów.
- Link lorastats.pl w postaci `/Node/<liczba>` to wewnętrzny numer serwisu; API przyjmuje go w `Nodes/JSON?node=` i zwraca właściwe ID noda (8 znaków hex), które wpisujemy do `MESH_NODE_IDS`.
- Nazwy bramek i przekaźników (`names`) są pobierane raz, przy pierwszym pojawieniu się noda.
- lorastats.pl prosi o nazwę narzędzia i kontakt w nagłówku `User-Agent` (`MESH_AGENT` w workflow) oraz zabrania scrapowania stron HTML – korzystamy wyłącznie z API.
- Lokalnie: `node scripts/mesh-sync.mjs` (bez zależności, Node 22+).

### Wyzwalanie co 30 minut (Cloudflare Worker)

Harmonogram (`schedule`) w GitHub Actions jest „best effort”: w listopadzie 2026 odpalał się 3–4 razy na dobę zamiast 48, z przerwami 4–10 h.
Dlatego `workers/mesh-sync-cron` (Cloudflare Worker z Cron Trigger `11,41 * * * *`, UTC) co 30 minut wywołuje workflow przez API
(`POST /repos/sp3fck/sp3fck.github.io/actions/workflows/mesh-sync.yml/dispatches`, `{"ref":"main"}`, odpowiedź 204).
Harmonogram w workflow zostaje jako zapas. Gdy oba trafią w ten sam czas, `concurrency` nie puści dwóch przebiegów naraz, a drugi nic nie zacommituje.
Worker nie ma adresu publicznego (`workers_dev = false`) i nie obsługuje zapytań HTTP – działa tylko z harmonogramu.

Wdrożenie (raz, z katalogu `workers/mesh-sync-cron`):

1. Token na GitHubie: Settings → Developer settings → Fine-grained tokens. Repository access: tylko `sp3fck/sp3fck.github.io`,
   Permissions: **Actions: Read and write**. Ustaw datę ważności i przypomnienie o odnowieniu.
2. `npx wrangler@4 login` (konto Cloudflare, plan darmowy wystarczy).
3. `npx wrangler@4 deploy`
4. `npx wrangler@4 secret put GITHUB_TOKEN` i wklej token (nie trafia do repo ani do `wrangler.toml`).
5. Po najbliższym :11 albo :41 w Actions powinien pojawić się przebieg z `workflow_dispatch`
   (`gh run list --workflow mesh-sync.yml --limit 3`). Błędy wywołań widać w Cloudflare: Workers → `sp3fck-mesh-sync-cron` → Logs.

Po wygaśnięciu tokenu wystarczy wygenerować nowy i powtórzyć krok 4.

## MeshCore

> **Ukryte.** Companion wrócił do Meshtastic (w MeshCore nie miał łączności), więc strona jest poza menu i ma `noindex`,
> a `MESHCORE_NODE_KEYS` w workflow jest puste (sync niczego nie pobiera). Żeby wrócić, np. z repeaterem:
> wpisz jego klucz w `MESHCORE_NODE_KEYS`, dopisz `['meshcore', 'meshcore.html', 'MeshCore']` do `LORA` w `assets/js/components.js`
> i usuń `<meta name="robots" content="noindex">` z `meshcore.html`. Kod i ostatnie dane (`data/meshcore.latest.js`) zostają.

`meshcore.html` (w menu: **LoRa → MeshCore**) pokazuje status moich nodów MeshCore: kiedy advert ostatnio trafił na mapę, typ noda i parametry radia,
z linkiem do noda na [mapie MeshCore Polska](https://mapa.meshcorepolska.org) (`?node=<klucz publiczny>`).

Ten sam workflow `mesh-sync.yml` uruchamia `scripts/meshcore-sync.mjs`: pobiera każdy node z `https://map.meshcore.io/api/v1/nodes/<klucz>`
i zapisuje `data/meshcore.latest.js` (tylko gdy coś się zmieniło). Listę nodów ustawia `MESHCORE_NODE_KEYS` – pełne klucze publiczne (64 znaki hex).
Błąd tego kroku nie blokuje zapisu danych Meshtastic.

- Mapa zna node tylko wtedy, gdy ktoś go tam wyśle: companion – ręcznie z aplikacji („wyślij na mapę”), repeatery – także automatycznie przez obserwatorów.
  Nie ma tu raportów odbioru jak w lorastats.pl.
- Czas aktywności to `updated_date` (zegar serwera mapy). `last_advert` bywa przesunięty o strefę czasową, więc go nie używamy.
- Pozycji noda ani linku `meshcore://` (zawiera advert z pozycją) nie zapisujemy.
- API mapy wysyła CORS tylko dla map.meshcore.dev, dlatego strona nie pyta go bezpośrednio z przeglądarki.
- Lokalnie: `node scripts/meshcore-sync.mjs` (bez zależności, Node 22+).

## Lokalny podgląd

```powershell
python -m http.server 8090
```

i `http://localhost:8090/`.
