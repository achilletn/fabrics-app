const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Reessayez plus tard.' },
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de messages envoyes. Reessayez plus tard.' },
});

module.exports = { loginLimiter, contactLimiter };
