const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  let limit = parseInt(req.query.limit, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  limit = Math.min(limit, 50);

  const rows = db
    .prepare(
      `SELECT slug, title, excerpt, image_path, source_label, source_url, published_at
       FROM actualites
       ORDER BY published_at DESC
       LIMIT ?`,
    )
    .all(limit);

  const items = rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    image: row.image_path,
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
    publishedAt: new Date(row.published_at * 1000).toISOString(),
  }));

  res.set('Cache-Control', 'public, max-age=60');
  res.json({ items });
});

module.exports = router;
