(function () {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const overlay = document.getElementById('overlay');
  const msg = document.getElementById('msg');
  const startBtn = document.getElementById('start');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const livesEl = document.getElementById('lives');

  let audio = null;
  function beep(freq, dur, type, vol) {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      g.gain.value = vol || 0.05;
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + dur);
    } catch (e) {}
  }

  const keys = { left: false, right: false, fire: false };
  let state = 'menu', paused = false;
  let player, bullets, bombs, aliens, shields, particles, ufo;
  let score, lives, level, dir, alienTimer, stepCount, last, hi = 0;
  const hiStored = (function () { try { return +localStorage.getItem('si-hi') || 0; } catch (e) { return 0; } })();
  hi = hiStored;

  const SPR = [
    ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'],
    ['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '01111111110', '00100000100', '01000000010'],
    ['00011111000', '01111111110', '11111111111', '11100100111', '11111111111', '00111011100', '01100100110', '11000000011']
  ];
  const COLORS = ['#ff5d8f', '#ffd24a', '#6fe3ff'];

  function initShields() {
    shields = [];
    for (let s = 0; s < 4; s++) {
      const bx = 50 + s * 112, by = H - 130;
      for (let r = 0; r < 6; r++) for (let c = 0; c < 10; c++) {
        if (r < 2 && (c < 1 || c > 8) && r === 0) continue;
        if (r >= 4 && c >= 3 && c <= 6) continue;
        shields.push({ x: bx + c * 6, y: by + r * 6, hp: 3 });
      }
    }
  }

  function initWave() {
    aliens = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) {
      aliens.push({ x: 30 + c * 40, y: 60 + r * 34, type: r === 0 ? 2 : r < 3 ? 1 : 0, alive: true });
    }
    dir = 1; alienTimer = 0; stepCount = 0;
    bullets = []; bombs = []; ufo = null;
    initShields();
  }

  function newGame() {
    score = 0; lives = 3; level = 1;
    player = { x: W / 2 - 15, y: H - 40, w: 30, h: 16, cd: 0, inv: 0 };
    particles = [];
    initWave();
    state = 'play'; paused = false;
    overlay.classList.add('hidden');
    updateHud();
    last = performance.now();
  }

  function updateHud() {
    scoreEl.textContent = 'Score ' + score + '  Hi ' + hi;
    levelEl.textContent = 'Level ' + level;
    livesEl.textContent = '♥'.repeat(Math.max(0, lives));
  }

  function end(text) {
    state = 'over';
    if (score > hi) { hi = score; try { localStorage.setItem('si-hi', hi); } catch (e) {} }
    updateHud();
    msg.textContent = text + '\nScore ' + score;
    startBtn.textContent = 'Play again';
    overlay.classList.remove('hidden');
  }

  function explode(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * 6.28, s = 40 + Math.random() * 90;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.5, color });
    }
  }

  function hit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  function update(dt) {
    // player
    const sp = 240;
    if (keys.left) player.x -= sp * dt;
    if (keys.right) player.x += sp * dt;
    player.x = Math.max(8, Math.min(W - player.w - 8, player.x));
    player.cd -= dt; player.inv -= dt;
    if (keys.fire && player.cd <= 0 && bullets.length < 3) {
      bullets.push({ x: player.x + player.w / 2 - 1.5, y: player.y - 8, w: 3, h: 10 });
      player.cd = 0.3; beep(880, 0.1);
    }
    bullets.forEach(b => b.y -= 520 * dt);
    bullets = bullets.filter(b => b.y > -12);

    // aliens march
    const alive = aliens.filter(a => a.alive);
    if (!alive.length) { level++; initWave(); updateHud(); return; }
    const interval = Math.max(0.04, (0.07 + alive.length * 0.012) * Math.pow(0.9, level - 1));
    alienTimer += dt;
    if (alienTimer >= interval) {
      alienTimer = 0; stepCount++;
      let edge = false;
      alive.forEach(a => { if ((dir > 0 && a.x + 28 + 8 > W - 6) || (dir < 0 && a.x - 8 < 6)) edge = true; });
      if (edge) { dir = -dir; alive.forEach(a => a.y += 16); }
      else alive.forEach(a => a.x += dir * 8);
      if (stepCount % 4 === 0) beep(90 + (stepCount % 8) * 8, 0.08, 'sawtooth', 0.04);
    }
    // bombs
    if (Math.random() < dt * (0.9 + level * 0.3)) {
      const cols = {};
      alive.forEach(a => { const k = Math.round(a.x); if (!cols[k] || cols[k].y < a.y) cols[k] = a; });
      const ks = Object.keys(cols), s = cols[ks[(Math.random() * ks.length) | 0]];
      bombs.push({ x: s.x + 13, y: s.y + 20, w: 4, h: 10 });
    }
    bombs.forEach(b => b.y += (150 + level * 12) * dt);
    bombs = bombs.filter(b => b.y < H);

    // ufo
    if (!ufo && Math.random() < dt * 0.05) {
      const l = Math.random() < 0.5;
      ufo = { x: l ? -40 : W + 10, y: 34, w: 32, h: 12, v: l ? 100 : -100 };
    }
    if (ufo) { ufo.x += ufo.v * dt; if (ufo.x < -50 || ufo.x > W + 20) ufo = null; }

    // bullet collisions
    for (const b of bullets) {
      for (const a of alive) {
        if (a.alive && !b.dead && hit(b, { x: a.x, y: a.y, w: 28, h: 20 })) {
          a.alive = false; b.dead = true;
          score += (a.type + 1) * 10;
          explode(a.x + 14, a.y + 10, COLORS[a.type]); beep(200, 0.15, 'square', 0.06);
        }
      }
      if (!b.dead && ufo && hit(b, ufo)) {
        b.dead = true; score += 100 * (1 + ((Math.random() * 3) | 0));
        explode(ufo.x + 16, ufo.y + 6, '#f33'); beep(300, 0.3, 'triangle', 0.08); ufo = null;
      }
      if (!b.dead) for (const s of shields) {
        if (s.hp > 0 && hit(b, { x: s.x, y: s.y, w: 6, h: 6 })) { s.hp--; b.dead = true; break; }
      }
    }
    bullets = bullets.filter(b => !b.dead);
    for (const b of bombs) {
      for (const s of shields) {
        if (s.hp > 0 && hit(b, { x: s.x, y: s.y, w: 6, h: 6 })) { s.hp--; b.dead = true; break; }
      }
      if (!b.dead && player.inv <= 0 && hit(b, player)) {
        b.dead = true; lives--; player.inv = 1.5;
        explode(player.x + 15, player.y + 8, '#7CFC9A'); beep(80, 0.5, 'sawtooth', 0.09);
      }
    }
    bombs = bombs.filter(b => !b.dead);
    // aliens reach shields / bottom
    for (const a of alive) {
      if (!a.alive) continue;
      for (const s of shields) if (s.hp > 0 && hit({ x: a.x, y: a.y, w: 28, h: 20 }, { x: s.x, y: s.y, w: 6, h: 6 })) s.hp = 0;
      if (a.y + 20 >= player.y) lives = 0;
    }
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; });
    particles = particles.filter(p => p.t > 0);
    updateHud();
    if (lives <= 0) end('GAME OVER');
  }

  function drawSprite(rows, x, y, px, color) {
    ctx.fillStyle = color;
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '1') ctx.fillRect(x + i * px, y + j * px, px, px); });
  }

  function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    // player
    if (player.inv <= 0 || ((player.inv * 10) | 0) % 2) {
      ctx.fillStyle = '#7CFC9A';
      ctx.fillRect(player.x, player.y + 6, player.w, 10);
      ctx.fillRect(player.x + 12, player.y, 6, 8);
    }
    ctx.fillStyle = '#fff';
    bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
    ctx.fillStyle = '#ff7a5c';
    bombs.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
    const frame = stepCount % 2;
    aliens.forEach(a => {
      if (!a.alive) return;
      drawSprite(SPR[a.type], a.x, a.y + (frame ? 1 : 0), 2.5, COLORS[a.type]);
    });
    shields.forEach(s => {
      if (s.hp > 0) { ctx.fillStyle = ['', '#2c7a3f', '#4fbf68', '#7CFC9A'][s.hp]; ctx.fillRect(s.x, s.y, 6, 6); }
    });
    if (ufo) {
      ctx.fillStyle = '#f33';
      ctx.fillRect(ufo.x + 6, ufo.y, 20, 6); ctx.fillRect(ufo.x, ufo.y + 6, 32, 6);
    }
    particles.forEach(p => { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); });
    ctx.fillStyle = '#7CFC9A'; ctx.fillRect(0, H - 14, W, 2);
    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#7CFC9A'; ctx.font = '28px Courier New'; ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, H / 2);
    }
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'play' && !paused) update(dt);
    if (state !== 'menu') draw();
    requestAnimationFrame(loop);
  }

  const map = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ' ': 'fire', ArrowUp: 'fire' };
  window.addEventListener('keydown', e => {
    if (map[e.key]) { keys[map[e.key]] = true; e.preventDefault(); }
    if ((e.key === 'p' || e.key === 'P') && state === 'play') paused = !paused;
    if ((e.key === 'Enter') && state !== 'play') newGame();
  });
  window.addEventListener('keyup', e => { if (map[e.key]) keys[map[e.key]] = false; });
  window.addEventListener('blur', () => { keys.left = keys.right = keys.fire = false; if (state === 'play') paused = true; });

  function hold(id, k) {
    const el = document.getElementById(id);
    const on = e => { e.preventDefault(); keys[k] = true; };
    const off = e => { e.preventDefault(); keys[k] = false; };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('pointercancel', off);
  }
  hold('left', 'left'); hold('right', 'right'); hold('fire', 'fire');
  startBtn.addEventListener('click', newGame);
  cv.addEventListener('click', () => { if (state === 'play') paused = !paused; });

  msg.textContent = 'SPACE INVADERS\nDefend Earth!';
  startBtn.textContent = 'Start';
  last = performance.now();
  updateHud();
  requestAnimationFrame(loop);
})();
