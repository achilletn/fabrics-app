const express = require('express');
const { param, validationResult } = require('express-validator');
const db = require('../db');
const requireStaff = require('../middleware/requireStaff');
const { doubleCsrfProtection } = require('../middleware/csrf');

const router = express.Router();

router.use(requireStaff);
router.use(doubleCsrfProtection);

function toApiShape(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    intention: row.intention,
    message: row.message,
    emailSent: Boolean(row.email_sent),
    handled: row.handled_at !== null,
    createdAt: new Date(row.created_at * 1000).toISOString(),
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all();
  res.json({ items: rows.map(toApiShape) });
});

router.patch('/:id/handled', param('id').isInt().toInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Identifiant invalide.' });
  }

  const existing = db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Message introuvable.' });
  }

  const nowHandled = existing.handled_at === null;
  db.prepare('UPDATE contact_messages SET handled_at = ? WHERE id = ?').run(
    nowHandled ? Math.floor(Date.now() / 1000) : null,
    existing.id,
  );

  const row = db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(existing.id);
  return res.json(toApiShape(row));
});

router.delete('/:id', param('id').isInt().toInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Identifiant invalide.' });
  }

  const existing = db.prepare('SELECT id FROM contact_messages WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Message introuvable.' });
  }

  db.prepare('DELETE FROM contact_messages WHERE id = ?').run(existing.id);
  res.status(204).end();
});

module.exports = router;
