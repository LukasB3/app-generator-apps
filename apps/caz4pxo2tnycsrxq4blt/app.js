(function () {
  var TOTAL = 5 * 60 * 1000;
  var CIRC = 2 * Math.PI * 45;
  var remaining = TOTAL;
  var endTime = 0;
  var timer = null;

  var display = document.getElementById('display');
  var ring = document.getElementById('ring');
  var status = document.getElementById('status');
  var startBtn = document.getElementById('start');
  var pauseBtn = document.getElementById('pause');
  var resetBtn = document.getElementById('reset');

  function render() {
    var secs = Math.ceil(remaining / 1000);
    var text = String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
    display.textContent = text;
    document.title = text + ' – Timer';
    ring.style.strokeDashoffset = CIRC * (1 - remaining / TOTAL);
  }

  function beep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      var ctx = new Ctx();
      for (var i = 0; i < 3; i++) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.frequency.value = 880;
        o.connect(g); g.connect(ctx.destination);
        var t = ctx.currentTime + i * 0.4;
        g.gain.setValueAtTime(0.2, t);
        g.gain.setValueAtTime(0, t + 0.25);
        o.start(t); o.stop(t + 0.3);
      }
    } catch (e) {}
  }

  function stop() { clearInterval(timer); timer = null; }

  function tick() {
    remaining = Math.max(0, endTime - Date.now());
    render();
    if (remaining === 0) {
      stop();
      document.body.classList.add('done');
      status.textContent = "Time's up!";
      startBtn.disabled = true;
      pauseBtn.disabled = true;
      beep();
    }
  }

  startBtn.addEventListener('click', function () {
    if (timer || remaining === 0) return;
    endTime = Date.now() + remaining;
    timer = setInterval(tick, 100);
    status.textContent = 'Running…';
    startBtn.disabled = true;
    pauseBtn.disabled = false;
  });

  pauseBtn.addEventListener('click', function () {
    if (!timer) return;
    tick();
    stop();
    if (remaining > 0) {
      status.textContent = 'Paused';
      startBtn.textContent = 'Resume';
      startBtn.disabled = false;
      pauseBtn.disabled = true;
    }
  });

  resetBtn.addEventListener('click', function () {
    stop();
    remaining = TOTAL;
    document.body.classList.remove('done');
    status.textContent = 'Ready';
    startBtn.textContent = 'Start';
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    render();
  });

  render();
})();
