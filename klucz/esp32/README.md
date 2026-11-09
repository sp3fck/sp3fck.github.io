# Klucz CW przez ESP32 (Bluetooth) · CW paddle via ESP32 (Bluetooth)

[Polski](#polski) · [English](#english)

---

## Polski

Płytka **ESP32-C3 SuperMini** działa jako klawiatura Bluetooth (BLE HID) o nazwie **„CW Paddle”**
i łączy klucz łopatkowy (paddle) z trenerem CW na stronie <https://sp3fck.github.io/cw-trainer.html>
(gra **Morze Morse'a**). Łopatki wysyłają:

- strzałkę w lewo **←** – kropka (dit),
- strzałkę w prawo **→** – kreska (dah).

Strzałki niczego nie wpisują i nie są skrótami systemu, a przy obu łopatkach naraz (squeeze) dochodzą obie.

Płytka przekazuje tylko stan styków – kropki i kreski robi keyer w przeglądarce. Klawiatura Bluetooth
działa w każdej przeglądarce, także na telefonie i tablecie, bez kabla i bez Web Serial.

### Czego potrzebujesz

- płytka **ESP32-C3 SuperMini** (inne ESP32 z Bluetooth LE też – zmień piny w szkicu),
- gniazdo jack 3,5 mm **stereo** (na wtyk klucza),
- 3 przewody i kabel USB-C (do wgrania szkicu i zasilania; potem może być zasilacz albo powerbank).

### Połączenia

| Jack klucza | Funkcja | ESP32-C3 SuperMini |
|---|---|---|
| Tip (czubek) | kropka (dit) | GPIO5 |
| Ring (pierścień) | kreska (dah) | GPIO21 |
| Sleeve (tuleja) | masa | GND |

Wejścia mają włączone podciąganie (`INPUT_PULLUP`), więc rezystory nie są potrzebne –
naciśnięcie łopatki zwiera wejście do masy. GPIO21 to pin TX, ale szkic wysyła komunikaty przez USB,
więc pin jest wolny (nie trzymaj tylko kreski przy podłączaniu zasilania – wtedy płytka wypisuje na nim komunikaty startowe).

Inna płytka? Zmień `PIN_DIT`, `PIN_DAH` i `PIN_LED` na początku szkicu
(np. CYD ESP32-2432S028R: kropka IO22, kreska IO27 na złączu CN1).

### Wgrywanie szkicu

1. Zainstaluj Arduino IDE (<https://www.arduino.cc/en/software>).
2. *Plik → Preferencje → Dodatkowe adresy URL menedżera płytek*:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
3. *Narzędzia → Płytka → Menedżer płytek*: zainstaluj **esp32** (Espressif Systems), wersja 3.x.
4. Otwórz `paddle_ble.ino` (IDE zaproponuje utworzenie folderu o tej samej nazwie – zgódź się).
5. *Narzędzia → Płytka → esp32*: **Nologo ESP32C3 Super Mini**.
6. *Narzędzia → Port*: port COM płytki.
7. Kliknij **Wgraj**. Dodatkowe biblioteki nie są potrzebne – szkic używa wbudowanej biblioteki BLE.

### Parowanie

1. Po wgraniu dioda na płytce **miga** – płytka czeka na połączenie.
2. W ustawieniach Bluetooth komputera albo telefonu: *Dodaj urządzenie* → **CW Paddle** (bez kodu PIN).
3. Po połączeniu dioda **gaśnie**, a **świeci** przy naciśniętej łopatce.
4. Sparowany klucz łączy się potem sam po włączeniu zasilania.

### Połączenie ze stroną

Otwórz trener CW. W panelu **Klucz**: *Połączenie klucza* → **ESP32 (Bluetooth)** (to tylko podpowiedź –
strzałki działają w Morzu Morse'a zawsze). Nadawaj w zakładce **Morze Morse'a**,
a w **Symulatorze pasma** łopatki stroją VFO.

Nadajesz lewą ręką? Zaznacz na stronie „Zamień kropkę i kreskę”.

### Typowe problemy

- **Cały czas kreska** – wtyk mono w gnieździe stereo: pierścień jest zwarty z masą. Użyj wtyku i kabla stereo.
- **Nie widać „CW Paddle”** – dioda nie miga? Płytka jest połączona z innym urządzeniem albo szkic się nie wgrał.
  Usuń „CW Paddle” z listy urządzeń Bluetooth na drugim urządzeniu.
- **Po ponownym wgraniu nie chce się połączyć** – usuń „CW Paddle” z listy urządzeń Bluetooth i sparuj od nowa.
- **Wgrywanie się nie udaje albo nie ma portu** – przytrzymaj przycisk **BOOT**, podłącz USB (albo naciśnij RESET), puść BOOT i wgraj jeszcze raz.
- **Kropki i kreski zamienione** – zamień przewody GPIO5 i GPIO21 albo zaznacz na stronie „Zamień kropkę i kreskę”.
- **W polu tekstowym klucz przesuwa kursor** – to celowe: w polach tekstowych strzałki zostają strzałkami.

### Dalej

Tryb **Web Bluetooth**: własna usługa GATT z bajtem stanu jak w protokole Arduino
(`0` nic, `1` kropka, `2` kreska, `3` obie) – połączenie prosto ze strony, bez parowania jako klawiatura.

---

## English

The **ESP32-C3 SuperMini** board acts as a Bluetooth keyboard (BLE HID) named **“CW Paddle”** and connects
an iambic paddle to the CW trainer at <https://sp3fck.github.io/cw-trainer.html> (the **Morse Sea** game).
The paddle sends:

- the left arrow **←** – dit,
- the right arrow **→** – dah.

Arrows type nothing and are not system shortcuts, and with both paddles pressed (squeeze) both get through.

The board only reports the paddle contacts – the keyer that makes dits and dahs runs in the browser.
A Bluetooth keyboard works in every browser, phones and tablets included, with no cable and no Web Serial.

### What you need

- an **ESP32-C3 SuperMini** board (other ESP32 boards with Bluetooth LE work too – change the pins in the sketch),
- a 3.5 mm **stereo** jack socket for the paddle plug,
- 3 wires and a USB-C cable (for uploading and power; later a charger or power bank will do).

### Wiring

| Paddle jack | Function | ESP32-C3 SuperMini |
|---|---|---|
| Tip | dit | GPIO5 |
| Ring | dah | GPIO21 |
| Sleeve | ground | GND |

The inputs use the internal pull-ups (`INPUT_PULLUP`), so no resistors are needed – pressing a paddle
shorts the input to ground. GPIO21 is the TX pin, but the sketch prints over USB, so the pin is free
(just don't hold the dah paddle while powering up – the board prints its boot messages there).

A different board? Change `PIN_DIT`, `PIN_DAH` and `PIN_LED` at the top of the sketch
(e.g. CYD ESP32-2432S028R: dit IO22, dah IO27 on the CN1 connector).

### Uploading the sketch

1. Install the Arduino IDE (<https://www.arduino.cc/en/software>).
2. *File → Preferences → Additional boards manager URLs*:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
3. *Tools → Board → Boards Manager*: install **esp32** (Espressif Systems), version 3.x.
4. Open `paddle_ble.ino` (the IDE offers to create a folder with the same name – accept).
5. *Tools → Board → esp32*: **Nologo ESP32C3 Super Mini**.
6. *Tools → Port*: the board's COM port.
7. Click **Upload**. No extra libraries are needed – the sketch uses the built-in BLE library.

### Pairing

1. After uploading, the on-board LED **blinks** – the board is waiting for a connection.
2. In the Bluetooth settings of your computer or phone: *Add device* → **CW Paddle** (no PIN).
3. Once connected the LED goes **off**, and it **lights** while a paddle is pressed.
4. A paired paddle reconnects by itself when powered on.

### Using it with the page

Open the CW trainer. In the **Key** panel: *Key connection* → **ESP32 (Bluetooth)** (just a hint –
the arrows always work in Morse Sea). Send in the **Morse Sea** tab;
in the **Band simulator** the paddle tunes the VFO.

Left-handed? Tick “Swap dit and dah” on the page.

### Troubleshooting

- **Constant dah** – a mono plug in a stereo socket shorts the ring to ground. Use a stereo plug and cable.
- **“CW Paddle” doesn't show up** – is the LED blinking? If not, the board is connected to another device or the upload failed.
  Remove “CW Paddle” from the Bluetooth device list on the other device.
- **Won't connect after re-uploading** – remove “CW Paddle” from the Bluetooth device list and pair again.
- **Upload fails or there is no port** – hold **BOOT**, plug in USB (or press RESET), release BOOT and upload again.
- **Dit and dah swapped** – swap the GPIO5 and GPIO21 wires or tick “Swap dit and dah” on the page.
- **In a text field the paddle moves the cursor** – on purpose: in text fields the arrows stay arrows.

### Next

A **Web Bluetooth** mode: a custom GATT service with a state byte as in the Arduino protocol
(`0` none, `1` dit, `2` dah, `3` both) – connecting straight from the page, without pairing as a keyboard.

73 de SP3FCK
