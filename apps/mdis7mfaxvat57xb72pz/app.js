(function () {
  const $ = (id) => document.getElementById(id);
  const DEFAULT = { name: 'Berlin', region: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.41 };
  let place = load('wx-place', DEFAULT);
  let unit = load('wx-unit', 'c');
  let wx = null;
  let chart = null;
  let seq = 0;

  function load(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v === null || v === undefined ? fallback : v;
    } catch (e) { return fallback; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage off */ } }

  const conv = (c) => (unit === 'f' ? c * 9 / 5 + 32 : c);
  const deg = (c) => Math.round(conv(c)) + '°';
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function icon(name, size) {
    return icons.svg(name || 'cloud', { size: size || 24, strokeWidth: 1.75 });
  }
  function parseDate(s) {
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function dayName(s, i) {
    if (i === 0) return 'Today';
    return parseDate(s).toLocaleDateString('en', { weekday: 'short' });
  }
  function hourLabel(s) { return String(s).slice(11, 16); }
  const compass = (d) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(num(d) / 45) % 8];

  function showMsg(text) {
    const m = $('msg');
    m.textContent = text || '';
    m.hidden = !text;
  }

  async function refresh() {
    const id = ++seq;
    document.body.classList.add('loading');
    $('place').textContent = place.name;
    showMsg('');
    try {
      const w = await data.weather(place.latitude, place.longitude);
      if (id !== seq) return;
      wx = w;
      render();
    } catch (e) {
      if (id !== seq) return;
      showMsg('Could not load the weather for ' + place.name + '. ' + (e && e.message ? e.message : '') + ' Check your connection and search again.');
      $('when').textContent = wx ? 'Showing the last forecast loaded.' : 'No forecast yet.';
    } finally {
      if (id === seq) document.body.classList.remove('loading');
    }
  }

  function render() {
    if (!wx) return;
    const c = wx.current;
    const d = data.describe(c.code, c.isDay);
    const sub = [place.region, place.country].filter((x) => x && x !== place.name).join(', ');
    $('place').textContent = place.name + (sub ? ', ' + sub : '');
    $('when').textContent = 'Local time ' + hourLabel(c.time) + ' · ' + parseDate(c.time).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' });
    $('temp').textContent = Math.round(conv(c.temperature));
    $('deg').textContent = unit === 'f' ? '°F' : '°C';
    $('cond').textContent = d.label;
    $('condicon').replaceChildren(icon(d.iconName, 32));
    $('feels').textContent = deg(c.feelsLike);
    $('hum').textContent = Math.round(num(c.humidity)) + '%';
    $('wind').textContent = Math.round(num(c.wind)) + ' km/h ' + compass(c.windDirection);
    $('prec').textContent = num(c.precipitation).toFixed(1) + ' mm';
    $('credit').textContent = wx.credit || '';

    const days = wx.daily.slice(0, 7);
    const list = $('days');
    list.replaceChildren();
    days.forEach((x, i) => {
      const li = el('li');
      li.append(el('div', 'd', dayName(x.date, i)), icon(data.describe(x.code, true).iconName),
        el('div', '', deg(x.max) + ' / ' + deg(x.min)),
        el('div', 'r', Math.round(num(x.precipitationChance)) + '% rain'));
      list.append(li);
    });

    const hl = $('hourly');
    hl.replaceChildren();
    wx.hourly.slice(0, 24).forEach((h) => {
      const li = el('li');
      li.append(el('div', 'r', hourLabel(h.time)), icon(data.describe(h.code, true).iconName, 22),
        el('div', '', deg(h.temperature)), el('div', 'r', Math.round(num(h.precipitationChance)) + '%'));
      hl.append(li);
    });
    drawChart(days);
  }

  function drawChart(days) {
    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--accent').trim();
    const warm = style.getPropertyValue('--accent2').trim();
    const quiet = style.getPropertyValue('--quiet').trim();
    const grid = style.getPropertyValue('--line').trim();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (chart) chart.destroy();
    Chart.defaults.font.family = "'Space Grotesk', sans-serif";
    Chart.defaults.color = quiet;
    chart = new Chart($('chart'), {
      type: 'line',
      data: {
        labels: days.map((x, i) => dayName(x.date, i)),
        datasets: [
          { label: 'High', data: days.map((x) => Math.round(conv(x.max))), borderColor: accent, backgroundColor: accent, tension: .35, borderWidth: 3, pointRadius: 4 },
          { label: 'Low', data: days.map((x) => Math.round(conv(x.min))), borderColor: warm, backgroundColor: warm, tension: .35, borderWidth: 3, pointRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: reduce ? false : { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (i) => i.dataset.label + ': ' + i.parsed.y + '°' + (unit === 'f' ? 'F' : 'C') } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false } },
          y: { grid: { color: grid }, ticks: { callback: (v) => v + '°' } }
        }
      }
    });
  }

  // Search
  const matches = $('matches');
  function closeMatches() { matches.hidden = true; matches.replaceChildren(); }
  $('search').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('q').value.trim();
    if (!q) { $('q').focus(); return; }
    matches.replaceChildren(el('li', 'none', 'Searching…'));
    matches.hidden = false;
    try {
      const res = await data.places(q);
      matches.replaceChildren();
      if (!res.length) {
        matches.append(el('li', 'none', 'No city found for “' + q + '”. Check the spelling.'));
        return;
      }
      res.slice(0, 6).forEach((p) => {
        const li = el('li');
        const b = el('button', '', [p.name, p.region, p.country].filter(Boolean).join(', '));
        b.type = 'button';
        b.addEventListener('click', () => {
          place = p;
          save('wx-place', p);
          $('q').value = '';
          closeMatches();
          refresh();
        });
        li.append(b);
        matches.append(li);
      });
      matches.querySelector('button').focus();
    } catch (err) {
      matches.replaceChildren(el('li', 'none', 'Search failed. ' + (err && err.message ? err.message : 'Try again.')));
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMatches(); });
  document.addEventListener('click', (e) => { if (!$('search').contains(e.target)) closeMatches(); });

  // Units
  document.querySelectorAll('.units button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.unit === unit));
    b.addEventListener('click', () => {
      unit = b.dataset.unit;
      save('wx-unit', unit);
      document.querySelectorAll('.units button').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      render();
    });
  });

  refresh();
})();
