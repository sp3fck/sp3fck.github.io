/*
  Klucz łopatkowy (paddle) -> klawiatura Bluetooth (BLE HID) „CW Paddle”
  ESP32-C3 SuperMini (i inne ESP32 z Bluetooth LE – wtedy zmień piny niżej)

  Podłączenie (jack 3,5 mm łopatek):
    Tip    (kropka, dit)  -> GPIO5
    Ring   (kreska, dah)  -> GPIO21 (pin TX – wolny, bo komunikaty idą przez USB)
    Sleeve (masa)         -> GND

  Łopatki wysyłają strzałki: kropka = strzałka w lewo, kreska = strzałka w prawo. Strzałki niczego nie wpisują
  i nie są skrótami systemu (Ctrl na iPhonie przełącza język, a Windows łączy lewy i prawy Ctrl w jeden klawisz).
  Trener CW (https://sp3fck.github.io/cw-trainer.html) czyta je w panelu
  Klucz -> Połączenie klucza: ESP32 (Bluetooth). Keyer (kropki i kreski) jest w przeglądarce,
  płytka przekazuje tylko stan styków – jak szkic arduino/paddle_uno.ino.

  Parowanie: w ustawieniach Bluetooth komputera albo telefonu dodaj urządzenie „CW Paddle”
  (bez kodu PIN). Sparowany klucz łączy się potem sam po włączeniu.

  Dioda na płytce (GPIO8): miga – czeka na połączenie, zgaszona – połączono,
  świeci – naciśnięta łopatka.

  Arduino IDE: pakiet płytek esp32 (Espressif) 3.x, płytka „Nologo ESP32C3 Super Mini”.
  Bez dodatkowych bibliotek – wystarcza wbudowana biblioteka BLE.
*/

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEHIDDevice.h>
#include <BLESecurity.h>

const uint8_t PIN_DIT = 5;            // CYD (ESP32-2432S028R): 22
const uint8_t PIN_DAH = 21;           // CYD: 27
const uint8_t PIN_LED = 8;            // niebieska dioda SuperMini
const uint8_t LED_ON = LOW;           // na SuperMini dioda świeci przy stanie niskim
const uint8_t DEBOUNCE_MS = 4;        // eliminacja drgań styków
const char *NAME = "CW Paddle";

// kody klawiszy HID (Usage Page 0x07)
const uint8_t KEY_DIT = 0x50;  // strzałka w lewo
const uint8_t KEY_DAH = 0x4F;  // strzałka w prawo

// klawiatura HID: bajt modyfikatorów, bajt zarezerwowany, 6 klawiszy. Bez raportu wyjściowego (diody Num/Caps Lock):
// klucz go nie potrzebuje, a biblioteka na NimBLE gubi drugą charakterystykę raportu o tym samym UUID.
const uint8_t REPORT_MAP[] = {
  0x05, 0x01,  // Usage Page (Generic Desktop)
  0x09, 0x06,  // Usage (Keyboard)
  0xA1, 0x01,  // Collection (Application)
  0x85, 0x01,  //   Report ID (1)
  0x05, 0x07,  //   Usage Page (Keyboard/Keypad)
  0x19, 0xE0,  //   Usage Minimum (Left Control)
  0x29, 0xE7,  //   Usage Maximum (Right GUI)
  0x15, 0x00,  //   Logical Minimum (0)
  0x25, 0x01,  //   Logical Maximum (1)
  0x75, 0x01,  //   Report Size (1)
  0x95, 0x08,  //   Report Count (8)
  0x81, 0x02,  //   Input (Data, Variable, Absolute) – modyfikatory
  0x95, 0x01,  //   Report Count (1)
  0x75, 0x08,  //   Report Size (8)
  0x81, 0x01,  //   Input (Constant) – bajt zarezerwowany
  0x95, 0x06,  //   Report Count (6)
  0x75, 0x08,  //   Report Size (8)
  0x15, 0x00,  //   Logical Minimum (0)
  0x25, 0x65,  //   Logical Maximum (101)
  0x05, 0x07,  //   Usage Page (Keyboard/Keypad)
  0x19, 0x00,  //   Usage Minimum (0)
  0x29, 0x65,  //   Usage Maximum (101)
  0x81, 0x00,  //   Input (Data, Array) – klawisze
  0xC0         // End Collection
};

BLECharacteristic *input = nullptr;
volatile bool connected = false;
uint8_t stableState = 0;
uint8_t lastRaw = 0;
unsigned long rawChangedAt = 0;

class ServerCallbacks : public BLEServerCallbacks {
#if defined(CONFIG_NIMBLE_ENABLED)
  void onConnect(BLEServer *server, ble_gap_conn_desc *desc) override {
    connected = true;
    // krótki odstęp połączenia (7,5–15 ms) – stan łopatek szybciej dociera do komputera
    server->updateConnParams(desc->conn_handle, 6, 12, 0, 400);
    Serial.println("Połączono");
  }
  void onDisconnect(BLEServer *server, ble_gap_conn_desc *desc) override {
    connected = false;
    Serial.println("Rozłączono – czekam na połączenie");
  }
#else
  void onConnect(BLEServer *server, esp_ble_gatts_cb_param_t *param) override {
    connected = true;
    server->updateConnParams(param->connect.remote_bda, 6, 12, 0, 400);
    Serial.println("Połączono");
  }
  void onDisconnect(BLEServer *server, esp_ble_gatts_cb_param_t *param) override {
    connected = false;
    Serial.println("Rozłączono – czekam na połączenie");
  }
#endif
};

// Obejście dwóch błędów biblioteki BLE pakietu esp32 3.3.x na stosie NimBLE (m.in. ESP32-C3):
// - deskryptor bez ustawionych callbacków wysypuje płytkę, gdy komputer go odczyta (np. przy parowaniu),
//   nullptr = domyślne, puste callbacki;
// - deskryptory HID dostają tylko „odczyt szyfrowany” bez „odczytu”, a dla NimBLE to znaczy: nie do odczytu.
//   Windows nie odczyta wtedy odnośnika raportu i sterownik klawiatury nie wstaje (kod 10).
void fixDescriptor(BLECharacteristic *chr, uint16_t uuid, uint16_t perm) {
  if (!chr) return;
  BLEDescriptor *d = chr->getDescriptorByUUID(BLEUUID(uuid));
  if (!d) return;
  d->setCallbacks(nullptr);
  d->setAccessPermissions(perm);
}

uint8_t readRaw() {
  uint8_t s = 0;
  if (digitalRead(PIN_DIT) == LOW) s |= 1;
  if (digitalRead(PIN_DAH) == LOW) s |= 2;
  return s;
}

// stan łopatek -> raport klawiatury: wciśnięte strzałki (obie naraz przy squeeze), pusty raport = puszczone
void sendState() {
  if (!connected) return;
  uint8_t report[8] = {0};  // modyfikatory, zarezerwowany, 6 klawiszy
  uint8_t n = 2;
  if (stableState & 1) report[n++] = KEY_DIT;
  if (stableState & 2) report[n++] = KEY_DAH;
  input->setValue(report, sizeof(report));
  input->notify();
}

void updateLed() {
  bool on = connected ? stableState != 0 : (millis() % 1000) < 120;
  digitalWrite(PIN_LED, on ? LED_ON : !LED_ON);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_DIT, INPUT_PULLUP);
  pinMode(PIN_DAH, INPUT_PULLUP);
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, !LED_ON);

  BLEDevice::init(NAME);
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  server->advertiseOnDisconnect(true);

  // parowanie bez kodu PIN (Just Works), z zapamiętaniem urządzenia i bezpiecznym połączeniem
  BLESecurity *security = new BLESecurity();
  security->setCapability(ESP_IO_CAP_NONE);
  security->setAuthenticationMode(true, false, true);

  BLEHIDDevice *hid = new BLEHIDDevice(server);
  input = hid->inputReport(1);
  fixDescriptor(input, 0x2908, ESP_GATT_PERM_READ | ESP_GATT_PERM_READ_ENCRYPTED);  // odnośnik raportu
  fixDescriptor(hid->batteryService()->getCharacteristic(BLEUUID((uint16_t)0x2a19)), 0x2904, ESP_GATT_PERM_READ);  // format poziomu baterii
  hid->manufacturer()->setValue("SP3FCK");
  // VID 0x303A (Espressif), PID 0x8001, wersja 0x0100 – biblioteka zapisuje bajty odwrotnie, więc podane zamienione
  hid->pnp(0x02, 0x3A30, 0x0180, 0x0001);
  hid->hidInfo(0x00, 0x01);
  hid->reportMap((uint8_t *)REPORT_MAP, sizeof(REPORT_MAP));
  hid->startServices();
  hid->setBatteryLevel(100);

  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->setAppearance(HID_KEYBOARD);
  adv->addServiceUUID(hid->hidService()->getUUID());
  adv->setScanResponse(true);
  adv->start();

  stableState = lastRaw = readRaw();
  Serial.println("CW Paddle gotowy – sparuj „CW Paddle” w ustawieniach Bluetooth");
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
  }

  updateLed();
  delay(1);
}
