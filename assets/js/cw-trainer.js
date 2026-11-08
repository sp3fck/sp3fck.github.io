/* Trener CW — gra do nauki Morse'a (Web Audio, bez bibliotek).
   Tryby: Koch (pojedyncze znaki; kolejny odblokowuje runda z wynikiem ≥ 90%), znaki wywoławcze, skróty i kody Q
   oraz gry zręcznościowe na 3 życia: Szybki palec (wybór usłyszanego znaku na czas) i Morze Morse'a (nadawanie
   spadających znaków kluczem podwójnym — klawisze albo przyciski na ekranie, keyer jambiczny w JS) oraz Symulator pasma
   na czas (strojenie VFO po paśmie i rozpoznawanie na ucho stacji o prawdziwych znakach i raportach RST).
   Prawdziwy klucz: Arduino przez Web Serial albo ESP32 jako klawiatura Bluetooth (szkice i instrukcje w klucz/).
   Ustawienia, poziom Kocha i rekordy są w localStorage (sp3fck-cw). */
(function () {
  // Wersja trenera (semver), widoczna pod alfabetem — przy każdej zmianie gry podbij
  const VERSION = '1.6.0';
  const root = document.querySelector('[data-cw-root]');
  if (!root) return;
  const t = (en, pl) => `<span lang="en">${en}</span><span lang="pl">${pl}</span>`;
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  const MORSE = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
    K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
    U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', '/': '-..-.', '=': '-...-',
  };
  const REV = Object.fromEntries(Object.entries(MORSE).map(([c, m]) => [m, c]));
  const CHART = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,?/=';
  // Kolejność znaków metody Kocha (jak w LCWO)
  const KOCH = [...'KMURESNAPTLWI.JZ=FOY,VG5/Q92H38B?47C1D60X'];
  // Szablony prefiksów; „#” to losowa cyfra. Powtórzone wpisy losują się częściej.
  const PREFIXES = ('SP# SP# SP# SQ# SQ# SO# SN# DL# DL# DK# DJ# DO# OK# OK# OM# OE# HB9 G# M# F# I# IK# IZ# EA# CT# ' +
    'PA# PD# ON# OZ# SM# LA# OH# ES# YL# LY# UR# UT# YO# LZ# HA# S5# 9A# YU# SV# EI# GM# W# K# N# AA# KD# VE# ' +
    'JA# VK# ZL# PY# LU# ZS# 4X# UA# R#').split(' ');
  // [skrót, znaczenie EN, znaczenie PL, 1 = znak specjalny nadawany bez przerw między literami]
  const ABBR = [
    ['CQ', 'calling any station', 'wywołanie ogólne'],
    ['DE', 'from, this is', 'od, tu'],
    ['TU', 'thank you', 'dziękuję'],
    ['TNX', 'thanks', 'dzięki'],
    ['73', 'best regards', 'pozdrowienia'],
    ['88', 'love and kisses', 'ucałowania'],
    ['5NN', 'report 599 (contest shorthand)', 'raport 599 (skrót z zawodów)'],
    ['599', 'report: perfect signal', 'raport: idealny sygnał'],
    ['RST', 'readability, strength, tone', 'czytelność, siła, ton'],
    ['UR', 'your', 'twój'],
    ['HR', 'here', 'tutaj'],
    ['ES', 'and', 'i'],
    ['FB', 'fine business – great', 'świetnie'],
    ['OM', 'old man – fellow operator', 'kolega krótkofalowiec'],
    ['YL', 'young lady – female operator', 'krótkofalarka'],
    ['GM', 'good morning', 'dzień dobry (rano)'],
    ['GA', 'good afternoon', 'dzień dobry (po południu)'],
    ['GE', 'good evening', 'dobry wieczór'],
    ['GL', 'good luck', 'powodzenia'],
    ['PSE', 'please', 'proszę'],
    ['AGN', 'again', 'powtórz'],
    ['NR', 'number', 'numer'],
    ['OP', 'operator', 'operator'],
    ['NAME', 'name', 'imię'],
    ['RIG', 'transceiver', 'radiostacja'],
    ['ANT', 'antenna', 'antena'],
    ['PWR', 'power', 'moc'],
    ['WX', 'weather', 'pogoda'],
    ['CPY', 'copy', 'odbiór'],
    ['HW', 'how do you copy?', 'jak odbierasz?'],
    ['CUL', 'see you later', 'do usłyszenia'],
    ['DX', 'long-distance contact', 'daleka łączność'],
    ['TEST', 'contest call', 'wywołanie w zawodach'],
    ['POTA', 'Parks on the Air', 'Parks on the Air – łączności z parków'],
    ['SOTA', 'Summits on the Air', 'Summits on the Air – łączności ze szczytów'],
    ['QRZ', 'who is calling me?', 'kto mnie woła?'],
    ['QTH', 'my location', 'moje położenie'],
    ['QSL', 'I confirm receipt', 'potwierdzam odbiór'],
    ['QSO', 'a contact', 'łączność'],
    ['QRM', 'man-made interference', 'zakłócenia od innych stacji'],
    ['QRN', 'static noise', 'zakłócenia atmosferyczne'],
    ['QSB', 'fading', 'zaniki sygnału'],
    ['QRP', 'low power', 'mała moc'],
    ['QRO', 'high power', 'duża moc'],
    ['QRS', 'send slower', 'nadawaj wolniej'],
    ['QRQ', 'send faster', 'nadawaj szybciej'],
    ['QRT', 'closing down', 'kończę pracę'],
    ['QRL', 'is the frequency busy?', 'czy częstotliwość jest zajęta?'],
    ['QSY', 'change frequency', 'zmiana częstotliwości'],
    ['QRX', 'wait', 'czekaj'],
    ['BK', 'break – back to you', 'oddaję'],
    ['K', 'over, go ahead', 'odbiór, nadawaj'],
    ['R', 'roger, received', 'odebrałem'],
    ['KN', 'go ahead, only you (prosign)', 'nadawaj, tylko ty (znak specjalny)', 1],
    ['SK', 'end of contact (prosign)', 'koniec łączności (znak specjalny)', 1],
    ['AR', 'end of message (prosign)', 'koniec wiadomości (znak specjalny)', 1],
  ].map(([text, en, pl, p]) => ({ text, en, pl, p: !!p }));

  // len – liczba pozycji w rundzie; lives – gra na życia zamiast rundy; time – gra na czas (s);
  // pause – przerwa po dobrej / złej odpowiedzi (ms)
  const MODES = {
    koch: { len: 30, typed: false, pause: [450, 1300] },
    calls: { len: 20, typed: true, pause: [900, 2000] },
    abbr: { len: 20, typed: true, pause: [1700, 2600] },
    quick: { lives: 3, typed: false, pause: [500, 1400] },
    sea: { lives: 3, typed: false },
    fox: { time: 180, typed: false },
  };

  // Kropki i kreski rysowane w CSS — znaki „·” i „−” wyglądają różnie (i często słabo) w różnych fontach
  const codeHtml = groups => `<span class="cw-code" role="img" aria-label="${groups.join(' ')}">` +
    groups.map(g => `<span>${[...g].map(s => s === '.' ? '<i></i>' : '<i class="h"></i>').join('')}</span>`).join('') +
    '</span>';
  const pattern = (text, prosign) => {
    const codes = [...text].map(c => MORSE[c]).filter(Boolean);
    return codeHtml(prosign ? [codes.join('')] : codes);
  };
  const diff = (want, got) => [...want].map((c, i) => got[i] === c ? c : `<span class="x">${c}</span>`).join('');
  const hearts = n => n > 0 ? '♥︎'.repeat(n) : '—';

  // ---------- ustawienia ----------
  const KEY = 'sp3fck-cw';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  const S = Object.assign({ mode: 'koch', wpm: 20, eff: 20, tone: 600, vol: 70, noise: 0, level: 2, swap: false, letterGap: 2.5, foxLevel: 1, foxTimed: true, keySource: 'keyboard', fold: {}, best: {} }, saved);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, +v || 0));
  // dawniej szum był tylko włącz/wyłącz (qrn: true/false)
  if (saved.qrn && saved.noise == null) S.noise = 50;
  delete S.qrn;
  S.wpm = clamp(S.wpm, 5, 45);
  S.eff = clamp(S.eff, 5, S.wpm);
  S.tone = clamp(S.tone, 400, 1000);
  S.vol = clamp(S.vol, 0, 100);
  S.noise = clamp(S.noise, 0, 100);
  S.level = Math.round(clamp(S.level, 2, KOCH.length));
  S.swap = S.swap === true;
  S.letterGap = Math.round(4 * clamp(S.letterGap, 1.5, 5)) / 4;
  if (![1, 2, 3].includes(S.foxLevel)) S.foxLevel = 1;
  S.foxTimed = S.foxTimed !== false;
  if (!['keyboard', 'arduino', 'esp32'].includes(S.keySource)) S.keySource = 'keyboard';
  // strona zawsze otwiera się na pierwszej zakładce (Koch); reszta ustawień jest pamiętana
  S.mode = 'koch';
  if (!S.best || typeof S.best !== 'object') S.best = {};
  if (!S.fold || typeof S.fold !== 'object') S.fold = {};
  // „Jonosfera” z wersji roboczych 1.2–1.3 to teraz „Morze Morse'a” — rekord przechodzi pod nową nazwę
  if (S.best.iono) {
    S.best.sea = Math.max(S.best.sea || 0, S.best.iono);
    delete S.best.iono;
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  const el = {};
  root.querySelectorAll('[data-cw]').forEach(n => { el[n.dataset.cw] = n; });
  const inputs = root.querySelectorAll('.cw-settings input[name]');

  // ---------- dźwięk ----------
  let ac = null, master = null, voice = null, noise = null, ledTimer = 0, keepAlive = null, side = null;
  // iOS (każda przeglądarka to tam WebKit): Web Audio działa w sesji „ambient” i milknie przy przełączniku
  // wyciszenia. Sesja „playback” gra jak odtwarzacz muzyki. Samo navigator.audioSession nie wystarcza
  // np. w Chrome na iOS 27, więc na iOS dodatkowo gra zapętlony cichy dźwięk z <audio> — odtwarzany
  // element multimedialny przełącza sesję na „playback” (wstrzymywany, gdy karta jest ukryta).
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function playbackSession() {
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'playback'; } catch (e) {}
    }
    if (!IOS || keepAlive) return;
    // 0,5 s ciszy jako WAV 8 kHz / 8 bit
    const n = 4000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    str(36, 'data'); v.setUint32(40, n, true);
    new Uint8Array(buf, 44).fill(128);
    keepAlive = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
    keepAlive.loop = true;
    keepAlive.setAttribute('playsinline', '');
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) keepAlive.pause(); else keepAlive.play().catch(() => {});
    });
  }
  function audio() {
    if (!ac) playbackSession();
    // cichy <audio> rusza przed Web Audio; play() bywa odrzucone poza gestem — ponawiane przy każdym dźwięku
    if (keepAlive && keepAlive.paused && !document.hidden) keepAlive.play().catch(() => {});
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.connect(ac.destination);
    }
    master.gain.value = S.vol / 100;
    // iOS zostawia kontekst także w stanie „interrupted” (np. po zablokowaniu ekranu)
    if (ac.state !== 'running') ac.resume();
    return ac;
  }
  function gaps() {
    const dit = 1.2 / S.wpm;
    if (S.eff >= S.wpm) return { dit, charGap: 3 * dit, wordGap: 7 * dit };
    // Farnsworth (wzór ARRL): znaki w pełnym tempie, wydłużone przerwy między znakami i słowami
    const ta = (60 * S.wpm - 37.2 * S.eff) / (S.eff * S.wpm);
    return { dit, charGap: 3 * ta / 19, wordGap: 7 * ta / 19 };
  }
  function led(sec) {
    clearTimeout(ledTimer);
    el.led.classList.toggle('on', sec > 0);
    if (sec > 0) ledTimer = setTimeout(() => el.led.classList.remove('on'), sec * 1000);
  }
  function hush() {
    if (voice) {
      const now = ac.currentTime;
      voice.env.gain.cancelScheduledValues(now);
      voice.env.gain.setTargetAtTime(0, now, 0.004);
      try { voice.osc.stop(now + 0.03); } catch (e) {}
      voice = null;
    }
    led(0);
  }
  // Kluczuje tekst na parametrze głośności od chwili t0 (spacja = przerwa między słowami); zwraca odcinki tonu
  // [początek, koniec] i koniec ostatniego elementu — w czasie AudioContext (s).
  function keyText(param, text, prosign, t0, amp) {
    const { dit, charGap, wordGap } = gaps();
    const spans = [];
    let at = t0, end = t0;
    for (const ch of text) {
      if (ch === ' ') { at += wordGap - charGap; continue; }
      [...(MORSE[ch] || '')].forEach((sym, i) => {
        if (i) at += dit;
        const len = sym === '.' ? dit : 3 * dit;
        // miękkie zbocza (~5 ms), bez trzasków kluczowania
        param.setTargetAtTime(amp, at, 0.0015);
        param.setTargetAtTime(0, at + len, 0.0015);
        spans.push([at, at + len]);
        at += len;
        end = at;
      });
      at += prosign ? dit : charGap;
    }
    return { spans, end };
  }
  // Odtwarza tekst (spacja = przerwa między słowami); zwraca czas do końca ostatniego elementu w sekundach.
  function play(text, prosign) {
    audio();
    hush();
    const osc = ac.createOscillator(), env = ac.createGain();
    osc.frequency.value = S.tone;
    env.gain.value = 0;
    osc.connect(env).connect(master);
    const t0 = ac.currentTime + 0.05;
    const { end } = keyText(env.gain, text, prosign, t0, 0.5);
    osc.start(t0);
    osc.stop(end + 0.05);
    voice = { osc, env };
    osc.onended = () => { if (voice && voice.osc === osc) voice = null; };
    const dur = end - ac.currentTime;
    led(dur);
    return dur;
  }
  // Podsłuch własnego nadawania (Morze Morse'a): stały oscylator, kluczowana tylko głośność
  function sideTone(len) {
    audio();
    if (!side) {
      const osc = ac.createOscillator(), g = ac.createGain();
      g.gain.value = 0;
      osc.connect(g).connect(master);
      osc.start();
      side = { osc, g };
    }
    side.osc.frequency.value = S.tone;
    const now = ac.currentTime;
    side.g.gain.cancelScheduledValues(now);
    side.g.gain.setTargetAtTime(0.5, now, 0.0015);
    side.g.gain.setTargetAtTime(0, now + len, 0.0015);
  }
  function sideOff() {
    if (!side) return;
    const now = ac.currentTime;
    side.g.gain.cancelScheduledValues(now);
    side.g.gain.setTargetAtTime(0, now, 0.002);
  }
  // Szum pasma: biały szum przepuszczony przez filtr wokół częstotliwości tonu.
  // 100% ≈ odstęp sygnał/szum ok. 3 dB, 50% ≈ 9 dB.
  const noiseGain = () => 2.4 * S.noise / 100;
  let noisePreview = 0;
  function setNoise(on) {
    if (on && !noise) {
      audio();
      const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = buf;
      src.loop = true;
      bp.type = 'bandpass';
      bp.frequency.value = S.tone;
      bp.Q.value = 0.8;
      g.gain.value = 0;
      g.gain.setTargetAtTime(noiseGain(), ac.currentTime, 0.2);
      src.connect(bp).connect(g).connect(master);
      src.start();
      noise = { src, bp, g };
    } else if (!on && noise) {
      noise.src.stop();
      noise = null;
    }
  }

  // ---------- losowanie ----------
  function callsign() {
    let c = pick(PREFIXES).replace('#', () => rnd(10));
    const n = pick([1, 2, 2, 3, 3, 3]);
    for (let i = 0; i < n; i++) c += String.fromCharCode(65 + rnd(26));
    return Math.random() < 0.06 ? c + '/P' : c;
  }
  const kochSet = () => KOCH.slice(0, S.level);
  // najnowszy znak pada częściej — to jego trzeba utrwalić
  const kochChar = () => { const set = kochSet(); return Math.random() < 0.25 ? set[set.length - 1] : pick(set); };
  function draw() {
    if (S.mode === 'calls') return { text: callsign() };
    if (S.mode === 'abbr') return pick(ABBR);
    return { text: kochChar() };
  }
  // Szybki palec: poprawny znak + 3 inne — z poziomu Kocha, a gdy za mało, kolejne w porządku Kocha
  function choices(ch) {
    const near = KOCH.filter(c => c !== ch).slice(0, Math.max(3, S.level - 1));
    return shuffle([ch, ...shuffle(near).slice(0, 3)]);
  }

  // ---------- gra ----------
  // bieżąca runda; state: wait (czeka na odpowiedź) | show (wynik pozycji) | play (Morze Morse'a) | done (koniec)
  let G = null;
  const active = () => G && G.state !== 'done';

  function screen(glyph, pat, msg, cls) {
    el.glyph.innerHTML = glyph;
    el.glyph.className = 'cw-glyph' + (cls ? ' ' + cls : '');
    el.pattern.innerHTML = pat;
    el.msg.innerHTML = msg;
  }
  const IDLE = {
    typed: t('Press Start, type what you hear and confirm with Enter.', 'Naciśnij Start, wpisz to, co słyszysz, i zatwierdź Enterem.'),
    koch: t('Press Start and hit the key of each character you hear.', 'Naciśnij Start i wciskaj klawisz każdego usłyszanego znaku.'),
    quick: t('Press Start: a character plays – pick it from four before the time runs out.',
      'Naciśnij Start: zagra znak – wybierz go z czterech, zanim skończy się czas.'),
    sea: t('Press Start and send the falling characters with the paddle before they fall into the sea. Try the paddle first – it works before the start too.',
      'Naciśnij Start i nadawaj kluczem spadające znaki, zanim wpadną do morza. Klucz działa też przed startem – możesz poćwiczyć.'),
    fox: t('Pick a level and press Start. Five stations with real callsigns transmit on the band – their calls are on the tiles under the screen. Tune with the VFO knob, the paddle, the arrows or by dragging the band, and when you recognise a call, press its number. Watch out for other stations – a wrong number costs 10 s. From stage 4 the tile also shows an RST report, and somewhere on the band the same call sends a different one – find the right station.',
      'Wybierz poziom i naciśnij Start. Na paśmie nadaje pięć stacji z prawdziwymi znakami – widzisz je na kafelkach pod ekranem. Strój gałką VFO, kluczem, strzałkami albo przeciągając pasmo, a gdy rozpoznasz znak, wciśnij jego numer. Uważaj na obce stacje – zły numer kosztuje 10 s. Od etapu 4 na kafelku jest też raport RST, a gdzieś na paśmie nadaje ten sam znak z innym raportem – znajdź właściwą stację.'),
  };
  function idle() {
    screen('CW', pattern('CW'), MODES[S.mode].typed ? IDLE.typed : IDLE[S.mode]);
  }
  const focusGame = () => (MODES[S.mode].typed ? el.input : el.rig).focus({ preventScroll: true });

  function startRound() {
    audio();
    if (G) { clearTimeout(G.timer); cancelAnimationFrame(G.raf); }
    const m = MODES[S.mode];
    G = { n: 0, ok: 0, score: 0, streak: 0, maxStreak: 0, lives: m.lives || 0, missed: {}, item: null, state: 'wait', timer: 0, raf: 0, heardAt: 0 };
    el.log.innerHTML = '';
    el.start.innerHTML = 'Stop';
    // szum tylko tam, gdzie się słucha
    setNoise(S.noise > 0 && S.mode !== 'sea');
    renderMode();
    focusGame();
    if (S.mode === 'sea') seaStart(); else if (S.mode === 'fox') foxStart(); else nextItem();
  }
  function stopRound() {
    clearTimeout(G.timer);
    cancelAnimationFrame(G.raf);
    hush();
    foxSilence();
    setNoise(false);
    keyerReset();
    G = null;
    el.start.innerHTML = 'Start';
    el.choices.innerHTML = '';
    renderMode();
    renderStats();
    idle();
  }
  function nextItem() {
    const m = MODES[S.mode];
    if (m.lives ? G.lives <= 0 : G.n >= m.len) return endRound();
    let item;
    do item = draw(); while (m.typed && G.item && item.text === G.item.text);
    G.item = item;
    G.n++;
    G.state = 'wait';
    screen('?', '', t('Listen…', 'Słuchaj…'));
    if (S.mode === 'quick') {
      G.choices = choices(item.text);
      el.choices.innerHTML = G.choices.map((c, i) => `<button type="button" data-ch="${c}"><small>${i + 1}</small>${c}</button>`).join('');
    }
    renderStats();
    playItem();
    if (S.mode === 'quick') {
      // czas na odpowiedź liczony od końca dźwięku, z każdym trafieniem krótszy; powtórka go nie wydłuża
      G.limit = Math.max(900, 3000 - 60 * G.ok);
      G.deadline = G.heardAt + G.limit;
      quickTick();
    }
  }
  function playItem() {
    // czas reakcji liczony od końca dźwięku
    G.heardAt = performance.now() + play(G.item.text, G.item.p) * 1000;
  }
  function quickTick() {
    if (!G || G.state !== 'wait' || S.mode !== 'quick') return;
    const left = G.deadline - performance.now(), f = Math.max(0, Math.min(1, left / G.limit));
    el.timerbar.style.width = `${f * 100}%`;
    el.timer.classList.toggle('low', f < 0.3);
    if (left <= 0) return answer('');
    G.raf = requestAnimationFrame(quickTick);
  }
  function answer(got) {
    if (!G || G.state !== 'wait') return;
    G.state = 'show';
    hush();
    cancelAnimationFrame(G.raf);
    const m = MODES[S.mode], it = G.item, good = got === it.text;
    let pts = 0;
    if (good) {
      G.ok++;
      G.streak++;
      G.maxStreak = Math.max(G.maxStreak, G.streak);
      // Koch: 10 pkt + premia do 10 pkt za szybką odpowiedź; Szybki palec: 10 pkt + do 20 pkt za zapas czasu;
      // pozostałe tryby: 10 pkt za znak
      const now = performance.now();
      const base = m.typed ? 10 * it.text.length
        : S.mode === 'quick' ? 10 + Math.round(20 * Math.max(0, Math.min(1, (G.deadline - now) / G.limit)))
        : 10 + Math.max(0, 10 - Math.floor(Math.max(0, now - G.heardAt) / 150));
      const speed = m.typed ? (S.wpm + S.eff) / 2 : S.wpm;
      pts = Math.round(base * (1 + Math.min(G.streak - 1, 10) / 10) * speed / 20);
      G.score += pts;
    } else {
      G.streak = 0;
      G.missed[it.text] = (G.missed[it.text] || 0) + 1;
      if (m.lives) G.lives--;
    }
    let msg = good
      ? `+${pts}` + (G.streak > 1 ? ` · ${t('streak', 'seria')} ×${G.streak}` : '')
      : !got && m.lives ? t('Time is up!', 'Czas minął!')
      : t('Your copy: ', 'Twój odbiór: ') + `<b>${esc(got) || '—'}</b>`;
    if (it.en) msg += `<span class="cw-mean">${t(it.en, it.pl)}</span>`;
    screen(good ? it.text : diff(it.text, got), pattern(it.text, it.p), msg, good ? 'ok' : 'bad');
    if (m.typed) {
      log(it, got, good);
    } else {
      const box = S.mode === 'quick' ? el.choices : el.pad;
      flash(box, it.text, 'ok');
      if (!good && got) flash(box, got, 'bad');
    }
    renderStats();
    G.timer = setTimeout(nextItem, m.pause[good ? 0 : 1]);
  }
  function endRound() {
    G.state = 'done';
    clearTimeout(G.timer);
    cancelAnimationFrame(G.raf);
    setNoise(false);
    foxSilence();
    keyerReset();
    const m = MODES[S.mode];
    // Symulator pasma bez czasu to trening — wynik nie trafia do rekordów
    const practice = S.mode === 'fox' && !G.timed;
    const best = S.best[S.mode] || 0, record = G.score > best && !practice;
    if (record) S.best[S.mode] = G.score;
    const missed = Object.entries(G.missed).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const missedLine = missed.length
      ? `<span class="cw-mean">${t('Missed:', 'Pomyłki:')} ${missed.map(([c, n]) => `<b translate="no">${c}</b>×${n}`).join(' ')}</span>` : '';
    if (m.lives || m.time) {
      const stats = S.mode === 'sea'
        ? t(`Shot down: <b>${G.ok}</b> · wave <b>${G.wave}</b> · best streak <b>×${G.maxStreak}</b>`,
            `Zestrzelone: <b>${G.ok}</b> · fala <b>${G.wave}</b> · najlepsza seria <b>×${G.maxStreak}</b>`)
        : S.mode === 'fox'
        ? t(`Stations found: <b>${G.ok}</b> · stage <b>${G.stage}</b> (${FOX_LEVEL[S.foxLevel - 1][0].toLowerCase()}) · mistakes <b>${G.wrong}</b>`,
            `Znalezione stacje: <b>${G.ok}</b> · etap <b>${G.stage}</b> (poziom ${FOX_LEVEL[S.foxLevel - 1][1].toLowerCase()}) · pomyłki <b>${G.wrong}</b>`) +
          (practice ? ` · ${t('time', 'czas')} <b>${clock(G.elapsed)}</b>` : '')
        : t(`Correct: <b>${G.ok}</b> of ${G.n} · best streak <b>×${G.maxStreak}</b>`,
            `Trafione: <b>${G.ok}</b> z ${G.n} · najlepsza seria <b>×${G.maxStreak}</b>`);
      screen(String(G.score), record ? t('New record!', 'Nowy rekord!')
        : practice ? t('Practice – not counted as a record', 'Trening – bez rekordu') : `${t('Record', 'Rekord')} ${best}`,
        stats + missedLine, record ? 'ok' : '');
    } else {
      const acc = Math.round(100 * G.ok / m.len);
      let msg = '';
      if (S.mode === 'koch') {
        if (acc >= 90 && S.level < KOCH.length) {
          const ch = KOCH[S.level++];
          msg = t('New character: ', 'Nowy znak: ') + `<b>${ch}</b> <span class="cw-pat">${pattern(ch)}</span>`;
          G.timer = setTimeout(() => play(`${ch} ${ch} ${ch}`), 700);
        } else if (acc >= 90) {
          msg = t('You know all 41 characters – time for callsigns!', 'Znasz wszystkie 41 znaków – czas na znaki wywoławcze!');
        } else {
          msg = t('Reach 90% to unlock the next character.', 'Zdobądź 90%, żeby odblokować kolejny znak.');
        }
        msg += missedLine;
      } else if (acc >= 90 && S.wpm < 45) {
        msg = t('Solid copy!', 'Pewny odbiór!') +
          ` <button type="button" class="btn ghost cw-mini" data-cw-faster>${t('Try', 'Spróbuj')} ${S.wpm + 2} WPM</button>`;
      } else if (acc < 60) {
        msg = t('Too fast? Lower the speed or the effective (Farnsworth) speed.', 'Za szybko? Zmniejsz tempo albo tempo efektywne (Farnsworth).');
      }
      screen(`${acc}%`, `${t('Score', 'Wynik')} ${G.score}` + (record ? ' · ' + t('new record!', 'nowy rekord!') : ''), msg, record ? 'ok' : '');
    }
    save();
    el.start.innerHTML = t('Again', 'Jeszcze raz');
    renderMode();
    renderStats();
    renderBest();
    renderSettings();
  }
  function log(it, got, good) {
    const li = document.createElement('li');
    li.className = good ? 'ok' : 'bad';
    li.innerHTML = `<span class="n">${G.n}</span><b translate="no">${it.text}</b><span translate="no">${good ? '✓' : esc(got) || '—'}</span>` +
      (it.en ? `<span class="m">${t(it.en, it.pl)}</span>` : '');
    el.log.prepend(li);
  }
  function flash(box, ch, cls) {
    const b = [...box.children].find(x => x.dataset.ch === ch);
    if (!b) return;
    b.classList.add(cls);
    setTimeout(() => b.classList.remove(cls), 600);
  }

  // ---------- klucz podwójny (paddle) z keyerem jambicznym ----------
  // Lewa łopatka = kropki, prawa = kreski (S.swap zamienia je dla leworęcznych), obie naraz (squeeze) = na przemian.
  // Keyer w trybie A z pamięcią: przeciwny element wciśnięty w trakcie nadawania zostanie nadany po bieżącym.
  // Długości elementów z „Tempa”, litera kończy się po ciszy z „Przerwy między znakami” (domyślnie 2,5 kropki).
  // lewy/prawy Ctrl: tak nadaje ESP32 jako klawiatura Bluetooth (i inne interfejsy udające klawiaturę)
  const PADDLE = { KeyZ: 'L', ArrowLeft: 'L', BracketLeft: 'L', ControlLeft: 'L', KeyX: 'R', ArrowRight: 'R', BracketRight: 'R', ControlRight: 'R' };
  const pads = { L: root.querySelector('[data-paddle="L"]'), R: root.querySelector('[data-paddle="R"]') };
  const elementOf = side => (side === 'L') !== S.swap ? '.' : '-';
  // busy – keyer nadaje (element albo przerwa po nim); on – trwa sam element (ton, dioda TX, fale radiowe łódki)
  const kr = { '.': false, '-': false, busy: false, on: false, cur: '', last: '', mem: '', code: '', timer: 0, gap: 0 };
  function paddle(side, down) {
    const p = elementOf(side);
    if (kr[p] === down || (down && S.mode !== 'sea' && S.mode !== 'fox')) return;
    kr[p] = down;
    pads[side].classList.toggle('on', down);
    // Symulator pasma: łopatki stroją VFO (lewa w dół, prawa w górę) — robi to pętla gry, keyer odpoczywa
    if (!down || S.mode === 'fox') return;
    if (kr.busy) {
      if (p !== kr.cur) kr.mem = p;
    } else {
      clearTimeout(kr.gap);
      keyerNext();
    }
  }
  function keyerNext() {
    let e = kr.mem;
    kr.mem = '';
    if (!e) e = kr['.'] && kr['-'] ? (kr.last === '.' ? '-' : '.') : kr['.'] ? '.' : kr['-'] ? '-' : '';
    const dit = 1.2 / S.wpm;
    if (!e) {
      kr.busy = false;
      // po przerwie 1 kropki między elementami czekamy na resztę ustawionej przerwy (domyślnie razem 2,5 kropki) = koniec litery
      kr.gap = setTimeout(endLetter, (S.letterGap - 1) * 1000 * dit);
      return;
    }
    const len = e === '.' ? dit : 3 * dit;
    Object.assign(kr, { busy: true, on: true, cur: e, last: e, code: kr.code + e });
    sideTone(len);
    el.led.classList.add('on');
    renderKeying();
    kr.timer = setTimeout(() => {
      kr.on = false;
      el.led.classList.remove('on');
      kr.timer = setTimeout(keyerNext, 1000 * dit);
    }, 1000 * len);
  }
  function endLetter() {
    const code = kr.code;
    kr.code = '';
    if (!code) return;
    const ch = REV[code] || null;
    el.decoded.textContent = ch || '?';
    el.decoded.className = ch ? '' : 'bad';
    renderKeying();
    if (G && G.state === 'play' && S.mode === 'sea') seaChar(ch);
  }
  function keyerReset() {
    clearTimeout(kr.timer);
    clearTimeout(kr.gap);
    Object.assign(kr, { '.': false, '-': false, busy: false, on: false, cur: '', last: '', mem: '', code: '' });
    sideOff();
    el.led.classList.remove('on');
    Object.values(pads).forEach(b => b.classList.remove('on'));
    el.decoded.textContent = '';
    renderKeying();
  }
  const renderKeying = () => { el.keying.innerHTML = kr.code ? codeHtml([kr.code]) : ''; };
  const PAD_LABEL = { '.': `· ${t('DIT', 'KROPKA')}`, '-': `− ${t('DAH', 'KRESKA')}` };
  function renderPaddles() {
    pads.L.innerHTML = `${PAD_LABEL[elementOf('L')]}<small>Z ←</small>`;
    pads.R.innerHTML = `${PAD_LABEL[elementOf('R')]}<small>X →</small>`;
    el.swap.checked = S.swap;
  }

  // ---------- źródła klucza ----------
  // Wszystkie trafiają do paddle(strona, wciśnięta): klawiatura i przyciski na ekranie (wyżej), Arduino przez Web Serial,
  // ESP32 na razie jako klawiatura BLE (lewy/prawy Ctrl). Urządzenia podają bajt stanu jak szkic klucz/arduino/paddle_uno.ino:
  // bit 1 = styk kropki (tip, lewa łopatka), bit 2 = styk kreski (ring, prawa).
  // Przyszły tryb Web Bluetooth (ESP32 z własną usługą GATT) dostanie w SOURCES własne connect/disconnect i będzie
  // wołać applyState(bajt) z powiadomień charakterystyki stanu — reszta zostaje bez zmian.
  const hasSerial = 'serial' in navigator;
  const BUILD = t('<a href="#klucz">How to build it →</a>', '<a href="#klucz">Jak to zbudować →</a>');
  const SOURCES = {
    keyboard: {
      info: t('Paddle on the keyboard: left – <kbd>Z</kbd> <kbd>←</kbd> or left <kbd>Ctrl</kbd>, right – <kbd>X</kbd> <kbd>→</kbd> or right <kbd>Ctrl</kbd>. On a phone use the DIT / DAH buttons in Morse Sea.',
        'Łopatki na klawiaturze: lewa – <kbd>Z</kbd> <kbd>←</kbd> albo lewy <kbd>Ctrl</kbd>, prawa – <kbd>X</kbd> <kbd>→</kbd> albo prawy <kbd>Ctrl</kbd>. Na telefonie przyciski KROPKA / KRESKA w Morzu Morse\'a.'),
    },
    arduino: {
      info: (hasSerial
        ? t('Paddle through an Arduino Uno/Nano on USB: click Connect, pick its COM port and wait about 2 s.',
            'Klucz przez Arduino Uno/Nano na USB: kliknij Połącz, wybierz jego port COM i poczekaj ok. 2 s.')
        : t('This browser has no Web Serial – use Chrome or Edge on a computer.',
            'Ta przeglądarka nie obsługuje Web Serial – użyj Chrome lub Edge na komputerze.')) + ' ' + BUILD,
      connect: serialConnect,
      disconnect: () => serialClose(t('Disconnected.', 'Rozłączono.')),
    },
    esp32: {
      info: t('ESP32 as a Bluetooth keyboard: pair “CW Paddle” in the system Bluetooth settings – the paddle then sends left <kbd>Ctrl</kbd> (dit) and right <kbd>Ctrl</kbd> (dah), on phones too. The interface is in preparation.',
        'ESP32 jako klawiatura Bluetooth: sparuj „CW Paddle” w ustawieniach Bluetooth systemu – łopatki wysyłają wtedy lewy <kbd>Ctrl</kbd> (kropka) i prawy <kbd>Ctrl</kbd> (kreska), także na telefonie. Interfejs jest w przygotowaniu.') + ' ' + BUILD,
    },
  };
  // bajt stanu z urządzenia → obie łopatki
  function applyState(s) {
    paddle('L', !!(s & 1));
    paddle('R', !!(s & 2));
  }
  function keyStatus(html, cls) {
    el.keystatus.innerHTML = html;
    el.keystatus.className = 'cw-keystatus' + (cls ? ' ' + cls : '');
  }
  function renderSource() {
    const src = SOURCES[S.keySource], connected = !!serial.port;
    root.querySelectorAll('[data-source]').forEach(b => b.setAttribute('aria-pressed', b.dataset.source === S.keySource));
    el.sourceinfo.innerHTML = src.info;
    el.serialbox.hidden = !src.connect;
    el.connect.hidden = connected;
    el.connect.disabled = !hasSerial;
    el.disconnect.hidden = !connected;
  }

  // Arduino przez Web Serial (115200 bd, protokół jak w szkicu)
  const serial = { port: null, reader: null, loop: null, timer: 0, closing: false };
  async function serialConnect() {
    audio(); // kliknięcie „Połącz” odblokowuje też dźwięk
    let port;
    try {
      port = await navigator.serial.requestPort();
    } catch (e) {
      return keyStatus(t('No port selected.', 'Nie wybrano portu.'));
    }
    try {
      await port.open({ baudRate: 115200 });
    } catch (e) {
      // najczęściej port zajęty, np. przez Serial Monitor w Arduino IDE
      return keyStatus(t(`Could not open the port (${esc(e.message)}). Is the Arduino IDE Serial Monitor open?`,
        `Nie udało się otworzyć portu (${esc(e.message)}). Czy nie jest otwarty Serial Monitor w Arduino IDE?`), 'bad');
    }
    serial.port = port;
    renderSource();
    keyStatus(t('Connected – the Uno restarts, wait about 2 s…', 'Połączono – Uno się restartuje, poczekaj ok. 2 s…'));
    serial.loop = serialRead(port);
    // Uno restartuje się po otwarciu portu, więc o bieżący stan („?”) pytamy dopiero po ok. 2 s
    serial.timer = setTimeout(async () => {
      if (serial.port !== port) return;
      try {
        const w = port.writable.getWriter();
        await w.write(new Uint8Array([63]));
        w.releaseLock();
      } catch (e) {}
      keyStatus(t('Ready – press the paddle.', 'Gotowe – naciskaj łopatki.'), 'ok');
    }, 2000);
  }
  async function serialRead(port) {
    while (port.readable && !serial.closing) {
      const reader = serial.reader = port.readable.getReader();
      let done = false;
      try {
        while (!done) {
          const r = await reader.read();
          done = r.done;
          if (r.value) for (const b of r.value) if (b >= 48 && b <= 51) applyState(b - 48);
        }
      } catch (e) {
        // po utracie urządzenia port.readable znika i pętla się kończy; po drobnych błędach transmisji czytamy dalej
      } finally {
        reader.releaseLock();
      }
      if (done) break;
    }
    if (!serial.closing && serial.port === port) serialClose(t('Disconnected – was the cable unplugged?', 'Rozłączono – wyjęty kabel?'), 'bad', true);
  }
  async function serialClose(msg, cls, fromLoop) {
    const port = serial.port;
    if (!port || serial.closing) return;
    serial.closing = true;
    clearTimeout(serial.timer);
    applyState(0); // obie łopatki puszczone, żeby ton nie wisiał
    try { if (serial.reader) await serial.reader.cancel(); } catch (e) {}
    if (!fromLoop) await serial.loop;
    try { await port.close(); } catch (e) {}
    Object.assign(serial, { port: null, reader: null, loop: null, closing: false });
    renderSource();
    keyStatus(msg, cls);
  }

  // ---------- Morze Morse'a ----------
  // Znaki z poziomu Kocha (od 3. fali także krótkie skróty) spadają do morza; trzeba je nadać kluczem, zanim
  // wpadną do wody. Co 8 zestrzelonych — nowa fala: szybsze spadanie i częstsze znaki.
  let C = {}; // kolory i font do płótna, z CSS
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  // fale morza: [wysokość nad dołem płótna, amplituda, długość, okres, przesunięcie, krycie]; ostatnia to przednia
  const WAVES = [[56, 5, 46, 700, 2, 0.14], [50, 4, 30, 520, 4, 0.22], [44, 4, 38, 420, 0, 0.38]];
  const waveY = (w, x, now) => G.H - w[0] + w[1] * Math.sin(x / w[2] + now / w[3] + w[4]) + 1.5 * Math.sin(x / 13 - now / 300 + w[4]);
  const surface = (x, now) => waveY(WAVES[2], x, now);
  function fitField() {
    const r = el.field.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    el.field.width = Math.round(r.width * dpr);
    el.field.height = Math.round(r.height * dpr);
    G.W = r.width;
    G.H = r.height;
    G.ctx = el.field.getContext('2d');
    G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function readColors() {
    const cs = getComputedStyle(root), v = n => cs.getPropertyValue(n).trim();
    C = { ink: v('--ink'), soft: v('--ink-soft'), accent: v('--accent'), ok: v('--ok'), bad: v('--bad'), sea: v('--link'), mono: v('--mono') };
  }
  function seaStart() {
    readColors();
    Object.assign(G, { state: 'play', items: [], fx: [], parts: [], sink: [], wave: 1, fall: 14, every: 3, spawnIn: 0.5, target: null, hitAt: -1e4, last: performance.now() });
    screen('', '', '');
    fitField();
    keyerReset();
    renderStats();
    G.raf = requestAnimationFrame(seaLoop);
  }
  function seaSpawn() {
    const set = kochSet();
    let text = kochChar();
    if (G.wave >= 3 && Math.random() < 0.3) {
      const words = ABBR.filter(a => !a.p && a.text.length <= 4 && [...a.text].every(c => set.includes(c)));
      if (words.length) text = pick(words).text;
    }
    // kilka prób, żeby nowy znak nie nachodził na te tuż pod górną krawędzią
    let xf = 0.5;
    for (let i = 0; i < 8; i++) {
      xf = 0.12 + Math.random() * 0.76;
      if (!G.items.some(it => it.y < 80 && Math.abs(it.xf - xf) < 0.18)) break;
    }
    G.items.push({ text, xf, y: -12, done: 0 });
  }
  function seaLoop(now) {
    if (!G || G.state !== 'play') return;
    const dt = Math.min(0.05, (now - G.last) / 1000); // po powrocie do karty gra rusza dalej, bez skoku
    G.last = now;
    G.spawnIn -= dt;
    if (G.spawnIn <= 0 && G.items.length < 6) { seaSpawn(); G.spawnIn = G.every; }
    const v = G.H / G.fall;
    for (const it of [...G.items]) {
      it.y += v * dt;
      const x = it.xf * G.W, sy = surface(x, now);
      if (it.y + 9 < sy) continue;
      // znak wpadł do wody: plusk, krąg na wodzie i tonąca litera
      G.items.splice(G.items.indexOf(it), 1);
      if (G.target === it) G.target = null;
      G.lives--;
      G.streak = 0;
      G.hitAt = now;
      G.missed[it.text] = (G.missed[it.text] || 0) + 1;
      burst(x, sy, 16, [C.sea, C.ink], 260, 900, true, now);
      G.fx.push({ kind: 'ripple', x, y: sy, t: now, dur: 800, color: C.bad });
      G.sink.push({ text: it.text, x, y: it.y, t: now });
      renderStats();
    }
    for (const p of G.parts) {
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    G.parts = G.parts.filter(p => now - p.t < p.life);
    G.sink = G.sink.filter(s => now - s.t < 1200);
    seaDraw(now);
    if (G.lives <= 0) return endRound();
    G.raf = requestAnimationFrame(seaLoop);
  }
  function seaChar(ch) {
    let it = G.items.includes(G.target) ? G.target : null;
    if (!it && ch) it = G.items.filter(x => x.text[0] === ch).sort((a, b) => b.y - a.y)[0] || null;
    if (!it || it.text[it.done] !== ch) {
      // pudło: rozpoczęty skrót trzeba nadać od początku
      if (it) it.done = 0;
      G.target = null;
      G.streak = 0;
      el.decoded.className = 'bad';
      renderStats();
      return;
    }
    el.decoded.className = 'ok';
    it.done++;
    G.target = it;
    if (it.done < it.text.length) return;
    G.items.splice(G.items.indexOf(it), 1);
    G.target = null;
    G.ok++;
    G.streak++;
    G.maxStreak = Math.max(G.maxStreak, G.streak);
    // punkty za znaki i za wysokość (im wcześniej, tym więcej), mnożone przez serię
    const pts = Math.round((10 * it.text.length + 10 * Math.max(0, 1 - it.y / G.H)) * (1 + Math.min(G.streak - 1, 10) / 10));
    G.score += pts;
    const now = performance.now(), x = it.xf * G.W;
    // wybuch: odłamki, rozbłysk i zdobyte punkty
    burst(x, it.y, 32, [C.accent, C.ok, C.ink], 300, 260, false, now);
    G.fx.push({ kind: 'ring', x, y: it.y, t: now, dur: 400, color: C.accent });
    G.fx.push({ text: `+${pts}`, x, y: it.y, t: now, color: C.ok });
    if (G.ok % 8 === 0) {
      G.wave++;
      G.fall = Math.max(4, G.fall * 0.88);
      G.every = Math.max(0.9, G.every * 0.88);
      G.fx.push({ text: (document.documentElement.lang === 'pl' ? 'FALA ' : 'WAVE ') + G.wave, x: G.W / 2, y: G.H * 0.4, t: now, color: C.accent, big: true });
    }
    renderStats();
  }
  // odłamki po zestrzeleniu (na boki) albo krople po plusku (w górę); g – grawitacja w px/s²
  function burst(x, y, n, colors, speed, g, up, now) {
    for (let i = 0; i < n; i++) {
      const a = up ? -Math.PI / 2 + (Math.random() - 0.5) * 1.4 : Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g, t: now, life: 450 + Math.random() * 400, color: pick(colors), r: 1.5 + Math.random() * 2 });
    }
  }
  function seaWave(w, now, fill, crest) {
    const { ctx, W, H } = G;
    ctx.beginPath();
    for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, waveY(w, x, now));
    if (crest) {
      ctx.strokeStyle = crest;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.lineTo(W + 8, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  // łódka /MM z anteną pionową, kołysze się na środkowej fali; gdy nadajesz, z anteny idą fale radiowe
  function seaBoat(now) {
    const { ctx, W } = G, x = W / 2, w = WAVES[1];
    const y = waveY(w, x, now), tilt = Math.atan((waveY(w, x + 8, now) - waveY(w, x - 8, now)) / 16);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.fillStyle = C.soft;
    ctx.strokeStyle = C.soft;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-36, -9); ctx.lineTo(36, -9); ctx.lineTo(27, 4); ctx.lineTo(-27, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-18, -19, 22, 10);
    ctx.beginPath();
    ctx.moveTo(16, -9); ctx.lineTo(16, -64);
    ctx.stroke();
    if (kr.on) {
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 1.5;
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = 1 - i * 0.25;
        ctx.beginPath();
        ctx.arc(16, -64, i * 9, -Math.PI * 0.85, -Math.PI * 0.15);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function seaDraw(now) {
    const { ctx, W, H } = G;
    ctx.clearRect(0, 0, W, H);
    // morze: dalsza fala, łódka, środkowa fala, tonące litery i przednia fala (po trafieniu przez chwilę czerwona)
    seaWave(WAVES[0], now, rgba(C.sea, WAVES[0][5]));
    seaBoat(now);
    seaWave(WAVES[1], now, rgba(C.sea, WAVES[1][5]));
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `800 26px ${C.mono}`;
    for (const s of G.sink) {
      const a = (now - s.t) / 1200;
      ctx.globalAlpha = 0.9 * (1 - a);
      ctx.fillStyle = C.bad;
      ctx.fillText(s.text, s.x, s.y + a * 30);
    }
    ctx.globalAlpha = 1;
    const hit = now - G.hitAt < 400;
    seaWave(WAVES[2], now, hit ? rgba(C.bad, 0.45) : rgba(C.sea, WAVES[2][5]), rgba(hit ? C.bad : C.sea, 0.7));
    // znaki: nadana część na zielono, cel na bursztynowo, nisko nad wodą na czerwono
    ctx.textAlign = 'left';
    for (const it of G.items) {
      const done = it.text.slice(0, it.done), rest = it.text.slice(it.done);
      let x = it.xf * W - ctx.measureText(it.text).width / 2;
      ctx.fillStyle = C.ok;
      ctx.fillText(done, x, it.y);
      x += ctx.measureText(done).width;
      ctx.fillStyle = it === G.target ? C.accent : it.y > H * 0.7 ? C.bad : C.ink;
      ctx.fillText(rest, x, it.y);
    }
    // odłamki i krople
    for (const p of G.parts) {
      ctx.globalAlpha = Math.max(0, 1 - (now - p.t) / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // efekty: rozbłysk, krąg na wodzie, punkty i numer fali
    ctx.textAlign = 'center';
    G.fx = G.fx.filter(f => now - f.t < (f.dur || 900));
    for (const f of G.fx) {
      const a = (now - f.t) / (f.dur || 900);
      ctx.globalAlpha = 1 - a;
      ctx.strokeStyle = ctx.fillStyle = f.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (f.kind === 'ring') {
        ctx.arc(f.x, f.y, 8 + a * 46, 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.kind === 'ripple') {
        ctx.ellipse(f.x, f.y, 8 + a * 60, 2 + a * 5, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.font = `800 ${f.big ? 34 : 18}px ${C.mono}`;
        ctx.fillText(f.text, f.x, f.y - a * 30);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Symulator pasma (w kodzie „fox”, dawniej Łowy na lisa) ----------
  // Na paśmie 80 m nadaje pięć stacji z prawdziwymi znakami (data/cw-calls.js), które widać na kafelkach („lisy” w kodzie).
  // VFO stroi się gałką, łopatkami / strzałkami, kółkiem myszy albo przeciągając panoramę. Każdy lis ma własny
  // oscylator: dostrojony gra tonem z ustawień, odstrojony wyżej albo niżej i ciszej (filtr CW ok. 500 Hz).
  // Stację łapie się jej numerem, gdy jest w pobliżu VFO. Wszystkie złapane → kolejny etap (+30 s): dłuższe znaki,
  // dłuższe przerwy, słabsze sygnały, ciaśniej na paśmie, obce stacje (często z tym samym prefiksem), a od etapu 4
  // raport RST na kafelku i „bliźniaki” — ten sam znak z innym raportem. Zły numer, obca stacja albo bliźniak: −10 s.
  // Poziom wybiera etap startowy.
  // długości znaków pięciu stacji w kolejnych etapach (dalej jak w ostatnim)
  const STAGES = [[3, 3, 3, 3, 3], [3, 3, 3, 4, 4], [4, 4, 4, 5, 5], [4, 5, 5, 5, 6], [5, 5, 6, 6, 6], [5, 6, 6, 6, 7]];
  const RST_FROM = 4;
  const RSTS = ['599', '589', '579', '569', '559', '549', '539', '449', '439', '339'];
  const FOX_START = [1, 3, 5]; // etap startowy na poziomie łatwym, średnim i trudnym
  const FOX_LEVEL = [['Easy', 'Łatwy'], ['Medium', 'Średni'], ['Hard', 'Trudny']];
  const CALLS = {};
  for (const [len, list] of Object.entries(window.SP3FCK_CALLS || {})) CALLS[len] = list.trim().split(/\s+/);
  // nieużyty w tej grze prawdziwy znak o danej długości; like — obca stacja z prefiksem jak u stacji z kafelka myli się łatwiej.
  // Bez pliku ze znakami (np. stary HTML z pamięci przeglądarki) — losowy znak w tym samym formacie.
  function realCall(len, taken, like) {
    const pool = (CALLS[len] || []).filter(c => !taken.has(c));
    const near = like ? pool.filter(c => c.slice(0, 2) === like.slice(0, 2) && c !== like) : [];
    let c = near.length ? pick(near) : pool.length ? pick(pool) : '';
    for (let i = 0; !c && i < 200; i++) {
      const x = len === 3 ? pick(['K', 'N', 'W']) + rnd(10) + String.fromCharCode(65 + rnd(26)) : callsign();
      if (x.length === len && !taken.has(x)) c = x;
    }
    c = c || callsign();
    taken.add(c);
    return c;
  }
  // inny, ale podobny raport (różni się zwykle jedną cyfrą) — dla „bliźniaka” stacji z kafelka
  function likeRst(rst) {
    const unlike = r => [...r].filter((ch, i) => ch !== rst[i]).length * 1000 + Math.abs(r - rst);
    return pick(RSTS.filter(r => r !== rst).sort((a, b) => unlike(a) - unlike(b)).slice(0, 3));
  }
  const BAND = [3540000, 3580000]; // Hz
  const SPAN = 5000; // szerokość panoramy, Hz
  const CATCH = 300; // tak blisko VFO (Hz) musi być lis, żeby go złapać
  const pass = off => Math.abs(off) > 1500 ? 0 : 1 / (1 + (off / 250) ** 4);
  const pl = () => document.documentElement.lang === 'pl';
  const kHz = f => { const s = (f / 1000).toFixed(2); return pl() ? s.replace('.', ',') : s; };
  const clock = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  // układ płótna (px od góry): nagłówek z VFO, S-metr, pasek pasma, panorama, wodospad
  const FY = { meter: 44, band: 70, top: 90, bot: 166 };

  function foxStart() {
    readColors();
    const n = parseInt(C.accent.slice(1), 16);
    Object.assign(G, { state: 'play', stage: FOX_START[S.foxLevel - 1] - 1, left: MODES.fox.time, timed: S.foxTimed, elapsed: 0, vfo: (BAND[0] + BAND[1]) / 2,
      hold: 0, shift: 0, shiftRem: 0, src: [], taken: new Set(), fx: [], wrong: 0, drag: null,
      shown: -1, rgb: [n >> 16, (n >> 8) & 255, n & 255], last: performance.now() });
    meter.f = 0;
    screen('', '', '');
    fitField();
    foxWaterfall();
    keyerReset();
    foxStage();
    G.raf = requestAnimationFrame(foxLoop);
  }
  // wodospad na osobnym płótnie w pikselach urządzenia: przesuwany w dół (czas) i na boki (strojenie)
  function foxWaterfall() {
    const dpr = window.devicePixelRatio || 1;
    G.wf = document.createElement('canvas');
    G.wf.width = Math.max(1, Math.round(G.W * dpr));
    G.wf.height = Math.max(1, Math.round((G.H - FY.bot) * dpr));
    G.wfc = G.wf.getContext('2d');
    G.row = G.wfc.createImageData(G.wf.width, 1);
    G.wfAcc = 0;
  }
  function foxStage() {
    foxSilence();
    G.stage++;
    const s = G.stage - 1, now = performance.now();
    // im dalej, tym ciaśniej na paśmie, słabiej, dłuższe przerwy i więcej stacji spoza kafelków
    const gap = Math.max(700, 3000 - 900 * s), used = [];
    const place = () => {
      let f = 0;
      for (let i = 0; i < 80; i++) {
        f = BAND[0] + 1000 + Math.random() * (BAND[1] - BAND[0] - 2000);
        if (used.every(x => Math.abs(x - f) >= gap) && Math.abs(f - G.vfo) > 1500) break;
      }
      used.push(f);
      return Math.round(f / 10) * 10;
    };
    // od etapu RST_FROM każda stacja podaje też raport (obce także, żeby nie zdradzał ich brak raportu), raport stacji
    // jest na kafelku, a gdzieś na paśmie nadaje „bliźniak”: ten sam znak z innym raportem (etap 4: 1, potem 2, 3)
    const rst = G.stage >= RST_FROM;
    const say = (c, r) => r ? `${c} ${c} ${r}` : `${c} ${c}`;
    const lens = shuffle([...STAGES[Math.min(G.stage, STAGES.length) - 1]]);
    G.src = lens.map((len, i) => {
      const code = realCall(len, G.taken), r = rst ? pick(RSTS) : '';
      return { kind: 'fox', n: i + 1, code, rst: r, text: say(code, r) };
    });
    const twins = shuffle(G.src.slice()).slice(0, rst ? Math.min(3, G.stage - RST_FROM + 1) : 0);
    for (let i = 0; i < Math.min(3, s); i++) {
      if (twins[i]) {
        const f = twins[i], r = likeRst(f.rst);
        G.src.push({ kind: 'twin', n: 0, code: f.code, rst: r, fox: f, text: say(f.code, r) });
        continue;
      }
      const like = G.src[rnd(5)].code, c = realCall(like.length, G.taken, like), r = rst ? pick(RSTS) : '';
      G.src.push(i < 2 ? { kind: 'fake', n: 0, code: c, text: say(c, r) } : { kind: 'cq', n: 0, code: c, text: `CQ DE ${c} ${c} K` });
    }
    G.src.forEach(x => Object.assign(x, foxVoice(), {
      freq: place(), level: Math.max(0.25, 0.8 - 0.15 * s) + Math.random() * 0.2,
      spans: [], nextAt: now + 300 + rnd(2500), sm: 0, caught: false, setOff: null, setTone: 0,
    }));
    G.pause = [Math.min(5000, 1000 + 1000 * s), Math.min(9000, 2200 + 1700 * s)];
    if (G.stage > FOX_START[S.foxLevel - 1]) foxFx((pl() ? 'ETAP ' : 'STAGE ') + G.stage, C.accent, G.timed ? '+30 s' : '', true);
    renderMode(); // pokazuje przyciski z nowymi znakami
    renderStats();
  }
  // oscylator stacji → kluczowanie → filtr odbiornika (głośność zależna od odstrojenia) → wyjście
  function foxVoice() {
    const osc = ac.createOscillator(), key = ac.createGain(), filt = ac.createGain();
    osc.frequency.value = S.tone;
    key.gain.value = 0;
    filt.gain.value = 0;
    osc.connect(key).connect(filt).connect(master);
    osc.start();
    return { osc, key, filt };
  }
  function foxQuiet(x) {
    if (!x.osc) return;
    const now = ac.currentTime;
    x.key.gain.cancelScheduledValues(now);
    x.key.gain.setTargetAtTime(0, now, 0.004);
    try { x.osc.stop(now + 0.05); } catch (e) {}
    x.osc = null;
    x.spans = [];
  }
  function foxSilence() {
    if (!G || !G.src) return;
    G.src.forEach(foxQuiet);
    el.led.classList.remove('on');
  }
  function foxSend(x) {
    const t0 = ac.currentTime + 0.05, base = performance.now() - ac.currentTime * 1000;
    const { spans, end } = keyText(x.key.gain, x.text, false, t0, 0.5);
    x.spans = spans.map(([a, b]) => [base + a * 1000, base + b * 1000]);
    const [p0, p1] = G.pause;
    x.nextAt = base + end * 1000 + p0 + Math.random() * (p1 - p0);
  }
  // fromKnob — kręci gałka (sama się już obróciła); inne strojenie obraca ją o tyle, ile przesunęło VFO
  function foxTune(df, fromKnob) {
    const f = Math.min(BAND[1] + 2000, Math.max(BAND[0] - 2000, G.vfo + df));
    if (!fromKnob) knobTurn((f - G.vfo) * 360 / KNOB_HZ);
    G.shift += f - G.vfo;
    G.vfo = f;
    el.knob.setAttribute('aria-valuenow', (f / 1000).toFixed(2));
  }
  // gałka VFO: przeciąganie dookoła środka — 1 obrót = 2 kHz, przy szybkim kręceniu do 5× więcej (jak w radiu)
  const KNOB_HZ = 2000;
  const knob = { a: 0, last: null, t: 0 };
  const knobAngle = e => {
    const r = el.knob.getBoundingClientRect();
    return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2) * 180 / Math.PI;
  };
  function knobTurn(deg) {
    knob.a += deg;
    el.knob.style.setProperty('--a', `${knob.a}deg`);
  }
  // S-metr paskowy na ekranie gry: 12 segmentów — S1–S9 i trzy ponad S9 — z bezwładnością (szybko w górę, wolniej w dół)
  const meter = { f: 0 };
  const METER = ['1', '', '3', '', '5', '', '7', '', '9', '+10', '+20', '+40'];
  // v – odbierany sygnał (0–1); szum pasma też trochę podnosi pasek
  function smeter(v, dt) {
    const floor = 0.015 + 0.05 * S.noise / 100;
    const want = Math.min(1, 0.06 + 0.9 * Math.sqrt(v + floor * (0.6 + 0.8 * Math.random())));
    meter.f += (want - meter.f) * (1 - Math.exp(-dt / (want > meter.f ? 0.06 : 0.35)));
  }
  function foxLoop(now) {
    if (!G || G.state !== 'play' || S.mode !== 'fox') return;
    const dt = Math.min(0.05, (now - G.last) / 1000); // po powrocie do karty gra rusza dalej, bez skoku
    G.last = now;
    // na czas: odliczanie do zera; trening bez czasu: czas gry liczony w górę
    if (G.timed) G.left -= dt; else G.elapsed += dt;
    if (G.left <= 0) return endRound();
    // łopatki: stuknięcie przesuwa o kilkadziesiąt Hz, przytrzymanie przyspiesza do 4 kHz/s
    const dir = (kr[elementOf('R')] ? 1 : 0) - (kr[elementOf('L')] ? 1 : 0);
    G.hold = dir ? G.hold + dt : 0;
    if (dir) foxTune(dir * Math.min(4000, 300 + 2500 * G.hold) * dt);
    const t = ac.currentTime;
    let rx = 0;
    for (const x of G.src) {
      if (!x.osc) continue;
      if (now >= x.nextAt) foxSend(x);
      const on = x.spans.some(([a, b]) => now >= a && now < b);
      // wygładzony poziom do panoramy i S-metra: szybko rośnie, wolno opada (kropek nie da się z niego czytać)
      x.sm += ((on ? 1 : 0) - x.sm) * (1 - Math.exp(-dt / (on ? 0.02 : 0.15)));
      const off = x.freq - G.vfo;
      if (off !== x.setOff || S.tone !== x.setTone) {
        x.osc.frequency.setTargetAtTime(Math.min(4000, Math.max(20, S.tone + off)), t, 0.01);
        x.filt.gain.setTargetAtTime(x.level * pass(off), t, 0.01);
        x.setOff = off;
        x.setTone = S.tone;
      }
      rx += x.sm * x.level * pass(off);
    }
    el.led.classList.toggle('on', rx > 0.08);
    smeter(rx, dt);
    const sec = Math.ceil(G.timed ? G.left : G.elapsed);
    if (sec !== G.shown) { G.shown = sec; renderStats(); }
    foxDraw(now, dt);
    G.raf = requestAnimationFrame(foxLoop);
  }
  function foxCatch(n) {
    if (!G || G.state !== 'play' || S.mode !== 'fox') return;
    const dist = x => Math.abs(x.freq - G.vfo);
    const near = G.src.filter(x => dist(x) <= CATCH).sort((a, b) => dist(a) - dist(b))[0];
    if (!near) return foxFx(pl() ? 'Tu nic nie ma' : 'Nothing here', C.soft, pl() ? 'dostrój się do sygnału' : 'tune in to a signal');
    if (near.caught) return foxFx(pl() ? `${near.code} – już znaleziona` : `${near.code} – already found`, C.soft);
    if (near.kind === 'fox' && near.n === n) {
      near.caught = true;
      G.ok++;
      // 100 pkt + do 50 za dokładne dostrojenie, więcej w dalszych etapach i przy szybszym tempie
      const pts = Math.round((100 + 50 * (1 - dist(near) / CATCH)) * (1 + (G.stage - 1) / 2) * (S.wpm + S.eff) / 40);
      G.score += pts;
      foxFx(`+${pts}`, C.ok, `${near.code}${near.rst ? ' ' + near.rst : ''} ✓`);
      foxQuiet(near);
      renderFoxButtons();
      renderStats();
      if (G.src.every(x => x.kind !== 'fox' || x.caught)) { if (G.timed) G.left += 30; foxStage(); }
      return;
    }
    if (G.timed) G.left = Math.max(0, G.left - 10);
    G.wrong++;
    const why = near.kind === 'twin'
      ? (pl() ? `${near.code}, ale RST ${near.rst} – na kafelku ${near.fox.rst}` : `${near.code}, but RST ${near.rst} – the tile says ${near.fox.rst}`)
      : near.kind === 'fox' ? (pl() ? `To nie ${G.src[n - 1].code}` : `That's not ${G.src[n - 1].code}`)
      : near.kind === 'fake' ? (pl() ? `Obca stacja – to był ${near.code}` : `Another station – that was ${near.code}`)
      : (pl() ? `To ${near.code} woła CQ` : `${near.code} calling CQ`);
    foxFx(G.timed ? '−10 s' : '✗', C.bad, why);
    flash(el.choices, String(n), 'bad');
    renderStats();
  }
  function foxFx(text, color, sub, big) {
    G.fx.push({ text, color, sub, big, t: performance.now() });
  }
  // kafelki: znaki pięciu stacji (znalezione na zielono), od etapu RST_FROM pod znakiem raport
  function renderFoxButtons() {
    el.choices.innerHTML = (G && G.src ? G.src.filter(x => x.kind === 'fox') : []).map(x =>
      `<button type="button" data-ch="${x.n}"${x.caught ? ' class="ok"' : ''}><small>${x.n}${x.caught ? ' ✓' : ''}</small>${x.code}` +
      (x.rst ? `<span class="r">${x.rst}</span>` : '') + '</button>').join('');
  }
  // poziom sygnału w punkcie pasma (0–1): szum + stacje w pobliżu, każdy jako wąski prążek
  function bandLevel(f, live, floor) {
    let v = floor * (0.4 + Math.random() * 1.2);
    for (const x of live) v += x.sm * x.level * Math.exp(-(((f - x.freq) / 45) ** 2));
    return Math.min(1, v);
  }
  function foxDraw(now, dt) {
    const { ctx, W, H } = G, L = 14, R = W - 14, hz = W / SPAN;
    const live = G.src.filter(x => x.osc && Math.abs(x.freq - G.vfo) < SPAN), floor = 0.04 + 0.1 * S.noise / 100;
    ctx.clearRect(0, 0, W, H);

    // wodospad: przesunięcie przy strojeniu, nowe wiersze u góry (ok. 30 px/s)
    const wf = G.wf, wfc = G.wfc, dpr = wf.width / W;
    const sx = -G.shift * hz * dpr + G.shiftRem, dx = Math.round(sx);
    G.shiftRem = sx - dx;
    G.shift = 0;
    G.wfAcc += 30 * dt * dpr;
    const dy = Math.floor(G.wfAcc);
    G.wfAcc -= dy;
    if (dx || dy) {
      wfc.globalCompositeOperation = 'copy';
      wfc.drawImage(wf, dx, dy);
      wfc.globalCompositeOperation = 'source-over';
    }
    if (dy) {
      const d = G.row.data, [r, g, b] = G.rgb;
      for (let i = 0, j = 0; i < wf.width; i++, j += 4) {
        d[j] = r;
        d[j + 1] = g;
        d[j + 2] = b;
        d[j + 3] = 1.5 * 255 * bandLevel(G.vfo + (i / wf.width - 0.5) * SPAN, live, floor);
      }
      for (let y = 0; y < dy; y++) wfc.putImageData(G.row, 0, y);
    }
    ctx.drawImage(wf, 0, FY.bot, W, H - FY.bot);

    // przepustowość filtra i środek (VFO)
    ctx.fillStyle = rgba(C.accent, 0.07);
    ctx.fillRect(W / 2 - 250 * hz, FY.top, 500 * hz, H - FY.top);
    ctx.strokeStyle = rgba(C.accent, 0.6);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(W / 2, FY.top);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // panorama: podziałka co 1 kHz i widmo
    ctx.strokeStyle = rgba(C.ink, 0.25);
    ctx.beginPath();
    for (let k = Math.ceil((G.vfo - SPAN / 2) / 1000) * 1000; k <= G.vfo + SPAN / 2; k += 1000) {
      const x = W / 2 + (k - G.vfo) * hz;
      ctx.moveTo(x, FY.top);
      ctx.lineTo(x, FY.top + 5);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, FY.bot);
    for (let x = 0; x <= W; x += 2) ctx.lineTo(x, FY.bot - bandLevel(G.vfo + (x / W - 0.5) * SPAN, live, floor) * (FY.bot - FY.top - 6));
    ctx.lineTo(W, FY.bot);
    ctx.closePath();
    ctx.fillStyle = rgba(C.accent, 0.18);
    ctx.fill();
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = rgba(C.ink, 0.15);
    ctx.beginPath();
    ctx.moveTo(0, FY.bot + 0.5);
    ctx.lineTo(W, FY.bot + 0.5);
    ctx.stroke();

    // nagłówek: VFO i etap
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `800 20px ${C.mono}`;
    ctx.fillStyle = C.accent;
    const fq = `${kHz(G.vfo)} kHz`, fw = ctx.measureText(fq).width;
    ctx.fillText(fq, L, 18);
    ctx.font = `600 11px ${C.mono}`;
    ctx.fillStyle = C.soft;
    ctx.fillText(`VFO · ${pl() ? 'ETAP' : 'STAGE'} ${G.stage}`, L + fw + 12, 19);

    // S-metr: segmenty S1–S9 bursztynowe, ponad S9 czerwone, podpisy nad paskiem
    const my = FY.meter, mx = L + 14, mw = (R - mx) / METER.length, lit = Math.round(meter.f * METER.length);
    ctx.font = `800 11px ${C.mono}`;
    ctx.fillText('S', L, my + 4);
    ctx.font = `600 8px ${C.mono}`;
    ctx.textAlign = 'center';
    METER.forEach((label, i) => {
      const over = i >= 9;
      ctx.fillStyle = i < lit ? (over ? C.bad : C.accent) : rgba(C.ink, 0.1);
      ctx.fillRect(mx + i * mw + 1, my, mw - 2, 8);
      if (!label) return;
      ctx.fillStyle = over ? rgba(C.bad, 0.8) : C.soft;
      ctx.fillText(label, mx + i * mw + mw / 2, my - 6);
    });

    // pasek pasma: podziałka co 5 kHz, okno panoramy, VFO i znalezione stacje
    const bx = f => L + (f - BAND[0]) / (BAND[1] - BAND[0]) * (R - L), by = FY.band;
    ctx.strokeStyle = rgba(C.ink, 0.3);
    ctx.beginPath();
    ctx.moveTo(L, by);
    ctx.lineTo(R, by);
    for (let k = BAND[0]; k <= BAND[1]; k += 5000) {
      ctx.moveTo(bx(k), by);
      ctx.lineTo(bx(k), by + (k % 10000 ? 3 : 5));
    }
    ctx.stroke();
    ctx.font = `500 9px ${C.mono}`;
    ctx.fillStyle = C.soft;
    ctx.textAlign = 'center';
    for (let k = BAND[0]; k <= BAND[1]; k += 10000) ctx.fillText(String(k / 1000), bx(k), by + 12);
    ctx.fillStyle = rgba(C.accent, 0.3);
    ctx.fillRect(bx(G.vfo - SPAN / 2), by - 3, bx(G.vfo + SPAN / 2) - bx(G.vfo - SPAN / 2), 6);
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.moveTo(bx(G.vfo), by - 2);
    ctx.lineTo(bx(G.vfo) - 5, by - 10);
    ctx.lineTo(bx(G.vfo) + 5, by - 10);
    ctx.closePath();
    ctx.fill();
    ctx.font = `800 11px ${C.mono}`;
    ctx.fillStyle = C.ok;
    for (const x of G.src) if (x.caught) ctx.fillText(String(x.n), bx(x.freq), by - 9);

    // komunikaty: punkty, pomyłki, nowy etap
    G.fx = G.fx.filter(f => now - f.t < 1800);
    const fy = FY.bot + (H - FY.bot) * 0.4;
    for (const f of G.fx) {
      const a = (now - f.t) / 1800, y = fy + (f.big ? -40 : 0) - a * 18;
      ctx.globalAlpha = 1 - a * a;
      ctx.fillStyle = f.color;
      ctx.font = `800 ${f.big ? 34 : 24}px ${C.mono}`;
      ctx.fillText(f.text, W / 2, y);
      if (f.sub) {
        ctx.font = `600 14px ${C.mono}`;
        ctx.fillStyle = C.ink;
        ctx.fillText(f.sub, W / 2, y + (f.big ? 30 : 24));
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- widok ----------
  // brak pola znosimy spokojnie: po wdrożeniu przeglądarka może jeszcze chwilę trzymać stary HTML z nowym skryptem
  const out = (name, html) => { const o = root.querySelector(`[data-cw-out="${name}"]`); if (o) o.innerHTML = html; };
  function renderSettings() {
    root.querySelector('input[name="eff"]').max = S.wpm;
    inputs.forEach(i => { i.value = S[i.name]; });
    out('wpm', `${S.wpm} WPM`);
    out('eff', S.eff < S.wpm ? `${S.eff} WPM` : t('off', 'wył.'));
    out('tone', `${S.tone} Hz`);
    out('vol', `${S.vol}%`);
    out('noise', S.noise ? `${S.noise}%` : t('off', 'wył.'));
    const g = S.letterGap;
    out('letterGap', `${Math.round(g * 1200 / S.wpm)} ms`);
    if (el.gapinfo) el.gapinfo.innerHTML = t(`${g} dits at ${S.wpm} WPM · shorter: fast letters don't merge, longer: a letter doesn't split`,
      `${String(g).replace('.', ',')} ${g % 1 || g < 5 ? 'kropki' : 'kropek'} przy ${S.wpm} WPM · krócej: szybkie znaki się nie sklejają, dłużej: znak się nie rozpada`);
    const ch = KOCH[S.level - 1];
    el.levelnum.textContent = `${S.level} / ${KOCH.length}`;
    el.levelnew.innerHTML = `${t('newest', 'najnowszy')} <b>${ch}</b> <span class="cw-pat">${pattern(ch)}</span>`;
    // wszystkie znaki poziomu, najnowszy wyróżniony
    el.levelset.innerHTML = KOCH.slice(0, S.level).map((c, i) => i === S.level - 1 ? `<b>${c}</b>` : c).join(' ');
  }
  function renderStats() {
    const m = MODES[S.mode];
    el.wpm.textContent = S.eff < S.wpm && S.mode !== 'sea' ? `${S.wpm}/${S.eff}` : S.wpm;
    el.progress.textContent = m.lives ? hearts(G ? G.lives : m.lives) : m.time ? (G ? clock(G.timed === false ? G.elapsed : G.left) : S.mode === 'fox' && !S.foxTimed ? '∞' : clock(m.time)) : `${G ? G.n : 0}/${m.len}`;
    // Symulator pasma: zamiast serii liczba znalezionych stacji
    el.streak.textContent = G ? (S.mode === 'fox' ? G.ok : G.streak) : 0;
    el.score.textContent = G ? G.score : 0;
    el.best.textContent = S.best[S.mode] || 0;
  }
  function renderBest() {
    root.querySelectorAll('[data-cw-best]').forEach(dd => { dd.textContent = S.best[dd.dataset.cwBest] || '—'; });
  }
  const KEYS = {
    typed: t('<kbd>Enter</kbd> confirm · empty <kbd>Enter</kbd> replay / next · <kbd>Esc</kbd> stop',
      '<kbd>Enter</kbd> zatwierdź · pusty <kbd>Enter</kbd> powtórz / dalej · <kbd>Esc</kbd> stop'),
    koch: t('<kbd>Space</kbd> replay · <kbd>Esc</kbd> stop', '<kbd>Spacja</kbd> powtórz · <kbd>Esc</kbd> stop'),
    quick: t('<kbd>1</kbd>–<kbd>4</kbd> pick · <kbd>Space</kbd> replay · <kbd>Esc</kbd> stop',
      '<kbd>1</kbd>–<kbd>4</kbd> wybór · <kbd>Spacja</kbd> powtórz · <kbd>Esc</kbd> stop'),
    fox: t('<kbd>Z</kbd> <kbd>←</kbd> <kbd>X</kbd> <kbd>→</kbd> tune · mouse wheel · <kbd>1</kbd>–<kbd>5</kbd> fox · <kbd>Esc</kbd> stop',
      '<kbd>Z</kbd> <kbd>←</kbd> <kbd>X</kbd> <kbd>→</kbd> strojenie · kółko myszy · <kbd>1</kbd>–<kbd>5</kbd> lis · <kbd>Esc</kbd> stop'),
  };
  const KEY_NAME = { '.': t('dit', 'kropka'), '-': t('dah', 'kreska') };
  const seaKeys = () => `<kbd>Z</kbd> <kbd>←</kbd> ${KEY_NAME[elementOf('L')]} · <kbd>X</kbd> <kbd>→</kbd> ${KEY_NAME[elementOf('R')]} · <kbd>Esc</kbd> stop`;
  function renderMode() {
    const m = MODES[S.mode], busy = active(), sea = S.mode === 'sea', fox = S.mode === 'fox', canvas = sea || fox;
    root.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === S.mode));
    el.form.hidden = !m.typed;
    el.pad.hidden = S.mode !== 'koch';
    // Symulator pasma: znaki stacji są znane dopiero po starcie; przed startem wybór poziomu
    el.choices.hidden = S.mode !== 'quick' && !(fox && G && G.src);
    el.foxlevel.hidden = !fox || busy;
    root.querySelectorAll('[data-foxlevel]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.foxlevel === S.foxLevel));
    el.foxnote.innerHTML = [
      t('Starts at stage 1: three-character calls.', 'Start od etapu 1: znaki trzyznakowe.'),
      t('Starts at stage 3: 4–5 character calls and other stations on the band.', 'Start od etapu 3: znaki 4–5-znakowe i obce stacje na paśmie.'),
      t('Starts at stage 5: longer calls, weak signals and RST reports – the same call also sends a different report.',
        'Start od etapu 5: dłuższe znaki, słabe sygnały i raporty RST – ten sam znak nadaje też z innym raportem.'),
    ][S.foxLevel - 1] + (S.foxTimed ? '' : ' ' + t('Without the clock: practice with no time limit and no penalties – Stop ends it, the score is not a record.',
      'Bez czasu: trening bez limitu i kar – Stop kończy grę, a wynik nie trafia do rekordów.'));
    el.foxtimed.checked = S.foxTimed;
    el.choices.classList.toggle('five', fox);
    el.timer.hidden = S.mode !== 'quick';
    // Symulator pasma: zamiast łopatek na ekranie i podglądu kluczowania — S-metr i gałka VFO
    el.keybox.hidden = !canvas;
    el.keying.parentElement.hidden = fox;
    pads.L.parentElement.hidden = fox;
    el.vfo.hidden = !fox;
    el.field.hidden = !(canvas && busy);
    el.field.setAttribute('aria-label', fox ? 'Band simulator / Symulator pasma' : "Morse Sea / Morze Morse'a");
    el.replay.hidden = canvas;
    el.screen.classList.toggle('tall', canvas);
    el.screen.classList.toggle('fox', fox);
    el.led.textContent = sea ? 'TX' : 'RX';
    el.plabel.innerHTML = m.lives ? t('Lives', 'Życia') : m.time ? t('Time', 'Czas') : t('Round', 'Runda');
    el.slabel.innerHTML = fox ? t('Stations', 'Stacje') : t('Streak', 'Seria');
    el.log.hidden = !m.typed;
    el.levelbox.hidden = m.typed || fox;
    el.lvldown.disabled = busy || S.level <= 2;
    el.lvlup.disabled = busy || S.level >= KOCH.length;
    el.levelrange.disabled = busy;
    el.keys.innerHTML = m.typed ? KEYS.typed : sea ? seaKeys() : KEYS[S.mode];
    if (!busy) el.timerbar.style.width = '100%';
    el.pad.innerHTML = KOCH.slice(0, S.level).map((c, i) =>
      `<button type="button" data-ch="${c}"${i === S.level - 1 ? ' class="new"' : ''}>${c}</button>`).join('');
    renderPaddles();
    if (fox) renderFoxButtons();
  }

  // ---------- zdarzenia ----------
  root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    if (active()) stopRound();
    if (G) clearTimeout(G.timer);
    G = null;
    keyerReset();
    S.mode = b.dataset.mode;
    save();
    el.start.innerHTML = 'Start';
    el.log.innerHTML = '';
    el.choices.innerHTML = '';
    renderMode();
    renderStats();
    idle();
  }));

  // Stop w treningu Symulatora pasma (bez czasu) kończy grę z podsumowaniem; poza tym przerywa rundę
  const stop = () => (S.mode === 'fox' && G.state === 'play' && !G.timed ? endRound() : stopRound());
  el.start.addEventListener('click', () => (active() ? stop() : startRound()));
  el.replay.addEventListener('click', () => {
    if (active() && G.state === 'wait') playItem();
    focusGame();
  });

  el.form.addEventListener('submit', e => {
    e.preventDefault();
    const got = el.input.value.toUpperCase().replace(/\s+/g, '');
    el.input.value = '';
    if (!active()) return startRound();
    if (G.state === 'show' && !got) { clearTimeout(G.timer); return nextItem(); }
    if (!got) return playItem();
    answer(got);
  });

  el.pad.addEventListener('click', e => {
    const b = e.target.closest('button[data-ch]');
    if (!b) return;
    if (!active()) return play(b.dataset.ch);
    answer(b.dataset.ch);
    el.rig.focus({ preventScroll: true });
  });
  el.choices.addEventListener('click', e => {
    const b = e.target.closest('button[data-ch]');
    // Symulator pasma: w grze łapie stację, po grze pozwala posłuchać jej znaku
    if (b && S.mode === 'fox') {
      if (active()) foxCatch(+b.dataset.ch);
      else if (G && G.src && G.src[b.dataset.ch - 1]) play(G.src[b.dataset.ch - 1].code);
      return el.rig.focus({ preventScroll: true });
    }
    if (!b || !active()) return;
    answer(b.dataset.ch);
    el.rig.focus({ preventScroll: true });
  });

  // przyciski klucza na ekranie: osobny palec na każdą łopatkę, więc squeeze działa na dotyku
  Object.entries(pads).forEach(([side, b]) => {
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (err) {}
      paddle(side, true);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => b.addEventListener(n, () => paddle(side, false)));
    b.addEventListener('contextmenu', e => e.preventDefault());
    // kliknięcie to pewny gest do odblokowania dźwięku (iOS)
    b.addEventListener('click', () => audio());
  });
  window.addEventListener('blur', () => { paddle('L', false); paddle('R', false); });
  // zamiana kropki i kreski (lewa ręka); fokus wraca do gry, żeby klawisze klucza od razu działały
  el.swap.addEventListener('change', () => {
    keyerReset();
    S.swap = el.swap.checked;
    save();
    renderPaddles();
    renderMode();
    el.rig.focus({ preventScroll: true });
  });
  // połączenie klucza: wybór źródła (zapamiętany), Połącz / Rozłącz, wyjęcie kabla
  root.querySelectorAll('[data-source]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.source === S.keySource) return;
    if (serial.port) serialClose(t('Disconnected.', 'Rozłączono.'));
    S.keySource = b.dataset.source;
    save();
    renderSource();
  }));
  el.connect.addEventListener('click', () => SOURCES[S.keySource].connect());
  el.disconnect.addEventListener('click', () => SOURCES[S.keySource].disconnect());
  // „?” przy połączeniu klucza: podpowiedź do wybranego źródła
  el.help.addEventListener('click', () => {
    const show = el.sourceinfo.hidden;
    el.sourceinfo.hidden = !show;
    el.help.setAttribute('aria-expanded', show);
  });
  // zwijane sekcje panelu (Klucz, Ustawienia, Rekordy); zwinięte zostają zwinięte po odświeżeniu
  root.querySelectorAll('details[data-fold]').forEach(d => {
    if (S.fold[d.dataset.fold] === false) d.open = false;
    d.addEventListener('toggle', () => {
      S.fold[d.dataset.fold] = d.open;
      save();
    });
  });
  if (hasSerial) {
    navigator.serial.addEventListener('disconnect', e => {
      if (e.target === serial.port) serialClose(t('Disconnected – the cable was unplugged.', 'Rozłączono – wyjęty kabel.'), 'bad');
    });
  }
  window.addEventListener('resize', () => {
    if (!G || G.state !== 'play' || !G.ctx) return;
    fitField();
    if (S.mode === 'fox') foxWaterfall();
  });
  // Symulator pasma: przeciąganie panoramy i kółko myszy stroją VFO
  el.field.addEventListener('pointerdown', e => {
    if (S.mode !== 'fox' || !G || G.state !== 'play') return;
    e.preventDefault();
    try { el.field.setPointerCapture(e.pointerId); } catch (err) {}
    G.drag = e.clientX;
  });
  el.field.addEventListener('pointermove', e => {
    if (S.mode !== 'fox' || !G || G.drag == null) return;
    foxTune(-(e.clientX - G.drag) * SPAN / G.W);
    G.drag = e.clientX;
  });
  ['pointerup', 'pointercancel'].forEach(n => el.field.addEventListener(n, () => { if (G) G.drag = null; }));
  el.field.addEventListener('wheel', e => {
    if (S.mode !== 'fox' || !G || G.state !== 'play') return;
    e.preventDefault();
    foxTune(-Math.sign(e.deltaY || e.deltaX) * (e.shiftKey ? 10 : 50));
  }, { passive: false });
  // poziom Symulatora pasma (etap startowy), zapamiętany; w trakcie gry ukryty
  root.querySelectorAll('[data-foxlevel]').forEach(b => b.addEventListener('click', () => {
    if (active()) return;
    S.foxLevel = +b.dataset.foxlevel;
    save();
    renderMode();
  }));
  // gra na czas albo trening bez czasu (zapamiętane)
  el.foxtimed.addEventListener('change', () => {
    S.foxTimed = el.foxtimed.checked;
    save();
    // po skończonej grze przełącznik przygotowuje nową — znika podsumowanie poprzedniej
    if (G && !active()) {
      G = null;
      el.start.innerHTML = 'Start';
      idle();
    }
    renderMode();
    renderStats();
  });
  // gałka VFO: kręcenie palcem / myszą dookoła środka, kółko myszy nad gałką (50 Hz, z Shift 10 Hz)
  const foxPlaying = () => S.mode === 'fox' && G && G.state === 'play';
  el.knob.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { el.knob.setPointerCapture(e.pointerId); } catch (err) {}
    knob.last = knobAngle(e);
    knob.t = performance.now();
    el.knob.classList.add('on');
    el.knob.focus({ preventScroll: true });
  });
  el.knob.addEventListener('pointermove', e => {
    if (knob.last == null) return;
    const a = knobAngle(e), now = performance.now();
    let d = a - knob.last;
    if (d > 180) d -= 360; else if (d < -180) d += 360;
    // szybciej niż 1 obrót/s → większy krok strojenia (do 5×)
    const boost = Math.min(5, Math.max(1, Math.abs(d) / Math.max(8, now - knob.t) * 1000 / 360));
    knob.last = a;
    knob.t = now;
    knobTurn(d);
    if (foxPlaying()) foxTune(d / 360 * KNOB_HZ * boost, true);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => el.knob.addEventListener(n, () => {
    knob.last = null;
    el.knob.classList.remove('on');
  }));
  el.knob.addEventListener('wheel', e => {
    e.preventDefault();
    const d = -Math.sign(e.deltaY || e.deltaX) * (e.shiftKey ? 1.8 : 9);
    knobTurn(d);
    if (foxPlaying()) foxTune(d / 360 * KNOB_HZ, true);
  }, { passive: false });

  function setLevel(d) {
    if (active()) return;
    S.level = Math.min(KOCH.length, Math.max(2, S.level + d));
    save();
    renderMode();
    renderSettings();
    play(KOCH[S.level - 1]);
  }
  el.lvlup.addEventListener('click', () => setLevel(1));
  el.lvldown.addEventListener('click', () => setLevel(-1));
  // suwak poziomu: klawiatura znaków zmienia się na bieżąco, najnowszy znak gra po puszczeniu suwaka
  el.levelrange.addEventListener('change', () => play(KOCH[S.level - 1]));

  root.querySelector('.cw-settings').addEventListener('input', e => {
    const i = e.target;
    if (!i.name) return;
    const farnsworthOff = S.eff >= S.wpm;
    S[i.name] = +i.value;
    if (i.name === 'wpm' && farnsworthOff) S.eff = S.wpm;
    S.eff = Math.min(S.eff, S.wpm);
    if (master) master.gain.value = S.vol / 100;
    if (noise) {
      noise.bp.frequency.value = S.tone;
      noise.g.gain.setTargetAtTime(noiseGain(), ac.currentTime, 0.05);
    }
    if (i.name === 'noise') {
      setNoise(S.noise > 0);
      // poza rundą: krótki odsłuch szumu, żeby łatwo dobrać poziom
      clearTimeout(noisePreview);
      if (!active()) noisePreview = setTimeout(() => { if (!active()) setNoise(false); }, 1500);
    }
    if (i.name === 'level') renderMode();
    save();
    renderSettings();
    renderStats();
  });

  // „Spróbuj +2 WPM” w podsumowaniu rundy
  root.addEventListener('click', e => {
    if (!e.target.closest('[data-cw-faster]')) return;
    const farnsworthOff = S.eff >= S.wpm;
    S.wpm = Math.min(45, S.wpm + 2);
    if (farnsworthOff) S.eff = S.wpm;
    save();
    renderSettings();
    startRound();
  });

  document.addEventListener('keydown', e => {
    // Morze Morse'a: klawisze klucza (także przed startem, do ćwiczeń), Symulator pasma: te same klawisze stroją VFO;
    // strzałki na suwakach zostają suwakom.
    // Sprawdzane przed modyfikatorami, bo lewy/prawy Ctrl też jest łopatką (ESP32 jako klawiatura Bluetooth).
    const side = (S.mode === 'sea' || S.mode === 'fox') && !e.metaKey && !e.altKey && PADDLE[e.code];
    if (side && !e.target.matches('input, textarea, select')) {
      e.preventDefault();
      if (!e.repeat) paddle(side, true);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && active()) return stop();
    if (e.target.matches('input[type="text"], textarea, select')) return;
    if (!active()) {
      if (e.key === 'Enter' && !e.target.closest('button, a')) { e.preventDefault(); startRound(); }
      return;
    }
    // tryby z wpisywaniem: litera wpisana poza polem trafia do pola
    if (MODES[S.mode].typed) {
      if (e.key.length === 1) el.input.focus();
      return;
    }
    if (S.mode === 'sea') return;
    if (S.mode === 'fox') {
      const n = '12345'.indexOf(e.key) + 1;
      if (n) {
        e.preventDefault();
        foxCatch(n);
      }
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      if (G.state === 'wait') playItem();
      return;
    }
    if (S.mode === 'quick') {
      // 1–4 wybiera odpowiedź; litera też, o ile jest wśród odpowiedzi (cyfry zostają dla numerów)
      const i = '1234'.indexOf(e.key), ch = i >= 0 ? G.choices[i] : e.key.toUpperCase();
      if (G.choices && G.choices.includes(ch) && (i >= 0 || !/\d/.test(ch))) {
        e.preventDefault();
        answer(ch);
      }
      return;
    }
    const ch = e.key.length === 1 ? e.key.toUpperCase() : '';
    if (MORSE[ch]) {
      e.preventDefault();
      answer(ch);
    }
  });
  document.addEventListener('keyup', e => {
    const side = PADDLE[e.code];
    if (side && kr[elementOf(side)]) {
      e.preventDefault();
      paddle(side, false);
    }
  });

  // Ściągawka: alfabet Morse'a, kliknięcie odtwarza znak
  const chart = document.querySelector('[data-cw-chart]');
  if (chart) {
    chart.innerHTML = [...CHART].map(c =>
      `<button type="button" data-ch="${c}"><b>${c}</b><span>${pattern(c)}</span></button>`).join('');
    chart.addEventListener('click', e => {
      const b = e.target.closest('button[data-ch]');
      if (b && !active()) play(b.dataset.ch);
    });
  }

  const version = document.querySelector('[data-cw-version]');
  if (version) version.textContent = 'v' + VERSION;

  renderSettings();
  renderPaddles();
  renderSource();
  // bez Web Serial komunikat zostaje widoczny przy nieaktywnym „Połącz”, nie tylko pod „?”
  if (hasSerial) keyStatus(t('Not connected.', 'Nie połączono.'));
  else keyStatus(t('Needs Chrome or Edge on a computer.', 'Wymaga Chrome lub Edge na komputerze.'), 'bad');
  renderMode();
  renderStats();
  renderBest();
  idle();
})();
