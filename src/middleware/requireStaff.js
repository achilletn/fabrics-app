function requireStaff(req, res, next) {
  if (req.session && req.session.staffId) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  return res.redirect('/admin/login.html');
}

module.exports = requireStaff;
