(function () {
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const bestEl = document.getElementById('best');
  const startBtn = document.getElementById('start');

  let best = 0;
  try { best = +localStorage.getItem('blastzone-best') || 0; } catch (e) {}
  bestEl.textContent = 'Best ' + best;

  let state = 'menu', player, bullets, enemies, ebullets, parts, stars, score, lives, t, spawn, combo, comboT, shake, paused;
  const keys = {};
  let firing = false, targetX = null;
  let actx = null;

  function beep(freq, dur, type, vol) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, actx.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, freq / 3), actx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.05, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) {}
  }

  function reset() {
    player = { x: W / 2, y: H - 60, cd: 0, inv: 0 };
    bullets = []; enemies = []; ebullets = []; parts = [];
    stars = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random() * 2 }));
    score = 0; lives = 3; t = 0; spawn = 0; combo = 0; comboT = 0; shake = 0; paused = false;
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = 'Score ' + score;
    livesEl.textContent = 'Lives ' + '♥'.repeat(Math.max(0, lives));
    bestEl.textContent = 'Best ' + best;
  }

  function boom(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = 1 + Math.random() * 5;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 20 + Math.random() * 25, color });
    }
  }

  function start() {
    reset(); state = 'play';
    startBtn.textContent = 'Restart';
    beep(500, 0.2, 'sawtooth');
  }

  function spawnEnemy() {
    const heavy = Math.random() < 0.2 + Math.min(0.3, t / 6000);
    enemies.push({
      x: 30 + Math.random() * (W - 60), y: -30,
      vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 1.2 + t / 4000,
      hp: heavy ? 4 : 1, r: heavy ? 24 : 16, heavy, cd: 60 + Math.random() * 90
    });
  }

  function update() {
    t++;
    stars.forEach(s => { s.y += s.s; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
    // player
    const sp = 6;
    if (keys.ArrowLeft || keys.a) player.x -= sp;
    if (keys.ArrowRight || keys.d) player.x += sp;
    if (targetX !== null) player.x += Math.max(-10, Math.min(10, targetX - player.x));
    player.x = Math.max(20, Math.min(W - 20, player.x));
    player.cd--; player.inv--;
    if ((firing || keys[' ']) && player.cd <= 0) {
      player.cd = 8;
      bullets.push({ x: player.x - 10, y: player.y - 10 }, { x: player.x + 10, y: player.y - 10 });
      beep(900, 0.08, 'square', 0.02);
    }
    bullets.forEach(b => b.y -= 12);
    bullets = bullets.filter(b => b.y > -10);

    spawn--;
    if (spawn <= 0) { spawnEnemy(); spawn = Math.max(14, 50 - t / 60); }

    enemies.forEach(e => {
      e.x += e.vx; e.y += e.vy;
      if (e.x < e.r || e.x > W - e.r) e.vx *= -1;
      if (--e.cd <= 0 && e.y > 0) {
        e.cd = 90 + Math.random() * 80;
        const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
        ebullets.push({ x: e.x, y: e.y, vx: dx / d * 4, vy: dy / d * 4 });
      }
    });
    ebullets.forEach(b => { b.x += b.vx; b.y += b.vy; });
    ebullets = ebullets.filter(b => b.x > -10 && b.x < W + 10 && b.y > -10 && b.y < H + 10);

    // bullet hits
    bullets.forEach(b => enemies.forEach(e => {
      if (!b.dead && e.hp > 0 && Math.hypot(b.x - e.x, b.y - e.y) < e.r + 4) {
        b.dead = true; e.hp--;
        boom(b.x, b.y, '#ffd24d', 3);
        if (e.hp <= 0) {
          combo = comboT > 0 ? combo + 1 : 1; comboT = 90;
          score += (e.heavy ? 50 : 10) * combo;
          boom(e.x, e.y, e.heavy ? '#ff4d3d' : '#4dffb0', e.heavy ? 50 : 26);
          shake = e.heavy ? 12 : 5;
          beep(e.heavy ? 120 : 220, 0.3, 'sawtooth', 0.07);
          // chain blast damages neighbours
          enemies.forEach(o => { if (o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 60) o.hp -= 1; });
        }
      }
    }));
    enemies.filter(e => e.hp <= 0 && !e.counted).forEach(e => {
      e.counted = true;
      if (!e.scored) { e.scored = true; }
    });
    bullets = bullets.filter(b => !b.dead);
    const dead = enemies.filter(e => e.hp <= 0 && !e.boomed);
    dead.forEach(e => { e.boomed = true; });
    enemies = enemies.filter(e => e.hp > 0 && e.y < H + 40);
    if (comboT > 0 && --comboT === 0) combo = 0;

    // player hit
    const hit = () => {
      if (player.inv > 0) return;
      lives--; player.inv = 90; shake = 18;
      boom(player.x, player.y, '#4db8ff', 40);
      beep(80, 0.5, 'sawtooth', 0.09);
      if (lives <= 0) gameOver();
    };
    ebullets = ebullets.filter(b => { if (Math.hypot(b.x - player.x, b.y - player.y) < 14) { hit(); return false; } return true; });
    enemies = enemies.filter(e => { if (Math.hypot(e.x - player.x, e.y - player.y) < e.r + 12) { hit(); boom(e.x, e.y, '#ff9d4d', 30); return false; } return true; });

    parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.life--; });
    parts = parts.filter(p => p.life > 0);
    if (shake > 0) shake *= 0.9;
    updateHud();
  }

  function gameOver() {
    state = 'over';
    if (score > best) {
      best = score;
      try { localStorage.setItem('blastzone-best', String(best)); } catch (e) {}
    }
    updateHud();
  }

  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.fillStyle = '#05050d'; ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.fillStyle = '#fff';
    stars.forEach(s => { ctx.globalAlpha = s.s / 3; ctx.fillRect(s.x, s.y, s.s, s.s); });
    ctx.globalAlpha = 1;

    if (state !== 'menu') {
      // player
      if (state === 'play' && !(player.inv > 0 && Math.floor(t / 4) % 2)) {
        ctx.fillStyle = '#4db8ff';
        ctx.beginPath(); ctx.moveTo(player.x, player.y - 20); ctx.lineTo(player.x + 18, player.y + 16);
        ctx.lineTo(player.x, player.y + 8); ctx.lineTo(player.x - 18, player.y + 16); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#ffd24d';
      bullets.forEach(b => ctx.fillRect(b.x - 2, b.y - 8, 4, 12));
      ctx.fillStyle = '#ff4dd2';
      ebullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 6.283); ctx.fill(); });
      enemies.forEach(e => {
        ctx.fillStyle = e.heavy ? '#c0392b' : '#27ae60';
        ctx.fillRect(e.x - e.r, e.y - e.r * 0.7, e.r * 2, e.r * 1.4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(e.x - e.r * 0.6, e.y - e.r * 0.3, e.r * 0.4, e.r * 0.4);
        ctx.fillRect(e.x + e.r * 0.2, e.y - e.r * 0.3, e.r * 0.4, e.r * 0.4);
        ctx.fillStyle = '#222';
        ctx.fillRect(e.x - e.r * 0.5, e.y + e.r * 0.2, e.r, e.r * 0.2);
      });
      parts.forEach(p => { ctx.globalAlpha = Math.min(1, p.life / 20); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); });
      ctx.globalAlpha = 1;
      if (combo > 1) {
        ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'left';
        ctx.fillText('x' + combo + ' COMBO', 12, 30);
      }
    }
    ctx.restore();

    ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    if (state === 'menu') {
      ctx.font = 'bold 30px system-ui'; ctx.fillText('Destroy the invaders!', W / 2, H / 2 - 10);
      ctx.font = '16px system-ui'; ctx.fillText('Press Start or Enter', W / 2, H / 2 + 24);
    } else if (state === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ff4d3d'; ctx.font = 'bold 44px system-ui'; ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui'; ctx.fillText('Score ' + score, W / 2, H / 2 + 26);
      ctx.font = '15px system-ui'; ctx.fillText('Press Enter to play again', W / 2, H / 2 + 56);
    } else if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 36px system-ui'; ctx.fillText('PAUSED', W / 2, H / 2);
    }
  }

  function loop() {
    if (state === 'play' && !paused) update();
    else if (state !== 'play') { parts && parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; }); }
    draw();
    requestAnimationFrame(loop);
  }

  function pointerX(e) {
    const r = cv.getBoundingClientRect();
    return (e.clientX - r.left) / r.width * W;
  }
  cv.addEventListener('pointerdown', e => { firing = true; targetX = pointerX(e); cv.setPointerCapture(e.pointerId); if (state !== 'play') start(); });
  cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || firing) targetX = pointerX(e); });
  cv.addEventListener('pointerup', () => { firing = false; });
  cv.addEventListener('pointercancel', () => { firing = false; });
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') targetX = null; });
  window.addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys[k] = true;
    if ([' ', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    if (k === 'Enter' && state !== 'play') start();
    if (k === 'p' && state === 'play') paused = !paused;
    targetX = null;
  });
  window.addEventListener('keyup', e => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
  window.addEventListener('blur', () => { if (state === 'play') paused = true; firing = false; });
  startBtn.addEventListener('click', () => { start(); startBtn.blur(); });

  reset();
  loop();
})();
