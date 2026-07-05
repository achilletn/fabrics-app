const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { loginLimiter } = require('../middleware/rateLimiters');
const { generateCsrfToken, doubleCsrfProtection } = require('../middleware/csrf');

const router = express.Router();

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_SECONDS = 15 * 60;

// Fixed dummy hash used to keep the bcrypt.compare timing constant when the
// username does not exist, so the response time does not leak which
// usernames are registered.
const DUMMY_HASH = '$2b$12$CwaJqUYnP2s0BsE8XKzZs.5Lk0G0v6RJ2eLmC8pj1n0kzJmS0RKh6';

router.get('/csrf-token', (req, res) => {
  req.session.csrfAnchor = true;
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
});

router.use(doubleCsrfProtection);

router.post(
  '/login',
  loginLimiter,
  body('username').isString().trim().isLength({ min: 1, max: 100 }),
  body('password').isString().isLength({ min: 1, max: 200 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Identifiants invalides.' });
    }

    const { username, password } = req.body;
    const staff = db.prepare('SELECT * FROM staff WHERE username = ?').get(username);

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (staff && staff.locked_until && staff.locked_until > nowSeconds) {
      return res.status(423).json({ error: 'Compte temporairement verrouille suite a de multiples echecs. Reessayez plus tard.' });
    }

    const hashToCompare = staff ? staff.password_hash : DUMMY_HASH;

    return bcrypt.compare(password, hashToCompare).then((valid) => {
      if (!staff || !valid) {
        if (staff) {
          const attempts = staff.failed_attempts + 1;
          const lockedUntil = attempts >= LOCKOUT_THRESHOLD ? nowSeconds + LOCKOUT_DURATION_SECONDS : null;
          db.prepare('UPDATE staff SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(
            attempts,
            lockedUntil,
            staff.id,
          );
        }
        return res.status(401).json({ error: 'Identifiants invalides.' });
      }

      db.prepare('UPDATE staff SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(staff.id);

      // Regenerate the session on privilege change to prevent session fixation.
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ error: 'Erreur serveur.' });
        }
        req.session.staffId = staff.id;
        req.session.username = staff.username;
        return req.session.save((saveErr) => {
          if (saveErr) {
            return res.status(500).json({ error: 'Erreur serveur.' });
          }
          return res.json({ username: staff.username });
        });
      });
    });
  },
);

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('fabrics.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (req.session && req.session.staffId) {
    return res.json({ username: req.session.username });
  }
  return res.status(401).json({ error: 'Non authentifie.' });
});

module.exports = router;
