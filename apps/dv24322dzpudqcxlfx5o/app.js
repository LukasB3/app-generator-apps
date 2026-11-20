(function () {
  const $ = (id) => document.getElementById(id);
  const KEY = 'currency-dashboard-v1';
  const NAMES = { EUR: 'Euro', USD: 'US dollar', GBP: 'Pound sterling', CHF: 'Swiss franc', JPY: 'Japanese yen', CAD: 'Canadian dollar', AUD: 'Australian dollar', CNY: 'Chinese yuan', INR: 'Indian rupee', SEK: 'Swedish krona', NOK: 'Norwegian krone', DKK: 'Danish krone', PLN: 'Polish zloty', CZK: 'Czech koruna', HUF: 'Hungarian forint', TRY: 'Turkish lira', BRL: 'Brazilian real', MXN: 'Mexican peso', ZAR: 'South African rand' };

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { saved = {}; }
  const state = { amount: saved.amount || '100', from: saved.from || 'EUR', to: saved.to || 'USD', rates: null, chart: null, token: 0 };

  const swapBtn = $('swap');
  swapBtn.append(icons.svg('refresh-cw'));

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ amount: state.amount, from: state.from, to: state.to })); } catch (e) { /* storage unavailable */ }
  }
  function parseAmount() {
    const n = parseFloat(String(state.amount).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : null;
  }
  function fmt(n, max) {
    const abs = Math.abs(n);
    const d = max !== undefined ? max : abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
    return n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: Math.min(2, d) });
  }
  function rate(from, to) { return state.rates[to] / state.rates[from]; }
  function showMsg(text, retry) {
    const m = $('msg');
    m.replaceChildren(document.createTextNode(text));
    if (retry) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = 'Try again';
      b.addEventListener('click', loadRates);
      m.append(b);
    }
    m.hidden = false;
  }

  function fillSelects() {
    const codes = Object.keys(state.rates).sort();
    [['from', state.from], ['to', state.to]].forEach(([id, val]) => {
      const sel = $(id);
      sel.replaceChildren();
      codes.forEach((c) => {
        const o = document.createElement('option');
        o.value = c; o.textContent = NAMES[c] ? c + ' – ' + NAMES[c] : c;
        sel.append(o);
      });
      sel.value = codes.includes(val) ? val : 'EUR';
    });
    state.from = $('from').value; state.to = $('to').value;
  }

  function renderResult() {
    if (!state.rates) return;
    const amt = parseAmount();
    if (amt === null) {
      $('eq').textContent = 'Enter an amount to convert';
      $('big').textContent = '–'; $('unit').textContent = '';
      return;
    }
    const r = rate(state.from, state.to);
    $('eq').textContent = fmt(amt, 4) + ' ' + state.from + ' =';
    $('big').textContent = fmt(amt * r) + ' ' + state.to;
    $('unit').textContent = '1 ' + state.from + ' = ' + fmt(r, 6) + ' ' + state.to + ' · 1 ' + state.to + ' = ' + fmt(1 / r, 6) + ' ' + state.from;
  }

  function renderTable() {
    const q = $('filter').value.trim().toLowerCase();
    const body = $('rows');
    body.replaceChildren();
    const codes = Object.keys(state.rates).filter((c) => c !== 'EUR').sort()
      .filter((c) => !q || c.toLowerCase().includes(q) || (NAMES[c] || '').toLowerCase().includes(q));
    if (!codes.length) {
      const tr = document.createElement('tr'), td = document.createElement('td');
      td.colSpan = 2; td.className = 'empty'; td.textContent = 'No currency matches “' + q + '”.';
      tr.append(td); body.append(tr); return;
    }
    codes.forEach((c) => {
      const tr = document.createElement('tr');
      tr.tabIndex = 0;
      if (state.from === 'EUR' && state.to === c) tr.className = 'sel';
      const a = document.createElement('td'), b = document.createElement('b');
      b.textContent = c; a.append(b, document.createTextNode(NAMES[c] || ''));
      const n = document.createElement('td'); n.className = 'num'; n.textContent = fmt(state.rates[c], 4);
      tr.append(a, n);
      const pick = () => { state.from = 'EUR'; state.to = c; syncSelects(); update(); };
      tr.addEventListener('click', pick);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      body.append(tr);
    });
  }

  function syncSelects() { $('from').value = state.from; $('to').value = state.to; }

  function setStats(hi, lo, chg, cls) {
    $('hi').textContent = hi; $('lo').textContent = lo;
    const c = $('chg'); c.textContent = chg; c.className = 'v ' + (cls || '');
  }

  async function loadChart() {
    const token = ++state.token;
    const { from, to } = state;
    $('charttitle').textContent = from + ' to ' + to + ', last 90 days';
    const cm = $('chartmsg');
    if (state.chart) { state.chart.destroy(); state.chart = null; }
    if (from === to) {
      setStats('–', '–', '–'); cm.textContent = 'Both currencies are the same, so the rate stays at 1. Pick two different currencies to see a chart.'; cm.hidden = false; return;
    }
    setStats('…', '…', '…');
    cm.textContent = 'Loading chart…'; cm.hidden = false;
    try {
      const h = await data.rateHistory(from, to, 90);
      if (token !== state.token) return;
      const pts = (h.points || []).filter((p) => isFinite(p.rate));
      if (pts.length < 2) throw new Error('Not enough history for this pair.');
      const vals = pts.map((p) => p.rate);
      const hi = Math.max(...vals), lo = Math.min(...vals);
      const pct = (vals[vals.length - 1] / vals[0] - 1) * 100;
      setStats(fmt(hi, 4), fmt(lo, 4), (pct >= 0 ? '+' : '') + pct.toFixed(2) + ' %', pct >= 0 ? 'up' : 'down');
      cm.hidden = true;
      const css = getComputedStyle(document.documentElement);
      const accent = css.getPropertyValue('--accent').trim(), quiet = css.getPropertyValue('--quiet').trim(), line = css.getPropertyValue('--line').trim();
      Chart.defaults.font.family = "'Inter', sans-serif";
      Chart.defaults.color = quiet;
      state.chart = new Chart($('chart'), {
        type: 'line',
        data: { labels: pts.map((p) => p.date), datasets: [{ label: from + ' to ' + to, data: vals, borderColor: accent, backgroundColor: accent + '22', fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.parsed.y, 4) + ' ' + to } } },
          scales: { x: { ticks: { maxTicksLimit: 5, maxRotation: 0 }, grid: { display: false } }, y: { ticks: { maxTicksLimit: 6 }, grid: { color: line } } }
        }
      });
      if (h.credit) $('credit').textContent = h.credit;
    } catch (e) {
      if (token !== state.token) return;
      setStats('–', '–', '–');
      cm.textContent = 'The chart could not be loaded: ' + (e.message || 'unknown error') + ' Change the pair or try again later.';
      cm.hidden = false;
    }
  }

  function update() {
    persist();
    renderResult();
    renderTable();
    loadChart();
  }

  async function loadRates() {
    $('msg').hidden = true;
    $('asof').textContent = "Loading today's rates…";
    try {
      const r = await data.rates('EUR');
      state.rates = Object.assign({}, r.rates, { EUR: 1 });
      $('asof').textContent = 'ECB rates of ' + r.date;
      if (r.credit) $('credit').textContent = r.credit;
      fillSelects();
      update();
    } catch (e) {
      $('asof').textContent = 'Rates unavailable';
      $('rows').replaceChildren();
      const tr = document.createElement('tr'), td = document.createElement('td');
      td.colSpan = 2; td.className = 'empty'; td.textContent = 'No rates to show yet.';
      tr.append(td); $('rows').append(tr);
      $('big').textContent = '–';
      showMsg("Today's rates could not be loaded: " + (e.message || 'unknown error') + '.', true);
    }
  }

  $('amount').value = state.amount;
  $('amount').addEventListener('input', (e) => { state.amount = e.target.value; persist(); renderResult(); });
  $('from').addEventListener('change', (e) => { state.from = e.target.value; update(); });
  $('to').addEventListener('change', (e) => { state.to = e.target.value; update(); });
  swapBtn.addEventListener('click', () => {
    if (!state.rates) return;
    [state.from, state.to] = [state.to, state.from]; syncSelects(); update();
  });
  $('form').addEventListener('submit', (e) => e.preventDefault());
  $('filter').addEventListener('input', () => { if (state.rates) renderTable(); });

  loadRates();
})();
