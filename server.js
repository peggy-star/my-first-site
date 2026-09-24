const express = require('express');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 8080;

// Make sure the data directory exists (this is where the SQLite file lives).
// On Zeabur, mount a persistent Volume at /app/data so messages survive redeploys.
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'guestbook.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`);

app.use(express.json());
app.use(express.static(__dirname));

// List latest guestbook messages
app.get('/api/messages', (req, res) => {
  const rows = db
    .prepare('SELECT id, name, message, created_at FROM messages ORDER BY id DESC LIMIT 200')
    .all();
  res.json(rows);
});

// Add a new guestbook message
app.post('/api/messages', (req, res) => {
  const { name, message } = req.body || {};
  const cleanName = String(name || '').trim().slice(0, 40);
  const cleanMessage = String(message || '').trim().slice(0, 280);

  if (!cleanName || !cleanMessage) {
    return res.status(400).json({ error: '請填寫名字與留言內容' });
  }

  const info = db
    .prepare('INSERT INTO messages (name, message) VALUES (?, ?)')
    .run(cleanName, cleanMessage);

  const row = db
    .prepare('SELECT id, name, message, created_at FROM messages WHERE id = ?')
    .get(info.lastInsertRowid);

  res.status(201).json(row);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
