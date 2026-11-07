# Klucz CW przez ESP32 (Bluetooth) · CW paddle via ESP32 (Bluetooth)

[Polski](#polski) · [English](#english)

---

## Polski

**W przygotowaniu** – szkic pojawi się w tym katalogu, gdy będzie gotowy.

### Plan

Płytka **CYD** (*Cheap Yellow Display*, ESP32-2432S028R) działa jako klawiatura Bluetooth (BLE HID)
o nazwie **„CW Paddle”**. Po sparowaniu w ustawieniach Bluetooth systemu łopatki wysyłają:

- lewy **Ctrl** – kropka (dit),
- prawy **Ctrl** – kreska (dah).

Trener CW (<https://sp3fck.github.io/cw-trainer.html>, gra **Morze Morse'a**) obsługuje je w panelu
*Klucz → Połączenie klucza: ESP32 (Bluetooth)*. Klawiatura Bluetooth działa w każdej przeglądarce, także na telefonie i tablecie.

### Połączenia – złącze CN1 (JST 1,25 mm, 4 piny)

| CN1 | Jack klucza |
|---|---|
| GND | sleeve (masa) |
| IO22 | tip – kropka (dit) |
| IO27 | ring – kreska (dah) |
| 3.3V | nieużywane |

### Oprogramowanie

- Arduino IDE z pakietem płytek **esp32** (Espressif),
- biblioteka **ESP32-BLE-Keyboard**,
- nazwa urządzenia Bluetooth: **CW Paddle**.

### Dalej

Tryb **Web Bluetooth**: własna usługa GATT z bajtem stanu jak w protokole Arduino
(`0` nic, `1` kropka, `2` kreska, `3` obie) – połączenie prosto ze strony, bez parowania jako klawiatura.

---

## English

**In preparation** – the sketch will appear in this folder when it's ready.

### Plan

The **CYD** board (*Cheap Yellow Display*, ESP32-2432S028R) acts as a Bluetooth keyboard (BLE HID)
named **“CW Paddle”**. Once paired in the system Bluetooth settings, the paddle sends:

- left **Ctrl** – dit,
- right **Ctrl** – dah.

The CW trainer (<https://sp3fck.github.io/cw-trainer.html>, the **Morse Sea** game) reads them in the
*Key* panel → *Key connection: ESP32 (Bluetooth)*. A Bluetooth keyboard works in every browser, phones and tablets included.

### Wiring – CN1 connector (JST 1.25 mm, 4 pins)

| CN1 | Paddle jack |
|---|---|
| GND | sleeve (ground) |
| IO22 | tip – dit |
| IO27 | ring – dah |
| 3.3V | not used |

### Software

- Arduino IDE with the **esp32** board package (Espressif),
- the **ESP32-BLE-Keyboard** library,
- Bluetooth device name: **CW Paddle**.

### Next

A **Web Bluetooth** mode: a custom GATT service with a state byte as in the Arduino protocol
(`0` none, `1` dit, `2` dah, `3` both) – connecting straight from the page, without pairing as a keyboard.

73 de SP3FCK
