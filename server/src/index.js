import cors from 'cors';
import express from 'express';
import api from './routes/api.js';
import { pool } from './db.js';

const app = express();
const PORT = Number(process.env.PORT || 43124);

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    name: 'TalaByahe API',
    status: 'ok',
    docs: '/api/health',
  });
});

app.use('/api', api);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    detail: err.detail || undefined,
  });
});

async function start() {
  await pool.query('SELECT 1');
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TalaByahe API listening on http://127.0.0.1:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start API:', err.message);
  process.exit(1);
});
