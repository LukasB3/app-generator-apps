const $ = (id) => document.getElementById(id);
const KEY = 'weather-place';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const deg = (n) => Math.round(n) + '°';

async function show(place) {
  $('matches').replaceChildren();
  $('msg').textContent = 'Loading…';
  try {
    const w = await data.weather(place.latitude, place.longitude);
    localStorage.setItem(KEY, JSON.stringify(place));
    render(place, w);
    $('msg').textContent = '';
  } catch (e) {
    $('msg').textContent = 'Could not load the forecast: ' + e.message;
  }
}

function render(place, w) {
  const c = w.current, d = data.describe(c.code);
  $('view').hidden = false;
  $('place').textContent = [place.name, place.region, place.country].filter(Boolean).join(', ');
  $('icon').textContent = d.icon;
  $('temp').textContent = deg(c.temperature) + 'C';
  $('label').textContent = d.label;
  $('details').textContent = `Feels like ${deg(c.feelsLike)} · Humidity ${c.humidity}% · Wind ${Math.round(c.wind)} km/h · Rain ${c.precipitation} mm`;

  const h = $('hourly');
  h.replaceChildren();
  w.hourly.forEach((x) => {
    const box = el('div', 'hour');
    box.append(el('div', '', x.time.slice(11, 16)), el('div', '', data.describe(x.code).icon),
      el('div', '', deg(x.temperature)), el('div', 'muted', (x.precipitationChance ?? 0) + '%'));
    h.append(box);
  });

  const dl = $('daily');
  dl.replaceChildren();
  w.daily.forEach((x) => {
    const dt = new Date(x.date + 'T12:00');
    const row = el('div', 'day');
    const info = data.describe(x.code).label + ' · ' + (x.precipitationChance ?? 0) + '% rain';
    row.append(el('strong', '', dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })),
      el('span', 'ic', data.describe(x.code).icon), el('span', 'muted', info),
      el('span', '', `${deg(x.min)} / ${deg(x.max)}`));
    dl.append(row);
  });
  $('credit').textContent = w.credit || '';
}

$('search').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const q = $('q').value.trim();
  if (!q) return;
  const list = $('matches');
  list.replaceChildren();
  $('msg').textContent = 'Searching…';
  try {
    const res = await data.places(q);
    if (!res.length) { $('msg').textContent = 'No places found.'; return; }
    $('msg').textContent = '';
    res.forEach((p) => {
      const li = el('li');
      const b = el('button', '', [p.name, p.region, p.country].filter(Boolean).join(', '));
      b.type = 'button';
      b.addEventListener('click', () => show(p));
      li.append(b);
      list.append(li);
    });
  } catch (e) {
    $('msg').textContent = 'Search failed: ' + e.message;
  }
});

try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved && typeof saved.latitude === 'number') show(saved);
  else $('msg').textContent = 'Search for a city to see its forecast.';
} catch (e) {
  $('msg').textContent = 'Search for a city to see its forecast.';
}
