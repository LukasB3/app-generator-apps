(function () {
  const $ = (id) => document.getElementById(id);
  const bill = $('bill'), tip = $('tip'), people = $('people'), round = $('round');
  const fmt = (n) => '$' + n.toFixed(2);

  function getPeople() {
    const n = Math.floor(Number(people.value));
    return n >= 1 ? Math.min(n, 99) : 1;
  }

  function update() {
    const b = parseFloat(bill.value);
    const t = Number(tip.value);
    const n = getPeople();
    $('tipLabel').textContent = t + '%';
    document.querySelectorAll('#presets button').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.tip) === t);
    });
    if (bill.value !== '' && (isNaN(b) || b < 0)) {
      $('msg').textContent = 'Please enter a valid, non-negative bill amount.';
    } else {
      $('msg').textContent = '';
    }
    const base = isNaN(b) || b < 0 ? 0 : b;
    const tipAmt = base * t / 100;
    let total = base + tipAmt;
    let share = total / n;
    if (round.checked) {
      share = Math.ceil(Math.round(share * 100) / 100);
      total = share * n;
    }
    $('perPerson').textContent = fmt(share);
    $('tipTotal').textContent = fmt(round.checked ? total - base : tipAmt);
    $('total').textContent = fmt(total);
  }

  function setPeople(n) {
    people.value = Math.max(1, Math.min(99, n));
    update();
  }

  $('form').addEventListener('submit', (e) => e.preventDefault());
  bill.addEventListener('input', update);
  tip.addEventListener('input', update);
  round.addEventListener('change', update);
  people.addEventListener('input', update);
  people.addEventListener('blur', () => setPeople(getPeople()));
  $('minus').addEventListener('click', () => setPeople(getPeople() - 1));
  $('plus').addEventListener('click', () => setPeople(getPeople() + 1));
  $('presets').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    tip.value = btn.dataset.tip;
    update();
  });
  update();
})();
