const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { contactLimiter } = require('../middleware/rateLimiters');
const { doubleCsrfProtection } = require('../middleware/csrf');
const { sendContactNotification } = require('../lib/mailer');

const router = express.Router();

router.use(doubleCsrfProtection);

router.post(
  '/',
  contactLimiter,
  body('name').isString().trim().isLength({ min: 1, max: 200 }).matches(/^[^\r\n]*$/),
  body('email').isString().trim().isEmail().normalizeEmail().isLength({ max: 254 }),
  body('intention').optional({ checkFalsy: true }).isString().trim().isLength({ max: 60 }).matches(/^[^\r\n]*$/),
  body('message').isString().trim().isLength({ min: 1, max: 4000 }),
  // Honeypot: a real visitor never fills this hidden field; a bot usually does.
  body('website').optional({ checkFalsy: true }).isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Champs invalides.' });
    }

    if (req.body.website) {
      // Silently pretend success to the bot instead of revealing the trap.
      return res.status(201).json({ ok: true });
    }

    const { name, email, intention, message } = req.body;

    const result = db
      .prepare('INSERT INTO contact_messages (name, email, intention, message) VALUES (?, ?, ?, ?)')
      .run(name, email, intention || null, message);

    const emailSent = await sendContactNotification({ name, email, intention, message });
    db.prepare('UPDATE contact_messages SET email_sent = ? WHERE id = ?').run(emailSent ? 1 : 0, result.lastInsertRowid);

    return res.status(201).json({ ok: true });
  },
);

module.exports = router;
