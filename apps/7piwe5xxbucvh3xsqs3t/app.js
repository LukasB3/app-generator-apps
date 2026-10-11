(function () {
  const $ = (id) => document.getElementById(id);
  const ssid = $('ssid'), sec = $('sec'), pass = $('pass'), hidden = $('hidden');
  const qrBox = $('qr'), details = $('details'), printBtn = $('print');

  const esc = (s) => s.replace(/([\\;,:"])/g, '\\$1');

  function update() {
    const open = sec.value === 'nopass';
    $('passRow').hidden = open;
    const name = ssid.value;
    if (!name) {
      qrBox.innerHTML = '<p class="empty">Enter a network name to create your code.</p>';
      details.hidden = true;
      printBtn.disabled = true;
      return;
    }
    let text = 'WIFI:T:' + sec.value + ';S:' + esc(name) + ';';
    if (!open && pass.value) text += 'P:' + esc(pass.value) + ';';
    if (hidden.checked) text += 'H:true;';
    text += ';';
    try {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      qrBox.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch (e) {
      qrBox.innerHTML = '<p class="empty">Too long to encode. Shorten the name or key.</p>';
      details.hidden = true;
      printBtn.disabled = true;
      return;
    }
    $('dSsid').textContent = name;
    $('dPass').textContent = open ? '(none)' : (pass.value || '(none)');
    details.hidden = false;
    printBtn.disabled = false;
  }

  [ssid, sec, pass, hidden].forEach((el) => {
    el.addEventListener('input', update);
    el.addEventListener('change', update);
  });
  $('form').addEventListener('submit', (e) => e.preventDefault());
  printBtn.addEventListener('click', () => window.print());
  update();
})();
