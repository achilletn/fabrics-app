// Rendu des cartes actualites. Construit uniquement via createElement/textContent
// (jamais innerHTML) afin qu'un champ compromis en base ne puisse pas injecter
// de HTML/JS dans la page publique.

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function buildCard(item) {
  const article = document.createElement('article');
  article.className =
    'border border-line overflow-hidden hover:bg-grenade-tint hover:border-grenade/40 transition-all duration-300 flex flex-col h-full';

  if (item.image) {
    const imageWrap = document.createElement('div');
    imageWrap.className = 'h-48 overflow-hidden bg-line';
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.title;
    img.className = 'w-full h-full object-cover';
    img.loading = 'lazy';
    imageWrap.appendChild(img);
    article.appendChild(imageWrap);
  }

  const body = document.createElement('div');
  body.className = 'p-6 flex flex-col flex-grow';

  const meta = document.createElement('div');
  meta.className = 'flex items-center justify-between text-xs text-smoke font-display tracking-wide mb-3';

  const time = document.createElement('time');
  const publishedDate = new Date(item.publishedAt);
  time.dateTime = publishedDate.toISOString();
  time.textContent = dateFormatter.format(publishedDate);
  meta.appendChild(time);

  if (item.sourceLabel) {
    const source = document.createElement('span');
    source.className = 'text-grenade';
    source.textContent = item.sourceLabel;
    meta.appendChild(source);
  }
  body.appendChild(meta);

  const title = document.createElement('h3');
  title.className = 'font-display text-lg font-bold mb-2 leading-snug';
  title.textContent = item.title;
  body.appendChild(title);

  const excerpt = document.createElement('p');
  excerpt.className = 'text-sm text-smoke leading-relaxed flex-grow';
  excerpt.textContent = item.excerpt;
  body.appendChild(excerpt);

  if (item.sourceUrl) {
    const link = document.createElement('a');
    link.href = item.sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'inline-block mt-4 text-xs font-display text-grenade hover:underline';
    link.textContent = 'Voir la publication →';
    body.appendChild(link);
  }

  article.appendChild(body);
  return article;
}

export async function renderActualites(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const limit = container.dataset.limit || '20';

  try {
    const response = await fetch(`/api/actualites?limit=${encodeURIComponent(limit)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('reponse invalide');
    const data = await response.json();

    container.textContent = '';
    if (!data.items || data.items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-sm text-smoke';
      empty.textContent = 'Aucune actualite pour le moment.';
      container.appendChild(empty);
      return;
    }

    for (const item of data.items) {
      container.appendChild(buildCard(item));
    }
  } catch (err) {
    container.textContent = '';
    const error = document.createElement('p');
    error.className = 'text-sm text-smoke';
    error.textContent = 'Impossible de charger les actualites pour le moment.';
    container.appendChild(error);
  }
}
