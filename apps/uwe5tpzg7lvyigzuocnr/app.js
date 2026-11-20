(function () {
  const COMPONENTS = [
    { id: 'website', name: 'Website' },
    { id: 'api', name: 'API' },
    { id: 'database', name: 'Database' },
    { id: 'payments', name: 'Payments' },
  ];
  const RANK = { ok: 0, degraded: 1, down: 2 };
  const LABEL = { ok: 'Operational', degraded: 'Degraded', down: 'Down' };
  const table = db.table('incidents');
  const $ = (id) => document.getElementById(id);
  const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const dayFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

  let rows = null;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const comps = (r) => String(r.components || '').split(',').filter(Boolean);
  const sevOf = (r) => (r.severity === 'down' ? 'down' : 'degraded');
  const toDate = (v) => new Date(v);
  const dayKey = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

  // Example shown while the log is empty
  const exampleRow = () => ({
    id: 'example', example: true,
    title: 'Elevated API error rates',
    details: 'A bad deploy caused some requests to fail. We rolled it back and error rates are back to normal.',
    author: 'Example', components: 'api,website', severity: 'degraded', resolved: true,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    resolved_at: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(),
  });

  function currentStatus(id) {
    let s = 'ok';
    (rows || []).forEach((r) => {
      if (!r.resolved && comps(r).includes(id) && RANK[sevOf(r)] > RANK[s]) s = sevOf(r);
    });
    return s;
  }

  function history(id) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      days.push({ date: d, key: dayKey(d), s: 'ok', n: 0 });
    }
    (rows || []).forEach((r) => {
      if (!comps(r).includes(id)) return;
      const start = toDate(r.created_at);
      const end = r.resolved && r.resolved_at ? toDate(r.resolved_at) : new Date();
      const a = dayKey(start), b = dayKey(end), sev = sevOf(r);
      days.forEach((d) => {
        if (d.key >= a && d.key <= b) {
          d.n++;
          if (RANK[sev] > RANK[d.s]) d.s = sev;
        }
      });
    });
    return days;
  }

  function renderBanner() {
    const b = $('banner');
    let worst = 'ok', count = 0;
    COMPONENTS.forEach((c) => {
      const s = currentStatus(c.id);
      if (s !== 'ok') count++;
      if (RANK[s] > RANK[worst]) worst = s;
    });
    const t = {
      ok: ['All systems operational', 'Every component is running normally.'],
      degraded: ['Some systems are degraded', count + (count === 1 ? ' component is' : ' components are') + ' affected. See the log below.'],
      down: ['Service disruption', count + (count === 1 ? ' component is' : ' components are') + ' affected, at least one is down.'],
    }[worst];
    b.dataset.state = worst;
    $('banner-title').textContent = t[0];
    $('banner-sub').textContent = t[1];
    $('banner-icon').replaceChildren(icons.svg(worst === 'ok' ? 'circle-check' : worst === 'down' ? 'circle-x' : 'triangle-exclamation-point', { size: 64, strokeWidth: 2 }));
  }

  function renderComponents() {
    const ul = $('components');
    ul.replaceChildren();
    COMPONENTS.forEach((c) => {
      const s = currentStatus(c.id);
      const li = el('li', 'comp');
      li.dataset.s = s;
      const head = el('div', 'comp-head');
      head.append(el('span', 'comp-name', c.name), el('span', 'comp-status', LABEL[s]));
      const strip = el('div', 'strip');
      history(c.id).forEach((d) => {
        const i = document.createElement('i');
        if (d.s !== 'ok') i.className = d.s === 'down' ? 'down' : 'warn';
        i.title = dayFmt.format(d.date) + ': ' + (d.n ? LABEL[d.s] + ', ' + d.n + (d.n === 1 ? ' incident' : ' incidents') : 'no incidents');
        strip.append(i);
      });
      const foot = el('div', 'strip-foot');
      foot.append(el('span', null, '30 days ago'), el('span', null, 'Today'));
      li.append(head, strip, foot);
      ul.append(li);
    });
  }

  async function setResolved(r, value, btn) {
    btn.disabled = true;
    try {
      await table.update(r.id, { resolved: value, resolved_at: value ? new Date().toISOString() : null });
    } catch (e) {
      btn.disabled = false;
      showState('Could not update the incident: ' + e.message, true);
    }
  }

  function showState(msg, isError) {
    const s = $('log-state');
    s.hidden = !msg;
    s.textContent = msg || '';
    s.className = 'state' + (isError ? ' error' : '');
  }

  function renderLog() {
    const ol = $('log');
    ol.replaceChildren();
    if (rows === null) { showState('Loading incidents…'); return; }
    let list = rows;
    if (!rows.length) {
      showState('No incidents have been posted. Updates from the team will appear here for everyone with this link. This is what one looks like:');
      list = [exampleRow()];
    } else showState('');
    list.forEach((r) => {
      const li = el('li', 'inc');
      const top = el('div', 'inc-top');
      if (r.example) top.append(el('span', 'tag example', 'Example'));
      top.append(el('span', 'tag ' + sevOf(r), sevOf(r) === 'down' ? 'Down' : 'Degraded'));
      top.append(el('span', 'tag' + (r.resolved ? ' resolved' : ''), r.resolved ? 'Resolved' : 'Ongoing'));
      li.append(top, el('h3', null, r.title || 'Untitled incident'));
      if (r.details) li.append(el('p', null, r.details));
      const names = comps(r).map((id) => (COMPONENTS.find((c) => c.id === id) || { name: id }).name).join(', ');
      let meta = 'Affects ' + (names || 'no component') + ' · posted ' + fmt.format(toDate(r.created_at)) + ' by ' + (r.author || 'the team');
      if (r.resolved && r.resolved_at) meta += ' · resolved ' + fmt.format(toDate(r.resolved_at));
      li.append(el('p', 'inc-meta', meta));
      if (!r.example) {
        const btn = el('button', 'btn', r.resolved ? 'Reopen' : 'Mark resolved');
        btn.type = 'button';
        btn.prepend(icons.svg(r.resolved ? 'rotate-ccw' : 'check'));
        btn.addEventListener('click', () => setResolved(r, !r.resolved, btn));
        li.append(btn);
      }
      ol.append(li);
    });
  }

  function renderAll() { renderBanner(); renderComponents(); renderLog(); }

  // Form
  const fc = $('f-comps');
  COMPONENTS.forEach((c) => {
    const l = el('label', 'choice');
    const i = document.createElement('input');
    i.type = 'checkbox'; i.value = c.id;
    l.append(i, el('span', null, c.name));
    fc.append(l);
  });
  $('f-author').value = localStorage.getItem('status-author') || '';

  $('form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = $('form-error');
    err.hidden = true;
    const picked = [...fc.querySelectorAll('input:checked')].map((i) => i.value);
    if (!picked.length) { err.textContent = 'Choose at least one affected component.'; err.hidden = false; return; }
    const author = $('f-author').value.trim();
    const title = $('f-title').value.trim();
    if (!title || !author) { err.textContent = 'Add a title and your name.'; err.hidden = false; return; }
    const btn = $('f-submit');
    btn.disabled = true;
    try {
      await table.insert({
        title, author,
        details: $('f-details').value.trim(),
        components: picked.join(','),
        severity: document.querySelector('input[name=sev]:checked').value,
        resolved: false,
      });
      localStorage.setItem('status-author', author);
      $('f-title').value = ''; $('f-details').value = '';
      fc.querySelectorAll('input').forEach((i) => { i.checked = false; });
    } catch (e) {
      err.textContent = 'Could not post the incident: ' + e.message;
      err.hidden = false;
    }
    btn.disabled = false;
  });

  renderAll();
  try {
    table.subscribe((data) => { rows = data || []; renderAll(); }, { newestFirst: true });
  } catch (e) {
    rows = [];
    renderAll();
  }
  // Surface a failed first load if nothing arrives
  setTimeout(() => {
    if (rows === null) {
      $('banner').dataset.state = 'error';
      $('banner-title').textContent = 'Status unavailable';
      $('banner-sub').textContent = 'The incident log did not load. Reload the page to try again.';
      showState('The incident log could not be loaded. Reload the page to try again.', true);
    }
  }, 10000);
})();
