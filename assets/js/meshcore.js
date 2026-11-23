/* Strona MeshCore: blok statusu dla każdego noda.
   Dane: window.MESHCORE_DATA z data/meshcore.latest.js (workflow mesh-sync.yml, co ok. 30 min, źródło: map.meshcore.io).
   "lastSeen" to czas, w którym advert noda ostatnio trafił na mapę (zegar serwera mapy, UTC). */
(function () {
  const box = document.getElementById('mc-nodes');
  if (!box) return;
  const D = window.MESHCORE_DATA;
  const t = (en, pl) => `<span lang="en">${en}</span><span lang="pl">${pl}</span>`;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const NODES = D && D.nodes ? Object.entries(D.nodes).map(([key, n]) => ({ ...n, key })) : [];
  if (!NODES.length) {
    box.querySelector('strong').innerHTML = t('No data yet', 'Brak danych');
    return;
  }

  const ACTIVE_MS = 24 * 3600e3; // companion trafia na mapę tylko po wysłaniu advertu z aplikacji
  const TYPES = { 1: 'Companion', 2: 'Repeater', 3: ['Room server', 'Room serwer'], 4: ['Sensor', 'Sensor'] };
  const type = v => { const x = TYPES[v]; return !x ? '—' : Array.isArray(x) ? t(...x) : x; };
  function radio(r) {
    if (!r || r.freq == null) return '—';
    // &nbsp; w środku, żeby na wąskim ekranie wiersz łamał się tylko na " · "
    const parts = [t(`${r.freq}&nbsp;MHz`, `${String(r.freq).replace('.', ',')}&nbsp;MHz`)];
    if (r.bw != null) parts.push(t(`BW&nbsp;${r.bw}&nbsp;kHz`, `BW&nbsp;${String(r.bw).replace('.', ',')}&nbsp;kHz`));
    if (r.sf != null) parts.push(`SF${r.sf}`);
    if (r.cr != null) parts.push(`CR${r.cr}`);
    return parts.join(' · ');
  }
  const shortKey = k => `${k.slice(0, 8)}…${k.slice(-4)}`;
  const stamp = ms => {
    const d = new Date(ms), o = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
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

  box.innerHTML = NODES.map(n => `
    <div class="mc-node" data-key="${esc(n.key)}">
      <div class="section-head">
        <div><span class="eyebrow">Status</span><h2>${esc(n.name || shortKey(n.key))}</h2></div>
        <a href="https://mapa.meshcorepolska.org/?node=${encodeURIComponent(n.key)}" target="_blank" rel="noopener">${t('MeshCore Polska map →', 'Mapa MeshCore Polska →')}</a>
      </div>
      <div class="mesh-status" role="status">
        <span class="mesh-led" aria-hidden="true"></span>
        <div><strong class="mc-state"></strong><span class="mc-seen"></span><small class="mc-seen-at"></small></div>
      </div>
      <dl class="station station-strip mesh-strip">
        <div><dt>${t('Type', 'Typ')}</dt><dd>${type(n.type)}</dd></div>
        <div><dt>${t('Radio', 'Radio')}</dt><dd>${radio(n.radio)}</dd></div>
        <div><dt>${t('Public key', 'Klucz publiczny')}</dt><dd class="mono" title="${esc(n.key)}">${esc(shortKey(n.key))}</dd></div>
        <div><dt>${t('Locator', 'Lokator')}</dt><dd>JO72SG</dd></div>
      </dl>
    </div>`).join('');

  function renderStatus() {
    for (const n of NODES) {
      const el = box.querySelector(`[data-key="${n.key}"]`);
      const seen = Date.parse(n.lastSeen) || 0, active = !!seen && Date.now() - seen < ACTIVE_MS;
      el.classList.toggle('is-active', active);
      el.querySelector('.mc-state').innerHTML = active ? t('Active', 'Aktywny') : t('Quiet', 'Cisza');
      el.querySelector('.mc-seen').innerHTML = seen ? `${t('Last advert on the map', 'Ostatni advert na mapie')} ${ago(seen)}` : t('Not on the map yet', 'Jeszcze nie ma na mapie');
      el.querySelector('.mc-seen-at').innerHTML = seen ? stamp(seen) : '';
    }
  }
  renderStatus();
  setInterval(renderStatus, 60e3);
})();
