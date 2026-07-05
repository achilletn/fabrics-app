let csrfToken = null;
let editingId = null;

const form = document.getElementById('actu-form');
const formTitle = document.getElementById('form-title');
const formError = document.getElementById('form-error');
const cancelBtn = document.getElementById('cancel-edit');
const listEl = document.getElementById('actu-list-admin');
const contactListEl = document.getElementById('contact-list-admin');
const whoamiEl = document.getElementById('whoami');

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
  formTitle.textContent = 'Nouvelle actualite';
  cancelBtn.classList.add('hidden');
  clearFormError();
}

function buildListItem(item) {
  const li = document.createElement('li');
  li.className = 'p-4 flex items-start justify-between gap-4';

  const info = document.createElement('div');
  const title = document.createElement('p');
  title.className = 'font-display font-bold text-ink';
  title.textContent = item.title;
  const date = document.createElement('p');
  date.className = 'text-xs text-smoke mt-1';
  date.textContent = new Date(item.publishedAt).toLocaleDateString('fr-FR');
  info.appendChild(title);
  info.appendChild(date);

  const actions = document.createElement('div');
  actions.className = 'flex gap-2 shrink-0';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.textContent = 'Modifier';
  editBtn.className = 'font-display text-xs border border-line px-3 py-1.5 hover:border-grenade hover:text-grenade transition-colors';
  editBtn.addEventListener('click', () => startEdit(item));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.textContent = 'Supprimer';
  deleteBtn.className = 'font-display text-xs border border-line px-3 py-1.5 hover:border-grenade hover:text-grenade transition-colors';
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
  li.className = `p-4 flex items-start justify-between gap-4 ${item.handled ? 'opacity-60' : ''}`;

  const info = document.createElement('div');

  const header = document.createElement('div');
  header.className = 'flex items-center gap-2 flex-wrap text-xs text-smoke font-display tracking-wide mb-1';
  const date = document.createElement('span');
  date.textContent = new Date(item.createdAt).toLocaleString('fr-FR');
  header.appendChild(date);
  if (item.intention) {
    const intention = document.createElement('span');
    intention.className = 'text-grenade';
    intention.textContent = item.intention;
    header.appendChild(intention);
  }
  if (!item.emailSent) {
    const warn = document.createElement('span');
    warn.className = 'text-grenade';
    warn.textContent = "email non envoye";
    header.appendChild(warn);
  }
  info.appendChild(header);

  const nameLine = document.createElement('p');
  nameLine.className = 'font-display font-bold text-ink';
  nameLine.textContent = `${item.name} <${item.email}>`;
  info.appendChild(nameLine);

  const messageEl = document.createElement('p');
  messageEl.className = 'text-sm text-smoke mt-1 whitespace-pre-wrap';
  messageEl.textContent = item.message;
  info.appendChild(messageEl);

  const actions = document.createElement('div');
  actions.className = 'flex gap-2 shrink-0';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.textContent = item.handled ? 'Marquer a traiter' : 'Marquer traite';
  toggleBtn.className = 'font-display text-xs border border-line px-3 py-1.5 hover:border-grenade hover:text-grenade transition-colors';
  toggleBtn.addEventListener('click', () => toggleContactHandled(item));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.textContent = 'Supprimer';
  deleteBtn.className = 'font-display text-xs border border-line px-3 py-1.5 hover:border-grenade hover:text-grenade transition-colors';
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
  if (data.items.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'p-4 text-sm text-smoke';
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
