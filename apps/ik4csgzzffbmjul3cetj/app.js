const $ = (id) => document.getElementById(id);
let chart = null;

function setMsg(t) { $('msg').textContent = t; }

function dirName(deg) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}

function stat(label, value) {
  const d = document.createElement('div');
  d.className = 'stat';
  const s = document.createElement('small');
  s.textContent = label;
  d.append(s, document.createTextNode(value));
  return d;
}

function dayName(date) {
  return new Date(date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' });
}

async function show(place) {
  $('matches').hidden = true;
  setMsg('Loading weather…');
  try {
    const w = await data.weather(place.latitude, place.longitude);
    localStorage.setItem('weather-place', JSON.stringify(place));
    const c = w.current;
    const d = data.describe(c.code);
    $('place').textContent = [place.name, place.region, place.country].filter(Boolean).join(', ');
    $('icon').textContent = d.icon;
    $('temp').textContent = Math.round(c.temperature) + '°C';
    $('label').textContent = d.label + ' · feels like ' + Math.round(c.feelsLike) + '°C';
    const st = $('stats');
    st.replaceChildren(
      stat('Humidity', c.humidity + '%'),
      stat('Wind', Math.round(c.wind) + ' km/h ' + dirName(c.windDirection)),
      stat('Precipitation', c.precipitation + ' mm'),
      stat('Today', Math.round(w.daily[0].min) + '° / ' + Math.round(w.daily[0].max) + '°')
    );
    $('now').hidden = false;

    const days = w.daily.slice(0, 7);
    const labels = days.map((x) => dayName(x.date));
    if (chart) chart.destroy();
    chart = new Chart($('chart'), {
      data: {
        labels,
        datasets: [
          { type: 'line', label: 'Max °C', data: days.map((x) => x.max), borderColor: '#ef4444', backgroundColor: '#ef4444', tension: 0.3, yAxisID: 'y' },
          { type: 'line', label: 'Min °C', data: days.map((x) => x.min), borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.3, yAxisID: 'y' },
          { type: 'bar', label: 'Rain mm', data: days.map((x) => x.precipitation), backgroundColor: 'rgba(14,165,233,.35)', yAxisID: 'y1' }
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
    const dl = $('days');
    dl.replaceChildren(...days.map((x) => {
      const e = document.createElement('div');
      e.className = 'day';
      const ic = document.createElement('span');
      ic.textContent = data.describe(x.code).icon;
      e.append(dayName(x.date), ic, Math.round(x.max) + '° / ' + Math.round(x.min) + '°');
      return e;
    }));
    $('forecast').hidden = false;
    $('credit').textContent = w.credit || '';
    setMsg('');
  } catch (e) {
    setMsg('Could not load weather: ' + e.message);
  }
}

$('search').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const q = $('q').value.trim();
  if (!q) return;
  setMsg('Searching…');
  const ul = $('matches');
  ul.hidden = true;
  try {
    const res = await data.places(q);
    if (!res.length) { setMsg('No places found for "' + q + '".'); return; }
    if (res.length === 1) { show(res[0]); return; }
    ul.replaceChildren(...res.map((p) => {
      const li = document.createElement('li');
      li.tabIndex = 0;
      li.textContent = [p.name, p.region, p.country].filter(Boolean).join(', ');
      li.addEventListener('click', () => show(p));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') show(p); });
      return li;
    }));
    ul.hidden = false;
    setMsg('Pick a place:');
  } catch (e) {
    setMsg('Search failed: ' + e.message);
  }
});

let saved = null;
try { saved = JSON.parse(localStorage.getItem('weather-place')); } catch (e) { /* ignore */ }
show(saved || { name: 'Berlin', region: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.41 });
