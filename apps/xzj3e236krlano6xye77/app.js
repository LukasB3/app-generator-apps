const LANGS = ['JavaScript', 'Python', 'TypeScript', 'Java', 'C#', 'C++', 'C', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin'];
const KEY = 'poll-voted-language';
const votes = db.table('votes');
const choices = document.getElementById('choices');
const msg = document.getElementById('msg');
const totalEl = document.getElementById('total');
let voted = localStorage.getItem(KEY);

const chart = new Chart(document.getElementById('chart'), {
  type: 'bar',
  data: {
    labels: LANGS,
    datasets: [{ label: 'Votes', data: LANGS.map(() => 0), backgroundColor: '#3b6fe0', borderRadius: 6 }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
  }
});

const buttons = LANGS.map((lang) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = lang;
  b.addEventListener('click', () => vote(lang));
  choices.appendChild(b);
  return b;
});

function refreshButtons() {
  buttons.forEach((b) => {
    b.disabled = !!voted;
    b.classList.toggle('mine', b.textContent === voted);
  });
}

async function vote(lang) {
  if (voted) return;
  msg.textContent = '';
  buttons.forEach((b) => (b.disabled = true));
  try {
    await votes.insert({ language: lang });
    voted = lang;
    localStorage.setItem(KEY, lang);
  } catch (e) {
    msg.textContent = 'Could not save your vote: ' + e.message;
  }
  refreshButtons();
}

votes.subscribe((rows) => {
  const counts = new Map(LANGS.map((l) => [l, 0]));
  let total = 0;
  rows.forEach((r) => {
    if (counts.has(r.language)) { counts.set(r.language, counts.get(r.language) + 1); total++; }
  });
  chart.data.datasets[0].data = LANGS.map((l) => counts.get(l));
  chart.update();
  totalEl.textContent = '· ' + total + (total === 1 ? ' vote' : ' votes');
});

refreshButtons();
