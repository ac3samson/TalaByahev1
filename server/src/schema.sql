CREATE TABLE IF NOT EXISTS company (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  stops JSONB NOT NULL DEFAULT '[]'::jsonb,
  distance_km NUMERIC(10, 1) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Deleted'))
);

ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_status_check;
ALTER TABLE routes ADD CONSTRAINT routes_status_check
  CHECK (status IN ('Active', 'Inactive', 'Deleted'));

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Conductor', 'Driver')),
  assigned_route TEXT NOT NULL DEFAULT '—',
  status TEXT NOT NULL DEFAULT 'Inactive' CHECK (status IN ('Active', 'Inactive', 'Deleted')),
  password TEXT NOT NULL DEFAULT '',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE employees ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_status_check;
ALTER TABLE employees ADD CONSTRAINT employees_status_check
  CHECK (status IN ('Active', 'Inactive', 'Deleted'));
CREATE INDEX IF NOT EXISTS idx_employees_last_seen ON employees (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS fares (
  id SERIAL PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  from_stop TEXT NOT NULL,
  to_stop TEXT NOT NULL,
  fare NUMERIC(10, 2) NOT NULL CHECK (fare >= 0),
  deleted_at TIMESTAMPTZ,
  UNIQUE (route_id, from_stop, to_stop)
);

ALTER TABLE fares ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE fares DROP CONSTRAINT IF EXISTS fares_route_id_from_stop_to_stop_key;
CREATE UNIQUE INDEX IF NOT EXISTS fares_active_unique
  ON fares (route_id, from_stop, to_stop)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS buses (
  id TEXT PRIMARY KEY,
  plate TEXT NOT NULL UNIQUE,
  route_id TEXT REFERENCES routes(id) ON DELETE SET NULL,
  capacity INTEGER NOT NULL DEFAULT 45 CHECK (capacity > 0),
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'On Trip', 'Maintenance', 'Deleted'))
);

ALTER TABLE buses DROP CONSTRAINT IF EXISTS buses_status_check;
ALTER TABLE buses ADD CONSTRAINT buses_status_check
  CHECK (status IN ('Available', 'On Trip', 'Maintenance', 'Deleted'));

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(id),
  bus_id TEXT NOT NULL REFERENCES buses(id),
  conductor_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  conductor_name TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Active', 'Ended', 'Rejected')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check;
ALTER TABLE trips ADD CONSTRAINT trips_status_check
  CHECK (status IN ('Pending', 'Active', 'Ended', 'Rejected'));

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  route_id TEXT REFERENCES routes(id) ON DELETE SET NULL,
  from_stop TEXT NOT NULL,
  to_stop TEXT NOT NULL,
  fare NUMERIC(10, 2) NOT NULL,
  base_fare NUMERIC(10, 2),
  discount_applied BOOLEAN NOT NULL DEFAULT FALSE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  conductor_name TEXT,
  bus_id TEXT REFERENCES buses(id) ON DELETE SET NULL
);

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS base_fare NUMERIC(10, 2);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS discount_applied BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS issue_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  reporter_name TEXT NOT NULL,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  trip_label TEXT NOT NULL DEFAULT '—',
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_issued_at ON tickets (issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_fares_route ON fares (route_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips (status);
CREATE INDEX IF NOT EXISTS idx_trips_started_at ON trips (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_reports_created_at ON issue_reports (created_at DESC);
