import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shouldSeed = process.argv.includes('--seed') || process.argv.includes('--reset');
const shouldReset = process.argv.includes('--reset');

const seed = {
  company: {
    name: 'Provincial Express',
    tagline: 'Safe rides across the province',
  },
  employees: [
    {
      id: 'EMP-001',
      name: 'Juan Dela Cruz',
      role: 'Conductor',
      assigned_route: 'Route 1',
      status: 'Inactive',
      password: 'conductor14',
    },
    {
      id: 'EMP-002',
      name: 'Maria Santos',
      role: 'Conductor',
      assigned_route: 'Route 2',
      status: 'Inactive',
      password: 'conductor14',
    },
    {
      id: 'EMP-003',
      name: 'Pedro Reyes',
      role: 'Driver',
      assigned_route: 'Route 1',
      status: 'Inactive',
      password: 'conductor14',
    },
    {
      id: 'EMP-004',
      name: 'Ana Lopez',
      role: 'Driver',
      assigned_route: 'Route 2',
      status: 'Inactive',
      password: 'conductor14',
    },
  ],
  routes: [
    {
      id: 'R1',
      name: 'Route 1 — North Line',
      code: 'PX-N1',
      stops: ['Terminal A', 'Town Center', 'Market Hub', 'Terminal B'],
      distance_km: 48,
      status: 'Active',
    },
    {
      id: 'R2',
      name: 'Route 2 — South Line',
      code: 'PX-S1',
      stops: ['Terminal A', 'Riverside', 'Highway Junction', 'Terminal C'],
      distance_km: 62,
      status: 'Active',
    },
  ],
  fares: [
    { route_id: 'R1', from_stop: 'Terminal A', to_stop: 'Town Center', fare: 25 },
    { route_id: 'R1', from_stop: 'Terminal A', to_stop: 'Market Hub', fare: 40 },
    { route_id: 'R1', from_stop: 'Terminal A', to_stop: 'Terminal B', fare: 50 },
    { route_id: 'R1', from_stop: 'Town Center', to_stop: 'Market Hub', fare: 25 },
    { route_id: 'R1', from_stop: 'Town Center', to_stop: 'Terminal B', fare: 35 },
    { route_id: 'R1', from_stop: 'Market Hub', to_stop: 'Terminal B', fare: 25 },
    { route_id: 'R2', from_stop: 'Terminal A', to_stop: 'Riverside', fare: 30 },
    { route_id: 'R2', from_stop: 'Terminal A', to_stop: 'Highway Junction', fare: 45 },
    { route_id: 'R2', from_stop: 'Terminal A', to_stop: 'Terminal C', fare: 60 },
    { route_id: 'R2', from_stop: 'Riverside', to_stop: 'Highway Junction', fare: 25 },
    { route_id: 'R2', from_stop: 'Riverside', to_stop: 'Terminal C', fare: 40 },
    { route_id: 'R2', from_stop: 'Highway Junction', to_stop: 'Terminal C', fare: 25 },
  ],
  buses: [
    { id: 'BUS-101', plate: 'ABC 1234', route_id: 'R1', capacity: 45, status: 'Available' },
    { id: 'BUS-102', plate: 'DEF 5678', route_id: 'R2', capacity: 45, status: 'Available' },
  ],
};

async function applySchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(schema);
}

async function resetData() {
  await query(`
    TRUNCATE TABLE issue_reports, tickets, trips, fares, buses, employees, routes, company
    RESTART IDENTITY CASCADE
  `);
}

async function seedData() {
  await query('INSERT INTO company (name, tagline) VALUES ($1, $2)', [
    seed.company.name,
    seed.company.tagline,
  ]);

  for (const route of seed.routes) {
    await query(
      `INSERT INTO routes (id, name, code, stops, distance_km, status)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [route.id, route.name, route.code, JSON.stringify(route.stops), route.distance_km, route.status],
    );
  }

  for (const employee of seed.employees) {
    await query(
      `INSERT INTO employees (id, name, role, assigned_route, status, password, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)`,
      [
        employee.id,
        employee.name,
        employee.role,
        employee.assigned_route,
        employee.status,
        employee.password,
      ],
    );
  }

  for (const fare of seed.fares) {
    await query(
      `INSERT INTO fares (route_id, from_stop, to_stop, fare)
       VALUES ($1, $2, $3, $4)`,
      [fare.route_id, fare.from_stop, fare.to_stop, fare.fare],
    );
  }

  for (const bus of seed.buses) {
    await query(
      `INSERT INTO buses (id, plate, route_id, capacity, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [bus.id, bus.plate, bus.route_id, bus.capacity, bus.status],
    );
  }
}

async function main() {
  try {
    await applySchema();
    if (shouldReset) {
      await resetData();
      await seedData();
      console.log('Database reset and seeded.');
    } else if (shouldSeed) {
      const { rows } = await query('SELECT COUNT(*)::int AS count FROM routes');
      if (rows[0].count === 0) {
        await seedData();
        console.log('Database seeded.');
      } else {
        console.log('Database already has data; skipping seed. Use --reset to reload.');
      }
    } else {
      console.log('Schema applied.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
