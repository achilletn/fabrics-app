const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const SqliteSessionStore = require('./lib/sqliteSessionStore');

const requireStaff = require('./middleware/requireStaff');
const { csrfErrorHandler } = require('./middleware/csrf');
const authRoutes = require('./routes/auth');
const actualitesPublicRoutes = require('./routes/actualites-public');
const actualitesAdminRoutes = require('./routes/actualites-admin');
const contactRoutes = require('./routes/contact');
const contactAdminRoutes = require('./routes/contact-admin');

const publicDir = path.join(__dirname, '..', 'public');

const app = express();

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

const cookieSecure = process.env.COOKIE_SECURE === 'true';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: cookieSecure ? [] : null,
      },
    },
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use(
  session({
    name: 'fabrics.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: new SqliteSessionStore(),
    cookie: {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'strict',
      maxAge: 2 * 60 * 60 * 1000,
      domain: process.env.COOKIE_DOMAIN || undefined,
    },
  }),
);

// Protected admin HTML: checked server-side before falling through to
// express.static, so an unauthenticated request never receives the
// dashboard markup, not just a client-side redirect.
app.get(['/admin', '/admin/', '/admin/index.html'], requireStaff, (req, res) => {
  res.sendFile(path.join(publicDir, 'admin', 'index.html'));
});

app.use('/api/auth', authRoutes);
app.use('/api/actualites', actualitesPublicRoutes);
app.use('/api/admin/actualites', actualitesAdminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin/contact', contactAdminRoutes);

app.use(express.static(publicDir, { extensions: ['html'] }));

app.use(csrfErrorHandler);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
  return res.status(500).send('Erreur serveur.');
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Introuvable.' });
  }
  return res.status(404).send('Page introuvable.');
});

module.exports = app;
