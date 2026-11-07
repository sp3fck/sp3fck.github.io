# Klucz CW przez Arduino (USB) · CW paddle via Arduino (USB)

[Polski](#polski) · [English](#english)

---

## Polski

Interfejs łączy klucz łopatkowy (paddle) z trenerem CW na stronie
<https://sp3fck.github.io/cw-trainer.html> (gra **Morze Morse'a**).
Arduino przekazuje przez USB tylko stan styków – kropki i kreski robi keyer w przeglądarce.

### Czego potrzebujesz

- Arduino **Uno** albo **Nano** (także klon),
- gniazdo jack 3,5 mm **stereo** (na wtyk klucza),
- 3 przewody i kabel USB,
- komputer z przeglądarką **Chrome** albo **Edge** (Web Serial; Firefox, Safari i telefony go nie obsługują).

### Połączenia

| Jack klucza | Funkcja | Arduino |
|---|---|---|
| Tip (czubek) | kropka (dit) | D2 |
| Ring (pierścień) | kreska (dah) | D3 |
| Sleeve (tuleja) | masa | GND |

Wejścia mają włączone podciąganie (`INPUT_PULLUP`), więc rezystory nie są potrzebne –
naciśnięcie łopatki zwiera wejście do masy.

### Wgrywanie szkicu

1. Zainstaluj Arduino IDE (<https://www.arduino.cc/en/software>).
2. Otwórz plik `paddle_uno.ino` (IDE zaproponuje utworzenie folderu o tej samej nazwie – zgódź się).
3. *Narzędzia → Płytka*: **Arduino Uno** albo **Arduino Nano**
   (starsze Nano: *Narzędzia → Procesor → ATmega328P (Old Bootloader)*).
4. *Narzędzia → Port*: port COM, pod którym jest Arduino.
5. Kliknij **Wgraj**.

### Test diodą

Wbudowana dioda **L** (pin 13) świeci, gdy któraś łopatka jest naciśnięta – tak sprawdzisz połączenia bez strony.

### Połączenie ze stroną

1. Zamknij *Serial Monitor* w Arduino IDE (blokuje port).
2. Otwórz trener CW. W panelu **Klucz** z prawej strony: *Połączenie klucza* → **Arduino (USB)** → **Połącz** → wybierz port COM Arduino.
3. Uno restartuje się po otwarciu portu – po ok. 2 s pojawi się „Gotowe – naciskaj łopatki”.
4. Nadawaj w zakładce **Morze Morse'a**.

Nadajesz lewą ręką? Zaznacz „Zamień kropkę i kreskę”.

### Protokół

115200 bd. Przy każdej zmianie stanu Arduino wysyła 1 znak ASCII:
`0` – nic, `1` – kropka, `2` – kreska, `3` – obie łopatki.
Wysłanie `?` do Arduino – odsyła bieżący stan.

### Typowe problemy

- **Cały czas kreska** – wtyk mono w gnieździe stereo: pierścień jest zwarty z masą. Użyj wtyku i kabla stereo.
- **Nie można otworzyć portu** – port jest zajęty, najczęściej przez *Serial Monitor* w Arduino IDE. Zamknij go albo całe IDE.
- **Arduino nie ma portu COM** – klony z układem CH340 potrzebują sterownika CH340/CH341.
- **Kropki i kreski zamienione** – zamień przewody D2 i D3 albo zaznacz na stronie „Zamień kropkę i kreskę”.
- **Przycisk „Połącz” nieaktywny** – przeglądarka nie obsługuje Web Serial; użyj Chrome albo Edge na komputerze.

---

## English

This interface connects an iambic paddle to the CW trainer at
<https://sp3fck.github.io/cw-trainer.html> (the **Morse Sea** game).
The Arduino only reports the paddle contacts over USB – the keyer that makes dits and dahs runs in the browser.

### What you need

- Arduino **Uno** or **Nano** (clones work too),
- a 3.5 mm **stereo** jack socket for the paddle plug,
- 3 wires and a USB cable,
- a computer with **Chrome** or **Edge** (Web Serial; Firefox, Safari and phones don't support it).

### Wiring

| Paddle jack | Function | Arduino |
|---|---|---|
| Tip | dit | D2 |
| Ring | dah | D3 |
| Sleeve | ground | GND |

The inputs use the internal pull-ups (`INPUT_PULLUP`), so no resistors are needed –
pressing a paddle shorts the input to ground.

### Uploading the sketch

1. Install the Arduino IDE (<https://www.arduino.cc/en/software>).
2. Open `paddle_uno.ino` (the IDE offers to create a folder with the same name – accept).
3. *Tools → Board*: **Arduino Uno** or **Arduino Nano**
   (older Nanos: *Tools → Processor → ATmega328P (Old Bootloader)*).
4. *Tools → Port*: the Arduino's COM port.
5. Click **Upload**.

### LED test

The built-in **L** LED (pin 13) lights while a paddle is pressed – a quick wiring check without the web page.

### Connecting to the page

1. Close the Arduino IDE *Serial Monitor* (it locks the port).
2. Open the CW trainer. In the **Key** panel on the right: *Key connection* → **Arduino (USB)** → **Connect** → pick the Arduino's COM port.
3. The Uno restarts when the port opens – after about 2 s you'll see “Ready – press the paddle”.
4. Send in the **Morse Sea** tab.

Left-handed? Tick “Swap dit and dah”.

### Protocol

115200 baud. On every change the Arduino sends one ASCII character:
`0` – none, `1` – dit, `2` – dah, `3` – both paddles.
Send `?` to the Arduino and it replies with the current state.

### Troubleshooting

- **Constant dah** – a mono plug in a stereo socket shorts the ring to ground. Use a stereo plug and cable.
- **Can't open the port** – it's busy, usually because the Arduino IDE *Serial Monitor* is open. Close it (or the whole IDE).
- **No COM port for the Arduino** – clones with the CH340 chip need the CH340/CH341 driver.
- **Dit and dah swapped** – swap the D2 and D3 wires or tick “Swap dit and dah” on the page.
- **The Connect button is disabled** – the browser has no Web Serial; use Chrome or Edge on a computer.

73 de SP3FCK
