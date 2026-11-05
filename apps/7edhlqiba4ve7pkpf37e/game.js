(function () {
  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const overlay = document.getElementById('overlay');
  const titleEl = document.getElementById('title'), msgEl = document.getElementById('msg');
  const keys = { left: false, right: false, fire: false };
  let audio = null;

  function beep(f, d, type) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type || 'square'; o.frequency.value = f;
      g.gain.value = 0.04;
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d);
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + d);
    } catch (e) {}
  }

  const SPR = [
    ['00100000100','00010001000','00111111100','01101110110','11111111111','10111111101','10100000101','00011011000'],
    ['00100000100','10010001001','10111111101','11101110111','11111111111','01111111110','00100000100','01000000010'],
    ['00001111000','01111111111','11111111111','11100110011','11111111111','00111001100','01100110011','11000000011']
  ];
  const COLORS = ['#f6f', '#6ff', '#ff6'];
  let state = 'menu', score, lives, level, player, bullets, bombs, aliens, dir, stepT, frame, shields, ufo, lastShot, best = 0, particles;

  function init(newGame) {
    if (newGame) { score = 0; lives = 3; level = 1; }
    player = { x: W / 2 - 15, y: H - 40, w: 30, h: 16 };
    bullets = []; bombs = []; particles = []; shields = []; ufo = null;
    aliens = []; dir = 1; stepT = 0; frame = 0; lastShot = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++)
      aliens.push({ x: 40 + c * 40, y: 60 + r * 32 + Math.min(level - 1, 5) * 12, w: 22, h: 16, t: r === 0 ? 2 : r < 3 ? 1 : 0, alive: true });
    for (let s = 0; s < 4; s++) {
      const bx = 50 + s * 112, by = H - 120;
      for (let i = 0; i < 12; i++) for (let j = 0; j < 7; j++) {
        if (j > 4 && i > 3 && i < 8) continue;
        shields.push({ x: bx + i * 5, y: by + j * 5, hp: 3 });
      }
    }
    hud();
  }
  function hud() {
    document.getElementById('score').textContent = 'Score ' + score;
    document.getElementById('level').textContent = 'Level ' + level;
    document.getElementById('lives').textContent = '♥'.repeat(Math.max(lives, 0));
  }
  function start() {
    init(true); state = 'play'; overlay.classList.add('hidden');
    beep(440, 0.1);
  }
  function end(win) {
    state = 'over'; best = Math.max(best, score);
    titleEl.textContent = 'GAME OVER';
    msgEl.textContent = 'Score ' + score + ' · Best ' + best;
    document.getElementById('start').textContent = 'Play again';
    overlay.classList.remove('hidden');
    beep(90, 0.6, 'sawtooth');
  }
  function boom(x, y, col) {
    for (let i = 0; i < 12; i++) particles.push({ x, y, vx: (Math.random() - .5) * 200, vy: (Math.random() - .5) * 200, l: .5, c: col });
  }
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function fire(now) {
    if (now - lastShot > 400 && bullets.length < 2) {
      bullets.push({ x: player.x + player.w / 2 - 1.5, y: player.y - 8, w: 3, h: 10 });
      lastShot = now; beep(880, 0.08);
    }
  }

  function update(dt, now) {
    if (keys.left) player.x -= 260 * dt;
    if (keys.right) player.x += 260 * dt;
    player.x = Math.max(8, Math.min(W - 8 - player.w, player.x));
    if (keys.fire) fire(now);

    bullets.forEach(b => b.y -= 420 * dt);
    bombs.forEach(b => b.y += (170 + level * 15) * dt);
    bullets = bullets.filter(b => b.y > -10);
    bombs = bombs.filter(b => b.y < H);

    const alive = aliens.filter(a => a.alive);
    const interval = Math.max(0.04, 0.03 + alive.length * 0.014 - level * 0.02);
    stepT += dt;
    if (stepT > interval) {
      stepT = 0; frame ^= 1;
      let edge = alive.some(a => (dir > 0 && a.x + a.w > W - 12) || (dir < 0 && a.x < 12));
      if (edge) { dir = -dir; alive.forEach(a => a.y += 14); }
      else alive.forEach(a => a.x += dir * 8);
      beep(frame ? 110 : 90, 0.05);
    }
    if (alive.length && Math.random() < dt * (1 + level * 0.4)) {
      const a = alive[Math.floor(Math.random() * alive.length)];
      bombs.push({ x: a.x + a.w / 2, y: a.y + a.h, w: 4, h: 10 });
    }
    if (!ufo && Math.random() < dt * 0.05) ufo = { x: -40, y: 36, w: 36, h: 14 };
    if (ufo) { ufo.x += 110 * dt; if (ufo.x > W) ufo = null; }

    for (const b of bullets) {
      for (const a of alive) if (a.alive && !b.dead && hit(b, a)) {
        a.alive = false; b.dead = true; score += (a.t + 1) * 10; boom(a.x + 11, a.y + 8, COLORS[a.t]); beep(200, 0.1, 'sawtooth');
      }
      if (ufo && !b.dead && hit(b, ufo)) {
        b.dead = true; score += 100; boom(ufo.x + 18, ufo.y + 7, '#f44'); ufo = null; beep(600, 0.2, 'sawtooth');
      }
    }
    for (const arr of [bullets, bombs]) for (const b of arr) for (const s of shields)
      if (s.hp > 0 && !b.dead && hit(b, { x: s.x, y: s.y, w: 5, h: 5 })) { s.hp--; b.dead = true; }
    bullets = bullets.filter(b => !b.dead);
    for (const b of bombs) if (!b.dead && hit(b, player)) {
      b.dead = true; lives--; boom(player.x + 15, player.y + 8, '#6f6'); beep(70, 0.4, 'sawtooth');
      if (lives <= 0) { hud(); return end(); }
    }
    bombs = bombs.filter(b => !b.dead);
    shields = shields.filter(s => s.hp > 0);
    for (const a of alive) {
      if (!a.alive) continue;
      for (const s of shields) if (hit(a, { x: s.x, y: s.y, w: 5, h: 5 })) s.hp = 0;
      if (a.y + a.h >= player.y) return end();
    }
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; });
    particles = particles.filter(p => p.l > 0);

    if (!aliens.some(a => a.alive)) { level++; const sc = score, lv = level, lf = lives; init(false); score = sc; level = lv; lives = lf; beep(660, 0.3); }
    hud();
  }

  function drawSprite(rows, x, y, w, h, col) {
    const cw = w / rows[0].length, ch = h / rows.length;
    ctx.fillStyle = col;
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '1') ctx.fillRect(x + i * cw, y + j * ch, cw + .5, ch + .5); });
  }
  function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    for (const a of aliens) if (a.alive) {
      const rows = SPR[a.t === 2 ? 2 : a.t];
      drawSprite(rows, a.x, a.y + (frame ? 2 : 0), a.w, a.h, COLORS[a.t]);
    }
    ctx.fillStyle = '#6f6';
    ctx.fillRect(player.x, player.y + 6, player.w, 10);
    ctx.fillRect(player.x + 12, player.y, 6, 8);
    ctx.fillStyle = '#4c4';
    for (const s of shields) { ctx.globalAlpha = s.hp / 3 * .6 + .4; ctx.fillRect(s.x, s.y, 5, 5); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
    ctx.fillStyle = '#fa4';
    bombs.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
    if (ufo) {
      ctx.fillStyle = '#f44'; ctx.fillRect(ufo.x, ufo.y + 5, ufo.w, 9);
      ctx.fillRect(ufo.x + 9, ufo.y, 18, 6);
    }
    particles.forEach(p => { ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(p.l * 2, 0); ctx.fillRect(p.x, p.y, 3, 3); });
    ctx.globalAlpha = 1;
    if (state === 'pause') { ctx.fillStyle = '#fff'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', W / 2, H / 2); }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (state === 'play') update(dt, now);
    if (state !== 'menu') draw();
    requestAnimationFrame(loop);
  }

  const map = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ' ': 'fire' };
  addEventListener('keydown', e => {
    if (map[e.key]) { keys[map[e.key]] = true; e.preventDefault(); }
    if ((e.key === 'p' || e.key === 'P') && (state === 'play' || state === 'pause')) state = state === 'play' ? 'pause' : 'play';
    if (e.key === 'Enter' && (state === 'menu' || state === 'over')) start();
  });
  addEventListener('keyup', e => { if (map[e.key]) keys[map[e.key]] = false; });
  addEventListener('blur', () => { keys.left = keys.right = keys.fire = false; if (state === 'play') state = 'pause'; });

  function hold(id, k) {
    const el = document.getElementById(id);
    const on = e => { e.preventDefault(); keys[k] = true; };
    const off = e => { e.preventDefault(); keys[k] = false; };
    el.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => el.addEventListener(t, off));
  }
  hold('left', 'left'); hold('right', 'right'); hold('fire', 'fire');
  document.getElementById('start').addEventListener('click', start);
  cv.addEventListener('pointerdown', () => { if (state === 'pause') state = 'play'; });

  init(true);
  draw();
  requestAnimationFrame(loop);
})();
