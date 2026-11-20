(function () {
  const KEY = 'trip-splitter-v1';
  const $ = (id) => document.getElementById(id);

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v);
    });
    kids.forEach((k) => el.append(k));
    return el;
  }

  function seed() {
    const people = ['Alex', 'Sam', 'Robin', 'Kim'].map((name, i) => ({ id: 'p' + i, name }));
    const all = people.map((p) => p.id);
    const ex = (desc, amount, payer, split) => ({ id: 'e' + desc, desc, amount, payer, split, example: true });
    return {
      people,
      expenses: [
        ex('Cabin rental', 32000, 'p0', all),
        ex('Groceries', 11840, 'p1', all),
        ex('Petrol and tolls', 6450, 'p2', ['p0', 'p2', 'p3']),
        ex('Dinner out', 9200, 'p3', all),
        ex('Kayak hire', 7000, 'p1', ['p1', 'p2', 'p3']),
        ex('Firewood and snacks', 2350, 'p0', ['p0', 'p1']),
      ],
    };
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.people) && Array.isArray(s.expenses)) return s;
    } catch (e) { /* fall through to the example trip */ }
    return seed();
  }

  let state = load();
  let undoState = null;
  let toastTimer = 0;

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
  }

  const money = (c) => (c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nameOf = (id) => (state.people.find((p) => p.id === id) || { name: 'Someone' }).name;
  let counter = Date.now();
  const newId = (p) => p + (counter++).toString(36);

  function balances() {
    const bal = {};
    state.people.forEach((p) => { bal[p.id] = 0; });
    state.expenses.forEach((e) => {
      const split = e.split.filter((id) => id in bal);
      if (!split.length || !(e.payer in bal)) return;
      bal[e.payer] += e.amount;
      const base = Math.floor(e.amount / split.length);
      let extra = e.amount - base * split.length;
      split.forEach((id) => {
        bal[id] -= base + (extra > 0 ? 1 : 0);
        if (extra > 0) extra--;
      });
    });
    return bal;
  }

  function transfers(bal) {
    const cr = [], de = [];
    Object.entries(bal).forEach(([id, v]) => {
      if (v > 0) cr.push({ id, v }); else if (v < 0) de.push({ id, v: -v });
    });
    const out = [];
    while (cr.length && de.length) {
      cr.sort((a, b) => b.v - a.v);
      de.sort((a, b) => b.v - a.v);
      const c = cr[0], d = de[0];
      const amt = Math.min(c.v, d.v);
      out.push({ from: d.id, to: c.id, amount: amt });
      c.v -= amt; d.v -= amt;
      if (c.v === 0) cr.shift();
      if (d.v === 0) de.shift();
    }
    return out;
  }

  function render() {
    const bal = balances();
    const total = state.expenses.reduce((s, e) => s + e.amount, 0);
    $('total').textContent = state.people.length + ' people · ' + state.expenses.length + ' expenses · ' + money(total) + ' in total';

    const hasEx = state.expenses.some((e) => e.example);
    $('banner').hidden = !hasEx;
    $('clear-examples').textContent = 'Clear examples';

    const tr = transfers(bal);
    const box = $('transfers');
    box.replaceChildren();
    if (!state.expenses.length) {
      box.append(h('p', { class: 'settled', text: 'Nothing to settle yet.' }), h('p', { class: 'note', text: 'Add the first expense and the transfers appear here.' }));
    } else if (!tr.length) {
      box.append(h('p', { class: 'settled', text: 'Everyone is even.' }));
    } else {
      tr.forEach((t) => {
        const arrow = icons.svg('arrow-right', { size: 20 });
        box.append(h('div', { class: 'transfer' },
          h('span', { class: 'who', text: nameOf(t.from) }), arrow,
          h('span', { class: 'who', text: nameOf(t.to) }),
          h('span', { class: 'sum', text: money(t.amount) })));
      });
      box.append(h('p', { class: 'note', text: tr.length + (tr.length === 1 ? ' transfer settles' : ' transfers settle') + ' everything.' }));
    }

    const bl = $('balances');
    bl.replaceChildren();
    state.people.forEach((p) => {
      const v = bal[p.id] || 0;
      const cls = v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero';
      const txt = v > 0 ? 'gets back ' + money(v) : v < 0 ? 'owes ' + money(-v) : 'even';
      bl.append(h('li', {}, h('span', { text: p.name }), h('span', { class: cls, text: txt })));
    });

    // form choices, keeping the current selection
    const payer = $('payer');
    const prev = payer.value;
    payer.replaceChildren(...state.people.map((p) => h('option', { value: p.id, text: p.name })));
    if (state.people.some((p) => p.id === prev)) payer.value = prev;
    const checked = new Set([...document.querySelectorAll('#split input:checked')].map((i) => i.value));
    const fresh = !$('split').children.length;
    $('split').replaceChildren(...state.people.map((p) => {
      const cb = h('input', { type: 'checkbox', value: p.id });
      cb.checked = fresh || checked.has(p.id);
      return h('label', {}, cb, h('span', { text: p.name }));
    }));

    const el = $('expenses');
    el.replaceChildren();
    if (!state.expenses.length) {
      el.append(h('li', { class: 'empty', text: 'No expenses yet. Fill in the form above to add one.' }));
    }
    state.expenses.slice().reverse().forEach((e) => {
      const who = e.split.length === state.people.length ? 'everyone' : e.split.map(nameOf).join(', ');
      const name = h('div', { class: 'name', text: e.desc });
      if (e.example) name.append(h('span', { class: 'tag', text: 'Example' }));
      const del = h('button', { type: 'button', class: 'icon', 'aria-label': 'Delete ' + e.desc });
      del.append(icons.svg('trash'));
      del.addEventListener('click', () => {
        snapshot('Deleted “' + e.desc + '”.');
        state.expenses = state.expenses.filter((x) => x.id !== e.id);
        commit();
      });
      el.append(h('li', {},
        h('div', { class: 'info' }, name, h('div', { class: 'meta', text: nameOf(e.payer) + ' paid for ' + who })),
        h('span', { class: 'money', text: money(e.amount) }), del));
    });

    const pl = $('people');
    pl.replaceChildren();
    state.people.forEach((p) => {
      const b = h('button', { type: 'button', class: 'icon', 'aria-label': 'Remove ' + p.name });
      b.append(icons.svg('x', { size: 18 }));
      b.addEventListener('click', () => removePerson(p));
      pl.append(h('li', {}, h('span', { text: p.name }), b));
    });
  }

  function commit() { save(); render(); }

  function snapshot(msg) {
    undoState = JSON.stringify(state);
    $('toast-text').textContent = msg;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; undoState = null; }, 8000);
  }

  $('toast-undo').addEventListener('click', () => {
    if (!undoState) return;
    state = JSON.parse(undoState);
    undoState = null;
    $('toast').hidden = true;
    commit();
  });

  function removePerson(p) {
    const used = state.expenses.some((e) => e.payer === p.id || e.split.includes(p.id));
    if (used) {
      showError('Delete the expenses that involve ' + p.name + ' before removing them.');
      return;
    }
    if (state.people.length <= 2) { showError('A trip needs at least two people.'); return; }
    snapshot('Removed ' + p.name + '.');
    state.people = state.people.filter((x) => x.id !== p.id);
    commit();
  }

  function showError(msg) {
    $('error').textContent = msg;
    clearTimeout(showError.t);
    showError.t = setTimeout(() => { $('error').textContent = ''; }, 6000);
  }

  $('form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const desc = $('desc').value.trim();
    const amount = Math.round(parseFloat($('amount').value) * 100);
    const split = [...document.querySelectorAll('#split input:checked')].map((i) => i.value);
    if (!desc) return showError('Say what the expense was for.');
    if (!(amount > 0)) return showError('Enter an amount above zero.');
    if (!split.length) return showError('Choose at least one person to split between.');
    state.expenses.push({ id: newId('e'), desc, amount, payer: $('payer').value, split, example: false });
    $('desc').value = '';
    $('amount').value = '';
    $('error').textContent = '';
    commit();
    $('desc').focus();
  });

  $('person-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = $('person').value.trim();
    if (!name) return;
    if (state.people.some((p) => p.name.toLowerCase() === name.toLowerCase())) return showError(name + ' is already on the trip.');
    state.people.push({ id: newId('p'), name });
    $('person').value = '';
    commit();
  });

  $('clear-examples').addEventListener('click', () => {
    snapshot('Cleared the example expenses.');
    state.expenses = state.expenses.filter((e) => !e.example);
    commit();
  });

  render();
})();
