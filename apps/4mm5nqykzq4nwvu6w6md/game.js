(function () {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const $ = id => document.getElementById(id);
  const overlay = $('overlay');
  let hi = 0;
  try { hi = +localStorage.getItem('si-hi') || 0; } catch (e) {}
  $('hi').textContent = hi;

  const keys = {};
  let state = 'menu';
  let player, bullets, bombs, aliens, shields, particles, stars;
  let score, lives, level, dir, stepTimer, stepDelay, fireCd, bombTimer, ufo, invuln;

  // Audio
  let ac = null;
  function beep(f, d, type, vol, slide) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f, ac.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, ac.currentTime + d);
      g.gain.setValueAtTime(vol || 0.05, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + d);
    } catch (e) {}
  }

  const SPR = [
    ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'],
    ['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '01111111110', '00100000100', '01000000010'],
    ['00011110000', '01111111110', '11111111111', '11100100111', '11111111111', '00111011100', '01100100110', '11000000011']
  ];
  const COLORS = ['#ff5c8a', '#ffd35c', '#5cf0ff'];

  function initStars() {
    stars = [];
    for (let i = 0; i < 60; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + .3 });
  }

  function buildWave() {
    aliens = [];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 10; c++)
        aliens.push({ x: 40 + c * 40, y: 70 + r * 34, type: r === 0 ? 2 : r < 3 ? 0 : 1, row: r, alive: true });
    dir = 1; stepTimer = 0;
    stepDelay = Math.max(0.12, 0.7 - (level - 1) * 0.08);
    bullets = []; bombs = [];
    ufo = null;
    shields = [];
    for (let s = 0; s < 4; s++) {
      const bx = 50 + s * 112, by = H - 130;
      for (let y = 0; y < 5; y++) for (let x = 0; x < 10; x++) {
        if (y === 4 && x > 2 && x < 7) continue;
        shields.push({ x: bx + x * 6, y: by + y * 6, hp: 3 });
      }
    }
  }

  function reset() {
    score = 0; lives = 3; level = 1; fireCd = 0; invuln = 0;
    player = { x: W / 2 - 15, y: H - 50, w: 30, h: 16 };
    particles = [];
    buildWave(); updateHud();
  }

  function updateHud() {
    $('score').textContent = score;
    $('level').textContent = level;
    $('lives').textContent = lives;
    $('hi').textContent = Math.max(hi, score);
  }

  function start() {
    initStars(); reset();
    state = 'play';
    overlay.classList.add('hidden');
    last = performance.now();
  }

  function end(win) {
    state = 'over';
    if (score > hi) { hi = score; try { localStorage.setItem('si-hi', hi); } catch (e) {} }
    $('title').textContent = 'GAME OVER';
    $('msg').textContent = 'Final score: ' + score + ' (level ' + level + ')';
    $('start').textContent = 'Play again';
    overlay.classList.remove('hidden');
  }

  function boom(x, y, col, n) {
    for (let i = 0; i < (n || 12); i++) {
      const a = Math.random() * 6.28, v = 30 + Math.random() * 120;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.5 + Math.random() * 0.3, c: col });
    }
  }

  function shoot() {
    if (fireCd > 0 || bullets.length >= 3) return;
    bullets.push({ x: player.x + player.w / 2, y: player.y - 4 });
    fireCd = 0.3;
    beep(900, 0.12, 'square', 0.04, 200);
  }

  function hitShield(x, y, w, h) {
    for (const s of shields) if (s.hp > 0 && x < s.x + 6 && x + w > s.x && y < s.y + 6 && y + h > s.y) {
      s.hp--; return true;
    }
    return false;
  }

  function update(dt) {
    if (state !== 'play') return;
    const sp = 230;
    if (keys.ArrowLeft || keys.a || keys.A) player.x -= sp * dt;
    if (keys.ArrowRight || keys.d || keys.D) player.x += sp * dt;
    player.x = Math.max(8, Math.min(W - 8 - player.w, player.x));
    if (keys[' ']) shoot();
    fireCd -= dt; invuln -= dt;

    // bullets
    for (const b of bullets) b.y -= 420 * dt;
    for (const b of bullets) {
      if (hitShield(b.x - 1, b.y, 2, 8)) { b.dead = true; continue; }
      for (const a of aliens) if (a.alive && b.x > a.x - 14 && b.x < a.x + 14 && b.y > a.y - 10 && b.y < a.y + 10) {
        a.alive = false; b.dead = true;
        score += [20, 10, 30][a.type] ; boom(a.x, a.y, COLORS[a.type]);
        beep(200, 0.2, 'sawtooth', 0.05, 50);
        break;
      }
      if (!b.dead && ufo && b.x > ufo.x - 16 && b.x < ufo.x + 16 && b.y < 52 && b.y > 28) {
        score += 100 * (1 + Math.floor(Math.random() * 3)); boom(ufo.x, 40, '#f55', 25);
        ufo = null; b.dead = true; beep(600, 0.4, 'sawtooth', 0.06, 100);
      }
      if (b.y < 0) b.dead = true;
    }
    bullets = bullets.filter(b => !b.dead);

    // alien movement
    const alive = aliens.filter(a => a.alive);
    if (!alive.length) { level++; buildWave(); updateHud(); beep(500, 0.4, 'triangle', 0.06, 1000); return; }
    const ratio = alive.length / 50;
    stepTimer += dt;
    const delay = Math.max(0.04, stepDelay * (0.25 + 0.75 * ratio));
    if (stepTimer >= delay) {
      stepTimer = 0;
      let edge = false;
      for (const a of alive) if ((dir > 0 && a.x > W - 28) || (dir < 0 && a.x < 28)) edge = true;
      if (edge) { dir = -dir; for (const a of alive) a.y += 14; }
      else for (const a of alive) a.x += dir * 8;
      anim ^= 1;
      beep(80 + (anim ? 0 : 20), 0.06, 'square', 0.04);
    }
    for (const a of alive) if (a.y > player.y - 16) { lives = 0; updateHud(); boom(player.x + 15, player.y, '#fff', 40); end(); return; }

    // bombs
    bombTimer -= dt;
    if (bombTimer <= 0) {
      bombTimer = Math.max(0.25, 1 - level * 0.1) * (0.5 + Math.random());
      const cols = {};
      for (const a of alive) if (!cols[a.x] || cols[a.x].y < a.y) cols[a.x] = a;
      const list = Object.values(cols);
      const a = list[Math.floor(Math.random() * list.length)];
      bombs.push({ x: a.x, y: a.y + 10 });
    }
    for (const b of bombs) {
      b.y += (140 + level * 12) * dt;
      if (hitShield(b.x - 2, b.y, 4, 8)) b.dead = true;
      else if (invuln <= 0 && b.x > player.x && b.x < player.x + player.w && b.y > player.y && b.y < player.y + player.h) {
        b.dead = true; lives--; invuln = 1.5;
        boom(player.x + 15, player.y + 8, '#7CFC9A', 30); beep(120, 0.5, 'sawtooth', 0.07, 30);
        updateHud();
        if (lives <= 0) { end(); return; }
      }
      if (b.y > H) b.dead = true;
    }
    bombs = bombs.filter(b => !b.dead);

    // ufo
    if (!ufo && Math.random() < dt * 0.06) ufo = { x: -20, v: 90 + Math.random() * 40 };
    if (ufo) { ufo.x += ufo.v * dt; if (ufo.x > W + 20) ufo = null; }

    // particles
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; }
    particles = particles.filter(p => p.t > 0);
    updateHud();
  }

  let anim = 0, last = 0;
  bombTimer = 1;

  function drawSprite(rows, x, y, px, col) {
    ctx.fillStyle = col;
    const w = rows[0].length;
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < w; c++)
      if (rows[r][c] === '1') ctx.fillRect(Math.round(x - w * px / 2 + c * px), Math.round(y - rows.length * px / 2 + r * px), px, px);
  }

  function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (!stars) initStars();
    ctx.fillStyle = '#556';
    for (const s of stars) ctx.fillRect(s.x, s.y, s.s, s.s);
    if (!aliens) return;
    for (const a of aliens) if (a.alive) {
      const spr = SPR[a.type];
      drawSprite(anim ? spr : spr.map((r, i) => i > 5 ? r.split('').reverse().join('') : r), a.x, a.y, 2.4, COLORS[a.type]);
    }
    for (const s of shields) if (s.hp > 0) {
      ctx.fillStyle = ['#000', '#2a7a46', '#4cc27a', '#7CFC9A'][s.hp];
      ctx.fillRect(s.x, s.y, 6, 6);
    }
    if (ufo) {
      ctx.fillStyle = '#f55';
      ctx.beginPath(); ctx.ellipse(ufo.x, 40, 16, 7, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#fbb'; ctx.fillRect(ufo.x - 5, 31, 10, 5);
    }
    if (state === 'play' && (invuln <= 0 || Math.floor(invuln * 12) % 2)) {
      ctx.fillStyle = '#7CFC9A';
      ctx.fillRect(player.x, player.y + 6, player.w, 10);
      ctx.fillRect(player.x + 11, player.y + 1, 8, 6);
      ctx.fillRect(player.x + 14, player.y - 5, 2, 6);
    }
    ctx.fillStyle = '#fff';
    for (const b of bullets) ctx.fillRect(b.x - 1, b.y, 3, 10);
    ctx.fillStyle = '#ff9';
    for (const b of bombs) { ctx.fillRect(b.x - 1, b.y, 3, 4); ctx.fillRect(b.x - 2, b.y + 4, 3, 4); }
    for (const p of particles) { ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, p.t * 2); ctx.fillRect(p.x, p.y, 3, 3); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1d3a2a'; ctx.fillRect(0, H - 22, W, 2);
  }

  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (state === 'play') update(dt);
    else if (state === 'over') { for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; } particles = particles.filter(p => p.t > 0); }
    draw();
    requestAnimationFrame(loop);
  }

  function pause() {
    if (state === 'play') {
      state = 'pause';
      $('title').textContent = 'PAUSED'; $('msg').textContent = 'Press P or Resume';
      $('start').textContent = 'Resume'; overlay.classList.remove('hidden');
    } else if (state === 'pause') {
      state = 'play'; overlay.classList.add('hidden');
    }
  }

  $('start').addEventListener('click', () => { if (state === 'pause') pause(); else start(); });
  window.addEventListener('keydown', e => {
    if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
    if (e.key === 'p' || e.key === 'P') { pause(); return; }
    if ((e.key === 'Enter') && state !== 'play') { if (state === 'pause') pause(); else start(); return; }
    keys[e.key] = true;
  });
  window.addEventListener('keyup', e => { keys[e.key] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') pause(); });

  function hold(id, key) {
    const el = $(id);
    const on = e => { e.preventDefault(); keys[key] = true; };
    const off = e => { e.preventDefault(); keys[key] = false; };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('pointercancel', off);
  }
  hold('left', 'ArrowLeft'); hold('right', 'ArrowRight'); hold('fire', ' ');

  initStars();
  requestAnimationFrame(t => { last = t; loop(t); });
})();
