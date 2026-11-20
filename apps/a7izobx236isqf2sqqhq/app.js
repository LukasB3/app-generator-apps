(function () {
  const SAMPLE = {
    status: 'ok',
    request_id: 'req_8f3a21c9',
    page: { number: 1, size: 2, total: 148, next: '/v1/orders?page=2' },
    data: [
      {
        id: 1042,
        customer: { name: 'Ada Lovelace', email: 'ada@example.com', vip: true },
        items: [
          { sku: 'KB-87', title: 'Mechanical keyboard', qty: 1, price: 119.9 },
          { sku: 'CB-02', title: 'USB-C cable', qty: 3, price: 7.5 }
        ],
        shipping: { method: 'express', address: null, tracking: 'TRK-77120' },
        paid: true,
        tags: ['priority', 'gift'],
        created_at: '2026-11-12T09:41:07Z'
      },
      {
        id: 1043,
        customer: { name: 'Linus Torvalds', email: 'linus@example.com', vip: false },
        items: [{ sku: 'MS-11', title: 'Wireless mouse', qty: 2, price: 39 }],
        shipping: { method: 'standard', address: null, tracking: null },
        paid: false,
        tags: [],
        created_at: '2026-11-12T10:03:55Z'
      }
    ],
    meta: { elapsed_ms: 23.4, cache: 'miss', "rate-limit": { remaining: 997, reset: 1763630400 } }
  };
  const KEY = 'json-explorer-input';
  const PAGE = 200;

  const $ = (id) => document.getElementById(id);
  const src = $('src'), status = $('status'), tree = $('tree'), q = $('q');
  const state = { data: undefined, valid: false, open: new Set(['$']), selected: null, shown: {}, hits: new Set(), anc: new Set(), hitList: [], cur: -1, nodes: new Map() };

  const ic = (n, s) => icons.svg(n, { size: s || 16 });
  $('searchIcon').append(ic('search'));
  $('prev').append(ic('chevron-up'));
  $('next').append(ic('chevron-down'));

  const typeOf = (v) => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
  const isCont = (v) => v !== null && typeof v === 'object';
  const keyPath = (p, k) => typeof k === 'number' ? p + '[' + k + ']' : /^[A-Za-z_$][\w$]*$/.test(k) ? p + '.' + k : p + '[' + JSON.stringify(k) + ']';
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const countOf = (v) => Array.isArray(v) ? plural(v.length, 'item') : plural(Object.keys(v).length, 'key');
  const entries = (v) => Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v);

  function stats(v) {
    let n = 0, depth = 0;
    (function walk(x, d) { n++; depth = Math.max(depth, d); if (isCont(x)) entries(x).forEach(([, c]) => walk(c, d + 1)); })(v, 0);
    return { n, depth };
  }

  // ---- parsing and errors
  function locate(text, err) {
    const m = String(err.message);
    let line, col, pos;
    const lc = m.match(/line (\d+) column (\d+)/);
    if (lc) { line = +lc[1]; col = +lc[2]; }
    else {
      const p = m.match(/position (\d+)/);
      if (p) {
        pos = +p[1];
        const before = text.slice(0, pos).split('\n');
        line = before.length; col = before[before.length - 1].length + 1;
      }
    }
    if (line === undefined) return null;
    const lines = text.split('\n');
    const off = lines.slice(0, line - 1).reduce((a, l) => a + l.length + 1, 0) + col - 1;
    return { line, col, off, text: lines[line - 1] || '' };
  }
  function reason(text, err, loc) {
    let m = String(err.message).replace(/^JSON\.parse: /, '').replace(/ in JSON at position \d+.*/, '').replace(/ at position \d+.*/, '').replace(/ at line \d+ column \d+.*/, '').replace(/ of the JSON data/, '');
    if (!text.trim()) m = 'Nothing to parse';
    return m.charAt(0).toUpperCase() + m.slice(1);
  }

  function setStatus(ok, text, err) {
    status.className = 'status ' + (ok ? 'ok' : err ? 'err' : '');
    status.replaceChildren();
    if (ok || !err) { status.textContent = text; return; }
    const msg = document.createElement('div');
    msg.className = 'msg';
    msg.textContent = err.loc ? `${err.reason} at line ${err.loc.line}, column ${err.loc.col}` : err.reason;
    status.append(msg);
    if (err.loc) {
      const t = err.loc.text, c = err.loc.col - 1;
      const start = Math.max(0, c - 30);
      const pre = document.createElement('pre');
      const b = document.createElement('b');
      b.textContent = t.charAt(c) || '⏎';
      pre.append(t.slice(start, c), b, t.slice(c + 1, c + 30));
      const caret = document.createElement('pre');
      caret.textContent = ' '.repeat(c - start) + '^';
      caret.style.color = 'var(--danger)';
      caret.style.margin = '0 0 .4rem';
      pre.style.marginBottom = '0';
      const go = document.createElement('button');
      go.type = 'button'; go.textContent = 'Go to error';
      go.addEventListener('click', () => {
        src.focus(); src.setSelectionRange(err.loc.off, err.loc.off + 1);
        const lh = parseFloat(getComputedStyle(src).lineHeight);
        src.scrollTop = Math.max(0, (err.loc.line - 3) * lh);
      });
      status.append(pre, caret, go);
    }
  }

  function parse() {
    const text = src.value;
    try { localStorage.setItem(KEY, text); } catch (e) { /* storage unavailable */ }
    if (!text.trim()) {
      state.valid = false; state.data = undefined;
      setStatus(false, 'Paste JSON to explore it.');
      $('summary').textContent = 'Nothing loaded';
      tree.replaceChildren(note('Paste JSON on the left, or load the sample, and it appears here as a tree.'));
      resetSelection();
      return;
    }
    try {
      state.data = JSON.parse(text);
      state.valid = true;
      const s = stats(state.data);
      setStatus(true, 'Valid JSON');
      $('summary').textContent = `${typeOf(state.data)} · ${plural(s.n, 'value')} · ${s.depth} deep · ${(new Blob([text]).size / 1024).toFixed(1)} kB`;
      if (state.selected && resolve(state.selected) === undefined) resetSelection();
      render();
    } catch (e) {
      state.valid = false;
      const loc = locate(text, e);
      setStatus(false, '', { reason: reason(text, e, loc), loc });
      $('summary').textContent = 'Invalid JSON';
      const n = note('The tree comes back once the JSON is valid. The error is shown under the input.');
      n.classList.add('err-note');
      tree.replaceChildren(n);
      $('matches').textContent = '';
    }
  }
  function note(t) { const d = document.createElement('div'); d.className = 'note'; d.textContent = t; return d; }

  // ---- paths
  const pathMap = new Map(); // path -> value, rebuilt per render pass
  function resolve(path) {
    let found;
    (function walk(v, p) {
      if (p === path) { found = v; return; }
      if (found !== undefined || !isCont(v) || !path.startsWith(p)) return;
      entries(v).forEach(([k, c]) => walk(c, keyPath(p, k)));
    })(state.data, '$');
    return found;
  }
  function resetSelection() {
    state.selected = null;
    $('path').textContent = 'Select a value';
    $('pathType').textContent = '';
    $('copyPath').disabled = $('copyVal').disabled = true;
  }
  function select(path, v) {
    state.selected = path;
    $('path').textContent = path;
    $('pathType').textContent = isCont(v) ? `${typeOf(v)} · ${countOf(v)}` : typeOf(v);
    $('copyPath').disabled = $('copyVal').disabled = false;
    tree.querySelectorAll('.row.sel').forEach((r) => r.classList.remove('sel'));
    const row = state.nodes.get(path);
    if (row) row.classList.add('sel');
  }

  // ---- search
  function runSearch() {
    state.hits = new Set(); state.anc = new Set(); state.hitList = []; state.cur = -1;
    const term = q.value.trim().toLowerCase();
    if (!term || !state.valid) return;
    (function walk(v, p, key) {
      let self = key !== null && String(key).toLowerCase().includes(term);
      if (!isCont(v) && String(v).toLowerCase().includes(term)) self = true;
      let any = false;
      if (isCont(v)) entries(v).forEach(([k, c]) => { if (walk(c, keyPath(p, k), k)) any = true; });
      if (self) { state.hits.add(p); state.hitList.push(p); }
      if (any) state.anc.add(p);
      return self || any;
    })(state.data, '$', null);
    state.hitList.sort();
    // keep document order
    const order = []; (function walk(v, p) { if (state.hits.has(p)) order.push(p); if (isCont(v)) entries(v).forEach(([k, c]) => walk(c, keyPath(p, k))); })(state.data, '$');
    state.hitList = order;
  }
  function updateMatches() {
    const el = $('matches');
    if (!q.value.trim() || !state.valid) { el.textContent = ''; }
    else if (!state.hitList.length) el.textContent = 'No matches';
    else el.textContent = (state.cur >= 0 ? state.cur + 1 : 0) + ' of ' + state.hitList.length;
    $('prev').disabled = $('next').disabled = !state.hitList.length;
  }
  function jump(dir) {
    const n = state.hitList.length;
    if (!n) return;
    state.cur = state.cur < 0 ? (dir > 0 ? 0 : n - 1) : (state.cur + dir + n) % n;
    const p = state.hitList[state.cur];
    updateMatches();
    const row = state.nodes.get(p);
    if (row) {
      select(p, resolve(p));
      row.scrollIntoView({ block: 'center' });
    }
  }

  // ---- tree
  function render() {
    runSearch();
    state.nodes = new Map();
    const frag = document.createDocumentFragment();
    node(frag, state.data, '$', null, 0);
    tree.replaceChildren(frag);
    updateMatches();
    if (state.selected && state.nodes.get(state.selected)) state.nodes.get(state.selected).classList.add('sel');
  }
  function isOpen(p) { return state.open.has(p) || state.anc.has(p); }

  function node(parent, v, p, key, depth) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'row';
    row.setAttribute('role', 'treeitem');
    row.style.paddingLeft = (8 + depth * 18) + 'px';
    const cont = isCont(v);
    const open = cont && isOpen(p);
    if (cont) row.setAttribute('aria-expanded', String(open));
    if (state.hits.has(p)) row.classList.add('hit');

    const chev = document.createElement('span');
    chev.className = 'chev' + (open ? ' open' : '');
    if (cont) chev.append(ic('chevron-right', 14));
    row.append(chev);
    if (key !== null) {
      const k = document.createElement('span'); k.className = 'k';
      k.textContent = typeof key === 'number' ? key : JSON.stringify(key);
      const c = document.createElement('span'); c.className = 'colon'; c.textContent = ':';
      row.append(k, c);
    }
    const t = typeOf(v);
    const val = document.createElement('span');
    val.className = 'v ' + t;
    if (cont) {
      val.className = 'count';
      val.textContent = (Array.isArray(v) ? '[ ' : '{ ') + countOf(v) + (Array.isArray(v) ? ' ]' : ' }');
    } else val.textContent = t === 'string' ? JSON.stringify(v) : String(v);
    row.append(val);
    const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = t;
    row.append(badge);
    state.nodes.set(p, row);
    parent.append(row);

    row.addEventListener('click', () => {
      select(p, v);
      if (cont) {
        if (open) { state.open.delete(p); state.anc.delete(p); } else state.open.add(p);
        const top = tree.scrollTop;
        render(); tree.scrollTop = top;
        const r = state.nodes.get(p); if (r) r.focus({ preventScroll: true });
      }
    });

    if (open) {
      const list = entries(v);
      const limit = state.shown[p] || PAGE;
      list.slice(0, limit).forEach(([k, c]) => node(parent, c, keyPath(p, k), k, depth + 1));
      if (list.length > limit) {
        const more = document.createElement('button');
        more.type = 'button'; more.className = 'more ghost';
        more.style.marginLeft = (8 + (depth + 1) * 18) + 'px';
        more.textContent = `Show ${Math.min(PAGE, list.length - limit)} more of ${list.length - limit} hidden`;
        more.addEventListener('click', () => { state.shown[p] = limit + PAGE; const top = tree.scrollTop; render(); tree.scrollTop = top; });
        parent.append(more);
      }
    }
  }

  function setAll(open) {
    if (!state.valid) return;
    state.open = new Set();
    if (open) (function walk(v, p, d) { if (isCont(v) && d < 12) { state.open.add(p); entries(v).forEach(([k, c]) => walk(c, keyPath(p, k), d + 1)); } })(state.data, '$', 0);
    else state.open.add('$');
    q.value = ''; render();
  }

  // ---- actions
  let copyTimer;
  function copy(text, btn) {
    const label = btn.dataset.label || (btn.dataset.label = btn.textContent);
    const done = (ok) => { btn.textContent = ok ? 'Copied' : 'Copy failed'; clearTimeout(copyTimer); copyTimer = setTimeout(() => { btn.textContent = label; }, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
    else done(false);
  }
  $('copyPath').addEventListener('click', (e) => { if (state.selected) copy(state.selected, e.currentTarget); });
  $('copyVal').addEventListener('click', (e) => { if (state.selected) copy(JSON.stringify(resolve(state.selected), null, 2), e.currentTarget); });
  $('expand').addEventListener('click', () => setAll(true));
  $('collapse').addEventListener('click', () => setAll(false));
  $('prev').addEventListener('click', () => jump(-1));
  $('next').addEventListener('click', () => jump(1));
  q.addEventListener('input', () => { render(); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); jump(e.shiftKey ? -1 : 1); } });
  $('format').addEventListener('click', () => { if (state.valid) { src.value = JSON.stringify(state.data, null, 2); parse(); } else src.focus(); });
  $('clear').addEventListener('click', () => { src.value = ''; state.open = new Set(['$']); parse(); src.focus(); });
  $('sample').addEventListener('click', () => { src.value = JSON.stringify(SAMPLE, null, 2); state.open = new Set(['$', '$.data', '$.data[0]']); state.selected = null; resetSelection(); parse(); });

  let timer;
  src.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(parse, 150); });

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
  if (saved && saved.trim()) { src.value = saved; state.open = new Set(['$']); parse(); }
  else $('sample').click();
})();
