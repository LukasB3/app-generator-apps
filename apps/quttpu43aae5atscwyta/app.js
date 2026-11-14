(function () {
  const COLS = [
    { id: 'todo', name: 'To do', cls: '' },
    { id: 'doing', name: 'In progress', cls: 'doing' },
    { id: 'finished', name: 'Done', cls: 'finished' }
  ];
  const EXAMPLES = [
    { title: 'Book the team offsite venue', col: 'todo' },
    { title: 'Draft the Q1 priorities', col: 'todo' },
    { title: 'Review the new onboarding checklist', col: 'doing' },
    { title: 'Fix the login page typo', col: 'doing' },
    { title: 'Send the weekly update', col: 'finished', done: true }
  ];
  const cards = db.table('cards');
  const $ = (id) => document.getElementById(id);
  const board = $('board'), authorEl = $('author');
  let rows = [], loaded = false, toastTimer = null, undoFn = null;

  authorEl.value = localStorage.getItem('board-author') || '';
  authorEl.addEventListener('input', () => localStorage.setItem('board-author', authorEl.value.trim()));

  function showError(e) {
    const el = $('error');
    el.textContent = 'Something went wrong: ' + (e && e.message ? e.message : 'please try again.') + ' Your change may not have been saved.';
    el.hidden = false;
  }
  function run(p) {
    return p.then((r) => { $('error').hidden = true; return r; }, (e) => { showError(e); });
  }
  function toast(text, undo) {
    $('toast-text').textContent = text;
    undoFn = undo;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; undoFn = null; }, 7000);
  }
  $('toast-undo').addEventListener('click', () => {
    const f = undoFn; undoFn = null; $('toast').hidden = true;
    if (f) f();
  });

  function icon(name) { return icons.svg(name, { size: 20 }); }
  function iconBtn(name, label, onClick, disabled, extra) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'icon-btn' + (extra ? ' ' + extra : '');
    b.setAttribute('aria-label', label); b.title = label;
    b.append(icon(name)); b.disabled = !!disabled;
    b.addEventListener('click', onClick);
    return b;
  }

  function move(row, dir) {
    const i = COLS.findIndex((c) => c.id === row.col) + dir;
    if (i < 0 || i >= COLS.length) return;
    const col = COLS[i].id;
    run(cards.update(row.id, { col, done: col === 'finished' }));
  }
  function remove(row) {
    run(cards.remove(row.id)).then(() => {
      toast('Card deleted', () => run(cards.insert({
        title: row.title, note: row.note || '', col: row.col, done: !!row.done, author: row.author || ''
      })));
    });
  }

  function cardEl(row) {
    const li = document.createElement('li');
    li.className = 'card' + (row.done ? ' done' : '');
    const top = document.createElement('div'); top.className = 'row';
    const tick = document.createElement('button');
    tick.type = 'button'; tick.className = 'tick';
    tick.setAttribute('role', 'checkbox'); tick.setAttribute('aria-checked', String(!!row.done));
    tick.setAttribute('aria-label', 'Mark "' + row.title + '" as done');
    tick.append(icon('check'));
    tick.addEventListener('click', () => {
      const done = !row.done;
      run(cards.update(row.id, { done, col: done ? 'finished' : (row.col === 'finished' ? 'doing' : row.col) }));
    });
    const t = document.createElement('p'); t.className = 'title'; t.textContent = row.title;
    top.append(tick, t);
    li.append(top);
    if (row.author) {
      const by = document.createElement('p'); by.className = 'by'; by.textContent = 'Added by ' + row.author;
      li.append(by);
    }
    const idx = COLS.findIndex((c) => c.id === row.col);
    const act = document.createElement('div'); act.className = 'actions';
    act.append(
      iconBtn('arrow-left', 'Move to ' + (COLS[idx - 1] ? COLS[idx - 1].name : 'previous column'), () => move(row, -1), idx <= 0),
      iconBtn('arrow-right', 'Move to ' + (COLS[idx + 1] ? COLS[idx + 1].name : 'next column'), () => move(row, 1), idx >= COLS.length - 1),
      iconBtn('trash', 'Delete card', () => remove(row), false, 'del')
    );
    li.append(act);
    return li;
  }

  // columns are built once so the add fields keep what is being typed
  const lists = {}, counts = {}, empties = {};
  COLS.forEach((c) => {
    const sec = document.createElement('section'); sec.className = 'col ' + c.cls;
    const h = document.createElement('h2'); h.id = 'h-' + c.id;
    const name = document.createElement('span'); name.textContent = c.name;
    const n = document.createElement('span'); n.className = 'count'; n.textContent = '0';
    h.append(name, n);
    const ul = document.createElement('ul'); ul.className = 'cards'; ul.setAttribute('aria-labelledby', h.id);
    const none = document.createElement('p'); none.className = 'col-empty'; none.textContent = 'Nothing here yet.';
    const form = document.createElement('form'); form.className = 'add';
    const input = document.createElement('input');
    input.maxLength = 120; input.placeholder = 'New card'; input.setAttribute('aria-label', 'New card in ' + c.name);
    const btn = document.createElement('button'); btn.type = 'submit'; btn.append(icon('plus'), document.createTextNode('Add'));
    form.append(input, btn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = input.value.trim();
      if (!title) return;
      input.value = '';
      run(cards.insert({ title, note: '', col: c.id, done: c.id === 'finished', author: authorEl.value.trim() }));
    });
    sec.append(h, ul, none, form);
    board.append(sec);
    lists[c.id] = ul; counts[c.id] = n; empties[c.id] = none;
  });

  function draw() {
    const sorted = rows.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id - b.id);
    COLS.forEach((c) => {
      const mine = sorted.filter((r) => (COLS.some((x) => x.id === r.col) ? r.col : 'todo') === c.id);
      lists[c.id].replaceChildren(...mine.map(cardEl));
      counts[c.id].textContent = String(mine.length);
      empties[c.id].hidden = mine.length > 0;
    });
    $('empty').hidden = !(loaded && rows.length === 0);
    const open = rows.filter((r) => !r.done).length;
    $('status').textContent = rows.length
      ? 'Live: ' + open + ' open, ' + (rows.length - open) + ' done'
      : 'Live: shared with everyone who has this link';
  }

  $('seed').addEventListener('click', () => {
    const name = authorEl.value.trim();
    $('seed').disabled = true;
    Promise.all(EXAMPLES.map((e) => cards.insert({
      title: e.title, note: '', col: e.col, done: !!e.done, author: name
    }))).then(() => { $('error').hidden = true; }, showError).then(() => { $('seed').disabled = false; });
  });

  cards.subscribe((list) => {
    rows = Array.isArray(list) ? list : [];
    loaded = true;
    draw();
  });
  draw();
  setTimeout(() => {
    if (!loaded) $('status').textContent = 'Still connecting…';
  }, 4000);
})();
