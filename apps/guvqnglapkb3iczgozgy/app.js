(function () {
  const COLS = 10, ROWS = 20, S = 30;
  const cv = document.getElementById('board'), ctx = cv.getContext('2d');
  const nx = document.getElementById('next').getContext('2d');
  const COLORS = { I: '#38d9f5', O: '#f5d838', T: '#b455e8', S: '#4fd65f', Z: '#f05050', J: '#4a63f0', L: '#f59a38' };
  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]]
  };
  const TYPES = Object.keys(SHAPES);
  let grid, cur, next, bag = [], score, lines, level, over, running, paused, timer;

  const $ = id => document.getElementById(id);

  function draw1(c, x, y, color, s) {
    c.fillStyle = color;
    c.fillRect(x * s, y * s, s, s);
    c.fillStyle = 'rgba(255,255,255,.25)';
    c.fillRect(x * s, y * s, s, 3);
    c.strokeStyle = 'rgba(0,0,0,.4)';
    c.strokeRect(x * s + .5, y * s + .5, s - 1, s - 1);
  }
  function pick() {
    if (!bag.length) {
      bag = TYPES.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    const t = bag.pop();
    return { t, m: SHAPES[t].map(r => r.slice()), x: 0, y: 0 };
  }
  function spawn() {
    cur = next || pick();
    next = pick();
    cur.x = Math.floor((COLS - cur.m.length) / 2);
    cur.y = 0;
    if (hit(cur.m, cur.x, cur.y)) { over = true; running = false; clearInterval(timer); $('start').textContent = 'Restart'; }
    drawNext();
  }
  function hit(m, px, py) {
    for (let y = 0; y < m.length; y++)
      for (let x = 0; x < m.length; x++)
        if (m[y][x]) {
          const gx = px + x, gy = py + y;
          if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
          if (gy >= 0 && grid[gy][gx]) return true;
        }
    return false;
  }
  function rotate(m) {
    const n = m.length;
    return m.map((_, y) => m.map((_, x) => m[n - 1 - x][y]));
  }
  function tryRotate() {
    if (cur.t === 'O') return;
    const r = rotate(cur.m);
    for (const k of [0, -1, 1, -2, 2]) {
      if (!hit(r, cur.x + k, cur.y)) { cur.m = r; cur.x += k; return; }
    }
  }
  function move(dx) { if (!hit(cur.m, cur.x + dx, cur.y)) cur.x += dx; }
  function lock() {
    cur.m.forEach((r, y) => r.forEach((v, x) => {
      if (v && cur.y + y >= 0) grid[cur.y + y][cur.x + x] = cur.t;
    }));
    let n = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every(c => c)) { grid.splice(y, 1); grid.unshift(Array(COLS).fill(null)); n++; y++; }
    }
    if (n) {
      score += [0, 100, 300, 500, 800][n] * level;
      lines += n;
      const lv = Math.floor(lines / 10) + 1;
      if (lv !== level) { level = lv; restartTimer(); }
    }
    updateUI();
    spawn();
  }
  function step(soft) {
    if (!hit(cur.m, cur.x, cur.y + 1)) { cur.y++; if (soft) score++; }
    else lock();
    updateUI();
    render();
  }
  function drop() {
    let d = 0;
    while (!hit(cur.m, cur.x, cur.y + 1)) { cur.y++; d++; }
    score += d * 2;
    lock();
    render();
  }
  function updateUI() { $('score').textContent = score; $('lines').textContent = lines; $('level').textContent = level; }
  function drawNext() {
    nx.clearRect(0, 0, 96, 96);
    const m = next.m, s = 24, off = (96 - m.length * s) / 2 / s;
    m.forEach((r, y) => r.forEach((v, x) => { if (v) draw1(nx, x + off, y + off, COLORS[next.t], s); }));
  }
  function render() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    for (let i = 1; i < COLS; i++) { ctx.beginPath(); ctx.moveTo(i * S, 0); ctx.lineTo(i * S, ROWS * S); ctx.stroke(); }
    for (let i = 1; i < ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * S); ctx.lineTo(COLS * S, i * S); ctx.stroke(); }
    grid.forEach((r, y) => r.forEach((c, x) => { if (c) draw1(ctx, x, y, COLORS[c], S); }));
    if (cur && !over) {
      let gy = cur.y;
      while (!hit(cur.m, cur.x, gy + 1)) gy++;
      cur.m.forEach((r, y) => r.forEach((v, x) => {
        if (v) { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect((cur.x + x) * S, (gy + y) * S, S, S); }
      }));
      cur.m.forEach((r, y) => r.forEach((v, x) => { if (v) draw1(ctx, cur.x + x, cur.y + y, COLORS[cur.t], S); }));
    }
    if (over || paused || !running) {
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px system-ui';
      ctx.fillText(over ? 'GAME OVER' : paused ? 'PAUSED' : 'TETRIS', cv.width / 2, cv.height / 2);
      ctx.font = '16px system-ui';
      ctx.fillText(over ? 'Score ' + score : 'Press Start', cv.width / 2, cv.height / 2 + 30);
    }
  }
  function restartTimer() {
    clearInterval(timer);
    timer = setInterval(() => { if (running && !paused) step(false); }, Math.max(80, 800 - (level - 1) * 70));
  }
  function start() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    score = 0; lines = 0; level = 1; over = false; paused = false; running = true; next = null; bag = [];
    $('start').textContent = 'Restart';
    spawn(); updateUI(); restartTimer(); render();
  }
  function togglePause() {
    if (!running) return;
    paused = !paused;
    $('pause').textContent = paused ? 'Resume' : 'Pause';
    render();
  }
  function act(a) {
    if (!running || paused) return;
    if (a === 'left') move(-1);
    else if (a === 'right') move(1);
    else if (a === 'rotate') tryRotate();
    else if (a === 'down') { step(true); return; }
    else if (a === 'drop') { drop(); return; }
    render();
  }
  const keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'down', ' ': 'drop' };
  document.addEventListener('keydown', e => {
    if (e.key === 'p' || e.key === 'P') { togglePause(); return; }
    if (keys[e.key]) { e.preventDefault(); act(keys[e.key]); }
  });
  document.querySelectorAll('.touch button').forEach(b => {
    b.addEventListener('click', () => act(b.dataset.a));
  });
  $('start').addEventListener('click', start);
  $('pause').addEventListener('click', togglePause);

  grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  score = 0; lines = 0; level = 1; over = false; running = false; paused = false;
  render();
})();
