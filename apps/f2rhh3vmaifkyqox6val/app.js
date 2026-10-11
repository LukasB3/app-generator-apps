(function () {
  const $ = (id) => document.getElementById(id);
  const ssid = $('ssid'), sec = $('sec'), key = $('key'), hidden = $('hidden'), title = $('title');
  let currentText = '';

  const esc = (s) => s.replace(/([\\;,:"])/g, '\\$1');

  function update() {
    const open = sec.value === 'nopass';
    key.disabled = open;
    $('keyLabel').style.opacity = open ? 0.5 : 1;
    $('cardTitle').textContent = title.value;
    const name = ssid.value;
    const ok = name.length > 0;
    $('empty').style.display = ok ? 'none' : '';
    $('print').disabled = $('png').disabled = !ok;
    if (!ok) {
      $('qr').innerHTML = '';
      $('details').textContent = '';
      currentText = '';
      return;
    }
    let t = 'WIFI:T:' + sec.value + ';S:' + esc(name) + ';';
    if (!open) t += 'P:' + esc(key.value) + ';';
    if (hidden.checked) t += 'H:true;';
    t += ';';
    currentText = t;
    const qr = qrcode(0, 'M');
    qr.addData(t);
    qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    $('details').textContent = 'Network: ' + name + (open ? ' (open)' : key.value ? ' · Key: ' + key.value : '');
  }

  function downloadPng() {
    if (!currentText) return;
    const qr = qrcode(0, 'M');
    qr.addData(currentText);
    qr.make();
    const n = qr.getModuleCount(), cell = 10, m = 4;
    const size = (n + m * 2) * cell;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++)
      for (let q = 0; q < n; q++)
        if (qr.isDark(r, q)) ctx.fillRect((q + m) * cell, (r + m) * cell, cell, cell);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'wifi-qr.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  ['input', 'change'].forEach((e) => $('form').addEventListener(e, update));
  $('form').addEventListener('submit', (e) => e.preventDefault());
  $('print').addEventListener('click', () => window.print());
  $('png').addEventListener('click', downloadPng);
  update();
})();
