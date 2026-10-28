/* Wspólny pasek stacji, header i footer — wstrzykiwane na każdej podstronie.
   Strona ustawia aktywną pozycję menu przez <body data-page="...">.
   Teksty w obu językach: <span lang="en"> / <span lang="pl">, widoczny jest tylko bieżący (style.css). */
(function () {
  const t = (en, pl) => `<span lang="en">${en}</span><span lang="pl">${pl}</span>`;

  const TOOLS = [
    ['ham-map', 'ham-map.html', t('QSO Map', 'Mapa łączności')],
    ['propagation', 'propagation.html', t('Propagation &amp; Weather', 'Propagacja i pogoda')],
    ['q-codes', 'q-codes.html', t('Q Codes &amp; CW Shortcuts', 'Kody Q i skróty CW')],
    ['qrz-builder', 'qrz-builder/', t('QRZ Page Builder', 'Kreator strony QRZ')],
  ];
  const NAV = [
    ['index', 'index.html', 'Home', 'Start'],
    ['ham-tools', 'ham-tools.html', 'Ham Tools', 'Narzędzia', TOOLS],
    ['gallery', 'gallery.html', 'Gallery', 'Galeria'],
    ['youtube', 'youtube.html', 'YouTube', 'YouTube'],
    ['other', 'other.html', 'Other', 'Inne'],
    ['contact', 'contact.html', 'Contact', 'Kontakt'],
  ];
  const page = document.body.dataset.page || 'index';
  const current = id => id === page ? ' aria-current="page"' : '';

  const status = `
  <div class="statusbar">
    <div class="wrap">
      <div class="info">
        <span><span class="led"></span>SP3FCK</span>
        <span>LOC <b>JO72SG</b></span>
        <span class="hide-sm">CQ <b>15</b> · ITU <b>28</b></span>
        <span>UTC <b data-utc>--:--</b></span>
      </div>
      <div class="lang-switch" role="group" aria-label="Language / Język">
        <button type="button" data-set-lang="en" aria-pressed="false">EN</button>
        <button type="button" data-set-lang="pl" aria-pressed="false">PL</button>
      </div>
    </div>
  </div>`;

  const header = `
  <header class="site-header">
    <div class="wrap">
      <a class="brand" href="index.html" aria-label="SP3FCK — home"><span class="brand-call">SP3FCK</span></a>
      <button class="nav-toggle" aria-expanded="false" aria-controls="nav">Menu</button>
      <nav class="nav" id="nav" aria-label="Main">
        <ul>${NAV.map(([id, href, en, pl, sub]) => {
          const active = id === page || (sub && sub.some(([sid]) => sid === page));
          const link = `<a href="${href}"${active ? ' aria-current="page"' : ''}>${t(en, pl)}</a>`;
          if (!sub) return `<li>${link}</li>`;
          return `<li class="has-sub">${link}<ul class="sub">${sub.map(([sid, shref, label]) =>
            `<li><a href="${shref}"${current(sid)}>${label}</a></li>`).join('')}</ul></li>`;
        }).join('')}
        </ul>
      </nav>
    </div>
  </header>`;

  const year = new Date().getFullYear();
  const footer = `
  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <span class="footer-call">SP3FCK</span>
          <p>${t('Amateur radio station of Kuba from Świebodzin, Poland. HF, POTA, contests and home-made antennas.',
                 'Stacja krótkofalarska Kuby ze Świebodzina. KF, POTA, zawody i anteny własnej roboty.')}</p>
        </div>
        <div>
          <h2>${t('Site', 'Strona')}</h2>
          <ul>${NAV.map(([, href, en, pl]) => `<li><a href="${href}">${t(en, pl)}</a></li>`).join('')}</ul>
        </div>
        <div>
          <h2>Ham Tools</h2>
          <ul>${TOOLS.map(([, href, label]) => `<li><a href="${href}">${label}</a></li>`).join('')}
            <li><a href="https://www.qrz.com/db/SP3FCK" target="_blank" rel="noopener">QRZ.com</a></li>
          </ul>
        </div>
        <div>
          <h2>${t('Contact', 'Kontakt')}</h2>
          <ul>
            <li>Świebodzin, ${t('Poland', 'Polska')}</li>
            <li class="mono">JO72SG</li>
            <li><a data-u="sp3fck" data-d="gmail.com">sp3fck (at) gmail.com</a></li>
            <li><a href="https://www.youtube.com/@sp3fck_kuba" target="_blank" rel="noopener">YouTube</a></li>
            <li><a href="https://www.sp3pld.e7.pl/" target="_blank" rel="noopener">${t('SP3PLD club', 'Klub SP3PLD')}</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${year} SP3FCK · <a href="privacy.html">${t('Privacy', 'Prywatność')}</a></span>
        <span class="vy73">73!</span>
        <span>Created by <a href="https://kubabuba.pl" target="_blank" rel="noopener">kubabuba.pl</a></span>
      </div>
    </div>
  </footer>`;

  const h = document.getElementById('header-placeholder');
  const f = document.getElementById('footer-placeholder');
  if (h) h.outerHTML = status + header;
  if (f) f.outerHTML = footer;
})();
