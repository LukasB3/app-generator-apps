(function () {
  const $ = (id) => document.getElementById(id);
  const canvas = $('confetti');
  const ctx = canvas.getContext('2d');
  let pieces = [];
  let running = false;
  let celebratedKey = '';

  const saved = JSON.parse(localStorage.getItem('birthday') || 'null') || { name: 'Mum', date: '' };
  $('name').value = saved.name;
  $('date').value = saved.date;

  function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }
  addEventListener('resize', resize);
  resize();

  function burst(n) {
    const colors = ['#ff6b6b', '#ffd43b', '#51cf66', '#339af0', '#cc5de8', '#ff922b'];
    for (let i = 0; i < n; i++) {
      pieces.push({
        x: Math.random() * canvas.width, y: -20 - Math.random() * canvas.height * 0.4,
        vx: Math.random() * 4 - 2, vy: 2 + Math.random() * 4,
        w: 6 + Math.random() * 8, h: 4 + Math.random() * 6,
        r: Math.random() * 6, vr: Math.random() * 0.3 - 0.15,
        c: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.x += p.vx + Math.sin(p.r) ; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    pieces = pieces.filter((p) => p.y < canvas.height + 20);
    if (pieces.length) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  function parse(s) {
    const [y, m, d] = s.split('-').map(Number);
    return { y, m, d };
  }

  function tick() {
    const name = saved.name || 'Mum';
    $('title').textContent = '🎂 ' + (name.endsWith('s') ? name + "'" : name + "'s") + ' Birthday';
    if (!saved.date) {
      $('msg').textContent = 'Pick the birthday date below to start the countdown.';
      return;
    }
    const b = parse(saved.date);
    const now = new Date();
    let next = new Date(now.getFullYear(), b.m - 1, b.d);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isToday = next.getTime() === todayStart.getTime();
    if (next < todayStart) next = new Date(now.getFullYear() + 1, b.m - 1, b.d);

    if (isToday) {
      ['d', 'h', 'm', 's'].forEach((k) => ($(k).textContent = 0));
      const age = now.getFullYear() - b.y;
      $('msg').textContent = '🎉 Happy Birthday, ' + name + '!' + (age > 0 && age < 130 ? ' Here\'s to ' + age + '!' : '');
      if (celebratedKey !== 'today') { celebratedKey = 'today'; burst(250); }
      return;
    }
    celebratedKey = '';
    const diff = next - now;
    $('d').textContent = Math.floor(diff / 864e5);
    $('h').textContent = Math.floor(diff / 36e5) % 24;
    $('m').textContent = Math.floor(diff / 6e4) % 60;
    $('s').textContent = Math.floor(diff / 1e3) % 60;
    const days = Math.ceil(diff / 864e5);
    $('msg').textContent = days === 1 ? 'Tomorrow is the day! 🥳' : 'Only ' + days + ' sleeps to go!';
  }

  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    saved.name = $('name').value.trim() || 'Mum';
    saved.date = $('date').value;
    localStorage.setItem('birthday', JSON.stringify(saved));
    tick();
    burst(120);
  });
  $('party').addEventListener('click', () => burst(200));

  tick();
  setInterval(tick, 1000);
})();
