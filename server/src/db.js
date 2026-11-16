import pg from 'pg';

const { Pool } = pg;

export const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://talabyahe:talabyahe@127.0.0.1:5432/talabyahe';

export const pool = new Pool({
  connectionString: DATABASE_URL,
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function getHealth() {
  const started = Date.now();
  const result = await query(
    `SELECT current_database() AS database,
            current_user AS db_user,
            NOW() AS server_time,
            (SELECT COUNT(*)::int FROM employees) AS employees,
            (SELECT COUNT(*)::int FROM routes) AS routes,
            (SELECT COUNT(*)::int FROM fares) AS fares,
            (SELECT COUNT(*)::int FROM buses) AS buses,
            (SELECT COUNT(*)::int FROM tickets) AS tickets`,
  );
  return {
    ok: true,
    engine: 'PostgreSQL',
    latencyMs: Date.now() - started,
    ...result.rows[0],
  };
}
