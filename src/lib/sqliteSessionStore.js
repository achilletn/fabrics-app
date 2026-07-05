const session = require('express-session');
const db = require('../db');

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    this.getStmt = db.prepare('SELECT data, expires FROM sessions WHERE sid = ?');
    this.upsertStmt = db.prepare(
      `INSERT INTO sessions (sid, expires, data) VALUES (?, ?, ?)
       ON CONFLICT(sid) DO UPDATE SET expires = excluded.expires, data = excluded.data`,
    );
    this.deleteStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.deleteExpiredStmt = db.prepare('DELETE FROM sessions WHERE expires < ?');

    this.cleanupTimer = setInterval(() => {
      this.deleteExpiredStmt.run(Date.now());
    }, CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  get(sid, callback) {
    try {
      const row = this.getStmt.get(sid);
      if (!row) return callback(null, null);
      if (row.expires < Date.now()) {
        this.deleteStmt.run(sid);
        return callback(null, null);
      }
      return callback(null, JSON.parse(row.data));
    } catch (err) {
      return callback(err);
    }
  }

  set(sid, sessionData, callback) {
    try {
      const maxAge = (sessionData.cookie && sessionData.cookie.maxAge) || DEFAULT_MAX_AGE_MS;
      const expires = Date.now() + maxAge;
      this.upsertStmt.run(sid, expires, JSON.stringify(sessionData));
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      this.deleteStmt.run(sid);
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  touch(sid, sessionData, callback) {
    return this.set(sid, sessionData, callback || (() => {}));
  }
}

module.exports = SqliteSessionStore;
