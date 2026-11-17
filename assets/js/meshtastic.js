/* Strona Meshtastic: przełącznik nodów, kafelek statusu, lista bramek, graf ścieżek, wykres SNR i tabela pakietów.
   Dane: window.MESH_DATA z data/mesh.latest.js (workflow mesh-sync.yml, co ok. 30 min, źródło: lorastats.pl).
   Czas w danych jest w UTC; na stronie pokazujemy czas lokalny przeglądarki.
   Przełącznik na górze strony wybiera node — wszystkie sekcje poniżej pokazują dane tylko dla niego. */
(function () {
  const D = window.MESH_DATA;
  const root = document.getElementById('mesh');
  if (!root) return;
  const $ = id => document.getElementById(id);
  const t = (en, pl) => `<span lang="en">${en}</span><span lang="pl">${pl}</span>`;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Format danych: "nodes" (moje nody); starszy plik miał jeden "node", a raporty i ścieżki bez pola "from".
  const NODES = D && D.nodes ? Object.entries(D.nodes).map(([id, n]) => ({ ...n, id })) : D && D.node ? [D.node] : [];
  if (!NODES.length) {
    $('mesh-state').innerHTML = t('No data yet', 'Brak danych');
    return;
  }
  const MINE = new Map(NODES.map(n => [n.id, n]));
  const ALL = (D.reports || []).map(r => ({ ...r, from: r.from || NODES[0].id, ms: Date.parse(r.t) })).filter(r => !Number.isNaN(r.ms));
  const ALL_ROUTES = (D.routes || []).map(r => ({ ...r, from: r.from || NODES[0].id }));
  const names = D.names || D.gateways || {}; // "gateways" to stary format danych (sprzed grafu ścieżek)
  const info = id => MINE.get(id) || names[id] || {};
  const gwName = id => { const g = info(id); return esc(g.longName || g.shortName || id); };

  const ACTIVE_MS = 6 * 3600e3; // node nadaje co kilka godzin
  const DAY = 864e5;
  const ROLES = { 0: 'client', 1: 'client mute', 2: 'router', 4: 'repeater', 5: 'tracker', 6: 'sensor', 11: 'router late', 12: 'client base' };
  const num = (v, digits = 1) => {
    const s = Math.abs(v).toFixed(digits), sign = v < 0 ? '−' : '';
    return t(sign + s, sign + s.replace('.', ','));
  };
  const snr = v => v == null ? '—' : `${num(v, 2)} dB`;
  const hops = h => h == null ? '—' : h === 0 ? t('direct', 'bezpośrednio') : String(h);
  const TYPES = { position: ['position', 'pozycja'], nodeinfo: ['node info', 'dane noda'], text: ['message', 'wiadomość'], telemetry: ['telemetry', 'telemetria'], traceroute: ['traceroute', 'traceroute'] };
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
  const seenOf = id => {
    let m = Date.parse((MINE.get(id) || {}).lastSeen) || 0;
    for (const r of ALL) if (r.from === id && r.ms > m) m = r.ms;
    return m;
  };
  const isActive = ms => !!ms && Date.now() - ms < ACTIVE_MS;

  // Bieżący node i jego dane
  let cur, node, reports = [], routes = [];

  // ---- przełącznik nodów
  const sw = $('mesh-switch');
  function buildSwitch() {
    if (!sw) return;
    sw.hidden = NODES.length < 2;
    sw.innerHTML = NODES.map(n => `<button type="button" data-node="${esc(n.id)}" aria-pressed="false">` +
      `<span class="mesh-dot" aria-hidden="true"></span><b>${esc(n.longName || n.id)}</b>` +
      `<small>${ROLES[n.role] ? `${esc(ROLES[n.role])} · ` : ''}<span class="mesh-sw-state"></span></small></button>`).join('');
    sw.addEventListener('click', e => {
      const b = e.target.closest('[data-node]');
      if (b && b.dataset.node !== cur) select(b.dataset.node, true);
    });
  }
  function refreshSwitch() {
    if (!sw) return;
    sw.querySelectorAll('[data-node]').forEach(b => {
      const on = isActive(seenOf(b.dataset.node));
      b.setAttribute('aria-pressed', String(b.dataset.node === cur));
      b.querySelector('.mesh-dot').classList.toggle('is-on', on);
      b.querySelector('.mesh-sw-state').innerHTML = on ? t('active', 'aktywny') : t('quiet', 'cisza');
    });
  }
  const store = {
    get() { try { return localStorage.getItem('sp3fck-mesh-node'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem('sp3fck-mesh-node', v); } catch (e) {} }
  };

  // ---- kafelek statusu, bramki i ostatnie pakiety
  function renderStatus() {
    const seen = seenOf(cur), active = isActive(seen);
    root.classList.toggle('is-active', active);
    $('mesh-state').innerHTML = active ? t('Active', 'Aktywny') : t('Quiet', 'Cisza');
    $('mesh-seen').innerHTML = seen ? `${t('Last heard', 'Ostatnio słyszany')} ${ago(seen)}` : t('Not heard yet', 'Jeszcze nie słyszany');
    $('mesh-seen-at').innerHTML = seen ? stamp(seen) : '';
  }
  function renderNode() {
    const last = reports[reports.length - 1];
    $('mesh-name').textContent = node.longName || node.id;
    const src = $('mesh-src-link');
    if (src) src.href = `https://lorastats.pl/Node/${encodeURIComponent(cur)}`;
    renderStatus();
    $('mesh-gw').innerHTML = last ? gwName(last.gw) : '—';
    $('mesh-snr').innerHTML = last ? snr(last.snr) : '—';
    $('mesh-count').textContent = reports.filter(r => r.ms > Date.now() - DAY).length;

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

    // tabela ostatnich pakietów (widok tabelaryczny wykresu SNR)
    $('mesh-packets').innerHTML = reports.slice(-20).reverse().map(r =>
      `<tr><td>${stamp(r.ms)}</td><td>${gwName(r.gw)}</td><td>${snr(r.snr)}</td><td>${hops(r.hops)}</td><td>${type(r.type)}</td></tr>`).join('');
  }

  // ---- graf ścieżek: którędy pakiety wybranego noda docierają do bramek
  // Jeden odbiór (pakiet × bramka) = jedna ścieżka. Pełną ścieżkę daje traceroute; z raportu znamy liczbę skoków
  // i ostatni bajt ID przekaźnika — rozpoznajemy go, gdy pasuje do dokładnie jednego znanego noda.
  // Odcinki, których sieć nie zgłosiła, rysujemy przerywaną linią.
  const graph = (function () {
    const box = $('mesh-graph'), svg = $('mesh-graph-svg'), gtip = $('mesh-graph-tip');
    if (!box) return { update() {} };
    const UNK = 'ffffffff';
    const pl = () => document.documentElement.lang === 'pl';
    const plural = (n, one, few, many) => n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;
    const packets = n => [`${n} packet${n === 1 ? '' : 's'}`, `${n} ${plural(n, 'pakiet', 'pakiety', 'pakietów')}`];
    const hopsTxt = n => [`${n} hop${n === 1 ? '' : 's'}`, `${n} ${plural(n, 'skok', 'skoki', 'skoków')}`];
    const db = v => { const s = `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`; return [`${s} dB`, `${s.replace('.', ',')} dB`]; };
    const short = id => info(id).shortName || id.slice(-4);
    const long = id => info(id).longName || short(id);
    const r1 = v => Math.round(v * 10) / 10;

    let ME, nodes = new Map(), edges = new Map(), E = [], cols = [], dist = new Map(), maxN = 1;
    let xy = new Map(), vert = false, lastW = 0;

    function build() {
      ME = cur;
      const ids = new Set([...MINE.keys(), ...Object.keys(names)]);
      routes.forEach(r => r.paths.forEach(p => p.forEach(id => { if (id !== UNK) ids.add(id); })));
      const byByte = new Map();
      ids.forEach(id => { const b = id.slice(-2); byByte.set(b, byByte.has(b) ? null : id); });

      const recs = new Map();
      for (const r of routes) {
        const ms = Date.parse(r.t);
        for (const p of r.paths) if (p[p.length - 1] !== UNK) recs.set(`${r.id}|${p[p.length - 1]}`, { trail: p, ms, snr: null });
      }
      for (const r of reports) {
        const key = `${r.id}|${r.gw}`, have = recs.get(key);
        if (have) { have.ms = r.ms; have.snr = r.snr; continue; }
        const relay = r.relay ? byByte.get(r.relay) : null;
        let trail;
        if (r.hops === 0 || relay === ME) trail = [ME, r.gw];
        else if (r.hops == null || !('relay' in r)) continue; // raport sprzed zapisu przekaźników: nie wiadomo, którędy szedł
        else if (relay && relay !== r.gw) trail = [ME, ...Array(r.hops - 1).fill(UNK), relay, r.gw];
        else trail = [ME, ...Array(r.hops).fill(UNK), r.gw];
        recs.set(key, { trail, ms: r.ms, snr: r.snr });
      }

      nodes = new Map();
      edges = new Map();
      const rows = new Map();
      const nodeOf = id => {
        if (!nodes.has(id)) nodes.set(id, { id, heard: 0, snrSum: 0, snrN: 0, relayed: 0, on: new Set() });
        return nodes.get(id);
      };
      for (const { trail, ms, snr: s } of recs.values()) {
        const hopIds = [], used = [];
        let prev = null, gap = 0;
        for (const id of trail) {
          if (id === UNK) { gap++; continue; }
          if (id === prev) continue;
          nodeOf(id);
          hopIds.push(id);
          if (prev) {
            const key = `${prev}>${id}${gap ? '?' : ''}`;
            const e = edges.get(key) || { key, a: prev, b: id, n: 0, gaps: new Set(), last: 0 };
            e.n++;
            if (gap) e.gaps.add(gap);
            e.last = Math.max(e.last, ms);
            edges.set(key, e);
            used.push(key);
          }
          prev = id;
          gap = 0;
        }
        if (hopIds.length < 2) continue;
        const gw = nodes.get(hopIds[hopIds.length - 1]);
        gw.heard++;
        if (s != null) { gw.snrSum += s; gw.snrN++; }
        hopIds.slice(1, -1).forEach(id => nodes.get(id).relayed++);
        hopIds.forEach(id => used.forEach(k => nodes.get(id).on.add(k)));
        const rk = trail.join(',');
        const row = rows.get(rk) || { trail, n: 0, last: 0 };
        row.n++;
        row.last = Math.max(row.last, ms);
        rows.set(rk, row);
      }
      E = [...edges.values()];
      maxN = Math.max(1, ...E.map(e => e.n));

      // Kolumny = najkrótsza liczba skoków od noda (nieznany odcinek liczy się jako tyle skoków, ile zgłosił raport).
      dist = new Map([[ME, 0]]);
      for (let i = 0, changed = true; changed && i < 40; i++) {
        changed = false;
        for (const e of E) {
          const d = dist.get(e.a);
          if (d == null) continue;
          const nd = d + 1 + (e.gaps.size ? Math.min(...e.gaps) : 0);
          if (!(dist.get(e.b) <= nd)) { dist.set(e.b, nd); changed = true; }
        }
      }
      const layers = [];
      dist.forEach((d, id) => { if (nodes.has(id)) (layers[d] = layers[d] || []).push(id); });
      cols = layers.filter(Boolean);
      const busy = id => nodes.get(id).heard + nodes.get(id).relayed;
      cols.forEach(c => c.sort((a, b) => busy(b) - busy(a)));
      // Kolejność w kolumnie: kilka przebiegów barycentrum, żeby linie mniej się krzyżowały.
      const pos = new Map();
      const spread = c => c.forEach((id, i) => pos.set(id, c.length > 1 ? i / (c.length - 1) : .5));
      cols.forEach(spread);
      for (let it = 0; it < 8; it++) {
        const fwd = it % 2 === 0;
        for (const c of fwd ? cols.slice(1) : cols.slice(0, -1).reverse()) {
          const bc = new Map(c.map(id => {
            let sum = 0, w = 0;
            for (const e of E) {
              const o = fwd ? (e.b === id ? e.a : null) : (e.a === id ? e.b : null);
              if (o && o !== id && pos.has(o)) { sum += pos.get(o) * e.n; w += e.n; }
            }
            return [id, w ? sum / w : pos.get(id)];
          }));
          c.sort((a, b) => bc.get(a) - bc.get(b));
          spread(c);
        }
      }

      // tabela (widok tabelaryczny grafu)
      $('mesh-paths').innerHTML = [...rows.values()].sort((a, b) => b.n - a.n || b.last - a.last).map(r =>
        `<tr><td>${r.trail.map(id => id === UNK ? '?' : esc(short(id))).join(' → ')}</td><td>${r.n}</td><td>${ago(r.last)}</td></tr>`).join('');
    }

    const kind = id => id === ME ? 'me' : nodes.get(id).heard ? 'gw' : 'relay';
    function facts(id) {
      const n = nodes.get(id), out = [];
      const role = info(id).role;
      if (id === ME) out.push(['my node', 'mój node']);
      else if (MINE.has(id)) out.push(['my other node', 'mój drugi node']);
      else if (ROLES[role]) out.push([`role: ${ROLES[role]}`, `rola: ${ROLES[role]}`]);
      if (n.heard) {
        const [en, plTxt] = packets(n.heard);
        let line = [`gateway – heard ${en}`, `bramka – odebrała ${plTxt}`];
        if (n.snrN) { const [a, b] = db(n.snrSum / n.snrN); line = [`${line[0]}, avg SNR ${a}`, `${line[1]}, średni SNR ${b}`]; }
        out.push(line);
      }
      if (n.relayed) { const [en, plTxt] = packets(n.relayed); out.push([`relayed ${en}`, `przekazał ${plTxt}`]); }
      if (id !== ME) { const [en, plTxt] = hopsTxt(dist.get(id)); out.push([`shortest path: ${en}`, `najkrótsza droga: ${plTxt}`]); }
      return out;
    }
    function edgeFacts(e) {
      const [en, plTxt] = packets(e.n), out = [[en, plTxt]];
      if (e.gaps.size) {
        const g = [...e.gaps].sort((a, b) => a - b), span = g.length > 1 ? `${g[0]}–${g[g.length - 1]}` : String(g[0]);
        const many = g[g.length - 1];
        out.push([`+ ${span} unreported hop${many === 1 ? '' : 's'} in between`, `+ ${span} ${plural(many, 'niezgłoszony skok', 'niezgłoszone skoki', 'niezgłoszonych skoków')} po drodze`]);
      }
      return out;
    }

    // ---- rysowanie (układ poziomy na szerokim ekranie, pionowy na wąskim)
    function curve(a, b) {
      const [x1, y1] = xy.get(a), [x2, y2] = xy.get(b);
      if (!vert) {
        if (x2 - x1 > 1) { const m = r1((x1 + x2) / 2); return `M${x1} ${y1}C${m} ${y1} ${m} ${y2} ${x2} ${y2}`; }
        const k = r1(40 + Math.abs(y2 - y1) * .3);
        return `M${x1} ${y1}C${r1(x1 + k)} ${y1} ${r1(x2 + k)} ${y2} ${x2} ${y2}`;
      }
      if (y2 - y1 > 1) { const m = r1((y1 + y2) / 2); return `M${x1} ${y1}C${x1} ${m} ${x2} ${m} ${x2} ${y2}`; }
      const k = r1(34 + Math.abs(x2 - x1) * .3);
      return `M${x1} ${y1}C${x1} ${r1(y1 + k)} ${x2} ${r1(y2 + k)} ${x2} ${y2}`;
    }
    function render(force) {
      const W = Math.round(box.clientWidth);
      if (!E.length || !W || (W === lastW && !force)) return;
      lastW = W;
      vert = W < 640;
      const most = Math.max(...cols.map(c => c.length));
      xy = new Map();
      let H;
      if (!vert) {
        const gap = 62, top = 22, padL = 34, padR = 70;
        H = top + (most - 1) * gap + 40;
        cols.forEach((c, ci) => c.forEach((id, i) => xy.set(id, [
          r1(cols.length > 1 ? padL + ci * (W - padL - padR) / (cols.length - 1) : W / 2),
          r1(top + (most - 1) * gap / 2 + (i - (c.length - 1) / 2) * gap)])));
      } else {
        const gap = 92, top = 22, pad = 30;
        H = top + (cols.length - 1) * gap + 50;
        cols.forEach((c, ci) => {
          const step = c.length > 1 ? Math.min(86, (W - 2 * pad - 30) / (c.length - 1)) : 0;
          c.forEach((id, i) => xy.set(id, [r1(W / 2 - 15 + (i - (c.length - 1) / 2) * step), top + ci * gap]));
        });
      }
      const isPl = pl();
      let s = '<g>';
      for (const e of [...E].sort((a, b) => b.n - a.n)) {
        const w = (1.5 + 4.5 * Math.sqrt(e.n / maxN)).toFixed(1);
        s += `<path class="mg-edge${e.gaps.size ? ' is-gap' : ''}" data-e="${esc(e.key)}" d="${curve(e.a, e.b)}" stroke-width="${w}"/>`;
      }
      s += '</g><g>' + E.map(e => `<path class="mg-hit" data-e="${esc(e.key)}" d="${curve(e.a, e.b)}"/>`).join('') + '</g><g>';
      for (const [id, [x, y]] of xy) {
        const k = kind(id);
        const shape = k === 'me' ? '<circle class="mg-halo" r="15"/><circle class="mg-me" r="9"/>'
          : k === 'gw' ? '<rect class="mg-gw" x="-7.5" y="-7.5" width="15" height="15" rx="3"/>'
          : '<circle class="mg-relay" r="6.5"/>';
        const label = vert ? `x="${k === 'me' ? 20 : 13}" y="4" text-anchor="start"` : `y="${k === 'me' ? 31 : 26}" text-anchor="middle"`;
        const aria = `${long(id)} (${short(id)}): ${facts(id).map(f => f[isPl ? 1 : 0]).join('; ')}`;
        s += `<g class="mg-node" data-n="${esc(id)}" tabindex="0" role="img" aria-label="${esc(aria)}" transform="translate(${x} ${y})">` +
          `<circle class="mg-pad" r="16"/><circle class="mg-ring" r="${k === 'me' ? 19 : 13}"/>${shape}<text ${label}>${esc(short(id))}</text></g>`;
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      svg.innerHTML = s + '</g>';
      clear();
    }

    // ---- podświetlenie i dymek (mysz, dotyk i klawiatura)
    function clear() {
      svg.classList.remove('is-focus');
      svg.querySelectorAll('.on').forEach(el => el.classList.remove('on'));
      gtip.hidden = true;
    }
    function light(edgeKeys) {
      svg.classList.add('is-focus');
      const lit = new Set();
      edgeKeys.forEach(k => { const e = edges.get(k); lit.add(e.a); lit.add(e.b); });
      svg.querySelectorAll('.mg-edge').forEach(el => el.classList.toggle('on', edgeKeys.has(el.dataset.e)));
      svg.querySelectorAll('.mg-node').forEach(el => el.classList.toggle('on', lit.has(el.dataset.n)));
    }
    function tipAt(html, el) {
      gtip.innerHTML = html;
      gtip.hidden = false;
      const b = box.getBoundingClientRect(), c = el.getBoundingClientRect(), half = gtip.offsetWidth / 2;
      gtip.style.left = `${Math.min(Math.max(c.left + c.width / 2 - b.left, half + 4), b.width - half - 4)}px`;
      gtip.style.top = `${c.top - b.top - 4}px`;
    }
    function show(target) {
      const n = target.closest('[data-n]'), h = target.closest('[data-e]');
      if (n) {
        const id = n.dataset.n;
        light(nodes.get(id).on);
        tipAt(`<b>${esc(long(id))}</b>${facts(id).map(f => `<span>${t(...f)}</span>`).join('')}`, n);
      } else if (h) {
        const e = edges.get(h.dataset.e);
        light(new Set([e.key]));
        tipAt(`<b>${esc(short(e.a))} → ${esc(short(e.b))}</b>${edgeFacts(e).map(f => `<span>${t(...f)}</span>`).join('')}<span>${t('last', 'ostatnio')} ${stamp(e.last)}</span>`, svg.querySelector(`.mg-node[data-n="${e.b}"]`));
      }
    }
    svg.addEventListener('pointerover', e => { if (e.target.closest('[data-n],[data-e]')) show(e.target); });
    svg.addEventListener('pointerout', e => { if (e.pointerType !== 'touch' && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-n],[data-e]'))) clear(); });
    svg.addEventListener('focusin', e => show(e.target));
    svg.addEventListener('focusout', clear);
    document.addEventListener('pointerdown', e => { if (!svg.contains(e.target)) clear(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') clear(); });
    document.addEventListener('langchange', () => render(true));
    if (window.ResizeObserver) new ResizeObserver(() => render()).observe(box);
    else window.addEventListener('resize', () => render());

    return {
      update() {
        build();
        box.closest('section').hidden = !E.length;
        render(true);
      }
    };
  })();

  // ---- wykres SNR
  const chart = $('mesh-chart'), tip = $('mesh-tip');
  let pts = [];
  function snrChart() {
    pts = reports.filter(r => r.snr != null);
    tip.hidden = true;
    const fig = chart.closest('figure');
    fig.hidden = pts.length < 2;
    if (fig.hidden) { chart.innerHTML = ''; return; }
    const W = 760, H = 260, L = 46, R = 14, T = 14, B = 34;
    const x0 = pts[0].ms, x1 = Math.max(pts[pts.length - 1].ms, x0 + 3600e3);
    const lo = Math.floor(Math.min(...pts.map(p => p.snr)) / 5) * 5;
    const hi = Math.max(lo + 5, Math.ceil(Math.max(...pts.map(p => p.snr)) / 5) * 5);
    const X = ms => L + (ms - x0) / (x1 - x0) * (W - L - R);
    const Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    const step = (hi - lo) / 5 <= 2 ? 2.5 : 5;
    let s = '';
    for (let v = lo; v <= hi + 1e-9; v += step) {
      s += `<line class="mc-grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/>` +
        `<text class="mc-axis" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${String(v).replace('-', '−')}</text>`;
    }
    [0, .5, 1].forEach((f, i) => {
      const ms = x0 + f * (x1 - x0), d = new Date(ms), o = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
      const a = ['start', 'middle', 'end'][i];
      s += `<text class="mc-axis" lang="en" x="${X(ms)}" y="${H - 10}" text-anchor="${a}">${d.toLocaleString('en-GB', o)}</text>` +
        `<text class="mc-axis" lang="pl" x="${X(ms)}" y="${H - 10}" text-anchor="${a}">${d.toLocaleString('pl-PL', o)}</text>`;
    });
    s += pts.map((p, i) => `<circle class="mc-dot" cx="${X(p.ms)}" cy="${Y(p.snr)}" r="4.5"/>` +
      `<circle class="mc-hit" data-i="${i}" cx="${X(p.ms)}" cy="${Y(p.snr)}" r="13" tabindex="0"/>`).join('');
    chart.setAttribute('viewBox', `0 0 ${W} ${H}`);
    chart.innerHTML = s;
  }
  function showPoint(el) {
    const p = pts[el.dataset.i], box = chart.parentElement.getBoundingClientRect(), c = el.getBoundingClientRect();
    tip.innerHTML = `<b>${snr(p.snr)}</b><span>${stamp(p.ms)}</span><span>${gwName(p.gw)} · ${hops(p.hops)}</span>`;
    tip.hidden = false;
    const x = c.left + c.width / 2 - box.left, half = tip.offsetWidth / 2;
    tip.style.left = `${Math.min(Math.max(x, half + 4), box.width - half - 4)}px`;
    tip.style.top = `${c.top - box.top - 4}px`;
  }
  const hide = () => { tip.hidden = true; };
  chart.addEventListener('pointerover', e => { if (e.target.dataset.i) showPoint(e.target); });
  chart.addEventListener('pointerout', hide);
  chart.addEventListener('focusin', e => { if (e.target.dataset.i) showPoint(e.target); });
  chart.addEventListener('focusout', hide);
  window.addEventListener('resize', hide);

  // ---- wybór noda: ?node=<id> w adresie, potem ostatni wybór, potem pierwszy node
  function select(id, byUser) {
    cur = MINE.has(id) ? id : NODES[0].id;
    node = MINE.get(cur);
    reports = ALL.filter(r => r.from === cur);
    routes = ALL_ROUTES.filter(r => r.from === cur);
    if (byUser) {
      store.set(cur);
      try {
        const u = new URL(location.href);
        u.searchParams.set('node', cur);
        history.replaceState(null, '', u);
      } catch (e) {}
    }
    refreshSwitch();
    renderNode();
    graph.update();
    snrChart();
  }
  buildSwitch();
  select(new URLSearchParams(location.search).get('node') || store.get(), false);
  setInterval(() => { renderStatus(); refreshSwitch(); }, 60e3);
})();
