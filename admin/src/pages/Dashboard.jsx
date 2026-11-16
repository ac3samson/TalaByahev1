import { useEffect, useState } from 'react';
import { api } from '../api';
import PageState from '../components/PageState';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const payload = await api.dashboard();
        if (cancelled) return;
        setData(payload);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>
      <PageState loading={loading && !data} error={!data ? error : null}>
        {data && (
          <>
            {error && <div className="page-state error" style={{ marginBottom: '1rem' }}>{error}</div>}
            <div className="stats-grid">
              {[
                { label: "Today's Trips", value: data.stats.todayTrips },
                { label: 'Tickets Sold', value: data.stats.ticketsSold },
                { label: 'Revenue (₱)', value: Number(data.stats.totalRevenue || 0).toLocaleString() },
                { label: 'Active Trips', value: data.stats.activeTrips },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <div className="label">{s.label}</div>
                  <div className="value">{s.value}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <h3>Active Trips</h3>
              {data.activeTrips?.length ? (
                <div className="active-trip-list">
                  {data.activeTrips.map((trip) => {
                    const tripTickets = (data.activeTickets || []).filter((ticket) => ticket.tripId === trip.id);
                    return (
                      <div key={trip.id} className="active-trip-block">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Trip</th>
                              <th>Route</th>
                              <th>Bus</th>
                              <th>Conductor</th>
                              <th>Tickets</th>
                              <th>Earnings</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>{trip.id}</td>
                              <td>{trip.routeName}</td>
                              <td>
                                {trip.busId} · {trip.busPlate}
                              </td>
                              <td>{trip.conductorName}</td>
                              <td>{trip.ticketCount}</td>
                              <td>₱{Number(trip.earnings || 0).toLocaleString()}</td>
                            </tr>
                          </tbody>
                        </table>

                        <div className="trip-tickets">
                          <h4>Tickets Issued</h4>
                          {tripTickets.length ? (
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Ticket ID</th>
                                  <th>From → To</th>
                                  <th>Fare</th>
                                  <th>Time</th>
                                  <th>Conductor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tripTickets.map((t) => (
                                  <tr key={t.id}>
                                    <td>{t.id}</td>
                                    <td>
                                      {t.from} → {t.to}
                                    </td>
                                    <td>₱{t.fare}</td>
                                    <td>{t.time}</td>
                                    <td>{t.conductor}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="confirm-copy">No tickets issued on this trip yet.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="confirm-copy">No active trips yet.</p>
              )}
            </div>
          </>
        )}
      </PageState>
    </div>
  );
}
