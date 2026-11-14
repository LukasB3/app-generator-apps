(function () {
  const COLS = [
    { id: 'todo', name: 'To do' },
    { id: 'doing', name: 'Doing' },
    { id: 'done', name: 'Done' },
  ];
  const EXAMPLES = [
    ['Book the team lunch', 'todo'], ['Draft the Friday update', 'todo'],
    ['Review the new onboarding page', 'doing'], ['Fix the login typo', 'doing'],
    ['Set up the shared calendar', 'done'],
  ];
  const cards = db.table('cards');
  const $ = (id) => document.getElementById(id);
  const board = $('board'), statusEl = $('status');
  let rows = [];
  let loaded = false;
  let dragId = null;
  let toastTimer = null;
  let lastRemoved = null;

  const whoInput = $('who');
  whoInput.value = localStorage.getItem('board-name') || '';
  whoInput.addEventListener('input', () => localStorage.setItem('board-name', whoInput.value.trim()));
  const me = () => whoInput.value.trim() || 'Anonymous';

  function fail(e) {
    statusEl.textContent = 'Something went wrong: ' + (e && e.message ? e.message : 'unknown error') + '. Try again in a moment.';
    statusEl.className = 'status error';
  }
  function ok() { statusEl.textContent = ''; statusEl.className = 'status'; }
  async function run(fn) { try { await fn(); ok(); } catch (e) { fail(e); } }

  function showToast(text) {
    $('toast-text').textContent = text;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; lastRemoved = null; }, 8000);
  }
  $('undo').addEventListener('click', () => {
    const c = lastRemoved;
    $('toast').hidden = true; lastRemoved = null;
    if (c) run(() => cards.insert({ title: c.title, col: c.col, done: c.done, author: c.author, pos: c.pos }));
  });

  function colCards(id) {
    return rows.filter((r) => r.col === id)
      .sort((a, b) => (a.pos || 0) - (b.pos || 0) || String(a.created_at).localeCompare(String(b.created_at)));
  }
  const nextPos = (id) => Math.max(0, ...colCards(id).map((r) => r.pos || 0)) + 1;

  function moveTo(card, colId) {
    if (card.col === colId) return;
    run(() => cards.update(card.id, { col: colId, pos: nextPos(colId) }));
  }

  function iconBtn(name, label, onClick, cls) {
    const b = document.createElement('button');
    b.type = 'button'; b.title = label; b.setAttribute('aria-label', label);
    if (cls) b.className = cls;
    b.append(icons.svg(name, { size: 20 }));
    b.addEventListener('click', onClick);
    return b;
  }

  function cardEl(c, i) {
    const li = document.createElement('li');
    li.className = 'card' + (c.done ? ' ticked' : '');
    li.draggable = true;
    li.addEventListener('dragstart', (e) => { dragId = c.id; li.classList.add('dragging'); e.dataTransfer.setData('text/plain', String(c.id)); });
    li.addEventListener('dragend', () => { dragId = null; li.classList.remove('dragging'); });
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!c.done;
    cb.setAttribute('aria-label', 'Mark "' + c.title + '" as ticked');
    cb.addEventListener('change', () => run(() => cards.update(c.id, { done: cb.checked })));
    const t = document.createElement('span');
    t.className = 't'; t.textContent = c.title;
    const meta = document.createElement('span');
    meta.className = 'meta'; meta.textContent = 'Added by ' + (c.author || 'Anonymous');
    const acts = document.createElement('div');
    acts.className = 'acts';
    const idx = COLS.findIndex((x) => x.id === c.col);
    const left = iconBtn('arrow-left', 'Move to ' + (COLS[idx - 1] ? COLS[idx - 1].name : ''), () => moveTo(c, COLS[idx - 1].id));
    const right = iconBtn('arrow-right', 'Move to ' + (COLS[idx + 1] ? COLS[idx + 1].name : ''), () => moveTo(c, COLS[idx + 1].id));
    left.disabled = idx <= 0; right.disabled = idx >= COLS.length - 1;
    const del = iconBtn('trash', 'Delete card', () => {
      lastRemoved = c;
      run(() => cards.remove(c.id)).then(() => showToast('Card deleted'));
    }, 'del');
    acts.append(left, right, del);
    li.append(cb, t, meta, acts);
    return li;
  }

  // Columns are built once so typing in an add field survives live updates.
  const lists = {}, counts = {};
  COLS.forEach((col) => {
    const sec = document.createElement('section');
    sec.className = 'col'; sec.dataset.col = col.id;
    const h = document.createElement('h2');
    const name = document.createElement('span'); name.textContent = col.name;
    const n = document.createElement('span'); n.className = 'n'; counts[col.id] = n;
    h.append(name, n);
    const ul = document.createElement('ul'); ul.className = 'cards'; lists[col.id] = ul;
    const form = document.createElement('form'); form.className = 'add';
    const input = document.createElement('input');
    input.maxLength = 120; input.placeholder = 'New card'; input.required = true;
    input.setAttribute('aria-label', 'New card in ' + col.name);
    const btn = document.createElement('button');
    btn.type = 'submit'; btn.title = 'Add card'; btn.setAttribute('aria-label', 'Add card to ' + col.name);
    btn.append(icons.svg('plus', { size: 20 }));
    form.append(input, btn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = input.value.trim();
      if (!title) return;
      input.value = '';
      run(() => cards.insert({ title, col: col.id, done: false, author: me(), pos: nextPos(col.id) }));
    });
    sec.addEventListener('dragover', (e) => { if (dragId != null) { e.preventDefault(); sec.classList.add('over'); } });
    sec.addEventListener('dragleave', (e) => { if (!sec.contains(e.relatedTarget)) sec.classList.remove('over'); });
    sec.addEventListener('drop', (e) => {
      e.preventDefault(); sec.classList.remove('over');
      const c = rows.find((r) => r.id === dragId);
      if (c) moveTo(c, col.id);
    });
    sec.append(h, ul, form);
    board.append(sec);
  });

  function render() {
    const empty = loaded && rows.length === 0;
    $('empty').hidden = !empty;
    // keep the board visible when empty so a first card can be added directly
    board.hidden = !loaded;
    $('foot').hidden = !loaded;
    $('clear-examples').hidden = !rows.some((r) => r.author === 'Example');
    COLS.forEach((col) => {
      const list = colCards(col.id);
      counts[col.id].textContent = list.length;
      const ul = lists[col.id];
      ul.replaceChildren();
      if (!list.length) {
        const li = document.createElement('li');
        li.className = 'none'; li.textContent = 'No cards here. Add one below or drop one in.';
        ul.append(li);
      }
      list.forEach((c, i) => ul.append(cardEl(c, i)));
    });
  }

  $('seed').addEventListener('click', () => run(async () => {
    let i = 1;
    for (const [title, col] of EXAMPLES) await cards.insert({ title, col, done: col === 'done', author: 'Example', pos: i++ });
  }));
  $('clear-examples').addEventListener('click', () => run(async () => {
    for (const r of rows.filter((x) => x.author === 'Example')) await cards.remove(r.id);
  }));

  cards.subscribe((list) => {
    rows = Array.isArray(list) ? list : [];
    loaded = true;
    if (statusEl.textContent.indexOf('Loading') === 0) ok();
    render();
  });
})();
