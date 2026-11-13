const $ = (id) => document.getElementById(id);
const KEY = 'weather-place';
let chart = null;

function setMsg(t) { $('msg').textContent = t; }

function add(parent, tag, text, cls) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (cls) el.className = cls;
  parent.appendChild(el);
  return el;
}

function dayName(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
}

async function show(place) {
  localStorage.setItem(KEY, JSON.stringify(place));
  $('matches').hidden = true;
  setMsg('Loading weather…');
  try {
    const w = await data.weather(place.latitude, place.longitude);
    setMsg('');
    const c = w.current;
    const d = data.describe(c.code);
    $('place').textContent = [place.name, place.region, place.country].filter(Boolean).join(', ');
    $('icon').textContent = d.icon;
    $('temp').textContent = Math.round(c.temperature) + '°C';
    $('label').textContent = d.label + ' · feels like ' + Math.round(c.feelsLike) + '°C';
    const facts = $('facts');
    facts.textContent = '';
    const today = w.daily[0];
    [
      ['Humidity', c.humidity + '%'],
      ['Wind', Math.round(c.wind) + ' km/h'],
      ['Precipitation', c.precipitation + ' mm'],
      ['Today', Math.round(today.min) + '° / ' + Math.round(today.max) + '°'],
      ['Sunrise', today.sunrise.slice(11)],
      ['Sunset', today.sunset.slice(11)],
    ].forEach(([k, v]) => {
      const box = add(facts, 'div', '');
      add(box, 'dt', k);
      add(box, 'dd', v);
    });
    $('current').hidden = false;
    $('forecast').hidden = false;

    const days = w.daily.slice(0, 7);
    if (chart) chart.destroy();
    chart = new Chart($('chart'), {
      data: {
        labels: days.map((x) => dayName(x.date)),
        datasets: [
          { type: 'line', label: 'Max °C', data: days.map((x) => x.max), borderColor: '#e76f51', backgroundColor: '#e76f51', tension: .3, yAxisID: 'y' },
          { type: 'line', label: 'Min °C', data: days.map((x) => x.min), borderColor: '#2a9d8f', backgroundColor: '#2a9d8f', tension: .3, yAxisID: 'y' },
          { type: 'bar', label: 'Rain mm', data: days.map((x) => x.precipitation), backgroundColor: '#8ecae666', yAxisID: 'y1' },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { title: { display: true, text: '°C' } },
          y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'mm' } },
        },
      },
    });
    const list = $('days');
    list.textContent = '';
    days.forEach((x) => {
      const box = add(list, 'div', '');
      add(box, 'b', dayName(x.date));
      add(box, 'div', data.describe(x.code).icon, 'e');
      add(box, 'div', Math.round(x.min) + '° / ' + Math.round(x.max) + '°');
      add(box, 'div', (x.precipitationChance ?? 0) + '% rain');
    });
    $('credit').textContent = w.credit || '';
  } catch (e) {
    setMsg('Could not load weather: ' + e.message);
  }
}

$('search').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const q = $('q').value.trim();
  if (!q) return;
  setMsg('Searching…');
  try {
    const res = await data.places(q);
    const ul = $('matches');
    ul.textContent = '';
    if (!res.length) { ul.hidden = true; setMsg('No places found.'); return; }
    if (res.length === 1) { setMsg(''); show(res[0]); return; }
    setMsg('Pick a place:');
    res.forEach((p) => {
      const li = add(ul, 'li', '');
      const b = add(li, 'button', [p.name, p.region, p.country].filter(Boolean).join(', '));
      b.type = 'button';
      b.addEventListener('click', () => { setMsg(''); show(p); });
    });
    ul.hidden = false;
  } catch (e) {
    setMsg('Search failed: ' + e.message);
  }
});

try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved && typeof saved.latitude === 'number') show(saved);
  else setMsg('Search for a city to begin.');
} catch (e) {
  setMsg('Search for a city to begin.');
}
