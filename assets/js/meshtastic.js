/* Strona Meshtastic: kafelek statusu, lista bramek, wykres SNR i tabela pakietów.
   Dane: window.MESH_DATA z data/mesh.latest.js (workflow mesh-sync.yml, co ok. 30 min, źródło: lorastats.pl).
   Czas w danych jest w UTC; na stronie pokazujemy czas lokalny przeglądarki. */
(function () {
  const D = window.MESH_DATA;
  const root = document.getElementById('mesh');
  if (!root) return;
  const $ = id => document.getElementById(id);
  const t = (en, pl) => `<span lang="en">${en}</span><span lang="pl">${pl}</span>`;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  if (!D || !D.node) {
    $('mesh-state').innerHTML = t('No data yet', 'Brak danych');
    return;
  }

  const ACTIVE_MS = 6 * 3600e3; // node nadaje co kilka godzin
  const DAY = 864e5;
  const reports = (D.reports || []).map(r => ({ ...r, ms: Date.parse(r.t) })).filter(r => !Number.isNaN(r.ms));
  const gwName = id => { const g = (D.gateways || {})[id]; return g ? esc(g.longName || g.shortName || id) : esc(id); };
  const num = (v, digits = 1) => {
    const s = Math.abs(v).toFixed(digits), sign = v < 0 ? '−' : '';
    return t(sign + s, sign + s.replace('.', ','));
  };
  const snr = v => v == null ? '—' : `${num(v, 2)} dB`;
  const hops = h => h == null ? '—' : h === 0 ? t('direct', 'bezpośrednio') : String(h);
  const TYPES = { position: ['position', 'pozycja'], nodeinfo: ['node info', 'dane noda'], text: ['message', 'wiadomość'], telemetry: ['telemetry', 'telemetria'] };
  const type = k => TYPES[k] ? t(...TYPES[k]) : esc(k || '—');
  const stamp = ms => {
    const d = new Date(ms), o = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    return t(d.toLocaleString('en-GB', o), d.toLocaleString('pl-PL', o));
  };
  function ago(ms) {
    const m = Math.max(0, Math.round((Date.now() - ms) / 60e3));
    if (m < 1) return t('just now', 'przed chwilą');
    if (m < 60) return t(`${m} min ago`, `${m} min temu`);
    const h = Math.floor(m / 60), r = m % 60;
    if (h < 48) return t(`${h} h ${r} min ago`, `${h} h ${r} min temu`);
    const d = Math.floor(h / 24);
    return t(`${d} days ago`, `${d} dni temu`);
  }

  // ---- kafelek statusu
  const last = reports[reports.length - 1];
  const seen = Math.max(Date.parse(D.node.lastSeen) || 0, last ? last.ms : 0);
  function renderStatus() {
    const active = seen && Date.now() - seen < ACTIVE_MS;
    root.classList.toggle('is-active', !!active);
    $('mesh-state').innerHTML = active ? t('Active', 'Aktywny') : t('Quiet', 'Cisza');
    $('mesh-seen').innerHTML = seen ? `${t('Last heard', 'Ostatnio słyszany')} ${ago(seen)}` : t('Not heard yet', 'Jeszcze nie słyszany');
    $('mesh-seen-at').innerHTML = seen ? stamp(seen) : '';
  }
  renderStatus();
  setInterval(renderStatus, 60e3);

  $('mesh-name').textContent = D.node.longName || D.node.id;
  $('mesh-gw').innerHTML = last ? gwName(last.gw) : '—';
  $('mesh-snr').innerHTML = last ? snr(last.snr) : '—';
  $('mesh-count').textContent = reports.filter(r => r.ms > Date.now() - DAY).length;

  // ---- bramki
  const byGw = new Map();
  for (const r of reports) {
    const g = byGw.get(r.gw) || { n: 0, sum: 0, k: 0, best: -Infinity, hops: new Set(), last: 0 };
    g.n++;
    if (r.snr != null) { g.sum += r.snr; g.k++; g.best = Math.max(g.best, r.snr); }
    if (r.hops != null) g.hops.add(r.hops);
    g.last = Math.max(g.last, r.ms);
    byGw.set(r.gw, g);
  }
  $('mesh-gateways').innerHTML = [...byGw].sort((a, b) => b[1].n - a[1].n).map(([id, g]) => `
    <tr><td>${gwName(id)}</td><td>${g.n}</td><td>${g.k ? snr(g.sum / g.k) : '—'}</td><td>${g.k ? snr(g.best) : '—'}</td>
    <td>${g.hops.size ? [...g.hops].sort().map(hops).join(', ') : '—'}</td><td>${ago(g.last)}</td></tr>`).join('')
    || `<tr><td colspan="6">${t('No gateway has reported this node yet.', 'Żadna bramka nie zgłosiła jeszcze tego noda.')}</td></tr>`;

  // ---- tabela ostatnich pakietów (widok tabelaryczny wykresu)
  $('mesh-packets').innerHTML = reports.slice(-20).reverse().map(r =>
    `<tr><td>${stamp(r.ms)}</td><td>${gwName(r.gw)}</td><td>${snr(r.snr)}</td><td>${hops(r.hops)}</td><td>${type(r.type)}</td></tr>`).join('');

  // ---- wykres SNR
  const pts = reports.filter(r => r.snr != null);
  const chart = $('mesh-chart'), tip = $('mesh-tip');
  if (pts.length < 2) {
    chart.closest('figure').hidden = true;
    return;
  }
  const W = 760, H = 260, L = 46, R = 14, T = 14, B = 34;
  const x0 = pts[0].ms, x1 = Math.max(pts[pts.length - 1].ms, x0 + 3600e3);
  const lo = Math.floor(Math.min(...pts.map(p => p.snr)) / 5) * 5;
  const hi = Math.max(lo + 5, Math.ceil(Math.max(...pts.map(p => p.snr)) / 5) * 5);
  const X = ms => L + (ms - x0) / (x1 - x0) * (W - L - R);
  const Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const step = (hi - lo) / 5 <= 2 ? 2.5 : 5;
  let svg = '';
  for (let v = lo; v <= hi + 1e-9; v += step) {
    svg += `<line class="mc-grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/>` +
      `<text class="mc-axis" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${String(v).replace('-', '−')}</text>`;
  }
  [0, .5, 1].forEach((f, i) => {
    const ms = x0 + f * (x1 - x0), d = new Date(ms), o = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    const a = ['start', 'middle', 'end'][i];
    svg += `<text class="mc-axis" lang="en" x="${X(ms)}" y="${H - 10}" text-anchor="${a}">${d.toLocaleString('en-GB', o)}</text>` +
      `<text class="mc-axis" lang="pl" x="${X(ms)}" y="${H - 10}" text-anchor="${a}">${d.toLocaleString('pl-PL', o)}</text>`;
  });
  svg += pts.map((p, i) => `<circle class="mc-dot" cx="${X(p.ms)}" cy="${Y(p.snr)}" r="4.5"/>` +
    `<circle class="mc-hit" data-i="${i}" cx="${X(p.ms)}" cy="${Y(p.snr)}" r="13" tabindex="0"/>`).join('');
  chart.setAttribute('viewBox', `0 0 ${W} ${H}`);
  chart.innerHTML = svg;

  function show(el) {
    const p = pts[el.dataset.i], box = chart.parentElement.getBoundingClientRect(), c = el.getBoundingClientRect();
    tip.innerHTML = `<b>${snr(p.snr)}</b><span>${stamp(p.ms)}</span><span>${gwName(p.gw)} · ${hops(p.hops)}</span>`;
    tip.hidden = false;
    const x = c.left + c.width / 2 - box.left, half = tip.offsetWidth / 2;
    tip.style.left = `${Math.min(Math.max(x, half + 4), box.width - half - 4)}px`;
    tip.style.top = `${c.top - box.top - 4}px`;
  }
  const hide = () => { tip.hidden = true; };
  chart.addEventListener('pointerover', e => { if (e.target.dataset.i) show(e.target); });
  chart.addEventListener('pointerout', hide);
  chart.addEventListener('focusin', e => { if (e.target.dataset.i) show(e.target); });
  chart.addEventListener('focusout', hide);
  window.addEventListener('resize', hide);
})();
