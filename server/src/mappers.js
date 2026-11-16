export function mapEmployee(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    route: row.assigned_route,
    status: row.status,
  };
}

export function mapRoute(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    stops: row.stops,
    distanceKm: Number(row.distance_km),
    status: row.status,
  };
}

export function mapFare(row) {
  return {
    id: row.id,
    routeId: row.route_id,
    from: row.from_stop,
    to: row.to_stop,
    fare: Number(row.fare),
  };
}

export function mapBus(row) {
  return {
    id: row.id,
    plate: row.plate,
    routeId: row.route_id,
    capacity: row.capacity,
    status: row.status,
  };
}

export function mapTicket(row) {
  return {
    id: row.id,
    tripId: row.trip_id,
    routeId: row.route_id,
    from: row.from_stop,
    to: row.to_stop,
    fare: Number(row.fare),
    baseFare: row.base_fare == null ? null : Number(row.base_fare),
    discountApplied: Boolean(row.discount_applied),
    time: new Date(row.issued_at).toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    }),
    issuedAt: row.issued_at,
    conductor: row.conductor_name,
    busId: row.bus_id,
  };
}

export function mapTrip(row) {
  return {
    id: row.id,
    routeId: row.route_id,
    routeName: row.route_name,
    busId: row.bus_id,
    busPlate: row.bus_plate,
    conductorId: row.conductor_id,
    conductorName: row.conductor_name,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    ticketCount: Number(row.ticket_count || 0),
    earnings: Number(row.earnings || 0),
    stops: row.stops || [],
  };
}

export function mapIssueReport(row) {
  return {
    id: row.id,
    reportedBy: row.reporter_name,
    reporterId: row.reporter_id,
    tripFrom: row.trip_label || '—',
    tripId: row.trip_id,
    category: row.category,
    description: row.description,
    createdAt: row.created_at,
    time: new Date(row.created_at).toLocaleString('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Manila',
    }),
  };
}
