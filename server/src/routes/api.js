import { Router } from 'express';
import { getHealth, query } from '../db.js';
import {
  mapBus,
  mapEmployee,
  mapFare,
  mapIssueReport,
  mapRoute,
  mapTicket,
  mapTrip,
} from '../mappers.js';

const router = Router();

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin@talabyahe.ph';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'talabyahe14';

router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const health = await getHealth();
    res.json(health);
  }),
);

function isAdminPassword(password) {
  return String(password || '') === ADMIN_PASSWORD;
}

/** Conductor shows Active in admin while the mobile app is open and heartbeating. */
const PRESENCE_SECONDS = 45;

const EMPLOYEE_SELECT = `
  id, name, role, assigned_route, last_seen_at,
  CASE
    WHEN status = 'Deleted' THEN 'Deleted'
    WHEN last_seen_at IS NOT NULL
     AND last_seen_at > NOW() - make_interval(secs => ${PRESENCE_SECONDS})
    THEN 'Active'
    ELSE 'Inactive'
  END AS status
`;

async function touchConductorPresence(employeeId, online = true) {
  if (online) {
    const { rows } = await query(
      `UPDATE employees
       SET last_seen_at = NOW(), status = 'Active'
       WHERE upper(id) = upper($1)
         AND status <> 'Deleted'
       RETURNING ${EMPLOYEE_SELECT}`,
      [employeeId],
    );
    return rows[0] || null;
  }
  const { rows } = await query(
    `UPDATE employees
     SET last_seen_at = NULL, status = 'Inactive'
     WHERE upper(id) = upper($1)
       AND status <> 'Deleted'
     RETURNING ${EMPLOYEE_SELECT}`,
    [employeeId],
  );
  return rows[0] || null;
}

router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (username !== ADMIN_USERNAME || !isAdminPassword(password)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    res.json({
      ok: true,
      username: ADMIN_USERNAME,
      role: 'admin',
    });
  }),
);

router.post(
  '/auth/verify-password',
  asyncHandler(async (req, res) => {
    if (!isAdminPassword(req.body?.password)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    res.json({ ok: true });
  }),
);

router.post(
  '/auth/conductor-login',
  asyncHandler(async (req, res) => {
    const employeeId = String(req.body?.employeeId || '').trim().toUpperCase();
    const password = String(req.body?.password || '');

    if (!employeeId || !password) {
      return res.status(400).json({ error: 'Employee ID and password are required' });
    }

    const { rows } = await query(
      `SELECT id, name, role, assigned_route, password
       FROM employees
       WHERE upper(id) = $1
         AND status <> 'Deleted'`,
      [employeeId],
    );
    const employee = rows[0];
    if (!employee || employee.password !== password) {
      return res.status(401).json({ error: 'Invalid employee ID or password' });
    }

    const present = await touchConductorPresence(employee.id, true);

    res.json({
      ok: true,
      conductor: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        route: employee.assigned_route,
        status: present?.status || 'Active',
      },
    });
  }),
);

router.post(
  '/auth/conductor-presence',
  asyncHandler(async (req, res) => {
    const employeeId = String(req.body?.employeeId || '').trim().toUpperCase();
    const online = req.body?.online !== false;

    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    const row = await touchConductorPresence(employeeId, online);
    if (!row) return res.status(404).json({ error: 'Employee not found' });
    res.json({ ok: true, status: row.status, lastSeenAt: row.last_seen_at });
  }),
);

router.get(
  '/company',
  asyncHandler(async (_req, res) => {
    const { rows } = await query('SELECT name, tagline FROM company ORDER BY id LIMIT 1');
    res.json(rows[0] ?? { name: 'TalaByahe', tagline: '' });
  }),
);

router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const [company, stats, tickets, activeTickets, activeTrips, todayTrips] = await Promise.all([
      query('SELECT name, tagline FROM company ORDER BY id LIMIT 1'),
      query(`
        SELECT
          (SELECT COUNT(*)::int FROM trips WHERE status = 'Active') AS active_trips,
          (SELECT COUNT(*)::int FROM buses WHERE status = 'On Trip') AS active_buses,
          (SELECT COUNT(*)::int FROM employees
             WHERE role = 'Conductor'
               AND status <> 'Deleted'
               AND last_seen_at IS NOT NULL
               AND last_seen_at > NOW() - make_interval(secs => ${PRESENCE_SECONDS})
          ) AS active_conductors,
          (SELECT COUNT(*)::int FROM tickets WHERE issued_at::date = CURRENT_DATE) AS tickets_today,
          (SELECT COALESCE(SUM(fare), 0)::float FROM tickets WHERE issued_at::date = CURRENT_DATE) AS revenue_today,
          (SELECT COUNT(*)::int FROM trips WHERE started_at::date = CURRENT_DATE) AS trips_today
      `),
      query(`
        SELECT id, trip_id, route_id, from_stop, to_stop, fare, base_fare, discount_applied,
               issued_at, conductor_name, bus_id
        FROM tickets
        ORDER BY issued_at DESC
        LIMIT 20
      `),
      query(`
        SELECT tk.id, tk.trip_id, tk.route_id, tk.from_stop, tk.to_stop, tk.fare, tk.base_fare,
               tk.discount_applied, tk.issued_at, tk.conductor_name, tk.bus_id
        FROM tickets tk
        JOIN trips t ON t.id = tk.trip_id
        WHERE t.status = 'Active'
        ORDER BY tk.issued_at DESC
        LIMIT 50
      `),
      query(`
        SELECT t.id, t.route_id, r.name AS route_name, t.bus_id, b.plate AS bus_plate,
               t.conductor_id, t.conductor_name, t.status, t.started_at, t.ended_at,
               r.stops,
               (SELECT COUNT(*)::int FROM tickets tk WHERE tk.trip_id = t.id) AS ticket_count,
               (SELECT COALESCE(SUM(fare), 0)::float FROM tickets tk WHERE tk.trip_id = t.id) AS earnings
        FROM trips t
        JOIN routes r ON r.id = t.route_id
        JOIN buses b ON b.id = t.bus_id
        WHERE t.status = 'Active'
        ORDER BY t.started_at DESC
      `),
      query(`
        SELECT t.id, t.route_id, r.name AS route_name, t.bus_id, b.plate AS bus_plate,
               t.conductor_id, t.conductor_name, t.status, t.started_at, t.ended_at,
               r.stops,
               (SELECT COUNT(*)::int FROM tickets tk WHERE tk.trip_id = t.id) AS ticket_count,
               (SELECT COALESCE(SUM(fare), 0)::float FROM tickets tk WHERE tk.trip_id = t.id) AS earnings
        FROM trips t
        JOIN routes r ON r.id = t.route_id
        JOIN buses b ON b.id = t.bus_id
        WHERE t.started_at::date = CURRENT_DATE
        ORDER BY t.started_at DESC
      `),
    ]);

    const s = stats.rows[0];
    res.json({
      company: company.rows[0] ?? { name: 'TalaByahe', tagline: '' },
      stats: {
        todayTrips: s.trips_today,
        activeTrips: s.active_trips,
        ticketsSold: s.tickets_today,
        totalRevenue: s.revenue_today,
        activeBuses: s.active_buses,
        activeConductors: s.active_conductors,
      },
      recentTickets: tickets.rows.map(mapTicket),
      activeTickets: activeTickets.rows.map(mapTicket),
      activeTrips: activeTrips.rows.map(mapTrip),
      todayTrips: todayTrips.rows.map(mapTrip),
    });
  }),
);

router.get(
  '/employees',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT ${EMPLOYEE_SELECT}
       FROM employees
       WHERE status <> 'Deleted'
       ORDER BY id`,
    );
    res.json(rows.map(mapEmployee));
  }),
);

router.post(
  '/employees',
  asyncHandler(async (req, res) => {
    const {
      name,
      role = 'Conductor',
      route = '—',
      password,
      adminPassword,
    } = req.body ?? {};

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!password || String(password).length < 4) {
      return res.status(400).json({ error: 'Employee password must be at least 4 characters' });
    }
    if (!isAdminPassword(adminPassword)) {
      return res.status(401).json({ error: 'Incorrect admin password' });
    }

    const { rows: next } = await query(`
      SELECT 'EMP-' || LPAD((COALESCE(MAX(SUBSTRING(id FROM 5)::int), 0) + 1)::text, 3, '0') AS id
      FROM employees
      WHERE id ~ '^EMP-[0-9]+$'
    `);

    const id = next[0].id;
    const { rows } = await query(
      `INSERT INTO employees (id, name, role, assigned_route, status, password, last_seen_at)
       VALUES ($1, $2, $3, $4, 'Inactive', $5, NULL)
       RETURNING ${EMPLOYEE_SELECT}`,
      [id, name.trim(), role, route, String(password)],
    );
    res.status(201).json(mapEmployee(rows[0]));
  }),
);

router.put(
  '/employees/:id',
  asyncHandler(async (req, res) => {
    const { name, role, route, password, adminPassword } = req.body ?? {};
    const changingPassword = password != null && String(password).length > 0;

    if (!isAdminPassword(adminPassword)) {
      return res.status(401).json({ error: 'Incorrect admin password' });
    }

    if (changingPassword && String(password).length < 4) {
      return res.status(400).json({ error: 'Employee password must be at least 4 characters' });
    }

    const { rows } = await query(
      `UPDATE employees
       SET name = COALESCE($2, name),
           role = COALESCE($3, role),
           assigned_route = COALESCE($4, assigned_route),
           password = CASE
             WHEN $5::text IS NULL OR $5::text = '' THEN password
             ELSE $5::text
           END
       WHERE id = $1
         AND status <> 'Deleted'
       RETURNING ${EMPLOYEE_SELECT}`,
      [req.params.id, name ?? null, role ?? null, route ?? null, password ?? null],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Employee not found' });
    res.json(mapEmployee(rows[0]));
  }),
);

router.delete(
  '/employees/:id',
  asyncHandler(async (req, res) => {
    if (!isAdminPassword(req.body?.password)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const activeTrip = await query(
      `SELECT COUNT(*)::int AS count
       FROM trips
       WHERE conductor_id = $1 AND status IN ('Active', 'Pending')`,
      [req.params.id],
    );
    if (activeTrip.rows[0].count > 0) {
      return res.status(409).json({
        error: "Can't delete this employee — they still have an active or pending trip",
      });
    }

    // Soft-delete: hide from admin/mobile, keep trip/report history.
    const { rows } = await query(
      `UPDATE employees
       SET status = 'Deleted', last_seen_at = NULL
       WHERE id = $1 AND status <> 'Deleted'
       RETURNING id`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Employee not found' });
    res.status(204).end();
  }),
);

router.get(
  '/routes',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT id, name, code, stops, distance_km, status
       FROM routes
       WHERE status <> 'Deleted'
       ORDER BY id`,
    );
    res.json(rows.map(mapRoute));
  }),
);

router.post(
  '/routes',
  asyncHandler(async (req, res) => {
    const { name, code, stops, distanceKm, status = 'Active', adminPassword } = req.body ?? {};
    if (!isAdminPassword(adminPassword)) {
      return res.status(401).json({ error: 'Incorrect admin password' });
    }
    if (!name?.trim() || !code?.trim()) {
      return res.status(400).json({ error: 'Name and code are required' });
    }
    const stopList = Array.isArray(stops)
      ? stops.map((s) => String(s).trim()).filter(Boolean)
      : String(stops || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    if (stopList.length < 2) {
      return res.status(400).json({ error: 'Enter at least two stops (origin and destination)' });
    }

    const { rows: next } = await query(`
      SELECT 'R' || (COALESCE(MAX(SUBSTRING(id FROM 2)::int), 0) + 1) AS id
      FROM routes
      WHERE id ~ '^R[0-9]+$'
    `);

    const { rows } = await query(
      `INSERT INTO routes (id, name, code, stops, distance_km, status)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING id, name, code, stops, distance_km, status`,
      [next[0].id, name.trim(), code.trim(), JSON.stringify(stopList), Number(distanceKm) || 0, status],
    );
    res.status(201).json(mapRoute(rows[0]));
  }),
);

router.put(
  '/routes/:id',
  asyncHandler(async (req, res) => {
    const { name, code, stops, distanceKm, adminPassword } = req.body ?? {};
    if (!isAdminPassword(adminPassword)) {
      return res.status(401).json({ error: 'Incorrect admin password' });
    }
    const stopList =
      stops == null
        ? null
        : Array.isArray(stops)
          ? stops.map((s) => String(s).trim()).filter(Boolean)
          : String(stops)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
    if (stopList && stopList.length < 2) {
      return res.status(400).json({ error: 'Enter at least two stops (origin and destination)' });
    }

    const { rows } = await query(
      `UPDATE routes
       SET name = COALESCE($2, name),
           code = COALESCE($3, code),
           stops = COALESCE($4::jsonb, stops),
           distance_km = COALESCE($5, distance_km)
       WHERE id = $1 AND status <> 'Deleted'
       RETURNING id, name, code, stops, distance_km, status`,
      [
        req.params.id,
        name ?? null,
        code ?? null,
        stopList ? JSON.stringify(stopList) : null,
        distanceKm == null ? null : Number(distanceKm),
      ],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Route not found' });
    res.json(mapRoute(rows[0]));
  }),
);

router.delete(
  '/routes/:id',
  asyncHandler(async (req, res) => {
    if (!isAdminPassword(req.body?.password)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Soft-delete: hide from admin/mobile, keep trip history for reports.
    const activeTrip = await query(
      `SELECT COUNT(*)::int AS count
       FROM trips
       WHERE route_id = $1 AND status IN ('Active', 'Pending')`,
      [req.params.id],
    );
    if (activeTrip.rows[0].count > 0) {
      return res.status(409).json({ error: "Can't delete this route — a trip is still active" });
    }

    const { rows } = await query(
      `UPDATE routes
       SET status = 'Deleted'
       WHERE id = $1 AND status <> 'Deleted'
       RETURNING id`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Route not found' });

    // Free buses assigned to this route so they can be reused.
    await query(`UPDATE buses SET route_id = NULL WHERE route_id = $1`, [req.params.id]);

    res.status(204).end();
  }),
);

router.get(
  '/fares',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT f.id, f.route_id, f.from_stop, f.to_stop, f.fare
       FROM fares f
       JOIN routes r ON r.id = f.route_id
       WHERE r.status <> 'Deleted'
         AND f.deleted_at IS NULL
       ORDER BY f.route_id, f.from_stop, f.to_stop`,
    );
    res.json(rows.map(mapFare));
  }),
);

router.post(
  '/fares',
  asyncHandler(async (req, res) => {
    const { routeId, from, to, fare, adminPassword } = req.body ?? {};
    if (!isAdminPassword(adminPassword)) {
      return res.status(401).json({ error: 'Incorrect admin password' });
    }
    if (!routeId || !from || !to || fare == null) {
      return res.status(400).json({ error: 'routeId, from, to, and fare are required' });
    }
    if (String(from).trim() === String(to).trim()) {
      return res.status(400).json({ error: 'From and To stops must be different' });
    }
    const existing = await query(
      `SELECT id FROM fares
       WHERE route_id = $1 AND from_stop = $2 AND to_stop = $3
         AND deleted_at IS NULL
       LIMIT 1`,
      [routeId, from, to],
    );
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'This fare already exists' });
    }
    try {
      const { rows } = await query(
        `INSERT INTO fares (route_id, from_stop, to_stop, fare)
         VALUES ($1, $2, $3, $4)
         RETURNING id, route_id, from_stop, to_stop, fare`,
        [routeId, from, to, Number(fare)],
      );
      res.status(201).json(mapFare(rows[0]));
    } catch (err) {
      if (err?.code === '23505') {
        return res.status(409).json({ error: 'This fare already exists' });
      }
      throw err;
    }
  }),
);

router.put(
  '/fares/:id',
  asyncHandler(async (req, res) => {
    const { routeId, from, to, fare } = req.body ?? {};
    const { rows } = await query(
      `UPDATE fares
       SET route_id = COALESCE($2, route_id),
           from_stop = COALESCE($3, from_stop),
           to_stop = COALESCE($4, to_stop),
           fare = COALESCE($5, fare)
       WHERE id = $1
         AND deleted_at IS NULL
       RETURNING id, route_id, from_stop, to_stop, fare`,
      [req.params.id, routeId ?? null, from ?? null, to ?? null, fare == null ? null : Number(fare)],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Fare not found' });
    res.json(mapFare(rows[0]));
  }),
);

router.delete(
  '/fares/:id',
  asyncHandler(async (req, res) => {
    if (!isAdminPassword(req.body?.password)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    // Soft-delete: hide from admin/mobile; ticket history already stores fare amounts.
    const { rows } = await query(
      `UPDATE fares
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Fare not found' });
    res.status(204).end();
  }),
);

router.get(
  '/buses',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT id, plate, route_id, capacity, status
       FROM buses
       WHERE status <> 'Deleted'
       ORDER BY id`,
    );
    res.json(rows.map(mapBus));
  }),
);

router.put(
  '/buses/:id',
  asyncHandler(async (req, res) => {
    const { plate, adminPassword } = req.body ?? {};
    if (!isAdminPassword(adminPassword)) {
      return res.status(401).json({ error: 'Incorrect admin password' });
    }
    if (!plate?.trim()) {
      return res.status(400).json({ error: 'Plate is required' });
    }

    const { rows } = await query(
      `UPDATE buses
       SET plate = $2
       WHERE id = $1 AND status <> 'Deleted'
       RETURNING id, plate, route_id, capacity, status`,
      [req.params.id, plate.trim()],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bus not found' });
    res.json(mapBus(rows[0]));
  }),
);

router.delete(
  '/buses/:id',
  asyncHandler(async (req, res) => {
    if (!isAdminPassword(req.body?.password)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const activeTrip = await query(
      `SELECT COUNT(*)::int AS count
       FROM trips
       WHERE bus_id = $1 AND status IN ('Active', 'Pending')`,
      [req.params.id],
    );
    if (activeTrip.rows[0].count > 0) {
      return res.status(409).json({ error: "Can't delete this bus — a trip is still active" });
    }

    const bus = await query(
      `SELECT status FROM buses WHERE id = $1 AND status <> 'Deleted'`,
      [req.params.id],
    );
    if (!bus.rows[0]) return res.status(404).json({ error: 'Bus not found' });
    if (bus.rows[0].status === 'On Trip') {
      return res.status(409).json({ error: "Can't delete this bus — a trip is still active" });
    }

    // Soft-delete so trip history stays available for reports.
    await query(`UPDATE buses SET status = 'Deleted', route_id = NULL WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  }),
);

router.get(
  '/fares/lookup',
  asyncHandler(async (req, res) => {
    const { routeId, from, to } = req.query;
    if (!routeId || !from || !to) {
      return res.status(400).json({ error: 'routeId, from, and to are required' });
    }
    const { rows } = await query(
      `SELECT fare FROM fares
       WHERE route_id = $1
         AND deleted_at IS NULL
         AND ((from_stop = $2 AND to_stop = $3) OR (from_stop = $3 AND to_stop = $2))
       LIMIT 1`,
      [routeId, from, to],
    );
    if (!rows[0]) return res.status(404).json({ error: 'No fare found for this segment' });
    res.json({ fare: Number(rows[0].fare) });
  }),
);

router.get(
  '/trips/active',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(`
      SELECT t.id, t.route_id, r.name AS route_name, t.bus_id, b.plate AS bus_plate,
             t.conductor_id, t.conductor_name, t.status, t.started_at, t.ended_at,
             r.stops,
             (SELECT COUNT(*)::int FROM tickets tk WHERE tk.trip_id = t.id) AS ticket_count,
             (SELECT COALESCE(SUM(fare), 0)::float FROM tickets tk WHERE tk.trip_id = t.id) AS earnings
      FROM trips t
      JOIN routes r ON r.id = t.route_id
      JOIN buses b ON b.id = t.bus_id
      WHERE t.status = 'Active'
      ORDER BY t.started_at DESC
    `);
    res.json(rows.map(mapTrip));
  }),
);

router.get(
  '/trips',
  asyncHandler(async (req, res) => {
    const date =
      req.query.date ||
      new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const { rows } = await query(
      `
      SELECT t.id, t.route_id, r.name AS route_name, t.bus_id, b.plate AS bus_plate,
             t.conductor_id, t.conductor_name, t.status, t.started_at, t.ended_at,
             r.stops,
             (SELECT COUNT(*)::int FROM tickets tk WHERE tk.trip_id = t.id) AS ticket_count,
             (SELECT COALESCE(SUM(fare), 0)::float FROM tickets tk WHERE tk.trip_id = t.id) AS earnings
      FROM trips t
      JOIN routes r ON r.id = t.route_id
      JOIN buses b ON b.id = t.bus_id
      WHERE t.started_at::date = $1::date
      ORDER BY t.started_at DESC
    `,
      [date],
    );
    res.json(rows.map(mapTrip));
  }),
);

const TRIP_DETAIL_SELECT = `
  SELECT t.id, t.route_id, r.name AS route_name, t.bus_id, b.plate AS bus_plate,
         t.conductor_id, t.conductor_name, t.status, t.started_at, t.ended_at,
         r.stops,
         (SELECT COUNT(*)::int FROM tickets tk WHERE tk.trip_id = t.id) AS ticket_count,
         (SELECT COALESCE(SUM(fare), 0)::float FROM tickets tk WHERE tk.trip_id = t.id) AS earnings
  FROM trips t
  JOIN routes r ON r.id = t.route_id
  JOIN buses b ON b.id = t.bus_id
`;

/** Restore an in-progress trip after app reinstall / cleared local storage. */
router.get(
  '/trips/current',
  asyncHandler(async (req, res) => {
    const conductorId = String(req.query.conductorId || '').trim();
    if (!conductorId) {
      return res.status(400).json({ error: 'conductorId is required' });
    }

    const { rows } = await query(
      `${TRIP_DETAIL_SELECT}
       WHERE t.status IN ('Active', 'Pending')
         AND t.conductor_id = $1
       ORDER BY t.started_at DESC
       LIMIT 1`,
      [conductorId],
    );

    if (!rows[0]) {
      return res.json({ trip: null, tickets: [] });
    }

    const tickets = await query(
      `SELECT id, trip_id, route_id, from_stop, to_stop, fare, base_fare, discount_applied,
              issued_at, conductor_name, bus_id
       FROM tickets
       WHERE trip_id = $1
       ORDER BY issued_at DESC`,
      [rows[0].id],
    );

    res.json({
      trip: mapTrip(rows[0]),
      tickets: tickets.rows.map(mapTicket),
    });
  }),
);

router.get(
  '/trips/pending',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(`
      ${TRIP_DETAIL_SELECT}
      WHERE t.status = 'Pending'
      ORDER BY t.started_at ASC
    `);
    res.json(rows.map(mapTrip));
  }),
);

router.post(
  '/trips',
  asyncHandler(async (req, res) => {
    const { routeId, busId, conductorId, conductorName } = req.body ?? {};
    if (!routeId || !busId || !conductorId) {
      return res.status(400).json({ error: 'routeId, busId, and conductorId are required' });
    }

    const [routeResult, busResult, conductorResult, openTrip] = await Promise.all([
      query(`SELECT id, name, stops FROM routes WHERE id = $1 AND status = 'Active'`, [routeId]),
      query('SELECT id, plate, status FROM buses WHERE id = $1', [busId]),
      query(`SELECT id, name FROM employees WHERE id = $1 AND status <> 'Deleted'`, [conductorId]),
      query(
        `SELECT id FROM trips
         WHERE status IN ('Active', 'Pending') AND (conductor_id = $1 OR bus_id = $2)
         LIMIT 1`,
        [conductorId, busId],
      ),
    ]);

    if (!routeResult.rows[0]) return res.status(404).json({ error: 'Route not found' });
    if (!busResult.rows[0]) return res.status(404).json({ error: 'Bus not found' });
    if (!conductorResult.rows[0]) return res.status(404).json({ error: 'Conductor not found' });
    if (busResult.rows[0].status !== 'Available') {
      return res.status(409).json({ error: 'Bus is not available' });
    }
    if (openTrip.rows[0]) {
      return res.status(409).json({ error: 'Conductor or bus already has an active or pending trip' });
    }

    const { rows: next } = await query(`
      SELECT 'TRIP-' || TO_CHAR(NOW(), 'YYMMDD') || '-' ||
             LPAD((COALESCE(MAX(SUBSTRING(id FROM 13)::int), 0) + 1)::text, 3, '0') AS id
      FROM trips
      WHERE id ~ ('^TRIP-' || TO_CHAR(NOW(), 'YYMMDD') || '-[0-9]+$')
    `);

    const id = next[0].id;
    const name = conductorName || conductorResult.rows[0].name;

    const { rows } = await query(
      `INSERT INTO trips (id, route_id, bus_id, conductor_id, conductor_name, status)
       VALUES ($1, $2, $3, $4, $5, 'Pending')
       RETURNING id, route_id, bus_id, conductor_id, conductor_name, status, started_at, ended_at`,
      [id, routeId, busId, conductorId, name],
    );

    res.status(201).json(
      mapTrip({
        ...rows[0],
        route_name: routeResult.rows[0].name,
        bus_plate: busResult.rows[0].plate,
        stops: routeResult.rows[0].stops,
        ticket_count: 0,
        earnings: 0,
      }),
    );
  }),
);

router.get(
  '/trips/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `${TRIP_DETAIL_SELECT}
       WHERE t.id = $1`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Trip not found' });
    res.json(mapTrip(rows[0]));
  }),
);

router.post(
  '/trips/:id/approve',
  asyncHandler(async (req, res) => {
    await query('BEGIN');
    try {
      const { rows } = await query(
        `UPDATE trips
         SET status = 'Active', started_at = NOW()
         WHERE id = $1 AND status = 'Pending'
         RETURNING id, route_id, bus_id, conductor_id, conductor_name, status, started_at, ended_at`,
        [req.params.id],
      );
      if (!rows[0]) {
        await query('ROLLBACK');
        return res.status(404).json({ error: 'Pending trip not found' });
      }

      const busCheck = await query(`SELECT id, plate, status FROM buses WHERE id = $1`, [rows[0].bus_id]);
      if (!busCheck.rows[0] || busCheck.rows[0].status !== 'Available') {
        await query('ROLLBACK');
        return res.status(409).json({ error: 'Bus is no longer available' });
      }

      await query(`UPDATE buses SET status = 'On Trip', route_id = $2 WHERE id = $1`, [
        rows[0].bus_id,
        rows[0].route_id,
      ]);

      const detail = await query(
        `${TRIP_DETAIL_SELECT}
         WHERE t.id = $1`,
        [rows[0].id],
      );
      await query('COMMIT');
      res.json(mapTrip(detail.rows[0]));
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  }),
);

router.post(
  '/trips/:id/reject',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE trips
       SET status = 'Rejected', ended_at = NOW()
       WHERE id = $1 AND status = 'Pending'
       RETURNING id, status`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pending trip not found' });
    res.json({ ok: true, id: rows[0].id, status: rows[0].status });
  }),
);

router.post(
  '/trips/:id/end',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE trips
       SET status = 'Ended', ended_at = NOW()
       WHERE id = $1 AND status = 'Active'
       RETURNING id, bus_id`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Active trip not found' });
    await query(`UPDATE buses SET status = 'Available' WHERE id = $1`, [rows[0].bus_id]);
    res.json({ ok: true, id: rows[0].id });
  }),
);

router.get(
  '/tickets',
  asyncHandler(async (req, res) => {
    const date = req.query.date;
    const params = [];
    let where = '';
    if (date) {
      params.push(date);
      where = 'WHERE issued_at::date = $1::date';
    }
    const { rows } = await query(
      `SELECT id, trip_id, route_id, from_stop, to_stop, fare, base_fare, discount_applied,
              issued_at, conductor_name, bus_id
       FROM tickets
       ${where}
       ORDER BY issued_at DESC
       LIMIT 100`,
      params,
    );
    res.json(rows.map(mapTicket));
  }),
);

router.post(
  '/tickets',
  asyncHandler(async (req, res) => {
    const { tripId, from, to, fare, baseFare, discountApplied } = req.body ?? {};
    if (!tripId || !from || !to || fare == null) {
      return res.status(400).json({ error: 'tripId, from, to, and fare are required' });
    }

    const { rows: tripRows } = await query(
      `SELECT t.id, t.route_id, t.bus_id, t.conductor_id, t.conductor_name, t.status
       FROM trips t
       WHERE t.id = $1`,
      [tripId],
    );
    const trip = tripRows[0];
    if (!trip || trip.status !== 'Active') {
      return res.status(404).json({ error: 'Active trip not found' });
    }

    const { rows: conductorRows } = await query(
      `SELECT id FROM employees WHERE id = $1 AND status <> 'Deleted'`,
      [trip.conductor_id],
    );
    if (!conductorRows[0]) {
      return res.status(404).json({ error: 'Conductor not found' });
    }

    const { rows: next } = await query(`
      SELECT 'TKT-' || LPAD((COALESCE(MAX(SUBSTRING(id FROM 5)::int), 1000) + 1)::text, 4, '0') AS id
      FROM tickets
      WHERE id ~ '^TKT-[0-9]+$'
    `);

    const { rows } = await query(
      `INSERT INTO tickets
         (id, trip_id, route_id, from_stop, to_stop, fare, base_fare, discount_applied, conductor_name, bus_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, trip_id, route_id, from_stop, to_stop, fare, base_fare, discount_applied,
                 issued_at, conductor_name, bus_id`,
      [
        next[0].id,
        tripId,
        trip.route_id,
        from,
        to,
        Number(fare),
        baseFare == null ? Number(fare) : Number(baseFare),
        Boolean(discountApplied),
        trip.conductor_name,
        trip.bus_id,
      ],
    );

    res.status(201).json(mapTicket(rows[0]));
  }),
);

router.get(
  '/reports/summary',
  asyncHandler(async (req, res) => {
    const date =
      req.query.date ||
      new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const type = ['daily', 'trip', 'conductor'].includes(req.query.type)
      ? req.query.type
      : 'daily';

    const [ticketStats, tripCount] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::int AS tickets_sold,
           COALESCE(SUM(fare), 0)::float AS gross_revenue
         FROM tickets
         WHERE issued_at::date = $1::date`,
        [date],
      ),
      query(
        `SELECT COUNT(*)::int AS trips
         FROM trips
         WHERE started_at::date = $1::date
           AND status IN ('Active', 'Ended', 'Pending')`,
        [date],
      ),
    ]);

    const baseStats = {
      todayTrips: tripCount.rows[0].trips,
      ticketsSold: ticketStats.rows[0].tickets_sold,
      totalRevenue: ticketStats.rows[0].gross_revenue,
    };

    if (type === 'trip') {
      const { rows } = await query(
        `
        SELECT t.id, r.name AS route_name, t.bus_id, b.plate AS bus_plate,
               t.conductor_name, t.status, t.started_at, t.ended_at,
               (SELECT COUNT(*)::int FROM tickets tk WHERE tk.trip_id = t.id) AS ticket_count,
               (SELECT COALESCE(SUM(fare), 0)::float FROM tickets tk WHERE tk.trip_id = t.id) AS earnings
        FROM trips t
        JOIN routes r ON r.id = t.route_id
        JOIN buses b ON b.id = t.bus_id
        WHERE t.started_at::date = $1::date
          AND t.status IN ('Active', 'Ended', 'Pending')
        ORDER BY t.started_at DESC
      `,
        [date],
      );

      return res.json({
        date,
        type,
        title: 'Per-Trip Performance',
        stats: baseStats,
        rows: rows.map((row) => ({
          tripId: row.id,
          route: row.route_name,
          bus: `${row.bus_id} · ${row.bus_plate}`,
          conductor: row.conductor_name,
          tickets: Number(row.ticket_count || 0),
          earnings: Number(row.earnings || 0),
          status: row.status,
        })),
      });
    }

    if (type === 'conductor') {
      const { rows } = await query(
        `
        SELECT
          COALESCE(t.conductor_name, 'Unknown') AS conductor,
          COALESCE(t.conductor_id, '—') AS conductor_id,
          COUNT(DISTINCT t.id)::int AS trips,
          COUNT(tk.id)::int AS tickets,
          COALESCE(SUM(tk.fare), 0)::float AS revenue
        FROM trips t
        LEFT JOIN tickets tk ON tk.trip_id = t.id
        WHERE t.started_at::date = $1::date
          AND t.status IN ('Active', 'Ended', 'Pending')
        GROUP BY t.conductor_id, t.conductor_name
        ORDER BY revenue DESC, conductor ASC
      `,
        [date],
      );

      return res.json({
        date,
        type,
        title: 'Conductor Collection Report',
        stats: {
          ...baseStats,
          conductors: rows.length,
        },
        rows: rows.map((row) => ({
          conductor: row.conductor,
          conductorId: row.conductor_id,
          trips: Number(row.trips || 0),
          tickets: Number(row.tickets || 0),
          revenue: Number(row.revenue || 0),
        })),
      });
    }

    const { rows: tickets } = await query(
      `SELECT id, trip_id, route_id, from_stop, to_stop, fare, base_fare, discount_applied,
              issued_at, conductor_name, bus_id
       FROM tickets
       WHERE issued_at::date = $1::date
       ORDER BY issued_at`,
      [date],
    );

    res.json({
      date,
      type: 'daily',
      title: 'Daily Earnings Summary',
      stats: baseStats,
      tickets: tickets.map(mapTicket),
      rows: tickets.map((row) => {
        const ticket = mapTicket(row);
        return {
          ticketId: ticket.id,
          segment: `${ticket.from} → ${ticket.to}`,
          fare: ticket.fare,
          conductor: ticket.conductor,
          time: ticket.time,
        };
      }),
    });
  }),
);

router.get(
  '/issue-reports',
  asyncHandler(async (req, res) => {
    const date =
      req.query.date ||
      new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const { rows } = await query(
      `SELECT id, reporter_id, reporter_name, trip_id, trip_label, category, description, created_at
       FROM issue_reports
       WHERE created_at::date = $1::date
       ORDER BY created_at DESC
       LIMIT 100`,
      [date],
    );
    res.json(rows.map(mapIssueReport));
  }),
);

router.post(
  '/issue-reports',
  asyncHandler(async (req, res) => {
    const {
      reporterId,
      reporterName,
      tripId = null,
      tripLabel = '—',
      category,
      description,
    } = req.body ?? {};

    if (!reporterName?.trim() || !category?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'Reported by, category, and description are required' });
    }

    if (!reporterId) {
      return res.status(400).json({ error: 'reporterId is required' });
    }

    const { rows: conductorRows } = await query(
      `SELECT id FROM employees WHERE id = $1 AND status <> 'Deleted'`,
      [reporterId],
    );
    if (!conductorRows[0]) {
      return res.status(404).json({ error: 'Conductor not found' });
    }

    const { rows: next } = await query(`
      SELECT 'RPT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' ||
             LPAD((COALESCE(MAX(SUBSTRING(id FROM 13)::int), 0) + 1)::text, 3, '0') AS id
      FROM issue_reports
      WHERE id ~ ('^RPT-' || TO_CHAR(NOW(), 'YYMMDD') || '-[0-9]+$')
    `);

    const id = next[0].id;
    const { rows } = await query(
      `INSERT INTO issue_reports
         (id, reporter_id, reporter_name, trip_id, trip_label, category, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, reporter_id, reporter_name, trip_id, trip_label, category, description, created_at`,
      [
        id,
        reporterId || null,
        reporterName.trim(),
        tripId || null,
        tripLabel?.trim() || '—',
        category.trim(),
        description.trim(),
      ],
    );

    res.status(201).json(mapIssueReport(rows[0]));
  }),
);

export default router;
