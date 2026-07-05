const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.classList.add('hidden');

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const tokenResponse = await fetch('/api/auth/csrf-token', { credentials: 'same-origin' });
    if (!tokenResponse.ok) throw new Error('csrf');
    const { csrfToken } = await tokenResponse.json();

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      window.location.href = '/admin/';
      return;
    }

    const data = await response.json().catch(() => ({}));
    showError(data.error || 'Identifiants invalides.');
  } catch (err) {
    showError('Erreur de connexion au serveur.');
  }
});
