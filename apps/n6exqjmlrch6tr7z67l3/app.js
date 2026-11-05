(function () {
  var $ = function (id) { return document.getElementById(id); };
  var ssid = $('ssid'), sec = $('sec'), pw = $('pw'), hidden = $('hidden');
  var qrBox = $('qr'), msg = $('msg'), print = $('print'), dl = $('dl');
  var svgText = '';

  function esc(s) { return s.replace(/([\\;,:"])/g, '\\$1'); }

  function update() {
    var open = sec.value === 'nopass';
    $('pwRow').style.display = open ? 'none' : '';
    var name = ssid.value;
    var key = pw.value;
    svgText = '';
    var problem = '';
    if (!name) problem = 'Enter your network name to create a code.';
    else if (!open && !key) problem = 'Enter the Wi-Fi key.';
    else if (sec.value === 'WPA' && key.length < 8) problem = 'WPA keys must be at least 8 characters.';
    if (problem) {
      qrBox.innerHTML = '';
      msg.textContent = problem;
    } else {
      var text = 'WIFI:T:' + sec.value + ';S:' + esc(name) + ';' +
        (open ? '' : 'P:' + esc(key) + ';') + (hidden.checked ? 'H:true;' : '') + ';';
      var qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      svgText = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
      qrBox.innerHTML = svgText;
      msg.textContent = 'Scan to join "' + name + '"';
    }
    print.disabled = dl.disabled = !svgText;
  }

  [ssid, sec, pw, hidden].forEach(function (el) {
    el.addEventListener('input', update);
    el.addEventListener('change', update);
  });
  $('form').addEventListener('submit', function (e) { e.preventDefault(); });
  print.addEventListener('click', function () { window.print(); });
  dl.addEventListener('click', function () {
    var blob = new Blob([svgText], { type: 'image/svg+xml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wifi-qr.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
  dl.textContent = 'Download SVG';
  update();
})();
