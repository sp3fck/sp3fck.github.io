/* Pogoda dla wybranej miejscowości (propagation.html).
   Nazwa → współrzędne: geokoder Open-Meteo (bez klucza, CORS) → przestawienie widżetu Windy.
   Gdy jest kilka miejscowości o tej samej nazwie, pierwsza jest pokazywana od razu, reszta do wyboru. */
(function () {
  const form = document.getElementById('wx-search');
  const map = document.getElementById('wx-map');
  if (!form || !map) return;

  const input = form.querySelector('#wx-q');
  const status = form.querySelector('.wx-status');
  const list = form.querySelector('.wx-results');
  const open = document.getElementById('wx-open');
  const HOME = { name: 'Świebodzin', admin1: 'Lubuskie', country_code: 'PL', country: 'Poland', latitude: 52.247, longitude: 15.533 };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const t = (en, pl) => `<span lang="en">${en}</span><span lang="pl">${pl}</span>`;
  const label = r => [r.admin1, r.country].filter(Boolean).join(', ');

  function show(r) {
    const lat = r.latitude.toFixed(3), lon = r.longitude.toFixed(3);
    const url = new URL(map.dataset.src || map.src); // mapa mogła się jeszcze nie wczytać (data-src)
    ['lat', 'detailLat'].forEach(k => url.searchParams.set(k, lat));
    ['lon', 'detailLon'].forEach(k => url.searchParams.set(k, lon));
    delete map.dataset.src;
    map.src = url.toString();
    if (open) open.href = `https://www.windy.com/${lat}/${lon}?${lat},${lon},8`;
    const where = label(r);
    status.innerHTML = `${t('Showing:', 'Pokazuję:')} <strong>${esc(r.name)}</strong>${where ? ', ' + esc(where) : ''}`;
  }

  function choices(results, current) {
    const others = results.filter(r => r !== current);
    if (!others.length) { list.hidden = true; list.innerHTML = ''; return; }
    list.innerHTML = `<span>${t('Other places with this name:', 'Inne miejscowości o tej nazwie:')}</span>` + others.map(r =>
      `<button type="button" data-i="${results.indexOf(r)}">${esc(r.name)}${label(r) ? ' <small>' + esc(label(r)) + '</small>' : ''}</button>`).join('');
    list.hidden = false;
    list.onclick = e => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      const r = results[+b.dataset.i];
      show(r); choices(results, r);
    };
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const q = input.value.trim();
    if (q.length < 2) { input.focus(); return; }
    status.innerHTML = t('Searching…', 'Szukam…');
    try {
      const lang = document.documentElement.lang === 'pl' ? 'pl' : 'en';
      const url = `https://geocoding-api.open-meteo.com/v1/search?count=8&language=${lang}&format=json&name=` + encodeURIComponent(q);
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const results = (await res.json()).results || [];
      if (!results.length) {
        status.innerHTML = t(`No place called “${esc(q)}” found. Check the spelling.`, `Nie znaleziono miejscowości „${esc(q)}”. Sprawdź pisownię.`);
        list.hidden = true;
        return;
      }
      show(results[0]);
      choices(results, results[0]);
    } catch (err) {
      status.innerHTML = t('Search failed. Please try again in a moment.', 'Nie udało się wyszukać miejscowości. Spróbuj ponownie za chwilę.');
    }
  });

  document.getElementById('wx-home').addEventListener('click', () => {
    input.value = '';
    list.hidden = true;
    show(HOME);
  });
})();
