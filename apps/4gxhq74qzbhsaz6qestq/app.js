(function () {
  const clock = document.getElementById('clock');
  const dateEl = document.getElementById('date');
  const btn = document.getElementById('format');
  let hour12 = false;

  function pad(n) { return String(n).padStart(2, '0'); }

  function render() {
    const d = new Date();
    let h = d.getHours();
    let suffix = '';
    if (hour12) {
      suffix = h >= 12 ? ' PM' : ' AM';
      h = h % 12 || 12;
    }
    clock.textContent = pad(h) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + suffix;
    dateEl.textContent = d.toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    document.title = clock.textContent;
  }

  btn.addEventListener('click', function () {
    hour12 = !hour12;
    btn.textContent = hour12 ? 'Switch to 24-hour' : 'Switch to 12-hour';
    render();
  });

  render();
  setInterval(render, 1000);
})();
