const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 4000;
const AUTH0_DOMAIN = 'dev-yoag06mta5zqt28n.us.auth0.com';

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Simple in-memory cache for userinfo tokens (5 min TTL)
const tokenCache = new Map();

async function verifyToken(token) {
  const cached = tokenCache.get(token);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached.user;

  const res = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) return null;

  const user = await res.json();
  tokenCache.set(token, { user, ts: Date.now() });
  // Keep cache small
  if (tokenCache.size > 500) tokenCache.delete(tokenCache.keys().next().value);
  return user;
}

async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  const user = await verifyToken(token).catch(() => null);
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
}

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

app.get('/tasks', auth, async (req, res) => {
  const result = await pool.query('SELECT * FROM tasks ORDER BY created_at ASC');
  res.json(result.rows);
});

app.post('/tasks', auth, async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });
  const result = await pool.query(
    'INSERT INTO tasks (title) VALUES ($1) RETURNING *',
    [title.trim()]
  );
  res.json(result.rows[0]);
});

app.patch('/tasks/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { done } = req.body;
  const result = await pool.query(
    'UPDATE tasks SET done = $1 WHERE id = $2 RETURNING *',
    [done, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

app.delete('/tasks/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

init().then(() => {
  app.listen(PORT, () => console.log(`Tasklist API running on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
