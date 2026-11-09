const entries = db.table('entries');
const form = document.getElementById('form');
const authorEl = document.getElementById('author');
const messageEl = document.getElementById('message');
const countEl = document.getElementById('count');
const errorEl = document.getElementById('error');
const sendEl = document.getElementById('send');
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');

authorEl.value = localStorage.getItem('guestbook-name') || '';

messageEl.addEventListener('input', () => {
  countEl.textContent = messageEl.value.length + '/280';
});

function render(rows) {
  listEl.textContent = '';
  emptyEl.hidden = rows.length > 0;
  for (const r of rows) {
    const li = document.createElement('li');
    const name = document.createElement('b');
    name.textContent = r.author;
    const time = document.createElement('time');
    const d = new Date(r.created_at);
    time.textContent = isNaN(d) ? '' : d.toLocaleString();
    const p = document.createElement('p');
    p.textContent = r.message;
    li.append(name, time, p);
    listEl.append(li);
  }
}

entries.subscribe(render, { newestFirst: true });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const author = authorEl.value.trim();
  const message = messageEl.value.trim();
  if (!author || !message) {
    errorEl.textContent = 'Please fill in both fields.';
    return;
  }
  errorEl.textContent = '';
  sendEl.disabled = true;
  try {
    await entries.insert({ author, message });
    localStorage.setItem('guestbook-name', author);
    messageEl.value = '';
    countEl.textContent = '0/280';
  } catch (err) {
    errorEl.textContent = err.message || 'Could not save your message.';
  } finally {
    sendEl.disabled = false;
  }
});
