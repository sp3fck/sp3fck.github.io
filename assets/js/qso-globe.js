/* ==========================================================
   QSO Globe — animowany glob w prawej kolumnie hero (index.html)
   Wymaga: d3 v7 (d3-geo) + dane QSO_WORLD (data/qso-globe-world.js)
   ========================================================== */
(function () {
  // ---------- KONFIGURACJA: edytuj tutaj ----------
  const CONFIG = {
    // QTH (lon, lat) — środek kwadratu JO72SG
    qth: { label: 'SP3FCK', lon: 15.54, lat: 52.27 },

    // Łączności (lon, lat). Kolejność = kolejność animacji.
    // Wybrane raz z logu QRZ (28.10.2026): najdalsze z każdego kontynentu; same się nie aktualizują.
    qsos: [
      { label: 'JE1LFX', lon: 139.54, lat: 35.48 },  // Japan
      { label: 'LR9W', lon: -67.46, lat: -45.85 },   // Argentina
      { label: 'N2IC', lon: -108.04, lat: 32.81 },   // United States
      { label: 'D2UY', lon: 12.21, lat: -5.56 },     // Angola
      { label: 'RI1FJZ', lon: 47.71, lat: 80.77 },   // Franz Josef Land
      { label: 'VK2SR', lon: 149.12, lat: -35.48 },  // Australia
      { label: 'D4D', lon: -24.96, lat: 16.85 },     // Cape Verde
      { label: 'B1Z', lon: 116.71, lat: 39.81 },     // China
      { label: 'CU3HN', lon: -27.21, lat: 38.65 },   // Azores
      { label: 'ZF2KT', lon: -81.21, lat: 19.31 },   // Cayman Islands
      { label: 'J51A', lon: -15.88, lat: 11.31 },    // Guinea-Bissau
      { label: 'A41CK', lon: 58.38, lat: 23.56 }     // Oman
    ],

    colors: ['#2dd4bf', '#a3e635', '#fbbf24', '#f87171', '#818cf8'],
    globeX: 0.5,         // pozycja środka globu (0..1 szerokości canvasu); na wąskich ekranach = 0.5
    globeY: 0.5,
    globeScale: 0.37,    // promień jako część min(szer, wys); zostaw miejsce na poświatę i łuki
    viewTilt: 14,        // o ile stopni QTH jest „nad” środkiem widoku
    follow: 0.6,         // 0 = kamera stoi na QTH, 1 = kamera goni czoło pathu
    drawMs: 2600,        // bazowy czas rysowania (dłuższe pathy rysują się dłużej)
    drawMsPerHalfGlobe: 2400,
    holdMs: 1100,        // pauza po dotarciu do korespondenta
    returnMs: 1700,      // powrót kamery do QTH
    keepTrails: true,    // zostawiaj wygaszone, wcześniejsze pathy
    showLabels: true
  };
  // ------------------------------------------------

  const canvas = document.querySelector('canvas[data-qso-globe]');
  if (!canvas || !window.d3 || typeof QSO_WORLD === 'undefined') return;
  const ctx = canvas.getContext('2d');
  const d3 = window.d3;

  const projection = d3.geoOrthographic().clipAngle(90).precision(0.4);
  const path = d3.geoPath(projection, ctx);
  const graticule = d3.geoGraticule10();
  const SPHERE = { type: 'Sphere' };
  const qthLL = [CONFIG.qth.lon, CONFIG.qth.lat];

  const qsos = CONFIG.qsos.map((q, i) => {
    const ll = [q.lon, q.lat];
    const dist = d3.geoDistance(qthLL, ll); // 0..π
    return {
      ...q, ll, dist,
      color: CONFIG.colors[i % CONFIG.colors.length],
      interp: d3.geoInterpolate(qthLL, ll),
      lift: 0.05 + 0.25 * (dist / Math.PI),
      drawMs: CONFIG.drawMs + CONFIG.drawMsPerHalfGlobe * (dist / Math.PI)
    };
  });

  let W = 0, H = 0, R = 0, CX = 0, CY = 0, rotFn = null;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W, H) * CONFIG.globeScale;
    CX = W * (W < 760 ? 0.5 : CONFIG.globeX);
    CY = H * CONFIG.globeY;
    projection.scale(R).translate([CX, CY]);
  }

  function setCenter(c) {
    projection.rotate([-c[0], -(c[1] - CONFIG.viewTilt)]);
    rotFn = d3.geoRotation(projection.rotate());
  }

  // Rzut punktu uniesionego nad powierzchnię (h = ułamek promienia)
  const RAD = Math.PI / 180;
  function project3(ll, h) {
    const p = rotFn(ll);
    const l = p[0] * RAD, f = p[1] * RAD;
    const k = 1 + h;
    const x = Math.cos(f) * Math.sin(l) * k;
    const y = Math.sin(f) * k;
    const z = Math.cos(f) * Math.cos(l);
    const visible = z > 0 || x * x + y * y > 1;
    return [CX + x * R, CY - y * R, visible];
  }

  function drawGlobe() {
    // poświata atmosfery
    const g = ctx.createRadialGradient(CX, CY, R * 0.85, CX, CY, R * 1.35);
    g.addColorStop(0, 'rgba(90,170,220,0.28)');
    g.addColorStop(1, 'rgba(90,170,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(CX, CY, R * 1.35, 0, Math.PI * 2); ctx.fill();

    // ocean
    const o = ctx.createRadialGradient(CX - R * 0.35, CY - R * 0.4, R * 0.1, CX, CY, R);
    o.addColorStop(0, '#1d3a4f');
    o.addColorStop(1, '#08131c');
    ctx.fillStyle = o;
    ctx.beginPath(); path(SPHERE); ctx.fill();

    ctx.beginPath(); path(graticule);
    ctx.strokeStyle = 'rgba(150,190,220,0.08)'; ctx.lineWidth = 0.6; ctx.stroke();

    ctx.beginPath(); path(QSO_WORLD.land);
    ctx.fillStyle = '#2c3e4d'; ctx.fill();
    ctx.strokeStyle = 'rgba(160,205,235,0.45)'; ctx.lineWidth = 0.7; ctx.stroke();

    ctx.beginPath(); path(QSO_WORLD.borders);
    ctx.strokeStyle = 'rgba(160,200,230,0.18)'; ctx.lineWidth = 0.5; ctx.stroke();

    ctx.beginPath(); path(SPHERE);
    ctx.strokeStyle = 'rgba(130,200,235,0.45)'; ctx.lineWidth = 1; ctx.stroke();
  }

  function drawArc(q, tEnd, alpha, active) {
    if (tEnd <= 0) return;
    const N = Math.ceil(12 + 110 * tEnd * (q.dist / Math.PI));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = q.color;
    ctx.lineWidth = active ? 2.2 : 1.2;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (active) { ctx.shadowColor = q.color; ctx.shadowBlur = 12; }
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= N; i++) {
      const s = (tEnd * i) / N;
      const [x, y, v] = project3(q.interp(s), q.lift * Math.sin(Math.PI * s));
      if (v) { pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false;
    }
    ctx.stroke();
    ctx.restore();
  }

  function dot(ll, h, color, r, alpha, glow) {
    const [x, y, v] = project3(ll, h);
    if (!v) return null;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return [x, y];
  }

  function ring(xy, color, r, alpha) {
    if (!xy) return;
    ctx.save();
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(xy[0], xy[1], r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function label(xy, text, color, alpha) {
    if (!xy || !CONFIG.showLabels) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '600 12px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
    ctx.fillText(text, xy[0] + 8, xy[1] - 8);
    ctx.restore();
  }

  // ---------- maszyna stanów animacji ----------
  const ease = d3.easeCubicInOut;
  let idx = 0, phase = 'draw', phaseStart = 0, center = qthLL, from = qthLL, done = [], fading = false;

  function step(now) {
    const q = qsos[idx];
    const el = now - phaseStart;
    let t = 0, trailFade = 1;

    if (phase === 'draw') {
      t = Math.min(1, el / q.drawMs);
      const te = ease(t);
      center = d3.geoInterpolate(qthLL, q.interp(te))(CONFIG.follow);
      if (t >= 1) { phase = 'hold'; phaseStart = now; }
      render(q, te, now, 1);
    } else if (phase === 'hold') {
      t = Math.min(1, el / CONFIG.holdMs);
      render(q, 1, now, 1, t);
      if (t >= 1) {
        if (CONFIG.keepTrails) done.push(q);
        idx++;
        if (idx >= qsos.length) { idx = 0; fading = true; }
        from = center; phase = 'return'; phaseStart = now;
      }
    } else if (phase === 'return') {
      t = Math.min(1, el / CONFIG.returnMs);
      center = d3.geoInterpolate(from, qthLL)(ease(t));
      if (fading) trailFade = 1 - t;
      render(null, 0, now, trailFade);
      if (t >= 1) {
        if (fading) { done = []; fading = false; }
        phase = 'draw'; phaseStart = now;
      }
    }
  }

  function render(active, te, now, trailFade, holdT) {
    setCenter(center);
    ctx.clearRect(0, 0, W, H);
    drawGlobe();

    for (const d of done) {
      drawArc(d, 1, 0.38 * trailFade, false);
      dot(d.ll, 0, d.color, 2.6, 0.8 * trailFade, 0);
    }

    // QTH z pulsującym pierścieniem
    const pulse = (now % 2000) / 2000;
    const home = dot(qthLL, 0, '#ffffff', 3.2, 1, 10);
    ring(home, '#fbbf24', 4 + pulse * 14, 1 - pulse);
    label(home, CONFIG.qth.label, '#ffffff', 0.9);

    if (active) {
      drawArc(active, te, 1, true);
      const head = active.interp(te);
      const hp = dot(head, active.lift * Math.sin(Math.PI * te), '#ffffff', 2.6, 1, 16);
      if (holdT !== undefined) {
        const tip = dot(active.ll, 0, active.color, 3.6, 1, 12);
        ring(tip, active.color, 4 + holdT * 18, 1 - holdT);
        label(tip, active.label, active.color, Math.min(1, holdT * 4));
      } else if (te > 0.85) {
        label(hp, active.label, active.color, (te - 0.85) / 0.15);
      }
    }
  }

  // ---------- pętla, oszczędzanie CPU, reduced motion ----------
  let running = false, visible = true, raf = 0, pausedAt = 0;
  function loop(now) {
    if (!phaseStart) phaseStart = now;
    step(now);
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame((now) => {
      if (pausedAt && phaseStart) phaseStart += now - pausedAt; // wznów od miejsca pauzy
      loop(now);
    });
  }
  function stop() {
    if (!running) return;
    running = false; pausedAt = performance.now();
    cancelAnimationFrame(raf);
  }
  function update() { (visible && !document.hidden) ? start() : stop(); }

  resize();
  new ResizeObserver(() => { resize(); if (!running) staticFrame(); }).observe(canvas);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  function staticFrame() {
    if (!reduce.matches) return;
    done = qsos.slice(); center = qthLL;
    render(null, 0, 0, 1);
  }

  if (reduce.matches) {
    staticFrame();
  } else {
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; update(); }).observe(canvas);
    document.addEventListener('visibilitychange', update);
    update();
  }
})();
