const $ = (id) => document.getElementById(id);
const KEY = 'weather-place';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function setMsg(t) { $('msg').textContent = t; }
const deg = (n) => Math.round(n) + '°';

async function show(place) {
  localStorage.setItem(KEY, JSON.stringify(place));
  $('matches').replaceChildren();
  setMsg('Loading forecast…');
  try {
    const w = await data.weather(place.latitude, place.longitude);
    setMsg('');
    render(place, w);
  } catch (err) {
    setMsg('Could not load the forecast: ' + err.message);
  }
}

function render(place, w) {
  const c = w.current, d = data.describe(c.code);
  const cur = $('current');
  cur.hidden = false;
  cur.className = 'card';
  const now = el('div', 'now');
  now.append(el('div', 'icon', d.icon));
  const mid = el('div');
  mid.append(el('div', 'place', [place.name, place.region, place.country].filter(Boolean).join(', ')),
    el('div', 'temp', deg(c.temperature)), el('div', '', d.label));
  now.append(mid);
  const stats = el('div', 'stats');
  [`Feels like ${deg(c.feelsLike)}`, `Humidity ${c.humidity}%`, `Wind ${Math.round(c.wind)} km/h`,
    `Rain ${c.precipitation} mm`].forEach((s) => stats.append(el('span', '', s)));
  cur.replaceChildren(now, stats);

  const h = $('hourly');
  h.replaceChildren();
  w.hourly.forEach((x) => {
    const b = el('div', 'hour');
    b.append(el('div', 'small', x.time.slice(11, 16)), el('div', 'i', data.describe(x.code).icon),
      el('div', '', deg(x.temperature)), el('div', 'small', x.precipitationChance + '%'));
    h.append(b);
  });
  $('hourlyWrap').hidden = false;

  const dl = $('daily');
  dl.replaceChildren();
  w.daily.forEach((x) => {
    const dt = new Date(x.date + 'T12:00');
    const r = el('div', 'day');
    const info = data.describe(x.code);
    r.append(el('strong', '', dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })),
      el('span', 'i', info.icon), el('span', '', `${info.label} · ${x.precipitationChance}% rain`),
      el('span', '', `${deg(x.min)} / ${deg(x.max)}`));
    dl.append(r);
  });
  $('dailyWrap').hidden = false;
  $('credit').textContent = w.credit || '';
}

$('search').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('q').value.trim();
  if (!q) return;
  setMsg('Searching…');
  $('matches').replaceChildren();
  try {
    const res = await data.places(q);
    if (!res.length) { setMsg('No place found for "' + q + '".'); return; }
    setMsg('Pick a place:');
    res.forEach((p) => {
      const li = el('li');
      const b = el('button', '', [p.name, p.region, p.country].filter(Boolean).join(', '));
      b.type = 'button';
      b.addEventListener('click', () => show(p));
      li.append(b);
      $('matches').append(li);
    });
  } catch (err) {
    setMsg('Search failed: ' + err.message);
  }
});

try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved) show(saved);
  else setMsg('Search for a city to see its forecast.');
} catch (e) {
  setMsg('Search for a city to see its forecast.');
}
