const seg = document.getElementById('seg');
const tilesEl = document.getElementById('tiles');
const rowsEl = document.getElementById('rows');
let chart = null;
let selected = ['web', 'market', 'retail'];
const FILTERS = [{ id: 'all', label: 'All channels' }].concat(CHANNELS.map((c) => ({ id: c.id, label: c.name })));

const eur = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-GB');

function monthTotals(i) {
  const t = { orders: 0, revenue: 0, returning: 0 };
  selected.forEach((id) => {
    const s = SALES[id][i];
    t.orders += s.orders; t.revenue += s.revenue; t.returning += s.returning;
  });
  t.aov = t.orders ? t.revenue / t.orders : 0;
  return t;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderTiles() {
  const last = MONTHS.length - 1;
  const cur = monthTotals(last), prev = monthTotals(last - 1);
  const defs = [
    ['Revenue', 'revenue', (v) => eur.format(v)],
    ['Orders', 'orders', (v) => num.format(v)],
    ['Average order value', 'aov', (v) => eur2.format(v)],
    ['Returning customers', 'returning', (v) => num.format(v)]
  ];
  tilesEl.replaceChildren();
  defs.forEach(([label, key, fmt]) => {
    const change = prev[key] ? (cur[key] - prev[key]) / prev[key] * 100 : 0;
    const up = change >= 0;
    const tile = el('article', 'tile');
    tile.append(el('h2', '', label), el('div', 'val', fmt(cur[key])));
    const d = el('div', 'delta ' + (up ? 'up' : 'down'));
    d.append(icons.svg(up ? 'trending-up' : 'trending-down', { size: 18 }));
    d.append(el('span', '', (up ? '+' : '') + change.toFixed(1) + '%'));
    d.append(el('small', '', 'vs ' + MONTHS[last - 1]));
    tile.append(d);
    tilesEl.append(tile);
  });
  document.querySelector('#tiles').setAttribute('aria-label', 'Key figures for ' + MONTHS[last]);
}

function channelLabel() {
  return selected.length === CHANNELS.length ? 'all channels' : CHANNELS.find((c) => c.id === selected[0]).name;
}

function renderChart() {
  const css = getComputedStyle(document.documentElement);
  const text = css.getPropertyValue('--quiet').trim();
  const grid = css.getPropertyValue('--line').trim();
  const labels = MONTHS.map((m) => m.slice(0, 3));
  const datasets = CHANNELS.filter((c) => selected.includes(c.id)).map((c) => ({
    label: c.name, data: SALES[c.id].map((s) => s.revenue), backgroundColor: c.color, borderRadius: 2
  }));
  if (chart) chart.destroy();
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = text;
  chart = new Chart(document.getElementById('chart'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: datasets.length > 1, position: 'bottom' },
        tooltip: {
          callbacks: {
            title: (items) => MONTHS[items[0].dataIndex],
            label: (c) => c.dataset.label + ': ' + eur.format(c.parsed.y)
          }
        }
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true, grid: { color: grid }, beginAtZero: true,
          ticks: { callback: (v) => '€' + (v / 1000) + 'k', maxTicksLimit: 6 }
        }
      }
    }
  });
  const total = MONTHS.reduce((s, m, i) => s + monthTotals(i).revenue, 0);
  document.getElementById('chartsub').textContent = 'From ' + MONTHS[0] + ' to ' + MONTHS[MONTHS.length - 1] + ', ' + channelLabel() + ': ' + eur.format(total) + ' in total';
}

function renderTable() {
  const list = PRODUCTS.map((p, i) => {
    const units = selected.reduce((s, id) => s + PRODUCT_UNITS[i][id], 0);
    return { name: p.name, units, revenue: units * p.price };
  }).sort((a, b) => b.units - a.units).slice(0, 10);
  const max = list[0].units || 1;
  rowsEl.replaceChildren();
  list.forEach((p, i) => {
    const tr = el('tr');
    const name = el('td');
    const bar = el('div', 'bar');
    const fill = el('i');
    fill.style.width = (p.units / max * 100) + '%';
    bar.append(fill);
    name.append(el('div', 'pname', p.name), bar);
    tr.append(el('td', 'rank', String(i + 1)), name, el('td', 'n', num.format(p.units)), el('td', 'n', eur.format(p.revenue)));
    rowsEl.append(tr);
  });
  document.getElementById('tablesub').textContent = 'By units sold over twelve months, ' + channelLabel();
}

function render() {
  renderTiles(); renderChart(); renderTable();
}

FILTERS.forEach((f, i) => {
  const label = el('label');
  const input = el('input');
  input.type = 'radio'; input.name = 'channel'; input.value = f.id;
  if (i === 0) input.checked = true;
  input.addEventListener('change', () => {
    selected = f.id === 'all' ? CHANNELS.map((c) => c.id) : [f.id];
    try { localStorage.setItem('sales-channel', f.id); } catch (e) {}
    render();
  });
  label.append(input, el('span', '', f.label));
  seg.append(label);
});

try {
  const saved = localStorage.getItem('sales-channel');
  const input = saved && seg.querySelector('input[value="' + saved + '"]');
  if (input) { input.checked = true; input.dispatchEvent(new Event('change')); }
  else render();
} catch (e) { render(); }

document.getElementById('range').textContent = MONTHS[0] + ' to ' + MONTHS[MONTHS.length - 1];
