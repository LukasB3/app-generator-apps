(function () {
  var $ = function (id) { return document.getElementById(id); };
  var bill = $('bill'), tip = $('tip'), people = $('people'), round = $('round');
  var presets = $('presets').querySelectorAll('button');

  function money(n) { return n.toFixed(2); }

  function getPeople() {
    var p = Math.floor(parseFloat(people.value));
    if (!isFinite(p) || p < 1) p = 1;
    return Math.min(p, 100);
  }

  function update() {
    var b = parseFloat(bill.value);
    if (!isFinite(b) || b < 0) b = 0;
    var t = parseFloat(tip.value) || 0;
    var n = getPeople();
    var tipAmt = b * t / 100;
    var total = b + tipAmt;
    var share = total / n;
    var note = '';
    if (round.checked) {
      var up = Math.ceil(share - 1e-9);
      note = 'Rounded up: group pays ' + money(up * n) + ' (extra tip ' + money(up * n - total) + ').';
      share = up;
      tipAmt = up * n - b;
      total = up * n;
    }
    $('tipLabel').textContent = t + '%';
    $('perPerson').textContent = money(share);
    $('tipTotal').textContent = money(tipAmt);
    $('total').textContent = money(total);
    $('note').textContent = note;
    presets.forEach(function (btn) {
      btn.classList.toggle('active', parseFloat(btn.dataset.tip) === t);
    });
  }

  presets.forEach(function (btn) {
    btn.addEventListener('click', function () { tip.value = btn.dataset.tip; update(); });
  });
  $('minus').addEventListener('click', function () { people.value = Math.max(1, getPeople() - 1); update(); });
  $('plus').addEventListener('click', function () { people.value = Math.min(100, getPeople() + 1); update(); });
  $('reset').addEventListener('click', function () {
    bill.value = ''; tip.value = 15; people.value = 1; round.checked = false; update();
  });
  $('form').addEventListener('submit', function (e) { e.preventDefault(); });
  [bill, tip, people, round].forEach(function (el) {
    el.addEventListener('input', update);
    el.addEventListener('change', update);
  });
  people.addEventListener('blur', function () { people.value = getPeople(); update(); });
  update();
})();
