const LANGS = ['JavaScript', 'Python', 'TypeScript', 'Java', 'C#', 'C++', 'Go', 'Rust', 'PHP', 'Kotlin', 'Swift', 'Ruby'];
const COLORS = ['#f7c948', '#3b78b5', '#2f74c0', '#e76f51', '#7b4fd6', '#5c6bc0', '#26a6c9', '#d2691e', '#8892bf', '#9b59f5', '#f0643c', '#d32f2f'];
const votes = db.table('votes');
const optionsEl = document.getElementById('options');
const msg = document.getElementById('msg');
const totalEl = document.getElementById('total');
let mine = localStorage.getItem('myLanguage');

const chart = new Chart(document.getElementById('chart'), {
  type: 'bar',
  data: { labels: LANGS, datasets: [{ label: 'Votes', data: LANGS.map(() => 0), backgroundColor: COLORS }] },
  options: {
    indexAxis: 'y',
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
  }
});

function markMine() {
  optionsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('mine', b.textContent === mine));
}

LANGS.forEach((lang) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = lang;
  b.addEventListener('click', async () => {
    msg.textContent = '';
    b.disabled = true;
    try {
      await votes.insert({ language: lang });
      mine = lang;
      localStorage.setItem('myLanguage', lang);
      markMine();
    } catch (e) {
      msg.textContent = e.message || 'Could not save your vote.';
    }
    b.disabled = false;
  });
  optionsEl.appendChild(b);
});
markMine();

votes.subscribe((rows) => {
  const counts = LANGS.map((l) => rows.filter((r) => r.language === l).length);
  chart.data.datasets[0].data = counts;
  chart.update();
  const n = counts.reduce((a, c) => a + c, 0);
  totalEl.textContent = n + (n === 1 ? ' vote' : ' votes') + ' so far';
});
