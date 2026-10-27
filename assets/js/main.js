(function () {
  const root = document.documentElement;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  // Język: domyślnie EN, wybór PL zapamiętany. <head> ustawia <html lang> przed renderem (bez mignięcia).
  // Tytuł karty: <meta name="title-pl">; atrybuty: data-pl-placeholder, data-pl-aria-label itd.
  const titleEn = document.title;
  const titlePl = (document.querySelector('meta[name="title-pl"]') || {}).content || titleEn;
  function setLang(lang) {
    root.lang = lang;
    document.title = lang === 'pl' ? titlePl : titleEn;
    document.querySelectorAll('*').forEach(el => {
      for (const attr of [...el.attributes]) {
        if (!attr.name.startsWith('data-pl-')) continue;
        const name = attr.name.slice(8);
        if (!el.hasAttribute('data-en-' + name)) el.setAttribute('data-en-' + name, el.getAttribute(name) || '');
        el.setAttribute(name, lang === 'pl' ? attr.value : el.getAttribute('data-en-' + name));
      }
    });
    document.querySelectorAll('[data-set-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.setLang === lang));
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }
  setLang(root.lang === 'pl' ? 'pl' : 'en');
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-set-lang]');
    if (!b) return;
    store.set('sp3fck-lang', b.dataset.setLang);
    setLang(b.dataset.setLang);
  });

  // Zegar UTC — log prowadzimy w UTC
  const tick = () => {
    const now = new Date().toISOString().slice(11, 16);
    document.querySelectorAll('[data-utc]').forEach(el => { el.textContent = now; });
  };
  tick(); setInterval(tick, 15000);

  // E-maile ukryte przed robotami: <a data-u="nazwa" data-d="domena.pl"> — w HTML nie ma „@”.
  // data-keep-text — zostaw tekst linku, ustaw tylko adres.
  document.querySelectorAll('a[data-u][data-d]').forEach(a => {
    const addr = a.dataset.u + String.fromCharCode(64) + a.dataset.d;
    a.href = 'mailto:' + addr;
    if (!a.hasAttribute('data-keep-text')) a.textContent = addr;
  });

  // Ramki z zewnętrznymi mapami (Windy, mapa QSO) — <iframe data-src>: wczytywane, gdy są ok. 200 px od ekranu.
  const lazyFrames = document.querySelectorAll('iframe[data-src]');
  const loadFrame = f => { if (f.dataset.src) { f.src = f.dataset.src; delete f.dataset.src; } };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { loadFrame(e.target); io.unobserve(e.target); }
    }), { rootMargin: '200px 0px' });
    lazyFrames.forEach(f => io.observe(f));
  } else {
    lazyFrames.forEach(loadFrame);
  }

  // Menu mobilne
  const btn = document.querySelector('.nav-toggle');
  const nav = document.getElementById('nav');
  if (btn && nav) btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
  });

  // Galeria: filtry kategorii (działa też dla treści dodanej później z danych)
  document.addEventListener('click', e => {
    const t = e.target.closest('.tabs button[data-cat]');
    if (!t) return;
    t.closest('.tabs').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === t));
    const cat = t.dataset.cat;
    document.querySelectorAll('[data-lightbox] > a').forEach(a => {
      a.hidden = cat !== 'all' && a.dataset.cat !== cat;
    });
  });

  // Lightbox — linki ze zdjęciem (<a><img></a>) w kontenerach [data-lightbox], także dodanych później.
  // Podpis: zawartość .cap w linku (oba języki), a gdy jej nie ma — alt zdjęcia.
  let lb = null, lbImg, lbCap, lbCount, items = [], idx = 0, opener = null;
  const lbShow = () => {
    const a = items[idx];
    const img = a.querySelector('img');
    const cap = a.querySelector('.cap');
    lbImg.src = a.href;
    lbImg.alt = img ? img.alt : '';
    lbCap.innerHTML = cap ? cap.innerHTML : '';
    lbCount.textContent = (idx + 1) + ' / ' + items.length;
    lb.classList.toggle('single', items.length < 2);
  };
  const lbClose = () => { lb.classList.remove('open'); lbImg.src = ''; if (opener) opener.focus(); };
  const lbStep = d => { idx = (idx + d + items.length) % items.length; lbShow(); };
  function lbCreate() {
    lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Photo');
    lb.innerHTML = '<img alt=""><div class="lb-cap"></div><button class="lb-close" aria-label="Close">✕</button>' +
      '<button class="lb-prev" aria-label="Previous">‹</button><button class="lb-next" aria-label="Next">›</button>' +
      '<div class="lb-count"></div>';
    document.body.appendChild(lb);
    lbImg = lb.querySelector('img'); lbCap = lb.querySelector('.lb-cap'); lbCount = lb.querySelector('.lb-count');
    lb.querySelector('.lb-close').addEventListener('click', lbClose);
    lb.querySelector('.lb-prev').addEventListener('click', () => lbStep(-1));
    lb.querySelector('.lb-next').addEventListener('click', () => lbStep(1));
    lb.addEventListener('click', e => { if (e.target === lb) lbClose(); });
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-lightbox] a');
    if (!a || !a.querySelector('img') || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    if (!lb) lbCreate();
    items = [...a.closest('[data-lightbox]').querySelectorAll('a')].filter(x => !x.hidden && x.querySelector('img'));
    idx = items.indexOf(a); opener = a;
    lbShow(); lb.classList.add('open');
    lb.querySelector('.lb-close').focus();
  });
  document.addEventListener('keydown', e => {
    if (!lb || !lb.classList.contains('open')) return;
    if (e.key === 'Escape') lbClose();
    if (e.key === 'ArrowLeft') lbStep(-1);
    if (e.key === 'ArrowRight') lbStep(1);
  });
})();
