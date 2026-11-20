(function () {
  var DEFAULTS = [
    { name: 'Lisbon', region: 'Lisbon', country: 'Portugal', latitude: 38.7223, longitude: -9.1393 },
    { name: 'Copenhagen', region: 'Capital Region', country: 'Denmark', latitude: 55.6761, longitude: 12.5683 }
  ];
  var KEY = 'trip-weather-cities';
  var cities = load();
  var forecasts = [null, null];
  var chart = null;
  var tokens = [0, 0];

  var pickersEl = document.getElementById('pickers');
  var statusEl = document.getElementById('status');
  var contentEl = document.getElementById('content');
  var creditEl = document.getElementById('credit');
  var matchEls = [];
  var nameEls = [];
  var whereEls = [];

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(s) && s.length === 2 && s.every(function (c) {
        return c && typeof c.name === 'string' && isFinite(c.latitude) && isFinite(c.longitude);
      })) return s;
    } catch (e) { /* fall through */ }
    return DEFAULTS.map(function (c) { return Object.assign({}, c); });
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cities)); } catch (e) { /* ignore */ }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function placeLine(c) {
    return [c.region, c.country].filter(function (x) { return x && x !== c.name; }).join(', ');
  }

  function buildPickers() {
    ['a', 'b'].forEach(function (k, i) {
      var box = el('div', 'picker ' + k);
      var name = el('div', 'name', cities[i].name);
      var where = el('div', 'where', placeLine(cities[i]));
      var form = el('form');
      var wrap = el('div');
      wrap.style.flex = '1';
      wrap.style.minWidth = '0';
      var label = el('label', '', 'Change city ' + (i + 1));
      var id = 'city' + i;
      label.htmlFor = id;
      var input = el('input');
      input.type = 'search'; input.id = id; input.maxLength = 60;
      input.placeholder = 'Search a city'; input.autocomplete = 'off';
      wrap.append(label, input);
      var btn = el('button', 'go', 'Search');
      btn.type = 'submit';
      btn.style.alignSelf = 'flex-end';
      form.append(wrap, btn);
      var list = el('ul', 'matches');
      box.append(name, where, form, list);
      pickersEl.append(box);
      nameEls[i] = name; whereEls[i] = where; matchEls[i] = list;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        search(i, input.value.trim(), input);
      });
    });
  }

  function search(i, q, input) {
    var list = matchEls[i];
    list.replaceChildren();
    if (q.length < 2) {
      list.append(el('li', 'msg', 'Type at least two letters.'));
      return;
    }
    list.append(el('li', 'msg', 'Searching…'));
    data.places(q).then(function (res) {
      list.replaceChildren();
      if (!res || !res.length) {
        list.append(el('li', 'msg', 'No place found for “' + q + '”. Try another spelling.'));
        return;
      }
      res.slice(0, 5).forEach(function (p) {
        var li = el('li');
        var b = el('button', '', p.name + (placeLine(p) ? ' · ' + placeLine(p) : ''));
        b.type = 'button';
        b.addEventListener('click', function () {
          cities[i] = { name: p.name, region: p.region || '', country: p.country || '', latitude: p.latitude, longitude: p.longitude };
          save();
          list.replaceChildren();
          input.value = '';
          nameEls[i].textContent = p.name;
          whereEls[i].textContent = placeLine(cities[i]);
          fetchCity(i);
        });
        li.append(b);
        list.append(li);
      });
    }).catch(function (err) {
      list.replaceChildren();
      list.append(el('li', 'msg', 'Search failed: ' + (err && err.message ? err.message : 'unknown error') + '. Try again in a moment.'));
    });
  }

  function fetchCity(i) {
    var t = ++tokens[i];
    forecasts[i] = null;
    setStatus('Loading the forecast…');
    data.weather(cities[i].latitude, cities[i].longitude).then(function (w) {
      if (t !== tokens[i]) return;
      forecasts[i] = w;
      if (forecasts[0] && forecasts[1]) render();
    }).catch(function (err) {
      if (t !== tokens[i]) return;
      setStatus('Could not load the forecast for ' + cities[i].name + ': ' + (err && err.message ? err.message : 'unknown error') + '. Pick the city again to retry.', true);
    });
  }

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (isError ? ' error' : '');
    if (msg) contentEl.hidden = true;
  }

  function dayName(s) {
    var p = String(s).split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function shortDay(s) {
    var p = String(s).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
  }
  function num(v) { return isFinite(v) ? v : 0; }

  // lower is better: far from a pleasant 22°C, likely and heavy rain count against a day
  function penalty(d) {
    return Math.abs(num(d.max) - 22) * 1.5 + num(d.precipitationChance) * 0.4 + num(d.precipitation) * 3;
  }

  function render() {
    setStatus('');
    contentEl.hidden = false;
    var A = forecasts[0].daily.slice(0, 7);
    var B = forecasts[1].daily.slice(0, 7);
    var n = Math.min(A.length, B.length);
    var wins = [0, 0], rows = [];
    for (var k = 0; k < n; k++) {
      var diff = penalty(A[k]) - penalty(B[k]);
      var w = Math.abs(diff) < 3 ? -1 : (diff < 0 ? 0 : 1);
      if (w >= 0) wins[w]++;
      rows.push(w);
    }
    verdict(wins, n, A, B);
    days(A, B, rows, n);
    drawChart(A, B, n);
    creditEl.textContent = forecasts[0].credit || '';
  }

  function avg(arr, f) {
    if (!arr.length) return 0;
    return arr.reduce(function (s, d) { return s + num(d[f]); }, 0) / arr.length;
  }

  function verdict(wins, n, A, B) {
    var a = cities[0].name, b = cities[1].name;
    var head = document.getElementById('verdictHead');
    var text = document.getElementById('verdictText');
    var ties = n - wins[0] - wins[1];
    var ha = avg(A.slice(0, n), 'max'), hb = avg(B.slice(0, n), 'max');
    var ra = avg(A.slice(0, n), 'precipitationChance'), rb = avg(B.slice(0, n), 'precipitationChance');
    if (wins[0] === wins[1]) head.textContent = 'Too close to call';
    else head.textContent = (wins[0] > wins[1] ? a : b) + ' has the better week';
    var parts = [
      a + ' wins ' + wins[0] + ' of ' + n + ' days, ' + b + ' wins ' + wins[1] + (ties ? ', ' + ties + ' too close to separate' : '') + '.',
      'Average high: ' + a + ' ' + ha.toFixed(0) + '°C, ' + b + ' ' + hb.toFixed(0) + '°C. Average chance of rain: ' + a + ' ' + ra.toFixed(0) + '%, ' + b + ' ' + rb.toFixed(0) + '%.',
      'Days score best near 22°C with little rain.'
    ];
    text.textContent = parts.join(' ');
  }

  function cell(k, c, d, win, ci) {
    var box = el('div', 'cell ' + k + (win ? ' win' : ''));
    var info = data.describe(d.code, true) || { label: 'Unknown', iconName: 'cloud' };
    var cond = el('div', 'cond');
    try { cond.append(icons.svg(info.iconName, { size: 20 })); } catch (e) { /* no icon */ }
    cond.append(document.createTextNode(info.label));
    box.append(cond);
    box.append(el('div', 'nums', Math.round(num(d.max)) + '° / ' + Math.round(num(d.min)) + '°'));
    box.append(el('div', 'rain', Math.round(num(d.precipitationChance)) + '% rain · ' + num(d.precipitation).toFixed(1) + ' mm'));
    box.append(el('div', 'tag', ci.name + (win ? ' · better day' : '')));
    return box;
  }

  function days(A, B, rows, n) {
    var root = document.getElementById('days');
    root.replaceChildren();
    for (var k = 0; k < n; k++) {
      var row = el('div', 'day');
      row.append(el('div', 'date', dayName(A[k].date)));
      var cols = el('div', 'cols');
      cols.append(cell('a', 0, A[k], rows[k] === 0, cities[0]), cell('b', 1, B[k], rows[k] === 1, cities[1]));
      row.append(cols);
      root.append(row);
    }
  }

  function drawChart(A, B, n) {
    var css = getComputedStyle(document.documentElement);
    var ca = css.getPropertyValue('--petrol').trim(), cb = css.getPropertyValue('--coral').trim();
    var quiet = css.getPropertyValue('--quiet').trim(), line = css.getPropertyValue('--line').trim();
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = quiet;
    var labels = A.slice(0, n).map(function (d) { return shortDay(d.date); });
    var pick = function (arr, f) { return arr.slice(0, n).map(function (d) { return num(d[f]); }); };
    var a = cities[0].name, b = cities[1].name;
    if (chart) chart.destroy();
    chart = new Chart(document.getElementById('chart'), {
      data: {
        labels: labels,
        datasets: [
          { type: 'bar', label: a + ' rain %', data: pick(A, 'precipitationChance'), yAxisID: 'rain', backgroundColor: ca + '40', borderRadius: 2, order: 3 },
          { type: 'bar', label: b + ' rain %', data: pick(B, 'precipitationChance'), yAxisID: 'rain', backgroundColor: cb + '40', borderRadius: 2, order: 3 },
          { type: 'line', label: a + ' high', data: pick(A, 'max'), yAxisID: 'temp', borderColor: ca, backgroundColor: ca, tension: .3, order: 1 },
          { type: 'line', label: a + ' low', data: pick(A, 'min'), yAxisID: 'temp', borderColor: ca, backgroundColor: ca, borderDash: [5, 4], tension: .3, order: 1 },
          { type: 'line', label: b + ' high', data: pick(B, 'max'), yAxisID: 'temp', borderColor: cb, backgroundColor: cb, tension: .3, order: 1 },
          { type: 'line', label: b + ' low', data: pick(B, 'min'), yAxisID: 'temp', borderColor: cb, backgroundColor: cb, borderDash: [5, 4], tension: .3, order: 1 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false } },
          temp: { position: 'left', title: { display: true, text: '°C' }, grid: { color: line } },
          rain: { position: 'right', min: 0, max: 100, title: { display: true, text: 'Rain chance %' }, grid: { display: false } }
        },
        plugins: { legend: { labels: { boxWidth: 14, usePointStyle: false } } }
      }
    });
  }

  buildPickers();
  fetchCity(0);
  fetchCity(1);
})();
