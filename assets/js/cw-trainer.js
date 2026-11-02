/* Trener CW — prosta gra do nauki odbioru Morse'a (Web Audio, bez bibliotek).
   Tryby: Koch (pojedyncze znaki; kolejny odblokowuje runda z wynikiem ≥ 90%), znaki wywoławcze, skróty i kody Q.
   Ustawienia, poziom Kocha i rekordy są w localStorage (sp3fck-cw). */
(function () {
  // Wersja trenera (semver), widoczna pod alfabetem — przy każdej zmianie gry podbij
  const VERSION = '1.0.0';
  const root = document.querySelector('[data-cw-root]');
  if (!root) return;
  const t = (en, pl) => `<span lang="en">${en}</span><span lang="pl">${pl}</span>`;
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];

  const MORSE = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
    K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
    U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', '/': '-..-.', '=': '-...-',
  };
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

  // len – liczba pozycji w rundzie; pause – przerwa po dobrej / złej odpowiedzi (ms)
  const MODES = {
    koch: { len: 30, typed: false, pause: [450, 1300] },
    calls: { len: 20, typed: true, pause: [900, 2000] },
    abbr: { len: 20, typed: true, pause: [1700, 2600] },
  };

  // Kropki i kreski rysowane w CSS — znaki „·” i „−” wyglądają różnie (i często słabo) w różnych fontach
  const pattern = (text, prosign) => {
    const codes = [...text].map(c => MORSE[c]).filter(Boolean);
    const groups = prosign ? [codes.join('')] : codes;
    return `<span class="cw-code" role="img" aria-label="${groups.join(' ')}">` +
      groups.map(g => `<span>${[...g].map(s => s === '.' ? '<i></i>' : '<i class="h"></i>').join('')}</span>`).join('') +
      '</span>';
  };
  const diff = (want, got) => [...want].map((c, i) => got[i] === c ? c : `<span class="x">${c}</span>`).join('');

  // ---------- ustawienia ----------
  const KEY = 'sp3fck-cw';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  const S = Object.assign({ mode: 'koch', wpm: 20, eff: 20, tone: 600, vol: 70, noise: 0, level: 2, best: {} }, saved);
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
  if (!MODES[S.mode]) S.mode = 'koch';
  if (!S.best || typeof S.best !== 'object') S.best = {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  const el = {};
  root.querySelectorAll('[data-cw]').forEach(n => { el[n.dataset.cw] = n; });
  const inputs = root.querySelectorAll('.cw-settings input[name]');

  // ---------- dźwięk ----------
  let ac = null, master = null, voice = null, noise = null, ledTimer = 0, keepAlive = null;
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
  // Odtwarza tekst (spacja = przerwa między słowami); zwraca czas do końca ostatniego elementu w sekundach.
  function play(text, prosign) {
    audio();
    hush();
    const { dit, charGap, wordGap } = gaps();
    const osc = ac.createOscillator(), env = ac.createGain();
    osc.frequency.value = S.tone;
    env.gain.value = 0;
    osc.connect(env).connect(master);
    const t0 = ac.currentTime + 0.05;
    let at = t0, end = t0;
    for (const ch of text) {
      if (ch === ' ') { at += wordGap - charGap; continue; }
      [...(MORSE[ch] || '')].forEach((sym, i) => {
        if (i) at += dit;
        const len = sym === '.' ? dit : 3 * dit;
        // miękkie zbocza (~5 ms), bez trzasków kluczowania
        env.gain.setTargetAtTime(0.5, at, 0.0015);
        env.gain.setTargetAtTime(0, at + len, 0.0015);
        at += len;
        end = at;
      });
      at += prosign ? dit : charGap;
    }
    osc.start(t0);
    osc.stop(end + 0.05);
    voice = { osc, env };
    osc.onended = () => { if (voice && voice.osc === osc) voice = null; };
    const dur = end - ac.currentTime;
    led(dur);
    return dur;
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
  function draw() {
    if (S.mode === 'calls') return { text: callsign() };
    if (S.mode === 'abbr') return pick(ABBR);
    const set = KOCH.slice(0, S.level);
    // najnowszy znak pada częściej — to jego trzeba utrwalić
    return { text: Math.random() < 0.25 ? set[set.length - 1] : pick(set) };
  }

  // ---------- gra ----------
  let G = null; // bieżąca runda; state: wait (czeka na odpowiedź) | show (wynik pozycji) | done (koniec rundy)
  const active = () => G && G.state !== 'done';

  function screen(glyph, pat, msg, cls) {
    el.glyph.innerHTML = glyph;
    el.glyph.className = 'cw-glyph' + (cls ? ' ' + cls : '');
    el.pattern.innerHTML = pat;
    el.msg.innerHTML = msg;
  }
  function idle() {
    screen('CW', pattern('CW'), MODES[S.mode].typed
      ? t('Press Start, type what you hear and confirm with Enter.', 'Naciśnij Start, wpisz to, co słyszysz, i zatwierdź Enterem.')
      : t('Press Start and hit the key of each character you hear.', 'Naciśnij Start i wciskaj klawisz każdego usłyszanego znaku.'));
  }
  const focusGame = () => (MODES[S.mode].typed ? el.input : el.rig).focus({ preventScroll: true });

  function startRound() {
    audio();
    if (G) clearTimeout(G.timer);
    G = { n: 0, ok: 0, score: 0, streak: 0, missed: {}, item: null, state: 'wait', timer: 0, heardAt: 0 };
    el.log.innerHTML = '';
    el.start.innerHTML = 'Stop';
    setNoise(S.noise > 0);
    renderMode();
    focusGame();
    nextItem();
  }
  function stopRound() {
    clearTimeout(G.timer);
    hush();
    setNoise(false);
    G = null;
    el.start.innerHTML = 'Start';
    renderMode();
    renderStats();
    idle();
  }
  function nextItem() {
    const m = MODES[S.mode];
    if (G.n >= m.len) return endRound();
    let item;
    do item = draw(); while (m.typed && G.item && item.text === G.item.text);
    G.item = item;
    G.n++;
    G.state = 'wait';
    screen('?', '', t('Listen…', 'Słuchaj…'));
    renderStats();
    playItem();
  }
  function playItem() {
    // czas reakcji liczony od końca dźwięku
    G.heardAt = performance.now() + play(G.item.text, G.item.p) * 1000;
  }
  function answer(got) {
    if (!G || G.state !== 'wait') return;
    G.state = 'show';
    hush();
    const m = MODES[S.mode], it = G.item, good = got === it.text;
    let pts = 0;
    if (good) {
      G.ok++;
      G.streak++;
      // Koch: 10 pkt + premia do 10 pkt za szybką odpowiedź; pozostałe tryby: 10 pkt za znak
      const base = m.typed ? 10 * it.text.length
        : 10 + Math.max(0, 10 - Math.floor(Math.max(0, performance.now() - G.heardAt) / 150));
      const speed = m.typed ? (S.wpm + S.eff) / 2 : S.wpm;
      pts = Math.round(base * (1 + Math.min(G.streak - 1, 10) / 10) * speed / 20);
      G.score += pts;
    } else {
      G.streak = 0;
      G.missed[it.text] = (G.missed[it.text] || 0) + 1;
    }
    let msg = good
      ? `+${pts}` + (G.streak > 1 ? ` · ${t('streak', 'seria')} ×${G.streak}` : '')
      : t('Your copy: ', 'Twój odbiór: ') + `<b>${esc(got) || '—'}</b>`;
    if (it.en) msg += `<span class="cw-mean">${t(it.en, it.pl)}</span>`;
    screen(good ? it.text : diff(it.text, got), pattern(it.text, it.p), msg, good ? 'ok' : 'bad');
    if (m.typed) {
      log(it, got, good);
    } else {
      flash(it.text, 'ok');
      if (!good) flash(got, 'bad');
    }
    renderStats();
    G.timer = setTimeout(nextItem, m.pause[good ? 0 : 1]);
  }
  function endRound() {
    G.state = 'done';
    setNoise(false);
    const m = MODES[S.mode], acc = Math.round(100 * G.ok / m.len);
    const record = G.score > (S.best[S.mode] || 0);
    if (record) S.best[S.mode] = G.score;
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
      const missed = Object.entries(G.missed).sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (missed.length) {
        msg += `<span class="cw-mean">${t('Missed:', 'Pomyłki:')} ${missed.map(([c, n]) => `<b>${c}</b>×${n}`).join(' ')}</span>`;
      }
    } else if (acc >= 90 && S.wpm < 45) {
      msg = t('Solid copy!', 'Pewny odbiór!') +
        ` <button type="button" class="btn ghost cw-mini" data-cw-faster>${t('Try', 'Spróbuj')} ${S.wpm + 2} WPM</button>`;
    } else if (acc < 60) {
      msg = t('Too fast? Lower the speed or the effective (Farnsworth) speed.', 'Za szybko? Zmniejsz tempo albo tempo efektywne (Farnsworth).');
    }
    save();
    screen(`${acc}%`, `${t('Score', 'Wynik')} ${G.score}` + (record ? ' · ' + t('new record!', 'nowy rekord!') : ''), msg, record ? 'ok' : '');
    el.start.innerHTML = t('Again', 'Jeszcze raz');
    renderMode();
    renderStats();
    renderBest();
    renderSettings();
  }
  function log(it, got, good) {
    const li = document.createElement('li');
    li.className = good ? 'ok' : 'bad';
    li.innerHTML = `<span class="n">${G.n}</span><b>${it.text}</b><span>${good ? '✓' : esc(got) || '—'}</span>` +
      (it.en ? `<span class="m">${t(it.en, it.pl)}</span>` : '');
    el.log.prepend(li);
  }
  function flash(ch, cls) {
    const b = [...el.pad.children].find(x => x.dataset.ch === ch);
    if (!b) return;
    b.classList.add(cls);
    setTimeout(() => b.classList.remove(cls), 600);
  }

  // ---------- widok ----------
  const out = (name, html) => { root.querySelector(`[data-cw-out="${name}"]`).innerHTML = html; };
  function renderSettings() {
    root.querySelector('input[name="eff"]').max = S.wpm;
    inputs.forEach(i => { i.value = S[i.name]; });
    out('wpm', `${S.wpm} WPM`);
    out('eff', S.eff < S.wpm ? `${S.eff} WPM` : t('off', 'wył.'));
    out('tone', `${S.tone} Hz`);
    out('vol', `${S.vol}%`);
    out('noise', S.noise ? `${S.noise}%` : t('off', 'wył.'));
    const ch = KOCH[S.level - 1];
    el.levelnum.textContent = `${S.level} / ${KOCH.length}`;
    el.levelnew.innerHTML = `${t('newest', 'najnowszy')} <b>${ch}</b> <span class="cw-pat">${pattern(ch)}</span>`;
  }
  function renderStats() {
    el.wpm.textContent = S.eff < S.wpm ? `${S.wpm}/${S.eff}` : S.wpm;
    el.progress.textContent = `${G ? G.n : 0}/${MODES[S.mode].len}`;
    el.streak.textContent = G ? G.streak : 0;
    el.score.textContent = G ? G.score : 0;
    el.best.textContent = S.best[S.mode] || 0;
  }
  function renderBest() {
    root.querySelectorAll('[data-cw-best]').forEach(dd => { dd.textContent = S.best[dd.dataset.cwBest] || '—'; });
  }
  function renderMode() {
    const m = MODES[S.mode], busy = active();
    root.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === S.mode));
    el.form.hidden = !m.typed;
    el.pad.hidden = m.typed;
    el.log.hidden = !m.typed;
    el.levelbox.hidden = m.typed;
    el.lvldown.disabled = busy || S.level <= 2;
    el.lvlup.disabled = busy || S.level >= KOCH.length;
    el.levelrange.disabled = busy;
    el.keys.innerHTML = m.typed
      ? t('<kbd>Enter</kbd> confirm · empty <kbd>Enter</kbd> replay / next · <kbd>Esc</kbd> stop',
          '<kbd>Enter</kbd> zatwierdź · pusty <kbd>Enter</kbd> powtórz / dalej · <kbd>Esc</kbd> stop')
      : t('<kbd>Space</kbd> replay · <kbd>Esc</kbd> stop', '<kbd>Spacja</kbd> powtórz · <kbd>Esc</kbd> stop');
    el.pad.innerHTML = KOCH.slice(0, S.level).map((c, i) =>
      `<button type="button" data-ch="${c}"${i === S.level - 1 ? ' class="new"' : ''}>${c}</button>`).join('');
  }

  // ---------- zdarzenia ----------
  root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    if (active()) stopRound();
    if (G) clearTimeout(G.timer);
    G = null;
    S.mode = b.dataset.mode;
    save();
    el.start.innerHTML = 'Start';
    el.log.innerHTML = '';
    renderMode();
    renderStats();
    idle();
  }));

  el.start.addEventListener('click', () => (active() ? stopRound() : startRound()));
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
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && active()) return stopRound();
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
    if (e.key === ' ') {
      e.preventDefault();
      if (G.state === 'wait') playItem();
      return;
    }
    const ch = e.key.length === 1 ? e.key.toUpperCase() : '';
    if (MORSE[ch]) {
      e.preventDefault();
      answer(ch);
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
  renderMode();
  renderStats();
  renderBest();
  idle();
})();
