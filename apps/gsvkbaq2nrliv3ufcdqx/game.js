(function () {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const $ = id => document.getElementById(id);
  const overlay = $('overlay');
  let best = 0;
  try { best = +localStorage.getItem('si-best') || 0; } catch (e) {}
  $('best').textContent = best;

  const keys = {};
  let state = 'menu', player, aliens, bullets, bombs, shields, particles, score, lives, level;
  let dir, alienSpeed, moveTimer, frame, cooldown, ufo, last, paused = false;
  const COLS = 10, ROWS = 5;

  // sprites
  const SPR = [
    ['00100000100','00010001000','00111111100','01101110110','11111111111','10111111101','10100000101','00011011000'],
    ['00100000100','10010001001','10111111101','11101110111','11111111111','01111111110','00100000100','01000000010'],
    ['00001111000','01111111111','11111111111','11100110011','11111111111','00111001100','01100110110','11000000011']
  ];
  const COLORS = ['#f6f', '#6ff', '#ff6', '#f66', '#6f6'];

  let actx = null;
  function beep(f, d, type, v) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'square'; o.frequency.value = f;
      g.gain.value = v || 0.05;
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + d);
    } catch (e) {}
  }

  function makeShields() {
    shields = [];
    for (let i = 0; i < 4; i++) {
      const x0 = 50 + i * 110;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) {
        if (r === 3 && c > 2 && c < 7) continue;
        shields.push({ x: x0 + c * 6, y: 440 + r * 6, hp: 3 });
      }
    }
  }

  function makeWave() {
    aliens = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
      aliens.push({ x: 40 + c * 40, y: 60 + r * 34 + Math.min(level - 1, 5) * 8, r, alive: true });
    dir = 1; moveTimer = 0; frame = 0;
    bullets = []; bombs = [];
    makeShields();
  }

  function reset() {
    score = 0; lives = 3; level = 1;
    player = { x: W / 2 - 15, y: H - 40, w: 30, h: 16 };
    particles = []; cooldown = 0; ufo = null;
    makeWave(); hud();
  }

  function hud() {
    $('score').textContent = score; $('level').textContent = level; $('lives').textContent = lives;
    if (score > best) {
      best = score; $('best').textContent = best;
      try { localStorage.setItem('si-best', best); } catch (e) {}
    }
  }

  function start() {
    reset(); state = 'play'; paused = false;
    overlay.classList.add('hidden'); last = performance.now();
  }

  function end(win) {
    state = 'over';
    $('title').textContent = 'GAME OVER';
    $('msg').textContent = 'Final score: ' + score;
    $('start').textContent = 'Play again';
    overlay.classList.remove('hidden');
  }

  function boom(x, y, col) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * 6.28, s = 30 + Math.random() * 90;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.5, col });
    }
  }

  function fire() {
    if (state !== 'play' || paused || cooldown > 0) return;
    bullets.push({ x: player.x + player.w / 2, y: player.y - 4 });
    cooldown = 0.4; beep(880, 0.1, 'square');
  }

  function update(dt) {
    if (keys.ArrowLeft || keys.a || keys.A) player.x -= 260 * dt;
    if (keys.ArrowRight || keys.d || keys.D) player.x += 260 * dt;
    player.x = Math.max(8, Math.min(W - 8 - player.w, player.x));
    if (keys[' ']) fire();
    cooldown -= dt;

    bullets.forEach(b => b.y -= 480 * dt);
    bombs.forEach(b => b.y += (160 + level * 12) * dt);

    // aliens
    const alive = aliens.filter(a => a.alive);
    const interval = Math.max(0.04, (0.04 + alive.length * 0.012) / (1 + level * 0.15));
    moveTimer += dt;
    if (moveTimer >= interval) {
      moveTimer = 0; frame ^= 1;
      let edge = alive.some(a => dir > 0 ? a.x + 28 > W - 10 : a.x < 10);
      if (edge) { dir = -dir; alive.forEach(a => a.y += 16); }
      else alive.forEach(a => a.x += dir * 8);
      beep(frame ? 90 : 70, 0.08, 'sawtooth', 0.04);
    }
    if (alive.some(a => a.y + 20 >= player.y)) { lives = 0; hud(); boom(player.x, player.y, '#fff'); return end(); }

    // alien bombs
    if (alive.length && Math.random() < dt * (0.8 + level * 0.3 + (50 - alive.length) * 0.02)) {
      const cols = {};
      alive.forEach(a => { if (!cols[a.x] || cols[a.x].y < a.y) cols[a.x] = a; });
      const ks = Object.keys(cols), s = cols[ks[Math.floor(Math.random() * ks.length)]];
      bombs.push({ x: s.x + 14, y: s.y + 22 });
    }

    // ufo
    if (!ufo && Math.random() < dt * 0.05) ufo = { x: -40, v: 90 };
    if (ufo) { ufo.x += ufo.v * dt; if (ufo.x > W + 40) ufo = null; }

    // bullet collisions
    bullets.forEach(b => {
      for (const a of alive) {
        if (a.alive && b.x > a.x && b.x < a.x + 28 && b.y > a.y && b.y < a.y + 20) {
          a.alive = false; b.dead = true;
          score += (ROWS - a.r) * 10; boom(a.x + 14, a.y + 10, COLORS[a.r]); beep(200, 0.15, 'noise' && 'sawtooth', 0.06);
          hud(); return;
        }
      }
      if (ufo && b.x > ufo.x - 18 && b.x < ufo.x + 18 && b.y > 30 && b.y < 48) {
        score += 100 + Math.floor(Math.random() * 3) * 50; boom(ufo.x, 40, '#f33'); ufo = null; b.dead = true; hud();
        beep(300, 0.3, 'triangle', 0.08); return;
      }
      for (const s of shields) if (s.hp > 0 && b.x > s.x && b.x < s.x + 6 && b.y > s.y && b.y < s.y + 6) { s.hp--; b.dead = true; return; }
    });
    bombs.forEach(b => {
      for (const s of shields) if (s.hp > 0 && b.x > s.x - 1 && b.x < s.x + 7 && b.y > s.y && b.y < s.y + 6) { s.hp--; b.dead = true; return; }
      if (b.x > player.x && b.x < player.x + player.w && b.y > player.y && b.y < player.y + player.h) {
        b.dead = true; lives--; boom(player.x + 15, player.y + 8, '#6f6'); beep(80, 0.5, 'sawtooth', 0.1); hud();
        if (lives <= 0) end(); else bombs = [];
      }
    });
    shields = shields.filter(s => s.hp > 0);
    bullets = bullets.filter(b => !b.dead && b.y > -10);
    bombs = bombs.filter(b => !b.dead && b.y < H);
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; });
    particles = particles.filter(p => p.t > 0);

    if (!aliens.some(a => a.alive)) { level++; hud(); makeWave(); beep(660, 0.3, 'triangle', 0.08); }
  }

  function drawSprite(sp, x, y, px, col) {
    ctx.fillStyle = col;
    for (let r = 0; r < sp.length; r++) for (let c = 0; c < sp[r].length; c++)
      if (sp[r][c] === '1') ctx.fillRect(x + c * px, y + r * px, px, px);
  }

  function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % W, (i * 53) % H, 1, 1);
    aliens.forEach(a => {
      if (!a.alive) return;
      const t = a.r === 0 ? 2 : a.r < 3 ? 1 : 0;
      drawSprite(SPR[t], a.x, a.y, 2.5, COLORS[a.r]);
    });
    shields.forEach(s => { ctx.fillStyle = ['#030', '#171', '#3c3'][s.hp - 1]; ctx.fillRect(s.x, s.y, 6, 6); });
    if (ufo) {
      ctx.fillStyle = '#f33'; ctx.beginPath(); ctx.ellipse(ufo.x, 40, 18, 7, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#fcc'; ctx.fillRect(ufo.x - 5, 31, 10, 5);
    }
    if (state === 'play' || lives > 0) {
      ctx.fillStyle = '#6f6';
      ctx.fillRect(player.x, player.y + 6, player.w, 10);
      ctx.fillRect(player.x + 11, player.y, 8, 8);
    }
    ctx.fillStyle = '#fff'; bullets.forEach(b => ctx.fillRect(b.x - 1, b.y - 8, 3, 10));
    ctx.fillStyle = '#fa4'; bombs.forEach(b => { ctx.fillRect(b.x - 1, b.y, 3, 5); ctx.fillRect(b.x - 2, b.y + 5, 5, 3); });
    particles.forEach(p => { ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 3, 3); });
    ctx.fillStyle = '#3a3'; ctx.fillRect(0, H - 14, W, 2);
    if (paused) { ctx.fillStyle = '#fff'; ctx.font = '28px monospace'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', W / 2, H / 2); }
  }

  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (state === 'play' && !paused) update(dt);
    else if (state === 'over') { particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; }); particles = particles.filter(p => p.t > 0); }
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', e => {
    if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
    keys[e.key] = true;
    if ((e.key === 'p' || e.key === 'P') && state === 'play') paused = !paused;
    if (e.key === 'Enter' && state !== 'play') start();
  });
  window.addEventListener('keyup', e => { keys[e.key] = false; });
  window.addEventListener('blur', () => { if (state === 'play') paused = true; });
  $('start').addEventListener('click', start);

  function hold(id, key) {
    const el = $(id);
    const on = e => { e.preventDefault(); keys[key] = true; };
    const off = e => { e.preventDefault(); keys[key] = false; };
    el.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(n => el.addEventListener(n, off));
  }
  hold('left', 'ArrowLeft'); hold('right', 'ArrowRight'); hold('fire', ' ');

  reset(); state = 'menu';
  last = performance.now();
  requestAnimationFrame(loop);
})();
