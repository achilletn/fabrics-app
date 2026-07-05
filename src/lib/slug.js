function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'actualite';
}

function uniqueSlug(baseText, slugExistsFn) {
  const base = slugify(baseText);
  let candidate = base;
  let suffix = 2;
  while (slugExistsFn(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

module.exports = { slugify, uniqueSlug };
