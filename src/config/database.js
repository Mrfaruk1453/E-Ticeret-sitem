const path = require('path');
const fs = require('fs');

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true' || !!process.env.NOW_REGION;

let dbPath;
if (isVercel) {
  // On Vercel serverless, the root filesystem is read-only.
  // We copy the seeded database to /tmp which is writable.
  dbPath = path.join('/tmp', 'ecommerce.db');
  const sourceDbPath = path.join(__dirname, '..', '..', 'data', 'ecommerce.db');

  if (!fs.existsSync(dbPath)) {
    if (fs.existsSync(sourceDbPath)) {
      try {
        fs.copyFileSync(sourceDbPath, dbPath);
        console.log('Copied database to /tmp/ecommerce.db on Vercel');
      } catch (err) {
        console.error('Failed to copy ecommerce.db to /tmp:', err);
      }
    }
  }
} else {
  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  dbPath = process.env.DB_PATH || path.join(dataDir, 'ecommerce.db');
}

// Node.js v22+ built-in SQLite
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for concurrency & data integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

/**
 * Execute a function inside an immediate transaction (row/table locking)
 * Guarantees serializability and prevents race conditions in concurrent orders
 */
function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch (_) {}
    throw err;
  }
}

module.exports = {
  db,
  transaction,
  dbPath
};
