const TRACKS = [
  { id: 'kick', name: 'Kick' },
  { id: 'snare', name: 'Snare' },
  { id: 'hat', name: 'Hi-hat' },
  { id: 'clap', name: 'Clap' },
];
const PRESETS = [
  { name: 'Boom bap', bpm: 92, swing: 20, kick: 'x.....x..x.x....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', clap: '............x...' },
  { name: 'Four on the floor', bpm: 124, swing: 0, kick: 'x...x...x...x...', snare: '................', hat: '..x...x...x...x.', clap: '....x.......x...' },
  { name: 'Trap', bpm: 140, swing: 0, kick: 'x.....x....x....', snare: '........x.......', hat: 'xxxxxxxxxxxxxxxx', clap: '........x.......' },
  { name: 'Breakbeat', bpm: 130, swing: 10, kick: 'x.....x...x.....', snare: '....x..x.x..x...', hat: 'x.x.x.x.x.x.x.x.', clap: '................' },
];
const KEY = 'drum-machine-v1';

const $ = (id) => document.getElementById(id);
const parse = (s) => [...s].map((c) => c === 'x');

let state = { bpm: 92, swing: 0, volume: 80, preset: 'Boom bap', mute: {}, pattern: {} };
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved && saved.pattern && TRACKS.every((t) => Array.isArray(saved.pattern[t.id]) && saved.pattern[t.id].length === 16)) {
    state = Object.assign(state, saved);
  }
} catch (e) { /* start from the preset */ }
if (!Object.keys(state.pattern).length) applyPreset(PRESETS[0], false);

function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* full */ } }
function say(t) { $('status').textContent = t; }

function applyPreset(p, announce = true) {
  state.bpm = p.bpm; state.swing = p.swing; state.preset = p.name;
  TRACKS.forEach((t) => { state.pattern[t.id] = parse(p[t.id]); });
  if (announce) { syncControls(); paint(); save(); say('Loaded: ' + p.name + '.'); }
}

// ---- UI
const stepEls = {};
const trackEls = {};
function build() {
  const seq = $('seq');
  TRACKS.forEach((t) => {
    const row = document.createElement('div'); row.className = 'track';
    const head = document.createElement('div'); head.className = 'track-head';
    const name = document.createElement('span'); name.className = 'track-name'; name.textContent = t.name;
    const mute = document.createElement('button'); mute.type = 'button'; mute.className = 'mute';
    mute.addEventListener('click', () => { state.mute[t.id] = !state.mute[t.id]; paint(); save(); });
    head.append(name, mute);
    const steps = document.createElement('div'); steps.className = 'steps';
    stepEls[t.id] = [];
    for (let i = 0; i < 16; i++) {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'step' + (i % 4 === 0 ? ' beat' : '');
      b.addEventListener('click', () => {
        state.pattern[t.id][i] = !state.pattern[t.id][i];
        state.preset = '';
        if (state.pattern[t.id][i]) preview(t.id);
        paint(); save();
      });
      stepEls[t.id].push(b); steps.append(b);
    }
    row.append(head, steps); seq.append(row);
    trackEls[t.id] = { row, mute };
  });
  PRESETS.forEach((p) => {
    const c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.textContent = p.name;
    c.dataset.name = p.name;
    c.addEventListener('click', () => applyPreset(p));
    $('chips').append(c);
  });
  $('clear').prepend(icons.svg('trash'));
  $('clear').append('Clear all');
  $('clear').addEventListener('click', () => {
    const backup = JSON.stringify(state.pattern);
    TRACKS.forEach((t) => { state.pattern[t.id] = new Array(16).fill(false); });
    state.preset = ''; paint(); save();
    say('Pattern cleared. ');
    const u = document.createElement('button'); u.type = 'button'; u.className = 'ghost'; u.textContent = 'Undo';
    u.addEventListener('click', () => { state.pattern = JSON.parse(backup); paint(); save(); say('Pattern restored.'); });
    $('status').append(u);
    u.focus();
  });
}

function paint() {
  TRACKS.forEach((t) => {
    const m = !!state.mute[t.id];
    trackEls[t.id].row.classList.toggle('muted', m);
    const mb = trackEls[t.id].mute;
    mb.setAttribute('aria-pressed', m);
    mb.replaceChildren(icons.svg(m ? 'volume-x' : 'volume-2', { size: 18 }), m ? 'Muted' : 'Mute');
    mb.setAttribute('aria-label', (m ? 'Unmute ' : 'Mute ') + t.name);
    stepEls[t.id].forEach((b, i) => {
      b.setAttribute('aria-pressed', !!state.pattern[t.id][i]);
      b.setAttribute('aria-label', t.name + ' step ' + (i + 1));
    });
  });
  document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.name === state.preset));
}

function syncControls() {
  $('tempo').value = state.bpm; $('bpmOut').textContent = state.bpm;
  $('swing').value = state.swing; $('swingOut').textContent = state.swing + '%';
  $('volume').value = state.volume;
  if (master) master.gain.value = state.volume / 100;
}

// ---- audio engine
let ctx = null, master = null;
function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = state.volume / 100;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}
function preview(id) {
  if (playing) return;
  ensureCtx();
  Drums[id](ctx, master, ctx.currentTime + 0.01);
}

let playing = false, step = 0, nextTime = 0, timer = null, queue = [], raf = 0, lastShown = -1;

function schedule() {
  const dur = 60 / state.bpm / 4;
  while (nextTime < ctx.currentTime + 0.12) {
    // swing delays every second sixteenth by up to half a step
    const t = nextTime + (step % 2 ? (state.swing / 100) * 0.5 * dur : 0);
    TRACKS.forEach((tr) => {
      if (state.pattern[tr.id][step] && !state.mute[tr.id]) Drums[tr.id](ctx, master, t);
    });
    queue.push({ step, t });
    nextTime += dur;
    step = (step + 1) % 16;
  }
}
function draw() {
  while (queue.length && queue[0].t <= ctx.currentTime) {
    const s = queue.shift().step;
    showStep(s);
  }
  raf = requestAnimationFrame(draw);
}
function showStep(s) {
  TRACKS.forEach((t) => {
    if (lastShown >= 0) stepEls[t.id][lastShown].classList.remove('now');
    if (s >= 0) stepEls[t.id][s].classList.add('now');
  });
  lastShown = s;
}
function setPlayBtn() {
  const b = $('play');
  b.replaceChildren(icons.svg(playing ? 'pause' : 'play', { size: 24 }), playing ? 'Stop' : 'Play');
}
function start() {
  ensureCtx();
  playing = true; step = 0; queue = []; nextTime = ctx.currentTime + 0.05;
  schedule();
  timer = setInterval(schedule, 25);
  raf = requestAnimationFrame(draw);
  setPlayBtn();
}
function stop() {
  playing = false; clearInterval(timer); cancelAnimationFrame(raf); queue = [];
  showStep(-1); setPlayBtn();
}
function toggle() { playing ? stop() : start(); }

build();
syncControls();
paint();
setPlayBtn();
say(state.preset ? 'Loaded: ' + state.preset + '. Press Play.' : 'Your own pattern is loaded. Press Play.');

$('play').addEventListener('click', toggle);
$('tempo').addEventListener('input', (e) => {
  state.bpm = +e.target.value; $('bpmOut').textContent = state.bpm; state.preset = ''; paint(); save();
});
$('swing').addEventListener('input', (e) => {
  state.swing = +e.target.value; $('swingOut').textContent = state.swing + '%'; save();
});
$('volume').addEventListener('input', (e) => {
  state.volume = +e.target.value; if (master) master.gain.value = state.volume / 100; save();
});
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.target.closest('button, input')) { e.preventDefault(); toggle(); }
});
