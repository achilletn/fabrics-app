let csrfToken = null;
let editingId = null;

const form = document.getElementById('actu-form');
const formCard = document.getElementById('form-card');
const formTitle = document.getElementById('form-title');
const formError = document.getElementById('form-error');
const cancelBtn = document.getElementById('cancel-edit');
const listEl = document.getElementById('actu-list-admin');
const contactListEl = document.getElementById('contact-list-admin');
const whoamiEl = document.getElementById('whoami');
const actuCountEl = document.getElementById('actu-count');
const contactCountEl = document.getElementById('contact-count');

function showFormError(message) {
  formError.textContent = message;
  formError.classList.remove('hidden');
}

function clearFormError() {
  formError.textContent = '';
  formError.classList.add('hidden');
}

async function ensureAuthenticated() {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (!res.ok) {
    window.location.href = '/admin/login.html';
    return;
  }
  const data = await res.json();
  whoamiEl.textContent = data.username;
}

async function refreshCsrfToken() {
  const res = await fetch('/api/auth/csrf-token', { credentials: 'same-origin' });
  const data = await res.json();
  csrfToken = data.csrfToken;
}

function resetForm() {
  editingId = null;
  form.reset();
  document.getElementById('actu-id').value = '';
  formTitle.textContent = 'Nouvelle actualité';
  formCard.classList.remove('is-editing');
  cancelBtn.classList.add('hidden');
  clearFormError();
}

function buildListItem(item) {
  const li = document.createElement('li');
  li.className = 'item';

  if (item.image) {
    const thumb = document.createElement('img');
    thumb.className = 'thumb';
    thumb.src = item.image;
    thumb.alt = '';
    thumb.loading = 'lazy';
    li.appendChild(thumb);
  } else {
    const thumb = document.createElement('div');
    thumb.className = 'thumb thumb-empty';
    thumb.textContent = '—';
    li.appendChild(thumb);
  }

  const info = document.createElement('div');
  info.className = 'item-body';
  const title = document.createElement('p');
  title.className = 'item-title';
  title.textContent = item.title;
  const date = document.createElement('p');
  date.className = 'item-meta';
  date.textContent = new Date(item.publishedAt).toLocaleDateString('fr-FR');
  info.appendChild(title);
  info.appendChild(date);

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.textContent = 'Modifier';
  editBtn.className = 'btn btn-sm';
  editBtn.addEventListener('click', () => startEdit(item));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.textContent = 'Supprimer';
  deleteBtn.className = 'btn btn-sm btn-danger';
  deleteBtn.addEventListener('click', () => deleteItem(item));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  li.appendChild(info);
  li.appendChild(actions);
  return li;
}

async function loadList() {
  const res = await fetch('/api/admin/actualites', { credentials: 'same-origin' });
  if (res.status === 401) {
    window.location.href = '/admin/login.html';
    return;
  }
  const data = await res.json();
  listEl.textContent = '';
  actuCountEl.textContent = data.items.length ? `(${data.items.length})` : '';
  if (data.items.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'Aucune actualité publiée pour le moment.';
    listEl.appendChild(empty);
    return;
  }
  for (const item of data.items) {
    listEl.appendChild(buildListItem(item));
  }
}

function startEdit(item) {
  editingId = item.id;
  document.getElementById('actu-id').value = item.id;
  document.getElementById('title').value = item.title;
  document.getElementById('excerpt').value = item.excerpt;
  document.getElementById('sourceLabel').value = item.sourceLabel || '';
  document.getElementById('sourceUrl').value = item.sourceUrl || '';
  document.getElementById('publishedAt').value = item.publishedAt.slice(0, 10);
  formTitle.textContent = `Modifier : ${item.title}`;
  formCard.classList.add('is-editing');
  cancelBtn.classList.remove('hidden');
  clearFormError();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteItem(item) {
  if (!window.confirm(`Supprimer definitivement "${item.title}" ?`)) return;
  const res = await fetch(`/api/admin/actualites/${item.id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken },
  });
  if (res.status === 401) {
    window.location.href = '/admin/login.html';
    return;
  }
  await refreshCsrfToken();
  await loadList();
}

function buildContactListItem(item) {
  const li = document.createElement('li');
  li.className = `item ${item.handled ? 'item-handled' : ''}`;

  const info = document.createElement('div');
  info.className = 'item-body';

  const header = document.createElement('div');
  header.className = 'item-meta-row';
  const date = document.createElement('span');
  date.className = 'when';
  date.textContent = new Date(item.createdAt).toLocaleString('fr-FR');
  header.appendChild(date);
  if (item.intention) {
    const intention = document.createElement('span');
    intention.className = 'badge badge-accent';
    intention.textContent = item.intention;
    header.appendChild(intention);
  }
  if (item.handled) {
    const status = document.createElement('span');
    status.className = 'badge';
    status.textContent = 'Traité';
    header.appendChild(status);
  }
  if (!item.emailSent) {
    const warn = document.createElement('span');
    warn.className = 'badge badge-warn';
    warn.textContent = 'Email non envoyé';
    header.appendChild(warn);
  }
  info.appendChild(header);

  const nameLine = document.createElement('p');
  nameLine.className = 'item-title';
  nameLine.textContent = `${item.name} <${item.email}>`;
  info.appendChild(nameLine);

  const messageEl = document.createElement('p');
  messageEl.className = 'item-text';
  messageEl.textContent = item.message;
  info.appendChild(messageEl);

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.textContent = item.handled ? 'Marquer à traiter' : 'Marquer traité';
  toggleBtn.className = 'btn btn-sm';
  toggleBtn.addEventListener('click', () => toggleContactHandled(item));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.textContent = 'Supprimer';
  deleteBtn.className = 'btn btn-sm btn-danger';
  deleteBtn.addEventListener('click', () => deleteContactMessage(item));

  actions.appendChild(toggleBtn);
  actions.appendChild(deleteBtn);

  li.appendChild(info);
  li.appendChild(actions);
  return li;
}

async function loadContactList() {
  const res = await fetch('/api/admin/contact', { credentials: 'same-origin' });
  if (res.status === 401) {
    window.location.href = '/admin/login.html';
    return;
  }
  const data = await res.json();
  contactListEl.textContent = '';
  const pending = data.items.filter((item) => !item.handled).length;
  contactCountEl.textContent = data.items.length ? `(${pending} à traiter / ${data.items.length})` : '';
  if (data.items.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'Aucun message pour le moment.';
    contactListEl.appendChild(empty);
    return;
  }
  for (const item of data.items) {
    contactListEl.appendChild(buildContactListItem(item));
  }
}

async function toggleContactHandled(item) {
  await fetch(`/api/admin/contact/${item.id}/handled`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken },
  });
  await refreshCsrfToken();
  await loadContactList();
}

async function deleteContactMessage(item) {
  if (!window.confirm(`Supprimer definitivement le message de "${item.name}" ?`)) return;
  await fetch(`/api/admin/contact/${item.id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken },
  });
  await refreshCsrfToken();
  await loadContactList();
}

cancelBtn.addEventListener('click', resetForm);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormError();

  const formData = new FormData(form);
  const method = editingId ? 'PUT' : 'POST';
  const url = editingId ? `/api/admin/actualites/${editingId}` : '/api/admin/actualites';

  try {
    const res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'x-csrf-token': csrfToken },
      body: formData,
    });

    if (res.status === 401) {
      window.location.href = '/admin/login.html';
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showFormError(data.error || 'Erreur lors de l’enregistrement.');
      await refreshCsrfToken();
      return;
    }

    await refreshCsrfToken();
    resetForm();
    await loadList();
  } catch (err) {
    showFormError('Erreur de connexion au serveur.');
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken },
  });
  window.location.href = '/admin/login.html';
});

(async function init() {
  await ensureAuthenticated();
  await refreshCsrfToken();
  await loadList();
  await loadContactList();
})();
