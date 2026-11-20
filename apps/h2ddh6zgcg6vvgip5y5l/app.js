(function () {
  const $ = (id) => document.getElementById(id);
  const DEFAULT = { name: 'Berlin', region: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.41 };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  let place = store.get('wx-place', DEFAULT);
  let unit = store.get('wx-unit', 'c');
  let wx = null;
  let chart = null;
  let token = 0;

  const temp = (c) => Math.round(unit === 'f' ? c * 9 / 5 + 32 : c);
  const deg = (c) => temp(c) + '°';
  const wind = (kmh) => unit === 'f' ? Math.round(kmh * 0.621) + ' mph' : Math.round(kmh) + ' km/h';
  const rainAmt = (mm) => unit === 'f' ? (mm / 25.4).toFixed(2) + ' in' : (Math.round(mm * 10) / 10) + ' mm';
  const parse = (s) => new Date(s.length === 10 ? s + 'T12:00' : s);
  const placeLine = (p) => [p.name, p.region, p.country].filter((x, i, a) => x && a.indexOf(x) === i).join(', ');

  function icon(name, size, label) {
    return icons.svg(name || 'cloud', { size: size, strokeWidth: 1.6, label: label });
  }
  function status(msg, isError) {
    const s = $('status');
    s.hidden = !msg;
    s.textContent = msg || '';
    s.className = 'status' + (isError ? ' error' : '');
  }

  async function load() {
    const my = ++token;
    $('dash').setAttribute('aria-busy', 'true');
    $('place').textContent = place.name;
    status('');
    try {
      const w = await data.weather(place.latitude, place.longitude);
      if (my !== token) return;
      wx = w;
      render();
      $('dash').setAttribute('aria-busy', 'false');
    } catch (e) {
      if (my !== token) return;
      status('Could not load the weather for ' + place.name + '. ' + (e && e.message ? e.message : '') + ' Check your connection and search again.', true);
      $('when').textContent = 'Unavailable';
      $('label').textContent = 'No data';
    }
  }

  function render() {
    const c = wx.current;
    const d = data.describe(c.code, c.isDay);
    $('place').textContent = placeLine(place);
    $('when').textContent = 'Now, ' + parse(c.time).toLocaleString('en', { weekday: 'long', hour: 'numeric', minute: '2-digit' });
    $('icon').replaceChildren(icon(d.iconName, 88));
    $('temp').textContent = deg(c.temperature);
    $('label').textContent = d.label;
    $('feels').textContent = deg(c.feelsLike);
    $('hum').textContent = Math.round(c.humidity) + '%';
    $('wind').textContent = wind(c.wind);
    $('rain').textContent = rainAmt(c.precipitation);
    $('credit').textContent = wx.credit || '';

    const days = $('days');
    days.replaceChildren();
    wx.daily.slice(0, 7).forEach((day, i) => {
      const dd = data.describe(day.code, true);
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = i === 0 ? 'Today' : parse(day.date).toLocaleDateString('en', { weekday: 'short' });
      const ic = document.createElement('span');
      ic.appendChild(icon(dd.iconName, 24));
      const cond = document.createElement('span');
      cond.className = 'cond';
      cond.textContent = dd.label + ', ' + Math.round(day.precipitationChance || 0) + '% rain';
      const rng = document.createElement('span');
      rng.className = 'rng';
      const lo = document.createElement('span');
      lo.className = 'lo';
      lo.textContent = ' ' + deg(day.min);
      rng.append(deg(day.max), lo);
      li.append(name, ic, cond, rng);
      days.appendChild(li);
    });

    const hl = $('hourly');
    hl.replaceChildren();
    const now = parse(c.time).getTime() - 3600000;
    wx.hourly.filter((h) => parse(h.time).getTime() >= now).slice(0, 24).forEach((h) => {
      const li = document.createElement('li');
      const t = document.createElement('div');
      t.textContent = parse(h.time).toLocaleTimeString('en', { hour: 'numeric' });
      const hd = data.describe(h.code, true);
      const ic = document.createElement('div');
      ic.appendChild(icon(hd.iconName, 24));
      const tt = document.createElement('div');
      tt.textContent = deg(h.temperature);
      const p = document.createElement('div');
      p.className = 'p';
      p.textContent = Math.round(h.precipitationChance || 0) + '%';
      li.append(t, ic, tt, p);
      hl.appendChild(li);
    });
    drawChart();
  }

  function drawChart() {
    const days = wx.daily.slice(0, 7);
    const labels = days.map((d, i) => i === 0 ? 'Today' : parse(d.date).toLocaleDateString('en', { weekday: 'short' }));
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--accent').trim();
    const deep = css.getPropertyValue('--deep').trim();
    const quiet = css.getPropertyValue('--quiet').trim();
    if (chart) chart.destroy();
    Chart.defaults.font.family = "'Space Grotesk', sans-serif";
    Chart.defaults.color = quiet;
    chart = new Chart($('chart'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'High', data: days.map((d) => temp(d.max)), borderColor: deep, backgroundColor: deep, tension: .3, pointRadius: 4, borderWidth: 3 },
          { label: 'Low', data: days.map((d) => temp(d.min)), borderColor: accent, backgroundColor: accent + '33', tension: .3, pointRadius: 4, borderWidth: 2, borderDash: [6, 4], fill: 0 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
          tooltip: { callbacks: { label: (x) => x.dataset.label + ': ' + x.parsed.y + '°' + unit.toUpperCase() } }
        },
        scales: {
          y: { ticks: { callback: (v) => v + '°' }, grid: { color: '#cdd4bd' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // search
  const q = $('q'), list = $('matches');
  function closeList() { list.hidden = true; list.replaceChildren(); }
  function choose(p) {
    place = p;
    store.set('wx-place', p);
    q.value = '';
    closeList();
    load();
  }
  $('search').addEventListener('submit', async (e) => {
    e.preventDefault();
    const term = q.value.trim();
    if (!term) { q.focus(); return; }
    list.hidden = false;
    list.replaceChildren();
    const li = document.createElement('li');
    li.className = 'none';
    li.textContent = 'Searching…';
    list.appendChild(li);
    try {
      const res = await data.places(term);
      list.replaceChildren();
      if (!res.length) {
        li.textContent = 'No city found for “' + term + '”. Try another spelling.';
        list.appendChild(li);
        return;
      }
      res.slice(0, 6).forEach((p) => {
        const item = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = p.name + ' ';
        const s = document.createElement('small');
        s.textContent = [p.region, p.country].filter(Boolean).join(', ');
        b.appendChild(s);
        b.addEventListener('click', () => choose(p));
        item.appendChild(b);
        list.appendChild(item);
      });
      list.querySelector('button').focus();
    } catch (err) {
      li.textContent = 'Search failed. ' + (err && err.message ? err.message : '') + ' Try again in a moment.';
      list.replaceChildren(li);
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeList(); } });
  document.addEventListener('click', (e) => { if (!$('search').contains(e.target)) closeList(); });

  document.querySelectorAll('.units button').forEach((b) => {
    b.addEventListener('click', () => {
      unit = b.dataset.unit;
      store.set('wx-unit', unit);
      sync();
      if (wx) render();
    });
  });
  function sync() {
    document.querySelectorAll('.units button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === unit)));
  }
  sync();
  load();
})();
