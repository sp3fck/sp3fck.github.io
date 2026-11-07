/*
  Klucz łopatkowy (paddle) -> USB Serial
  Arduino Uno / Nano / każdy AVR

  Podłączenie (jack 3,5 mm łopatek):
    Tip    (dit) -> D2
    Ring   (dah) -> D3
    Sleeve (GND) -> GND

  Protokół: przy każdej zmianie stanu wysyłany jest 1 znak ASCII:
    '0' = nic, '1' = dit, '2' = dah, '3' = dit + dah
  Wysłanie '?' do Arduino -> odsyła aktualny stan.
  Prędkość: 115200 bd.

  Keyer (generowanie kropek/kresek) jest po stronie strony WWW,
  Arduino tylko przekazuje stan styków.
*/

const uint8_t PIN_DIT = 2;
const uint8_t PIN_DAH = 3;
const uint8_t PIN_LED = 13;      // wbudowana dioda: świeci przy naciśnięciu
const uint8_t DEBOUNCE_MS = 4;   // eliminacja drgań styków

uint8_t stableState = 0;
uint8_t lastRaw = 0;
unsigned long rawChangedAt = 0;

uint8_t readRaw() {
  uint8_t s = 0;
  if (digitalRead(PIN_DIT) == LOW) s |= 1;
  if (digitalRead(PIN_DAH) == LOW) s |= 2;
  return s;
}

void sendState() {
  Serial.write('0' + stableState);
}

void setup() {
  pinMode(PIN_DIT, INPUT_PULLUP);
  pinMode(PIN_DAH, INPUT_PULLUP);
  pinMode(PIN_LED, OUTPUT);
  Serial.begin(115200);
  stableState = lastRaw = readRaw();
  sendState();
}

void loop() {
  uint8_t raw = readRaw();

  if (raw != lastRaw) {
    lastRaw = raw;
    rawChangedAt = millis();
  }

  if (raw != stableState && (millis() - rawChangedAt) >= DEBOUNCE_MS) {
    stableState = raw;
    sendState();
    digitalWrite(PIN_LED, stableState ? HIGH : LOW);
  }

  while (Serial.available()) {
    if (Serial.read() == '?') sendState();
  }
}
