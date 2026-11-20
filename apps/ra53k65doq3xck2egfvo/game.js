(function () {
  'use strict';
  const W = 480, H = 560;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const COL = {
    player: css.getPropertyValue('--accent').trim() || '#b6f26b',
    alert: css.getPropertyValue('--alert').trim() || '#ff6b5e',
    text: css.getPropertyValue('--text').trim() || '#e8ecff',
    rows: ['#7fd4ff', '#ffd166', '#e59bff']
  };

  const SQUID = [
    ['...XX...', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '..X..X..', '.X.XX.X.', 'X.X..X.X'],
    ['...XX...', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.X.XX.X.', 'X......X', '.X....X.']
  ];
  const CRAB = [
    ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'],
    ['..X.....X..', 'X..X...X..X', 'X.XXXXXXX.X', 'XXX.XXX.XXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..X.....X..', '.X.......X.']
  ];
  const SHIP = ['.....X.....', '...XXXXX...', '..XXXXXXX..', 'XXXXXXXXXXX', 'XXXXXXXXXXX'];
  const UFO = ['...XXXXXX...', '.XXXXXXXXXX.', 'XX.XX.XX.XXX', 'XXXXXXXXXXXX', '..XX....XX..'];
  const CELL = 3;

  function sprite(rows, x, y, color, cell) {
    const c = cell || CELL;
    ctx.fillStyle = color;
    for (let r = 0; r < rows.length; r++)
      for (let k = 0; k < rows[r].length; k++)
        if (rows[r][k] === 'X') ctx.fillRect(Math.round(x + k * c), Math.round(y + r * c), c, c);
  }

  const $ = (id) => document.getElementById(id);
  const el = {
    score: $('score'), best: $('best'), wave: $('wave'), lives: $('lives'),
    overlay: $('overlay'), title: $('ov-title'), text: $('ov-text'), start: $('start'),
    pause: $('pause'), mute: $('mute')
  };

  let best = 0;
  try { best = parseInt(localStorage.getItem('invaders-best'), 10) || 0; } catch (e) { best = 0; }
  el.best.textContent = best;

  // ---- sound
  let muted = false, actx = null;
  try { muted = localStorage.getItem('invaders-muted') === '1'; } catch (e) { muted = false; }
  el.mute.textContent = muted ? 'Sound off' : 'Sound on';
  function beep(freq, dur, type, vol, slide) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
      g.gain.setValueAtTime(vol || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) { /* sound is optional */ }
  }

  // ---- state
  let mode = 'ready'; // ready, playing, paused, over
  let score, lives, wave, inv, dir, stepT, frame, pBullet, eBullets, shields, player, ufo, ufoT, shootT, parts, respawn, stepNote, last;
  const keys = { left: false, right: false };

  function makeShields() {
    const list = [];
    for (let i = 0; i < 4; i++) {
      const cells = [];
      for (let r = 0; r < 12; r++) {
        cells.push([]);
        for (let c = 0; c < 20; c++) {
          let on = true;
          if (r < 3 && (c < 3 - r || c > 16 + r)) on = false; // cut corners
          if (r > 7 && c > 5 && c < 14) on = false; // arch
          cells[r].push(on);
        }
      }
      list.push({ x: 48 + i * 112 + 6, y: 440, cells });
    }
    return list;
  }

  function makeInvaders() {
    const list = [];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 9; c++) {
        const type = r === 0 ? 0 : r < 3 ? 1 : 2;
        list.push({ r, c, type, x: 50 + c * 40, y: 70 + Math.min(wave - 1, 5) * 12 + r * 34, alive: true });
      }
    return list;
  }

  function newWave() {
    inv = makeInvaders(); dir = 1; stepT = 0; frame = 0; stepNote = 0;
    pBullet = null; eBullets = []; shields = makeShields();
    ufo = null; ufoT = 12 + Math.random() * 8; shootT = 1;
    el.wave.textContent = wave;
  }

  function newGame() {
    score = 0; lives = 3; wave = 1; parts = []; respawn = 0;
    player = { x: W / 2 - 17, y: 508, w: 33, h: 15 };
    newWave(); showStats(); mode = 'playing'; el.overlay.hidden = true;
    el.pause.textContent = 'Pause'; last = performance.now();
  }

  function showStats() {
    el.score.textContent = score;
    el.lives.textContent = lives;
    el.wave.textContent = wave;
    el.best.textContent = Math.max(best, score);
  }

  function addScore(n) { score += n; showStats(); }

  function burst(x, y, color, n) {
    for (let i = 0; i < (n || 10); i++) {
      const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 120;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.3, color });
    }
  }

  function gameOver() {
    mode = 'over';
    if (score > best) { best = score; try { localStorage.setItem('invaders-best', String(best)); } catch (e) { /* ignore */ } }
    showStats();
    el.title.textContent = 'Game over';
    el.text.textContent = 'You scored ' + score + ' and reached wave ' + wave + (score >= best && score > 0 ? '. A new best.' : '. Best is ' + best + '.');
    el.start.textContent = 'Play again';
    el.overlay.hidden = false;
    el.start.focus();
    beep(200, 0.8, 'sawtooth', 0.06, 40);
  }

  function setPaused(p) {
    if (mode !== 'playing' && mode !== 'paused') return;
    if (p) {
      mode = 'paused'; el.pause.textContent = 'Resume';
      el.title.textContent = 'Paused'; el.text.textContent = 'Your game is waiting.'; el.start.textContent = 'Resume';
      el.overlay.hidden = false; el.start.focus();
    } else {
      mode = 'playing'; el.pause.textContent = 'Pause'; el.overlay.hidden = true; last = performance.now();
    }
  }

  function fire() {
    if (mode !== 'playing' || pBullet || respawn > 0) return;
    pBullet = { x: player.x + player.w / 2, y: player.y - 4 };
    beep(880, 0.12, 'square', 0.04, 300);
  }

  function hitShield(b, h) {
    for (const s of shields) {
      const c = Math.floor((b.x - s.x) / CELL), r = Math.floor((b.y + (h || 0) - s.y) / CELL);
      if (r < 0 || r >= 12 || c < 0 || c >= 20) continue;
      if (s.cells[r][c]) {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -2; dc <= 2; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < 12 && cc >= 0 && cc < 20 && (Math.abs(dc) + Math.abs(dr) < 3 || Math.random() < 0.4)) s.cells[rr][cc] = false;
          }
        return true;
      }
    }
    return false;
  }

  function invSize(i) { return i.type === 0 ? { w: 24, h: 24 } : { w: 33, h: 24 }; }
  function invDraw(i) { return i.type === 0 ? SQUID : CRAB; }

  function update(dt) {
    // player
    if (respawn > 0) respawn -= dt;
    const mv = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    player.x = Math.max(8, Math.min(W - 8 - player.w, player.x + mv * 260 * dt));

    // player bullet
    if (pBullet) {
      pBullet.y -= 520 * dt;
      if (pBullet.y < 0) pBullet = null;
      else if (hitShield(pBullet, 0)) pBullet = null;
    }
    if (pBullet) {
      for (const i of inv) {
        if (!i.alive) continue;
        const s = invSize(i);
        const ox = i.x + (33 - s.w) / 2;
        if (pBullet.x > ox && pBullet.x < ox + s.w && pBullet.y > i.y && pBullet.y < i.y + s.h) {
          i.alive = false; pBullet = null;
          addScore([30, 20, 10][i.type] * (i.type === 2 && i.r === 4 ? 1 : 1));
          burst(ox + s.w / 2, i.y + 12, COL.rows[i.type], 12);
          beep(160, 0.18, 'sawtooth', 0.05, 60);
          break;
        }
      }
    }
    if (pBullet && ufo && pBullet.y < 58 && pBullet.x > ufo.x && pBullet.x < ufo.x + 36) {
      const v = [50, 100, 150, 300][Math.floor(Math.random() * 4)];
      addScore(v); burst(ufo.x + 18, 44, COL.alert, 18);
      parts.push({ x: ufo.x + 18, y: 44, vx: 0, vy: -20, life: 0.9, color: COL.text, text: String(v) });
      ufo = null; pBullet = null; beep(600, 0.3, 'triangle', 0.06, 120);
    }

    // invaders march
    const alive = inv.filter((i) => i.alive);
    if (!alive.length) { wave++; newWave(); showStats(); beep(520, 0.3, 'triangle', 0.06, 900); return; }
    const interval = Math.max(0.05, (0.75 * alive.length / 45)) / (1 + (wave - 1) * 0.15);
    stepT += dt;
    if (stepT >= interval) {
      stepT = 0; frame ^= 1;
      let edge = false;
      for (const i of alive) {
        const nx = i.x + dir * 8;
        if (nx < 10 || nx + 33 > W - 10) { edge = true; break; }
      }
      if (edge) { dir = -dir; for (const i of alive) i.y += 16; }
      else for (const i of alive) i.x += dir * 8;
      beep([110, 98, 87, 78][stepNote++ % 4], 0.07, 'square', 0.04);
    }
    for (const i of alive) {
      // invaders eat shields they touch
      if (i.y + 24 > 440) for (const s of shields) {
        const x0 = i.x, x1 = i.x + 33;
        if (x1 > s.x && x0 < s.x + 60) {
          for (let r = 0; r < 12; r++) for (let c = 0; c < 20; c++) {
            const cx = s.x + c * CELL, cy = s.y + r * CELL;
            if (cx > x0 && cx < x1 && cy < i.y + 24) s.cells[r][c] = false;
          }
        }
      }
      if (i.y + 24 >= player.y) { lives = 0; showStats(); gameOver(); return; }
    }

    // invader fire
    shootT -= dt;
    if (shootT <= 0) {
      shootT = Math.max(0.35, 1.1 - wave * 0.08) * (0.5 + Math.random());
      const cols = {};
      for (const i of alive) if (!cols[i.c] || i.y > cols[i.c].y) cols[i.c] = i;
      const ks = Object.keys(cols);
      const shooter = cols[ks[Math.floor(Math.random() * ks.length)]];
      if (shooter && eBullets.length < 4 + wave) eBullets.push({ x: shooter.x + 16, y: shooter.y + 24, t: 0 });
    }
    for (let k = eBullets.length - 1; k >= 0; k--) {
      const b = eBullets[k];
      b.y += (200 + wave * 12) * dt; b.t += dt;
      let gone = b.y > H;
      if (!gone && hitShield(b, 8)) gone = true;
      if (!gone && pBullet && Math.abs(b.x - pBullet.x) < 4 && Math.abs(b.y - pBullet.y) < 10) { gone = true; pBullet = null; }
      if (!gone && respawn <= 0 && b.x > player.x && b.x < player.x + player.w && b.y + 8 > player.y && b.y < player.y + player.h) {
        gone = true; lives--; showStats();
        burst(player.x + 16, player.y + 8, COL.player, 24); beep(120, 0.5, 'sawtooth', 0.07, 40);
        if (lives <= 0) { gameOver(); return; }
        respawn = 1.4;
      }
      if (gone) eBullets.splice(k, 1);
    }

    // ufo
    ufoT -= dt;
    if (!ufo && ufoT <= 0) { const d = Math.random() < 0.5 ? 1 : -1; ufo = { x: d > 0 ? -40 : W + 4, d }; ufoT = 15 + Math.random() * 10; }
    if (ufo) {
      ufo.x += ufo.d * 90 * dt;
      if (ufo.x < -50 || ufo.x > W + 20) ufo = null;
    }

    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) parts.splice(k, 1);
    }
  }

  function draw() {
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, W, H);
    // stars (fixed)
    ctx.fillStyle = '#26305a';
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % W, (i * 53) % 420 + 6, 2, 2);
    // ground
    ctx.fillStyle = COL.player;
    ctx.fillRect(0, 534, W, 2);

    if (!inv) { // ready screen backdrop
      for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) {
        const t = r === 0 ? 0 : r < 3 ? 1 : 2;
        sprite((t === 0 ? SQUID : CRAB)[0], 50 + c * 40 + (t === 0 ? 4 : 0), 70 + r * 34, COL.rows[t]);
      }
      sprite(SHIP, W / 2 - 17, 508, COL.player);
      return;
    }

    for (const i of inv) if (i.alive) {
      const s = invSize(i);
      sprite(invDraw(i)[frame], i.x + (33 - s.w) / 2, i.y, COL.rows[i.type]);
    }
    ctx.fillStyle = '#6fa85a';
    for (const s of shields) for (let r = 0; r < 12; r++) for (let c = 0; c < 20; c++)
      if (s.cells[r][c]) ctx.fillRect(s.x + c * CELL, s.y + r * CELL, CELL, CELL);

    if (ufo) sprite(UFO, ufo.x, 36, COL.alert, 3);
    if (respawn <= 0 || Math.floor(respawn * 10) % 2 === 0) sprite(SHIP, player.x, player.y, COL.player);

    ctx.fillStyle = COL.text;
    if (pBullet) ctx.fillRect(pBullet.x - 1.5, pBullet.y, 3, 12);
    ctx.fillStyle = COL.alert;
    for (const b of eBullets) {
      const o = Math.floor(b.t * 12) % 2 ? 2 : -2;
      ctx.fillRect(b.x - 1 + o, b.y, 2, 4); ctx.fillRect(b.x - 1, b.y + 4, 2, 4); ctx.fillRect(b.x - 1 + o, b.y + 8, 2, 4);
    }
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      if (p.text) { ctx.fillStyle = p.color; ctx.font = '600 16px "JetBrains Mono", monospace'; ctx.fillText(p.text, p.x - 14, p.y); }
      else { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); }
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    if (mode === 'playing') {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
    }
    draw();
    requestAnimationFrame(loop);
  }

  // ---- input
  function onStart() {
    if (mode === 'paused') setPaused(false);
    else if (mode === 'ready' || mode === 'over') newGame();
  }
  el.start.addEventListener('click', onStart);
  el.pause.addEventListener('click', () => { if (mode === 'playing') setPaused(true); else if (mode === 'paused') setPaused(false); });
  el.mute.addEventListener('click', () => {
    muted = !muted; el.mute.textContent = muted ? 'Sound off' : 'Sound on';
    try { localStorage.setItem('invaders-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
  });

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; if (mode === 'playing') e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; if (mode === 'playing') e.preventDefault(); }
    else if (k === ' ' || k === 'Spacebar') {
      if (mode === 'playing') { e.preventDefault(); if (!e.repeat || true) fire(); }
      else if (e.target === document.body) { e.preventDefault(); onStart(); }
    } else if (k === 'Enter' && e.target === document.body) onStart();
    else if (k === 'p' || k === 'P' || k === 'Escape') {
      if (mode === 'playing') setPaused(true); else if (mode === 'paused') setPaused(false);
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
  });
  window.addEventListener('blur', () => { keys.left = keys.right = false; if (mode === 'playing') setPaused(true); });

  function hold(id, on, off) {
    const b = $(id);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('on'); on(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => b.addEventListener(t, () => { b.classList.remove('on'); off(); }));
  }
  hold('t-left', () => { keys.left = true; }, () => { keys.left = false; });
  hold('t-right', () => { keys.right = true; }, () => { keys.right = false; });
  hold('t-fire', fire, () => {});
  $('t-left').prepend(icons.svg('arrow-left', { size: 24 }));
  $('t-right').prepend(icons.svg('arrow-right', { size: 24 }));

  requestAnimationFrame(loop);
})();
