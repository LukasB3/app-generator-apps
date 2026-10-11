(function () {
  var names = ['Kick', 'Snare', 'Hat', 'Clap'];
  var pattern = names.map(function () { return new Array(16).fill(false); });
  [0, 4, 8, 12].forEach(function (i) { pattern[0][i] = true; });
  [4, 12].forEach(function (i) { pattern[1][i] = true; });
  for (var i = 0; i < 16; i += 2) pattern[2][i] = true;

  var ctx = null, noiseBuf = null;
  var playing = false, step = 0, nextTime = 0, timer = null;
  var cells = [];

  var grid = document.getElementById('grid');
  var playBtn = document.getElementById('play');
  var tempo = document.getElementById('tempo');
  var bpmOut = document.getElementById('bpm');

  names.forEach(function (n, r) {
    var row = document.createElement('div');
    row.className = 'row';
    var label = document.createElement('div');
    label.className = 'name';
    label.textContent = n;
    var steps = document.createElement('div');
    steps.className = 'steps';
    cells[r] = [];
    for (var c = 0; c < 16; c++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'step' + (pattern[r][c] ? ' on' : '');
      b.setAttribute('aria-label', n + ' step ' + (c + 1));
      b.addEventListener('click', toggle.bind(null, r, c, b));
      steps.appendChild(b);
      cells[r][c] = b;
    }
    row.appendChild(label);
    row.appendChild(steps);
    grid.appendChild(row);
  });

  function toggle(r, c, b) {
    pattern[r][c] = !pattern[r][c];
    b.classList.toggle('on', pattern[r][c]);
    if (pattern[r][c]) { ensureCtx(); play(r, ctx.currentTime); }
  }

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function noise(t, dur, type, freq, vol) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(ctx.destination);
    s.start(t); s.stop(t + dur);
  }

  function play(r, t) {
    if (r === 0) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.4);
    } else if (r === 1) {
      var o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.type = 'triangle'; o2.frequency.value = 190;
      g2.gain.setValueAtTime(0.5, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o2.connect(g2); g2.connect(ctx.destination);
      o2.start(t); o2.stop(t + 0.15);
      noise(t, 0.2, 'highpass', 1500, 0.7);
    } else if (r === 2) {
      noise(t, 0.06, 'highpass', 7000, 0.5);
    } else {
      noise(t, 0.04, 'bandpass', 1200, 0.8);
      noise(t + 0.02, 0.04, 'bandpass', 1200, 0.8);
      noise(t + 0.04, 0.2, 'bandpass', 1200, 0.7);
    }
  }

  function mark(s) {
    for (var r = 0; r < 4; r++)
      for (var c = 0; c < 16; c++) cells[r][c].classList.toggle('cur', c === s);
  }

  function schedule() {
    while (nextTime < ctx.currentTime + 0.15) {
      var s = step, t = nextTime;
      for (var r = 0; r < 4; r++) if (pattern[r][s]) play(r, t);
      var delay = Math.max(0, (t - ctx.currentTime) * 1000);
      setTimeout(function () { if (playing) mark(s); }, delay);
      nextTime += 60 / Number(tempo.value) / 4;
      step = (step + 1) % 16;
    }
  }

  playBtn.addEventListener('click', function () {
    ensureCtx();
    playing = !playing;
    if (playing) {
      step = 0; nextTime = ctx.currentTime + 0.05;
      timer = setInterval(schedule, 25);
      schedule();
    } else {
      clearInterval(timer);
      mark(-1);
    }
    playBtn.textContent = playing ? '■ Stop' : '▶ Play';
  });

  tempo.addEventListener('input', function () { bpmOut.textContent = tempo.value; });

  document.getElementById('clear').addEventListener('click', function () {
    for (var r = 0; r < 4; r++)
      for (var c = 0; c < 16; c++) {
        pattern[r][c] = false;
        cells[r][c].classList.remove('on');
      }
  });
})();
