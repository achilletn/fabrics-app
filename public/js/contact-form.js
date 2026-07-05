const form = document.getElementById('contact-form');
if (form) {
  const feedback = document.getElementById('contact-feedback');
  const submitBtn = document.getElementById('contact-submit');

  function showFeedback(message, isError) {
    feedback.textContent = message;
    feedback.classList.remove('hidden', 'text-grenade', 'text-smoke');
    feedback.classList.add(isError ? 'text-grenade' : 'text-smoke');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitBtn.disabled = true;

    try {
      const tokenResponse = await fetch('/api/auth/csrf-token', { credentials: 'same-origin' });
      const { csrfToken } = await tokenResponse.json();

      const payload = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        intention: document.getElementById('intention').value,
        message: document.getElementById('message').value,
        website: document.getElementById('website').value,
      };

      const response = await fetch('/api/contact', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        form.reset();
        showFeedback('Message envoye, merci ! Nous revenons vers vous rapidement.', false);
        return;
      }

      if (response.status === 429) {
        showFeedback('Trop de messages envoyes recemment. Reessayez plus tard.', true);
        return;
      }

      showFeedback('Une erreur est survenue, merci de reessayer.', true);
    } catch (err) {
      showFeedback('Erreur de connexion au serveur.', true);
    } finally {
      submitBtn.disabled = false;
    }
  });
}
