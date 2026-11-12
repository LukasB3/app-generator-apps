const LANGS = ['JavaScript', 'Python', 'TypeScript', 'Java', 'C#', 'C++', 'Go', 'Rust', 'PHP', 'Swift', 'Kotlin', 'Ruby'];
const KEY = 'poll-voted';
const votes = db.table('votes');
const msg = document.getElementById('msg');
const choices = document.getElementById('choices');
let voted = localStorage.getItem(KEY);

const chart = new Chart(document.getElementById('chart'), {
  type: 'bar',
  data: { labels: LANGS, datasets: [{ label: 'Votes', data: LANGS.map(() => 0), backgroundColor: '#4f6bed', borderRadius: 6 }] },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
  }
});

function renderButtons() {
  choices.textContent = '';
  for (const lang of LANGS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = lang;
    b.disabled = !!voted;
    if (voted === lang) b.classList.add('mine');
    b.addEventListener('click', () => vote(lang));
    choices.appendChild(b);
  }
}

async function vote(lang) {
  msg.textContent = '';
  try {
    await votes.insert({ language: lang });
    voted = lang;
    localStorage.setItem(KEY, lang);
    renderButtons();
  } catch (e) {
    msg.textContent = 'Could not save your vote: ' + e.message;
  }
}

votes.subscribe((rows) => {
  const counts = new Map(LANGS.map((l) => [l, 0]));
  let total = 0;
  for (const r of rows) {
    if (counts.has(r.language)) { counts.set(r.language, counts.get(r.language) + 1); total++; }
  }
  chart.data.datasets[0].data = LANGS.map((l) => counts.get(l));
  chart.update();
  document.getElementById('total').textContent = total + (total === 1 ? ' vote' : ' votes') + ' so far';
});

renderButtons();
