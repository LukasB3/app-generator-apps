(function () {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const $ = id => document.getElementById(id);
  const overlay = $('overlay');
  let best = +(localStorage.getItem('si-best') || 0);
  $('best').textContent = best;

  const keys = {};
  let state = 'menu', score, lives, wave, player, bullets, bombs, aliens, shields, dir, stepT, stepInt, fireCd, particles, ufo, last, shake;
  let audio;

  function beep(f, d, type, vol) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type || 'square'; o.frequency.value = f;
      g.gain.value = vol || 0.05;
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d);
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + d);
    } catch (e) {}
  }

  const SPR = [
    ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'],
    ['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '01111111110', '00100000100', '01000000010'],
    ['00001111000', '01111111111', '11111111111', '11100110011', '11111111111', '00011001100', '00110110110', '11000000011']
  ];
  const COLORS = ['#f4f', '#4ff', '#4f4'];

  function reset() { score = 0; lives = 3; wave = 1; newWave(); }

  function newWave() {
    bullets = []; bombs = []; particles = []; ufo = null; shake = 0;
    player = { x: W / 2, w: 36, h: 16 };
    aliens = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++)
      aliens.push({ x: 40 + c * 40, y: 70 + r * 34 + Math.min(wave - 1, 5) * 8, t: r === 0 ? 0 : r < 3 ? 1 : 2, alive: true });
    dir = 1; stepT = 0; stepInt = Math.max(0.12, 0.7 - wave * 0.06); fireCd = 0;
    shields = [];
    for (let s = 0; s < 4; s++) {
      const bx = 50 + s * 112, by = H - 120;
      for (let i = 0; i < 40; i++) for (let j = 0; j < 14; j++) {
        if (j > 9 && i > 10 && i < 30) continue;
        shields.push({ x: bx + i * 1.5 * 1, y: by + j * 3, a: true });
      }
    }
    // each shield cell is 3x3
    shields.forEach(c => { c.x = Math.round(c.x); });
    updateHud();
  }

  function updateHud() {
    $('score').textContent = score; $('wave').textContent = wave; $('lives').textContent = lives;
    if (score > best) { best = score; localStorage.setItem('si-best', best); }
    $('best').textContent = best;
  }

  function start() {
    reset(); state = 'play'; overlay.classList.add('hidden'); last = performance.now();
    beep(440, 0.1);
  }

  function end(msg) {
    state = 'over';
    $('title').textContent = 'GAME OVER';
    $('msg').textContent = msg + ' Score: ' + score;
    $('start').textContent = 'Play again';
    overlay.classList.remove('hidden');
  }

  function explode(x, y, col) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * 6.28, s = 40 + Math.random() * 120;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, col });
    }
  }

  function shoot() {
    if (fireCd > 0 || bullets.length >= 3) return;
    bullets.push({ x: player.x, y: H - 50 });
    fireCd = 0.3; beep(880, 0.08, 'square', 0.04);
  }

  function update(dt) {
    const sp = 240;
    if (keys.left) player.x -= sp * dt;
    if (keys.right) player.x += sp * dt;
    player.x = Math.max(24, Math.min(W - 24, player.x));
    if (keys.fire) shoot();
    fireCd -= dt;

    bullets.forEach(b => b.y -= 520 * dt);
    bullets = bullets.filter(b => b.y > -10 && !b.hit);
    bombs.forEach(b => b.y += (150 + wave * 10) * dt);
    bombs = bombs.filter(b => b.y < H && !b.hit);

    // alien movement
    const live = aliens.filter(a => a.alive);
    stepT += dt;
    const iv = stepInt * (0.25 + 0.75 * live.length / 50);
    if (stepT >= iv) {
      stepT = 0;
      const minX = Math.min(...live.map(a => a.x)), maxX = Math.max(...live.map(a => a.x));
      if ((dir > 0 && maxX > W - 36) || (dir < 0 && minX < 36)) {
        dir = -dir; live.forEach(a => a.y += 16);
      } else live.forEach(a => a.x += dir * 8);
      beep(90 + (a => a)(live.length % 2) * 20, 0.05, 'square', 0.05);
    }
    if (live.length) {
      if (Math.random() < dt * (0.8 + wave * 0.3 + (50 - live.length) * 0.03)) {
        // shoot from bottom-most alien of random column
        const a = live[Math.floor(Math.random() * live.length)];
        const lowest = live.filter(o => Math.abs(o.x - a.x) < 2).sort((p, q) => q.y - p.y)[0];
        bombs.push({ x: lowest.x, y: lowest.y + 10 });
      }
    }

    // ufo
    if (!ufo && Math.random() < dt * 0.05) ufo = { x: -30, v: 90 };
    if (ufo) { ufo.x += ufo.v * dt; if (ufo.x > W + 30) ufo = null; }

    // bullet collisions
    for (const b of bullets) {
      for (const a of live) {
        if (Math.abs(b.x - a.x) < 14 && Math.abs(b.y - a.y) < 10) {
          a.alive = false; b.hit = true; score += (3 - a.t) * 10;
          explode(a.x, a.y, COLORS[a.t]); beep(200, 0.12, 'sawtooth', 0.05); break;
        }
      }
      if (b.hit) continue;
      if (ufo && Math.abs(b.x - ufo.x) < 18 && Math.abs(b.y - 40) < 10) {
        score += 100; explode(ufo.x, 40, '#f44'); ufo = null; b.hit = true; beep(1200, 0.2, 'triangle', 0.06); continue;
      }
      hitShield(b, -1);
    }
    for (const b of bombs) {
      hitShield(b, 1);
      if (!b.hit && b.y > H - 50 && b.y < H - 30 && Math.abs(b.x - player.x) < 20) {
        b.hit = true; lives--; shake = 0.3; explode(player.x, H - 40, '#fff'); beep(70, 0.4, 'sawtooth', 0.08);
        if (lives <= 0) { updateHud(); return end('Earth has fallen.'); }
      }
    }
    shields = shields.filter(s => s.a);

    // aliens reach shields/ground
    for (const a of live) {
      if (a.y > H - 60) { lives = 0; updateHud(); return end('The invaders landed!'); }
      if (a.y > H - 130) shields.forEach(s => { if (Math.abs(s.x - a.x) < 12 && Math.abs(s.y - a.y) < 10) s.a = false; });
    }
    if (!live.length) { wave++; score += 50; newWave(); beep(660, 0.3, 'triangle', 0.06); }

    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
    particles = particles.filter(p => p.life > 0);
    shake = Math.max(0, shake - dt);
    updateHud();
  }

  function hitShield(b, d) {
    for (const s of shields) {
      if (s.a && Math.abs(b.x - s.x) < 3 && Math.abs(b.y - s.y) < 4) {
        b.hit = true;
        shields.forEach(o => { if (Math.hypot(o.x - s.x, o.y - s.y) < 7 && Math.random() < 0.8) o.a = false; });
        s.a = false; return;
      }
    }
  }

  function drawSprite(rows, x, y, px, col) {
    ctx.fillStyle = col;
    const w = rows[0].length;
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < w; c++)
      if (rows[r][c] === '1') ctx.fillRect(Math.round(x + (c - w / 2) * px), Math.round(y + (r - rows.length / 2) * px), px, px);
  }

  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    ctx.fillStyle = '#fff';
    stars.forEach(s => ctx.fillRect(s[0], s[1], 1, 1));
    if (state === 'play' || state === 'over' || state === 'pause') {
      const flip = Math.floor(performance.now() / 400) % 2;
      aliens.forEach(a => { if (a.alive) drawSprite(SPR[a.t], a.x, a.y + (flip ? 1 : 0), 2, COLORS[a.t]); });
      ctx.fillStyle = '#4c4';
      shields.forEach(s => ctx.fillRect(s.x - 1, s.y - 1, 3, 3));
      if (lives > 0) {
        ctx.fillStyle = '#4f4';
        ctx.fillRect(player.x - 18, H - 36, 36, 10);
        ctx.fillRect(player.x - 14, H - 42, 28, 6);
        ctx.fillRect(player.x - 2, H - 50, 4, 8);
      }
      ctx.fillStyle = '#fff';
      bullets.forEach(b => ctx.fillRect(b.x - 1, b.y, 3, 10));
      ctx.fillStyle = '#fa0';
      bombs.forEach(b => { ctx.fillRect(b.x - 1, b.y, 3, 4); ctx.fillRect(b.x - 2, b.y + 4, 3, 4); });
      if (ufo) {
        ctx.fillStyle = '#f44'; ctx.fillRect(ufo.x - 16, 36, 32, 8); ctx.fillRect(ufo.x - 9, 31, 18, 6);
      }
      particles.forEach(p => { ctx.fillStyle = p.col; ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillRect(p.x, p.y, 3, 3); });
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#2a2'; ctx.fillRect(0, H - 22, W, 2);
    }
    ctx.restore();
  }

  const stars = Array.from({ length: 60 }, () => [Math.random() * W | 0, Math.random() * H | 0]);

  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (state === 'play') update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function togglePause() {
    if (state === 'play') { state = 'pause'; $('title').textContent = 'PAUSED'; $('msg').textContent = 'Press P or Resume.'; $('start').textContent = 'Resume'; overlay.classList.remove('hidden'); }
    else if (state === 'pause') { state = 'play'; overlay.classList.add('hidden'); }
  }

  $('start').addEventListener('click', () => { if (state === 'pause') togglePause(); else start(); });

  const map = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ' ': 'fire' };
  window.addEventListener('keydown', e => {
    if (map[e.key]) { keys[map[e.key]] = true; e.preventDefault(); }
    if (e.key === 'p' || e.key === 'P') togglePause();
    if (e.key === 'Enter' && (state === 'menu' || state === 'over')) start();
  });
  window.addEventListener('keyup', e => { if (map[e.key]) keys[map[e.key]] = false; });

  [['left', 'left'], ['right', 'right'], ['fire', 'fire']].forEach(([id, k]) => {
    const el = $(id);
    const on = e => { e.preventDefault(); keys[k] = true; };
    const off = e => { e.preventDefault(); keys[k] = false; };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('pointercancel', off);
  });

  // drag on canvas to move
  cv.addEventListener('pointermove', e => {
    if (state !== 'play' || e.pointerType === 'mouse') return;
    const r = cv.getBoundingClientRect();
    player.x = Math.max(24, Math.min(W - 24, (e.clientX - r.left) / r.width * W));
  });
  window.addEventListener('blur', () => { if (state === 'play') togglePause(); });

  player = { x: W / 2 }; aliens = []; shields = []; bullets = []; bombs = []; particles = [];
  last = performance.now();
  requestAnimationFrame(loop);
})();
