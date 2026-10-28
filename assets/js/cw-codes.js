/* Kody Q i skróty CW (dane: data/cw-codes.js).
   [data-cw-search] — pole wyszukiwania, [data-cw-group] — przyciski grup, [data-cw-list] — lista wyników.
   Szukanie po kodzie (najpierw dokładne trafienie, potem początek, potem środek) i po znaczeniu w obu językach. */
(function () {
  const data = window.SP3FCK_CW;
  const out = document.querySelector('[data-cw-list]');
  const input = document.querySelector('[data-cw-search]');
  if (!data || !out || !input) return;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const t = ([en, pl]) => `<span lang="en">${esc(en)}</span><span lang="pl">${esc(pl)}</span>`;
  let group = '';

  // pasek wyszukiwania przykleja się tuż pod nagłówkiem strony (który też jest sticky)
  const tools = input.closest('.cw-tools');
  const header = document.querySelector('.site-header');
  const stick = () => { if (tools && header) tools.style.top = header.offsetHeight + 'px'; };
  stick(); addEventListener('resize', stick);

  function rank(item, code, text) {
    if (!code && !text) return 0;
    if (code && item.code === code) return 1;
    if (code && item.code.startsWith(code)) return 2;
    if (code && item.code.includes(code)) return 3;
    const hay = [item.exp, ...item.mean].join(' ').toLowerCase();
    return text && hay.includes(text) ? 4 : -1;
  }

  // rozwinięcie identyczne z angielskim znaczeniem pokazujemy tylko w wersji PL; zapis Morse'a większą czcionką
  const letters = s => s.toLowerCase().replace(/[^a-z]/g, '');
  function exp(item) {
    if (!item.exp) return '';
    const same = letters(item.exp) === letters(item.mean[0]);
    const morse = /^[·−]+$/.test(item.exp);
    return `<span class="exp${morse ? ' morse' : ''}"${same ? ' lang="pl"' : ''}>${esc(item.exp)}</span>`;
  }

  function render() {
    const raw = input.value.trim();
    const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // po znaczeniu dopiero od 3 znaków — inaczej „DE” czy „TU” zalewałyby listę przypadkowymi trafieniami
    const text = raw.length >= 3 ? raw.toLowerCase() : '';
    const html = Object.entries(data.groups).filter(([g]) => !group || g === group).map(([g, meta]) => {
      const rows = data.items.filter(i => i.g === g)
        .map(i => [rank(i, code, text), i]).filter(([r]) => r >= 0)
        .sort((a, b) => a[0] - b[0]).map(([, i]) => i);
      if (!rows.length) return '';
      return `<div class="cw-group">
        <h2>${t(meta.title)}</h2>
        <p class="hint">${t(meta.hint)}</p>
        <ul class="cw-list">${rows.map(i => `
          <li><span class="code">${esc(i.code)}</span><span class="mean">${t(i.mean)}${exp(i)}</span></li>`).join('')}
        </ul></div>`;
    }).join('');
    out.innerHTML = html || `<p class="cw-empty">${t(['Nothing found – try fewer letters.', 'Nic nie znaleziono – spróbuj wpisać mniej liter.'])}</p>`;
  }

  input.addEventListener('input', render);
  document.querySelectorAll('[data-cw-group]').forEach(b => b.addEventListener('click', () => {
    group = b.dataset.cwGroup;
    document.querySelectorAll('[data-cw-group]').forEach(x => x.setAttribute('aria-pressed', x === b));
    render();
  }));
  render();
})();
