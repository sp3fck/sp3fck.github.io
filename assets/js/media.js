/* Galeria i filmy z danych (data/gallery.js, data/youtube.js).
   Kontenery: [data-videos="N"] — N najnowszych filmów (puste = wszystkie);
   [data-gallery] — pełna galeria z podpisami; [data-gallery-strip="N"] — pasek N zdjęć bez podpisów. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const t = ([en, pl]) => `<span lang="en">${esc(en)}</span><span lang="pl">${esc(pl)}</span>`;
  const IMG = 'assets/img/gallery/';

  const videos = window.SP3FCK_VIDEOS || [];
  document.querySelectorAll('[data-videos]').forEach(list => {
    const n = parseInt(list.dataset.videos, 10) || videos.length;
    list.innerHTML = videos.slice(0, n).map(v => `
      <li><a href="${esc(v.url)}" target="_blank" rel="noopener">
        <span class="thumb"><img src="assets/img/youtube/${esc(v.id)}.jpg" alt="" width="640" height="360" loading="lazy"></span>
        <span class="body">
          <span class="meta">${esc(v.date.split('-').reverse().join('.'))}</span>
          <h3>${t(v.title)}</h3>
          <p>${t(v.desc)}</p>
        </span>
      </a></li>`).join('');
  });

  const photos = window.SP3FCK_GALLERY || [];
  document.querySelectorAll('[data-gallery]').forEach(grid => {
    grid.innerHTML = photos.map(p => `
      <a href="${IMG + esc(p.file)}" data-cat="${esc(p.cat)}">
        <span class="ph"><img src="${IMG + esc(p.file)}" alt="${esc(p.title[0])}" loading="lazy"></span>
        <span class="cap"><strong>${t(p.title)}</strong> <span>${t(p.desc)} · ${p.year}</span></span>
      </a>`).join('');
    document.querySelectorAll('[data-count]').forEach(el => {
      const cat = el.dataset.count;
      el.textContent = cat === 'all' ? photos.length : photos.filter(p => p.cat === cat).length;
    });
  });

  document.querySelectorAll('[data-gallery-strip]').forEach(strip => {
    const n = parseInt(strip.dataset.galleryStrip, 10) || 4;
    // na zmianę: stacja i dyplomy, żeby pasek nie był samymi dyplomami
    const station = photos.filter(p => p.cat === 'station');
    const awards = photos.filter(p => p.cat === 'awards');
    const pick = [];
    for (let i = 0; pick.length < n && (i < station.length || i < awards.length); i++) {
      if (station[i]) pick.push(station[i]);
      if (awards[i] && pick.length < n) pick.push(awards[i]);
    }
    strip.innerHTML = pick.map(p => `
      <a href="${IMG + esc(p.file)}"><img src="${IMG + esc(p.file)}" alt="${esc(p.title[0])}" loading="lazy">
        <span class="cap" hidden><strong>${t(p.title)}</strong> <span>${t(p.desc)}</span></span></a>`).join('');
  });
})();
