const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const requireStaff = require('../middleware/requireStaff');
const { doubleCsrfProtection } = require('../middleware/csrf');
const { upload, persistUploadedImage, deleteUploadedImage, hasUploadedFile } = require('../lib/uploads');
const { uniqueSlug } = require('../lib/slug');

const router = express.Router();

router.use(requireStaff);
router.use(doubleCsrfProtection);

function slugExists(slug, excludeId) {
  const row = excludeId
    ? db.prepare('SELECT id FROM actualites WHERE slug = ? AND id != ?').get(slug, excludeId)
    : db.prepare('SELECT id FROM actualites WHERE slug = ?').get(slug);
  return Boolean(row);
}

function toApiShape(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    image: row.image_path,
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
    publishedAt: new Date(row.published_at * 1000).toISOString(),
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM actualites ORDER BY published_at DESC').all();
  res.json({ items: rows.map(toApiShape) });
});

const textFieldValidators = [
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
  body('excerpt').isString().trim().isLength({ min: 1, max: 600 }),
  body('sourceLabel').optional({ checkFalsy: true }).isString().trim().isLength({ max: 60 }),
  body('sourceUrl').optional({ checkFalsy: true }).isURL({ protocols: ['http', 'https'], require_protocol: true }),
  body('publishedAt').isISO8601(),
];

function handleUploadError(err, req, res, next) {
  if (err) {
    return res.status(400).json({ error: err.message || 'Erreur lors du televersement du fichier.' });
  }
  return next();
}

router.post('/', (req, res, next) => {
  upload.single('image')(req, res, (err) => handleUploadError(err, req, res, next));
}, textFieldValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Champs invalides.', details: errors.array() });
  }

  try {
    const { title, excerpt, sourceLabel, sourceUrl, publishedAt } = req.body;
    const slug = uniqueSlug(title, (candidate) => slugExists(candidate));
    const imagePath = hasUploadedFile(req.file) ? await persistUploadedImage(req.file) : null;
    const publishedAtSeconds = Math.floor(new Date(publishedAt).getTime() / 1000);

    const result = db
      .prepare(
        `INSERT INTO actualites (slug, title, excerpt, image_path, source_label, source_url, published_at, created_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
      )
      .run(slug, title, excerpt, imagePath, sourceLabel || null, sourceUrl || null, publishedAtSeconds, req.session.staffId);

    const row = db.prepare('SELECT * FROM actualites WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(toApiShape(row));
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erreur lors de la creation.' });
  }
});

router.put(
  '/:id',
  param('id').isInt().toInt(),
  (req, res, next) => {
    upload.single('image')(req, res, (err) => handleUploadError(err, req, res, next));
  },
  textFieldValidators,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Champs invalides.', details: errors.array() });
    }

    const existing = db.prepare('SELECT * FROM actualites WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Actualite introuvable.' });
    }

    try {
      const { title, excerpt, sourceLabel, sourceUrl, publishedAt } = req.body;
      const publishedAtSeconds = Math.floor(new Date(publishedAt).getTime() / 1000);

      let imagePath = existing.image_path;
      if (hasUploadedFile(req.file)) {
        imagePath = await persistUploadedImage(req.file);
        await deleteUploadedImage(existing.image_path);
      }

      let slug = existing.slug;
      if (title !== existing.title) {
        slug = uniqueSlug(title, (candidate) => slugExists(candidate, existing.id));
      }

      db.prepare(
        `UPDATE actualites
         SET slug = ?, title = ?, excerpt = ?, image_path = ?, source_label = ?, source_url = ?, published_at = ?, updated_at = unixepoch()
         WHERE id = ?`,
      ).run(slug, title, excerpt, imagePath, sourceLabel || null, sourceUrl || null, publishedAtSeconds, existing.id);

      const row = db.prepare('SELECT * FROM actualites WHERE id = ?').get(existing.id);
      return res.json(toApiShape(row));
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Erreur lors de la mise a jour.' });
    }
  },
);

router.delete('/:id', param('id').isInt().toInt(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Identifiant invalide.' });
  }

  const existing = db.prepare('SELECT * FROM actualites WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Actualite introuvable.' });
  }

  db.prepare('DELETE FROM actualites WHERE id = ?').run(existing.id);
  await deleteUploadedImage(existing.image_path);

  res.status(204).end();
});

module.exports = router;
