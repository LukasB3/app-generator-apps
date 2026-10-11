(function () {
  var KEY = 'weekend-packing-v1';
  var CATS = ['Clothes', 'Toiletries', 'Tech', 'Documents & Money', 'Other'];
  var DEFAULTS = {
    'Clothes': ['T-shirts (2–3)', 'Pants / jeans', 'Underwear (3)', 'Socks (3 pairs)', 'Pajamas', 'Jacket', 'Comfortable shoes'],
    'Toiletries': ['Toothbrush & toothpaste', 'Deodorant', 'Shampoo', 'Medications', 'Sunscreen'],
    'Tech': ['Phone charger', 'Headphones', 'Power bank'],
    'Documents & Money': ['ID', 'Wallet', 'Tickets / bookings', 'Keys'],
    'Other': ['Water bottle', 'Snacks', 'Sunglasses']
  };

  var items;
  try { items = JSON.parse(localStorage.getItem(KEY)); } catch (e) { items = null; }
  if (!Array.isArray(items)) items = defaults();

  function defaults() {
    var out = [], id = 0;
    CATS.forEach(function (c) {
      DEFAULTS[c].forEach(function (t) { out.push({ id: ++id, text: t, cat: c, done: false }); });
    });
    return out;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} }

  var list = document.getElementById('list');
  var catSel = document.getElementById('new-cat');
  var input = document.getElementById('new-item');
  CATS.forEach(function (c) {
    var o = document.createElement('option');
    o.textContent = c; catSel.appendChild(o);
  });

  function render() {
    list.textContent = '';
    CATS.forEach(function (c) {
      var group = items.filter(function (i) { return i.cat === c; });
      if (!group.length) return;
      var sec = document.createElement('section');
      var h = document.createElement('h2');
      var d = group.filter(function (i) { return i.done; }).length;
      h.textContent = c + ' (' + d + '/' + group.length + ')';
      sec.appendChild(h);
      var ul = document.createElement('ul');
      group.forEach(function (it) {
        var li = document.createElement('li');
        if (it.done) li.className = 'done';
        var label = document.createElement('label');
        var cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = it.done;
        cb.addEventListener('change', function () { it.done = cb.checked; save(); render(); });
        var sp = document.createElement('span');
        sp.textContent = it.text;
        label.appendChild(cb); label.appendChild(sp);
        var del = document.createElement('button');
        del.type = 'button'; del.className = 'del'; del.textContent = '×';
        del.setAttribute('aria-label', 'Remove ' + it.text);
        del.addEventListener('click', function () {
          items = items.filter(function (x) { return x !== it; }); save(); render();
        });
        li.appendChild(label); li.appendChild(del); ul.appendChild(li);
      });
      sec.appendChild(ul); list.appendChild(sec);
    });
    var total = items.length, done = items.filter(function (i) { return i.done; }).length;
    document.getElementById('bar').style.width = (total ? done / total * 100 : 0) + '%';
    document.getElementById('count').textContent = total
      ? (done === total ? 'All packed — have a great trip! 🎉' : done + ' of ' + total + ' packed')
      : 'Your list is empty. Add something above.';
  }

  document.getElementById('add-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = input.value.trim();
    if (!t) return;
    var id = items.reduce(function (m, i) { return Math.max(m, i.id); }, 0) + 1;
    items.push({ id: id, text: t, cat: catSel.value, done: false });
    input.value = ''; save(); render(); input.focus();
  });
  document.getElementById('uncheck').addEventListener('click', function () {
    items.forEach(function (i) { i.done = false; }); save(); render();
  });
  document.getElementById('reset').addEventListener('click', function () {
    if (window.confirm('Replace your list with the default one?')) { items = defaults(); save(); render(); }
  });

  render();
})();
