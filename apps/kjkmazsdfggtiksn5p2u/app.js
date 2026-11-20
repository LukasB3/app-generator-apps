(function () {
  const KEY = 'wifi-card-v1';
  const EXAMPLE = { ssid: 'Maple Street Guest', security: 'WPA', password: 'welcome-home-2026', hidden: false, showpw: true, example: true };
  const $ = (id) => document.getElementById(id);
  const el = {
    ssid: $('ssid'), security: $('security'), password: $('password'), hidden: $('hidden'), showpw: $('showpw'),
    hint: $('pw-hint'), note: $('example-note'), qr: $('qr'), cssid: $('c-ssid'), cpw: $('c-pw'), cpwrow: $('c-pw-row')
  };

  let state;
  try { state = Object.assign({}, EXAMPLE, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { state = Object.assign({}, EXAMPLE); }

  $('wifi-icon').appendChild(icons.svg('wifi', { size: 30, strokeWidth: 2 }));
  $('print').append(icons.svg('printer'), 'Print card');
  $('reset').append(icons.svg('rotate-ccw'), 'Use example');

  const esc = (s) => s.replace(/([\\;,:"])/g, '\\$1');

  function payload() {
    const open = state.security === 'nopass';
    return 'WIFI:T:' + state.security + ';S:' + esc(state.ssid) + ';' +
      (open ? '' : 'P:' + esc(state.password) + ';') + (state.hidden ? 'H:true;' : '') + ';';
  }

  function draw() {
    const open = state.security === 'nopass';
    el.password.disabled = open;
    el.hint.textContent = open ? 'Open networks need no password.'
      : state.security === 'WEP' ? 'WEP is old and easy to break. Use WPA if the router allows it.'
      : state.password.length < 8 ? 'WPA passwords need at least 8 characters.' : '';
    el.note.hidden = !state.example;
    el.cssid.textContent = state.ssid || 'Enter a network name';
    el.cpwrow.hidden = open || !state.showpw;
    el.cpw.textContent = state.password || '—';
    if (!state.ssid) { el.qr.replaceChildren(); return; }
    const qr = qrcode(0, 'M');
    qr.addData(payload());
    qr.make();
    el.qr.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
  }

  function fill() {
    el.ssid.value = state.ssid; el.security.value = state.security; el.password.value = state.password;
    el.hidden.checked = state.hidden; el.showpw.checked = state.showpw;
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function read() {
    state = { ssid: el.ssid.value, security: el.security.value, password: el.password.value,
      hidden: el.hidden.checked, showpw: el.showpw.checked, example: false };
    save(); draw();
  }

  ['input', 'change'].forEach((ev) => $('form').addEventListener(ev, read));
  $('form').addEventListener('submit', (e) => e.preventDefault());
  $('print').addEventListener('click', () => window.print());
  $('reset').addEventListener('click', () => { state = Object.assign({}, EXAMPLE); save(); fill(); draw(); });

  fill(); draw();
})();
