(function () {
  const $ = (id) => document.getElementById(id);
  const ids = ['ssid', 'sec', 'pass', 'hidden', 'title', 'showpw'];
  const el = {};
  ids.forEach((i) => (el[i] = $(i)));
  let payload = '';

  const esc = (s) => s.replace(/([\\;,:"])/g, '\\$1');

  function buildPayload() {
    const ssid = el.ssid.value;
    if (!ssid) return '';
    const open = el.sec.value === 'nopass';
    let s = 'WIFI:T:' + el.sec.value + ';S:' + esc(ssid) + ';';
    if (!open) s += 'P:' + esc(el.pass.value) + ';';
    if (el.hidden.checked) s += 'H:true;';
    return s + ';';
  }

  function update() {
    const open = el.sec.value === 'nopass';
    $('passRow').classList.toggle('hide', open);
    payload = buildPayload();
    $('outTitle').textContent = el.title.value;
    $('outSsid').textContent = el.ssid.value;
    const showKey = !open && el.showpw.checked && el.pass.value;
    $('outPassLabel').classList.toggle('hide', !showKey);
    $('outPass').classList.toggle('hide', !showKey);
    $('outPass').textContent = el.pass.value;
    $('details').classList.toggle('hide', !payload);
    $('empty').classList.toggle('hide', !!payload);
    $('print').disabled = $('download').disabled = !payload;
    const box = $('qr');
    if (!payload) { box.innerHTML = ''; return; }
    const qr = qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }

  function download() {
    if (!payload) return;
    const qr = qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    const n = qr.getModuleCount(), cell = 10, m = 3;
    const size = (n + m * 2) * cell;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++)
      for (let k = 0; k < n; k++)
        if (qr.isDark(r, k)) ctx.fillRect((k + m) * cell, (r + m) * cell, cell, cell);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'wifi-qr.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  let dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  function applyTheme() {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('theme').textContent = dark ? 'Light mode' : 'Dark mode';
    $('theme').setAttribute('aria-pressed', dark ? 'true' : 'false');
  }
  $('theme').addEventListener('click', () => { dark = !dark; applyTheme(); });
  applyTheme();

  $('form').addEventListener('input', update);
  $('form').addEventListener('submit', (e) => e.preventDefault());
  $('print').addEventListener('click', () => window.print());
  $('download').addEventListener('click', download);
  update();
})();
