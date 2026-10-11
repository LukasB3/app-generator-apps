(function () {
  const $ = (id) => document.getElementById(id);
  const bill = $('bill'), tip = $('tip'), people = $('people'), round = $('round');
  const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function update() {
    const b = parseFloat(bill.value);
    const t = parseFloat(tip.value) || 0;
    let n = parseInt(people.value, 10);
    $('tipLabel').textContent = t;
    document.querySelectorAll('#presets button').forEach((btn) =>
      btn.classList.toggle('on', Number(btn.dataset.tip) === t));

    let msg = '';
    if (bill.value !== '' && !(b >= 0)) msg = 'Enter a valid bill amount.';
    if (!(n >= 1)) { msg = msg || 'At least 1 person is needed.'; n = 1; }
    $('msg').textContent = msg;

    const base = b >= 0 ? b : 0;
    const tipTotal = base * t / 100;
    let each = (base + tipTotal) / n;
    let total = base + tipTotal;
    if (round.checked) {
      each = Math.ceil(each - 1e-9);
      total = each * n;
    }
    const tipAll = total - base;
    $('perPerson').textContent = fmt(each);
    $('tipTotal').textContent = fmt(tipAll);
    $('tipEach').textContent = fmt(tipAll / n);
    $('total').textContent = fmt(total);
  }

  $('presets').addEventListener('click', (e) => {
    const v = e.target.dataset && e.target.dataset.tip;
    if (v) { tip.value = v; update(); }
  });
  $('minus').addEventListener('click', () => {
    people.value = Math.max(1, (parseInt(people.value, 10) || 1) - 1); update();
  });
  $('plus').addEventListener('click', () => {
    people.value = Math.min(99, (parseInt(people.value, 10) || 0) + 1); update();
  });
  $('form').addEventListener('submit', (e) => e.preventDefault());
  [bill, tip, people, round].forEach((el) => el.addEventListener('input', update));
  update();
})();
