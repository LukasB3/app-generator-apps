const KEY = 'address-book-contacts';
const $ = (id) => document.getElementById(id);
let contacts = [];
let editingId = null;

try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (Array.isArray(saved)) contacts = saved;
} catch (e) { contacts = []; }

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(contacts));
  } catch (e) {
    $('error').textContent = 'Could not save: browser storage is full or unavailable.';
  }
}

function resetForm() {
  editingId = null;
  $('form').reset();
  $('form-title').textContent = 'Add contact';
  $('save').textContent = 'Add contact';
  $('cancel').hidden = true;
  $('error').textContent = '';
}

function startEdit(c) {
  editingId = c.id;
  $('name').value = c.name;
  $('phone').value = c.phone;
  $('email').value = c.email;
  $('form-title').textContent = 'Edit contact';
  $('save').textContent = 'Save changes';
  $('cancel').hidden = false;
  $('name').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function link(href, text) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  return a;
}

function render() {
  const q = $('search').value.trim().toLowerCase();
  const shown = contacts
    .filter((c) => [c.name, c.phone, c.email].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  $('count').textContent = contacts.length
    ? `${shown.length} of ${contacts.length} contact${contacts.length === 1 ? '' : 's'}`
    : 'No contacts yet. Add your first one above.';
  const list = $('list');
  list.textContent = '';
  for (const c of shown) {
    const li = document.createElement('li');
    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('strong');
    name.textContent = c.name;
    info.append(name);
    if (c.phone) info.append(link('tel:' + c.phone.replace(/[^\d+]/g, ''), '📞 ' + c.phone));
    if (c.email) info.append(link('mailto:' + c.email, '✉️ ' + c.email));
    const actions = document.createElement('div');
    actions.className = 'actions';
    const edit = document.createElement('button');
    edit.className = 'small secondary';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => startEdit(c));
    const del = document.createElement('button');
    del.className = 'small danger';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      if (!confirm(`Delete ${c.name}?`)) return;
      contacts = contacts.filter((x) => x.id !== c.id);
      if (editingId === c.id) resetForm();
      persist();
      render();
    });
    actions.append(edit, del);
    li.append(info, actions);
    list.append(li);
  }
}

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('name').value.trim();
  const phone = $('phone').value.trim();
  const email = $('email').value.trim();
  if (!name) { $('error').textContent = 'Please enter a name.'; return; }
  if (!phone && !email) { $('error').textContent = 'Please enter a phone number or an e-mail.'; return; }
  if (editingId) {
    const c = contacts.find((x) => x.id === editingId);
    if (c) Object.assign(c, { name, phone, email });
  } else {
    contacts.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, phone, email });
  }
  persist();
  resetForm();
  render();
});

$('cancel').addEventListener('click', resetForm);
$('search').addEventListener('input', render);
render();
