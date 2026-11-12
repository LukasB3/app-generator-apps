const $ = (id) => document.getElementById(id);
const KEY = 'weather-place';
let chart = null;

function msg(t) { $('msg').textContent = t || ''; }
function hm(s) { return s ? s.slice(11, 16) : '–'; }
function dayName(d, i) {
  if (i === 0) return 'Today';
  return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
}

async function search(e) {
  e.preventDefault();
  const q = $('q').value.trim();
  const list = $('matches');
  list.hidden = true;
  if (!q) return;
  msg('Searching…');
  try {
    const found = await data.places(q);
    if (!found.length) { msg('No places found for "' + q + '".'); return; }
    msg('');
    list.textContent = '';
    found.slice(0, 6).forEach((p) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = [p.name, p.region, p.country].filter(Boolean).join(', ');
      b.addEventListener('click', () => { list.hidden = true; choose(p); });
      li.appendChild(b);
      list.appendChild(li);
    });
    list.hidden = false;
    if (found.length === 1) choose(found[0]), list.hidden = true;
  } catch (err) { msg(err.message); }
}

async function choose(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
  msg('Loading weather…');
  try {
    const w = await data.weather(p.latitude, p.longitude);
    show(p, w);
    msg('');
  } catch (err) { msg(err.message); }
}

function show(p, w) {
  const c = w.current, d = w.daily, desc = data.describe(c.code);
  $('place').textContent = [p.name, p.region, p.country].filter(Boolean).join(', ');
  $('time').textContent = 'Local time ' + c.time.replace('T', ' ');
  $('icon').textContent = desc.icon;
  $('temp').textContent = Math.round(c.temperature) + '°C';
  $('label').textContent = desc.label;
  $('feels').textContent = Math.round(c.feelsLike) + '°C';
  $('hum').textContent = Math.round(c.humidity) + '%';
  $('wind').textContent = Math.round(c.wind) + ' km/h';
  $('prec').textContent = c.precipitation + ' mm';
  $('rise').textContent = hm(d[0].sunrise);
  $('set').textContent = hm(d[0].sunset);
  $('now').hidden = false;
  $('forecast').hidden = false;

  const days = d.slice(0, 7);
  const labels = days.map((x, i) => dayName(x.date, i));
  if (chart) chart.destroy();
  chart = new Chart($('chart'), {
    data: {
      labels,
      datasets: [
        { type: 'line', label: 'Max °C', data: days.map((x) => x.max), borderColor: '#e0592a', backgroundColor: '#e0592a', tension: .3, yAxisID: 'y' },
        { type: 'line', label: 'Min °C', data: days.map((x) => x.min), borderColor: '#2467d1', backgroundColor: '#2467d1', tension: .3, yAxisID: 'y' },
        { type: 'bar', label: 'Rain mm', data: days.map((x) => x.precipitation), backgroundColor: '#7fb5ee88', yAxisID: 'y1' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: { title: { display: true, text: '°C' } },
        y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'mm' } },
      },
    },
  });

  const ul = $('days');
  ul.textContent = '';
  days.forEach((x, i) => {
    const li = document.createElement('li');
    const parts = [dayName(x.date, i), data.describe(x.code).icon, Math.round(x.max) + '° / ' + Math.round(x.min) + '°', x.precipitationChance + '% rain'];
    parts.forEach((t, k) => {
      const s = document.createElement('div');
      if (k === 1) s.className = 'e';
      s.textContent = t;
      li.appendChild(s);
    });
    ul.appendChild(li);
  });
  $('credit').textContent = w.credit || '';
}

$('search').addEventListener('submit', search);
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved && saved.latitude != null) { $('q').value = saved.name; choose(saved); }
  else choose({ name: 'Berlin', region: '', country: 'Germany', latitude: 52.52, longitude: 13.41 });
} catch (e) { /* ignore corrupt storage */ }
