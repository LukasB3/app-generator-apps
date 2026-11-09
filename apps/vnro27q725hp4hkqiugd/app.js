(function () {
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const boardEl = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const scores = { X: 0, O: 0, D: 0 };
  let board, turn, over, vsAI = true, starter = 'X', timer = null;

  const cells = [];
  for (let i = 0; i < 9; i++) {
    const b = document.createElement('button');
    b.className = 'cell';
    b.setAttribute('aria-label', 'Cell ' + (i + 1));
    b.addEventListener('click', () => play(i));
    boardEl.appendChild(b);
    cells.push(b);
  }

  function winner(b) {
    for (const l of LINES) {
      if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { p: b[l[0]], line: l };
    }
    return null;
  }

  function minimax(b, player, me) {
    const w = winner(b);
    if (w) return w.p === me ? 10 : -10;
    if (b.every(Boolean)) return 0;
    const other = player === 'X' ? 'O' : 'X';
    let best = player === me ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = player;
      const s = minimax(b, other, me);
      b[i] = null;
      best = player === me ? Math.max(best, s) : Math.min(best, s);
    }
    return best;
  }

  function aiMove() {
    let best = -Infinity, moves = [];
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      board[i] = 'O';
      const s = minimax(board, 'X', 'O');
      board[i] = null;
      if (s > best) { best = s; moves = [i]; } else if (s === best) moves.push(i);
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }

  function render() {
    const w = winner(board);
    cells.forEach((c, i) => {
      c.textContent = board[i] || '';
      c.className = 'cell' + (board[i] ? ' ' + board[i] : '') + (w && w.line.includes(i) ? ' win' : '');
      c.disabled = over || !!board[i];
    });
    document.getElementById('sx').textContent = scores.X;
    document.getElementById('so').textContent = scores.O;
    document.getElementById('sd').textContent = scores.D;
  }

  function place(i) {
    board[i] = turn;
    const w = winner(board);
    if (w) {
      over = true; scores[w.p]++;
      statusEl.textContent = (w.p === 'O' && vsAI ? 'Computer' : 'Player ' + w.p) + ' wins!';
    } else if (board.every(Boolean)) {
      over = true; scores.D++;
      statusEl.textContent = "It's a draw!";
    } else {
      turn = turn === 'X' ? 'O' : 'X';
      statusEl.textContent = vsAI && turn === 'O' ? 'Computer is thinking…' : 'Player ' + turn + "'s turn";
    }
    render();
  }

  function play(i) {
    if (over || board[i] || (vsAI && turn === 'O')) return;
    place(i);
    if (!over && vsAI) {
      timer = setTimeout(() => { timer = null; place(aiMove()); }, 400);
    }
  }

  function start() {
    clearTimeout(timer); timer = null;
    board = Array(9).fill(null); over = false; turn = 'X';
    statusEl.textContent = "Player X's turn";
    render();
    if (vsAI && starter === 'O') {
      turn = 'O';
      statusEl.textContent = 'Computer is thinking…';
      timer = setTimeout(() => { timer = null; place(aiMove()); }, 400);
    }
  }

  function setMode(ai) {
    vsAI = ai;
    document.getElementById('mode-ai').classList.toggle('active', ai);
    document.getElementById('mode-two').classList.toggle('active', !ai);
    scores.X = scores.O = scores.D = 0;
    starter = 'X';
    start();
  }

  document.getElementById('mode-ai').addEventListener('click', () => setMode(true));
  document.getElementById('mode-two').addEventListener('click', () => setMode(false));
  document.getElementById('new').addEventListener('click', () => {
    starter = starter === 'X' ? 'O' : 'X';
    if (!vsAI) starter = 'X';
    start();
  });
  document.getElementById('reset').addEventListener('click', () => {
    scores.X = scores.O = scores.D = 0; starter = 'X'; start();
  });

  start();
})();
