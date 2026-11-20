(function () {
  const ideas = db.table('ideas');
  const VOTED_KEY = 'featureboard.voted';
  const EXAMPLES = [
    ['Dark mode for the whole app', 14],
    ['Export reports as PDF', 11],
    ['Keyboard shortcuts for common actions', 8],
    ['Slack notifications when a task changes', 6],
    ['Bulk edit for several items at once', 3],
  ];

  const $ = (id) => document.getElementById(id);
  const list = $('list'), status = $('status'), summary = $('summary');
  const form = $('form'), titleEl = $('title'), msg = $('formmsg');

  let voted = new Set();
  try { voted = new Set(JSON.parse(localStorage.getItem(VOTED_KEY) || '[]')); } catch (e) { voted = new Set(); }
  let rows = [];
  let loaded = false;
  let chart = null;

  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();

  function saveVoted() {
    try { localStorage.setItem(VOTED_KEY, JSON.stringify([...voted])); } catch (e) { /* storage unavailable */ }
  }

  function sorted(r) {
    return r.slice().sort((a, b) => (b.votes - a.votes) || String(a.created_at).localeCompare(String(b.created_at)));
  }

  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  function render() {
    const isExample = loaded && rows.length === 0;
    const shown = isExample
      ? EXAMPLES.map((e, i) => ({ id: 'ex' + i, title: e[0], votes: e[1], example: true }))
      : sorted(rows).map((r) => ({ id: r.id, title: r.title, votes: r.votes || 0 }));

    $('examplebar').hidden = !isExample;
    list.replaceChildren();
    shown.forEach((it) => {
      const li = document.createElement('li');
      li.className = 'item' + (it.example ? ' example' : '');
      const btn = document.createElement('button');
      btn.type = 'button';
      const has = voted.has(it.id);
      btn.className = 'vote' + (has ? ' voted' : '');
      btn.disabled = has || !!it.example;
      btn.setAttribute('aria-label', (has ? 'You voted for ' : 'Upvote ') + it.title + ', ' + plural(it.votes, 'vote'));
      btn.append(icons.svg(has ? 'check' : 'arrow-up', { size: 18, strokeWidth: 2.5 }));
      const n = document.createElement('span');
      n.textContent = it.votes;
      btn.append(n);
      btn.addEventListener('click', () => vote(it.id, btn));
      const t = document.createElement('div');
      t.className = 'text';
      t.textContent = it.title;
      if (it.example) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = 'Example';
        t.append(tag);
      }
      li.append(btn, t);
      list.append(li);
    });

    if (!loaded) summary.textContent = 'Loading ideas…';
    else if (isExample) summary.textContent = 'No ideas yet. The list below shows examples.';
    else {
      const total = rows.reduce((s, r) => s + (r.votes || 0), 0);
      summary.textContent = plural(rows.length, 'idea') + ', ' + plural(total, 'vote') + '. Updates live.';
    }
    drawChart(shown.slice(0, 5), isExample);
  }

  function drawChart(top, isExample) {
    const labels = top.map((i) => (i.title.length > 26 ? i.title.slice(0, 25) + '…' : i.title));
    const values = top.map((i) => i.votes);
    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--accent').trim();
    const line = style.getPropertyValue('--line').trim();
    if (chart) chart.destroy();
    chart = new Chart($('chart'), {
      type: 'bar',
      data: { labels, datasets: [{ label: isExample ? 'Votes (examples)' : 'Votes', data: values, backgroundColor: accent, borderRadius: 4 }] },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 300 },
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: line } },
          y: { grid: { display: false } },
        },
      },
    });
  }

  async function vote(id, btn) {
    if (voted.has(id)) return;
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    btn.disabled = true;
    voted.add(id);
    saveVoted();
    row.votes = (row.votes || 0) + 1;
    render();
    try {
      await ideas.update(id, { votes: row.votes });
      status.textContent = '';
      status.className = 'status';
    } catch (e) {
      voted.delete(id);
      saveVoted();
      row.votes -= 1;
      showError('Your vote was not saved: ' + e.message + ' Try again.');
      render();
    }
  }

  function showError(text) {
    status.textContent = text;
    status.className = 'status err';
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const title = titleEl.value.trim().replace(/\s+/g, ' ');
    msg.textContent = '';
    if (!title) { msg.textContent = 'Write the idea in one line first.'; return; }
    if (rows.some((r) => String(r.title).toLowerCase() === title.toLowerCase())) {
      msg.textContent = 'That idea is already on the board. Give it a vote instead.';
      return;
    }
    $('add').disabled = true;
    try {
      const row = await ideas.insert({ title, votes: 1 });
      voted.add(row.id);
      saveVoted();
      titleEl.value = '';
      if (!rows.some((r) => r.id === row.id)) rows.push(row);
      render();
    } catch (e) {
      msg.textContent = 'Could not add the idea: ' + e.message;
    }
    $('add').disabled = false;
  });

  $('addex').addEventListener('click', async () => {
    const b = $('addex');
    b.disabled = true;
    try {
      for (const [title, votes] of EXAMPLES) await ideas.insert({ title, votes });
      status.textContent = '';
      status.className = 'status';
    } catch (e) {
      showError('Could not add the examples: ' + e.message);
    }
    b.disabled = false;
  });

  status.textContent = 'Loading ideas…';
  render();
  try {
    ideas.subscribe((r) => {
      rows = r || [];
      loaded = true;
      if (status.textContent === 'Loading ideas…' || status.classList.contains('err')) {
        status.textContent = '';
        status.className = 'status';
      }
      render();
    }, { newestFirst: true });
  } catch (e) {
    showError('The board could not be loaded: ' + e.message + ' Reload the page to try again.');
  }
})();
