const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'app.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS actualites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    image_path TEXT,
    source_label TEXT,
    source_url TEXT,
    published_at INTEGER NOT NULL,
    created_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_actualites_published_at ON actualites(published_at DESC);

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    expires INTEGER NOT NULL,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    intention TEXT,
    message TEXT NOT NULL,
    email_sent INTEGER NOT NULL DEFAULT 0,
    handled_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);
`);

module.exports = db;
