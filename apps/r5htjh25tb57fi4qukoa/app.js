const entries = db.table('entries');
const form = document.getElementById('form');
const authorEl = document.getElementById('author');
const messageEl = document.getElementById('message');
const countEl = document.getElementById('count');
const errorEl = document.getElementById('error');
const sendEl = document.getElementById('send');
const listEl = document.getElementById('list');
const totalEl = document.getElementById('total');

authorEl.value = localStorage.getItem('guestbook-name') || '';

messageEl.addEventListener('input', () => {
  countEl.textContent = messageEl.value.length + ' / 400';
});

function formatDate(value) {
  const d = new Date(value);
  return isNaN(d) ? '' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function renderRows(rows) {
  listEl.textContent = '';
  totalEl.textContent = rows.length === 1 ? '1 entry' : rows.length + ' entries';
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No entries yet. Be the first to sign!';
    listEl.appendChild(li);
    return;
  }
  for (const row of rows) {
    const li = document.createElement('li');
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = row.author;
    const when = document.createElement('span');
    when.className = 'when';
    when.textContent = formatDate(row.created_at);
    const p = document.createElement('p');
    p.textContent = row.message;
    li.append(who, when, p);
    listEl.appendChild(li);
  }
}

entries.subscribe(renderRows, { newestFirst: true });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const author = authorEl.value.trim();
  const message = messageEl.value.trim();
  if (!author || !message) return;
  errorEl.textContent = '';
  sendEl.disabled = true;
  try {
    await entries.insert({ author, message });
    localStorage.setItem('guestbook-name', author);
    messageEl.value = '';
    countEl.textContent = '0 / 400';
  } catch (err) {
    errorEl.textContent = err.message || 'Could not save your entry.';
  } finally {
    sendEl.disabled = false;
  }
});
