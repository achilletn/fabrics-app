const { doubleCsrf } = require('csrf-csrf');

const { generateCsrfToken, doubleCsrfProtection, invalidCsrfTokenError } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  getSessionIdentifier: (req) => req.session.id,
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
  cookieName: process.env.COOKIE_SECURE === 'true' ? '__Host-csrf' : 'csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
  },
  size: 64,
});

function csrfErrorHandler(err, req, res, next) {
  if (err === invalidCsrfTokenError) {
    return res.status(403).json({ error: 'Jeton CSRF invalide ou manquant.' });
  }
  return next(err);
}

module.exports = { generateCsrfToken, doubleCsrfProtection, csrfErrorHandler };
