(function () {
  const $ = (id) => document.getElementById(id);
  const DEFAULT_LOC = { name: 'Berlin', region: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.41 };

  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v || fallback; } catch (e) { return fallback; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ignore */ } }

  let loc = load('wx-loc', DEFAULT_LOC);
  let unit = load('wx-unit', 'C');
  let wx = null;
  let chart = null;
  let reqId = 0;

  $('go').append(icons.svg('search'), document.createTextNode('Search'));

  const deg = (c) => Math.round(unit === 'F' ? c * 9 / 5 + 32 : c);
  const degTxt = (c) => deg(c) + '°';
  const parseDay = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const hourLabel = (t) => t.slice(11, 16);
  const compass = (d) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function say(text) {
    $('msg').hidden = !text;
    $('msg').textContent = text || '';
  }
  function placeLabel(p) { return [p.region, p.country].filter(Boolean).join(', '); }

  function renderNow() {
    const c = wx.current, d = wx.daily[0];
    const info = data.describe(c.code, c.isDay);
    const box = $('now');
    box.replaceChildren();
    box.append(el('h2', 'place', loc.name), el('p', 'place-sub', placeLabel(loc)));
    const row = el('div', 'bigrow');
    row.append(el('span', 'temp', degTxt(c.temperature)), icons.svg(info.iconName, { size: 56, strokeWidth: 1.5 }));
    box.append(row, el('p', 'cond', info.label + ' · feels like ' + degTxt(c.feelsLike)));
    const facts = el('dl', 'facts');
    const items = [
      ['High / low', degTxt(d.max) + ' / ' + degTxt(d.min)],
      ['Humidity', Math.round(c.humidity) + '%'],
      ['Wind', Math.round(c.wind) + ' km/h ' + compass(c.windDirection)],
      ['Rain today', (d.precipitation || 0).toFixed(1) + ' mm · ' + Math.round(d.precipitationChance || 0) + '%'],
      ['Sunrise', hourLabel(d.sunrise)],
      ['Sunset', hourLabel(d.sunset)]
    ];
    items.forEach(([k, v]) => { const w = el('div'); w.append(el('dt', '', k), el('dd', '', v)); facts.append(w); });
    box.append(facts);
  }

  function renderDays() {
    const ul = $('days');
    ul.replaceChildren();
    wx.daily.forEach((d, i) => {
      const li = el('li');
      const name = i === 0 ? 'Today' : parseDay(d.date).toLocaleDateString('en', { weekday: 'short' });
      const info = data.describe(d.code, true);
      li.append(el('b', '', name), icons.svg(info.iconName, { size: 26, label: info.label }),
        el('b', '', degTxt(d.max)), el('span', 'lo', degTxt(d.min)));
      ul.append(li);
    });
  }

  function renderHours() {
    const ul = $('hours');
    ul.replaceChildren();
    wx.hourly.forEach((h, i) => {
      if (i % 2) return;
      const info = data.describe(h.code, true);
      const li = el('li');
      li.append(el('small', '', hourLabel(h.time)), icons.svg(info.iconName, { size: 24, label: info.label }),
        el('b', '', degTxt(h.temperature)), el('small', '', Math.round(h.precipitationChance || 0) + '% rain'));
      ul.append(li);
    });
  }

  function renderChart() {
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--accent').trim();
    const warm = css.getPropertyValue('--warm').trim();
    const quiet = css.getPropertyValue('--quiet').trim();
    const labels = wx.daily.map((d, i) => i === 0 ? 'Today' : parseDay(d.date).toLocaleDateString('en', { weekday: 'short' }));
    if (chart) chart.destroy();
    Chart.defaults.font.family = "'Space Grotesk', sans-serif";
    Chart.defaults.color = quiet;
    chart = new Chart($('chart'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'High (°' + unit + ')', data: wx.daily.map((d) => deg(d.max)), borderColor: warm, backgroundColor: warm, tension: .35, pointRadius: 4 },
          { label: 'Low (°' + unit + ')', data: wx.daily.map((d) => deg(d.min)), borderColor: accent, backgroundColor: accent, tension: .35, pointRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' } },
        scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v) => v + '°' } } }
      }
    });
  }

  function renderAll() {
    renderNow(); renderDays(); renderHours(); renderChart();
    $('credit').textContent = wx.credit || '';
  }

  async function fetchWeather() {
    const id = ++reqId;
    say('');
    try {
      const w = await data.weather(loc.latitude, loc.longitude);
      if (id !== reqId) return;
      wx = w;
      renderAll();
    } catch (e) {
      if (id !== reqId) return;
      say('Could not load the weather for ' + loc.name + '. Check your connection and search again.');
      if (!wx) $('now').replaceChildren(el('p', 'loading', 'No weather to show yet.'));
    }
  }

  $('search').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('q').value.trim();
    const list = $('results');
    list.hidden = true;
    if (!q) { say('Type a city name first.'); return; }
    say('Searching…');
    try {
      const found = await data.places(q);
      if (!found.length) { say('No city called “' + q + '” was found. Try another spelling.'); return; }
      say('');
      list.replaceChildren();
      found.slice(0, 6).forEach((p) => {
        const li = el('li');
        const b = el('button', '', p.name + ' ');
        b.type = 'button';
        b.append(el('small', '', placeLabel(p)));
        b.addEventListener('click', () => {
          loc = p; save('wx-loc', loc);
          list.hidden = true; $('q').value = '';
          fetchWeather();
        });
        li.append(b); list.append(li);
      });
      list.hidden = false;
      list.querySelector('button').focus();
    } catch (err) {
      say('The city search failed. Try again in a moment.');
    }
  });

  document.querySelectorAll('.units button').forEach((b) => {
    b.addEventListener('click', () => {
      unit = b.dataset.unit; save('wx-unit', unit);
      document.querySelectorAll('.units button').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      if (wx) renderAll();
    });
  });
  document.querySelectorAll('.units button').forEach((o) => o.setAttribute('aria-pressed', String(o.dataset.unit === unit)));

  fetchWeather();
})();
