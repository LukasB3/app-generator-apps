const $ = (id) => document.getElementById(id);
const KEY = 'weather-place';
let chart = null;

function setMsg(t) { $('msg').textContent = t; }

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function hm(s) { return s ? s.slice(11, 16) : '–'; }

function dayName(d, i) {
  if (i === 0) return 'Today';
  return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
}

async function show(place) {
  localStorage.setItem(KEY, JSON.stringify(place));
  $('matches').hidden = true;
  setMsg('Loading weather…');
  try {
    const w = await data.weather(place.latitude, place.longitude);
    const c = w.current, d = data.describe(c.code);
    $('place').textContent = [place.name, place.region, place.country].filter(Boolean).join(', ');
    $('when').textContent = 'Updated ' + c.time.replace('T', ' ');
    $('icon').textContent = d.icon;
    $('temp').textContent = Math.round(c.temperature) + '°C';
    $('label').textContent = d.label + (c.isDay ? '' : ' (night)');
    $('feels').textContent = Math.round(c.feelsLike) + '°C';
    $('hum').textContent = Math.round(c.humidity) + '%';
    $('wind').textContent = Math.round(c.wind) + ' km/h';
    $('prec').textContent = c.precipitation + ' mm';
    $('rise').textContent = hm(w.daily[0] && w.daily[0].sunrise);
    $('set').textContent = hm(w.daily[0] && w.daily[0].sunset);
    $('now').hidden = false;
    drawForecast(w.daily.slice(0, 7));
    $('credit').textContent = w.credit || '';
    setMsg('');
  } catch (e) {
    setMsg('Could not load weather: ' + e.message);
  }
}

function drawForecast(days) {
  $('forecast').hidden = false;
  const labels = days.map((x, i) => dayName(x.date, i));
  if (chart) chart.destroy();
  chart = new Chart($('chart'), {
    data: {
      labels,
      datasets: [
        { type: 'line', label: 'Max °C', data: days.map((x) => x.max), borderColor: '#e8590c', backgroundColor: '#e8590c', tension: .3, yAxisID: 'y' },
        { type: 'line', label: 'Min °C', data: days.map((x) => x.min), borderColor: '#1c7ed6', backgroundColor: '#1c7ed6', tension: .3, yAxisID: 'y' },
        { type: 'bar', label: 'Rain mm', data: days.map((x) => x.precipitation), backgroundColor: '#74c0fc99', yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: { title: { display: true, text: '°C' } },
        y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'mm' } }
      }
    }
  });
  const box = $('days');
  box.textContent = '';
  days.forEach((x, i) => {
    const cell = el('div');
    cell.append(el('strong', '', labels[i]), el('div', 'e', data.describe(x.code).icon),
      el('div', '', Math.round(x.max) + '° / ' + Math.round(x.min) + '°'),
      el('div', '', (x.precipitationChance ?? 0) + '% rain'));
    box.append(cell);
  });
}

$('search').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const q = $('q').value.trim();
  if (!q) return;
  setMsg('Searching…');
  const list = $('matches');
  list.hidden = true;
  list.textContent = '';
  try {
    const found = await data.places(q);
    if (!found.length) { setMsg('No places found for “' + q + '”.'); return; }
    if (found.length === 1) { show(found[0]); return; }
    found.forEach((p) => {
      const li = el('li');
      const b = el('button', '', [p.name, p.region, p.country].filter(Boolean).join(', '));
      b.type = 'button';
      b.addEventListener('click', () => show(p));
      li.append(b);
      list.append(li);
    });
    list.hidden = false;
    setMsg('Pick a match:');
  } catch (e) {
    setMsg('Search failed: ' + e.message);
  }
});

let saved = null;
try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* ignore */ }
show(saved && saved.latitude !== undefined ? saved : { name: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.41 });
