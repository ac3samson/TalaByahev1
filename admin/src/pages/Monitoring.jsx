import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';
import PageState from '../components/PageState';

function todayInManila() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

function formatTripTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
}

function DateFilter({ id, open, date, onToggle, onChange, onClose }) {
  const filtered = date !== todayInManila();
  return (
    <div className="card-filter">
      <button
        type="button"
        className={`card-filter-btn${open || filtered ? ' active' : ''}`}
        onClick={onToggle}
        aria-label="Filter by date"
        title={filtered ? `Showing ${date}` : 'Filter by date'}
      >
        <i className="fa-solid fa-filter" aria-hidden="true" />
      </button>
      {open && (
        <div className="card-filter-popover">
          <label htmlFor={id}>Date</label>
          <input
            id={id}
            type="date"
            value={date}
            onChange={(e) => onChange(e.target.value)}
          />
          <button type="button" className="btn-ghost" onClick={onClose}>
            Okay
          </button>
        </div>
      )}
    </div>
  );
}

export default function Monitoring() {
  const [dashboard, setDashboard] = useState(null);
  const [buses, setBuses] = useState([]);
  const [trips, setTrips] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [tripDate, setTripDate] = useState(todayInManila);
  const [ticketDate, setTicketDate] = useState(todayInManila);
  const [tripFilterOpen, setTripFilterOpen] = useState(false);
  const [ticketFilterOpen, setTicketFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingBus, setEditingBus] = useState(null);
  const [editView, setEditView] = useState('details');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [showEditAdminPassword, setShowEditAdminPassword] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingBus, setDeletingBus] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadBase = async () => {
      try {
        const [dash, busRows] = await Promise.all([
          api.dashboard(),
          api.buses.list(),
        ]);
        if (cancelled) return;
        setDashboard(dash);
        setBuses(busRows);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadBase();
    const id = setInterval(loadBase, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadTrips = () => {
      api.trips
        .list(tripDate)
        .then((rows) => {
          if (!cancelled) setTrips(rows);
        })
        .catch((err) => {
          if (!cancelled) setError(err.message);
        });
    };
    loadTrips();
    const id = setInterval(loadTrips, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tripDate]);

  useEffect(() => {
    let cancelled = false;
    const loadTickets = () => {
      api.tickets
        .list(ticketDate)
        .then((rows) => {
          if (!cancelled) setTickets(rows);
        })
        .catch((err) => {
          if (!cancelled) setError(err.message);
        });
    };
    loadTickets();
    const id = setInterval(loadTickets, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ticketDate]);

  const openEditBus = (bus) => {
    setEditingBus({ ...bus });
    setEditView('details');
    setEditAdminPassword('');
    setShowEditAdminPassword(false);
    setEditError('');
  };

  const closeEditBus = (force = false) => {
    if (saving && !force) return;
    setEditingBus(null);
    setEditView('details');
    setEditAdminPassword('');
    setShowEditAdminPassword(false);
    setEditError('');
  };

  const openSaveConfirm = (e) => {
    e.preventDefault();
    setEditView('confirm-save');
    setEditAdminPassword('');
    setShowEditAdminPassword(false);
    setEditError('');
  };

  const backToDetailsView = () => {
    if (saving) return;
    setEditView('details');
    setEditAdminPassword('');
    setShowEditAdminPassword(false);
    setEditError('');
  };

  const saveBus = async (e) => {
    e.preventDefault();
    setSaving(true);
    setEditError('');
    try {
      const updated = await api.buses.update(editingBus.id, {
        plate: editingBus.plate,
        adminPassword: editAdminPassword,
      });
      setBuses((prev) => prev.map((bus) => (bus.id === updated.id ? updated : bus)));
      setError(null);
      setSaving(false);
      closeEditBus(true);
    } catch (err) {
      setEditError(err.message || 'Could not save bus');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteBus = (bus) => {
    setDeletingBus(bus);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError('');
  };

  const closeDeleteBus = () => {
    if (deleting) return;
    setDeletingBus(null);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError('');
  };

  const confirmDeleteBus = async (e) => {
    e.preventDefault();
    if (!deletingBus) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.buses.remove(deletingBus.id, deletePassword);
      setBuses((prev) => prev.filter((bus) => bus.id !== deletingBus.id));
      if (editingBus?.id === deletingBus.id) closeEditBus(true);
      setDeletingBus(null);
      setDeletePassword('');
      setError(null);
    } catch (err) {
      setDeleteError(err.message || 'Could not delete bus');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Monitoring</h2>
      </div>
      <PageState loading={loading && !dashboard} error={!dashboard ? error : null}>
        {dashboard && (
          <>
            {error && <div className="page-state error" style={{ marginBottom: '1rem' }}>{error}</div>}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="label">Today&apos;s Trips</div>
                <div className="value">{dashboard.stats.todayTrips}</div>
              </div>
              <div className="stat-card">
                <div className="label">Tickets Today</div>
                <div className="value">{dashboard.stats.ticketsSold}</div>
              </div>
              <div className="stat-card">
                <div className="label">Revenue Today</div>
                <div className="value">₱{Number(dashboard.stats.totalRevenue || 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-header-row">
                <h3>Trip Summary</h3>
                <DateFilter
                  id="trip-summary-date"
                  open={tripFilterOpen}
                  date={tripDate}
                  onToggle={() => {
                    setTripFilterOpen((open) => !open);
                    setTicketFilterOpen(false);
                  }}
                  onChange={setTripDate}
                  onClose={() => setTripFilterOpen(false)}
                />
              </div>
              {trips.length ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Trip</th>
                      <th>Route</th>
                      <th>Bus</th>
                      <th>Conductor</th>
                      <th>Started</th>
                      <th>Ended</th>
                      <th>Tickets</th>
                      <th>Earnings</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map((trip) => (
                      <tr key={trip.id}>
                        <td>{trip.id}</td>
                        <td>{trip.routeName}</td>
                        <td>
                          {trip.busId} · {trip.busPlate}
                        </td>
                        <td>{trip.conductorName}</td>
                        <td>{formatTripTime(trip.startedAt)}</td>
                        <td>{formatTripTime(trip.endedAt)}</td>
                        <td>{trip.ticketCount}</td>
                        <td>₱{Number(trip.earnings || 0).toLocaleString()}</td>
                        <td>
                          <span className="badge">{trip.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="confirm-copy">No trips found for this date.</p>
              )}
            </div>

            <div className="card">
              <div className="card-header-row">
                <h3>Ticket Activity</h3>
                <DateFilter
                  id="ticket-activity-date"
                  open={ticketFilterOpen}
                  date={ticketDate}
                  onToggle={() => {
                    setTicketFilterOpen((open) => !open);
                    setTripFilterOpen(false);
                  }}
                  onChange={setTicketDate}
                  onClose={() => setTicketFilterOpen(false)}
                />
              </div>
              {tickets.length ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ticket ID</th>
                      <th>Route</th>
                      <th>From → To</th>
                      <th>Fare</th>
                      <th>Time</th>
                      <th>Conductor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id}>
                        <td>{t.id}</td>
                        <td>{t.routeId}</td>
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
                <p className="confirm-copy">No tickets found for this date.</p>
              )}
            </div>

            <div className="card">
              <h3>Buses</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Bus ID</th>
                    <th>Plate</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {buses.map((b) => (
                    <tr key={b.id}>
                      <td>{b.id}</td>
                      <td>{b.plate}</td>
                      <td>
                        <span className="badge">{b.status}</span>
                      </td>
                      <td className="table-actions">
                        <div className="table-action-group">
                          <button type="button" className="icon-btn" aria-label={`Edit ${b.id}`} onClick={() => openEditBus(b)}>
                            <i className="fa-solid fa-pencil" aria-hidden="true" />
                          </button>
                          <button type="button" className="icon-btn icon-btn-danger" aria-label={`Delete ${b.id}`} onClick={() => openDeleteBus(b)}>
                            <i className="fa-solid fa-trash-can" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PageState>

      {editingBus && editView === 'details' && (
        <Modal title="Edit Bus" onClose={closeEditBus}>
          <form className="modal-form" onSubmit={openSaveConfirm}>
            <div className="form-group">
              <label>Bus ID</label>
              <input value={editingBus.id} disabled />
            </div>
            <div className="form-group">
              <label>Plate</label>
              <input
                value={editingBus.plate}
                onChange={(e) => setEditingBus({ ...editingBus, plate: e.target.value })}
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={closeEditBus} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingBus && editView === 'confirm-save' && (
        <Modal
          title={
            <span className="modal-title-with-back">
              <button type="button" className="modal-back-btn" onClick={backToDetailsView} aria-label="Go back">
                <i className="fa-solid fa-arrow-left" aria-hidden="true" />
              </button>
              Confirm Changes
            </span>
          }
          onClose={closeEditBus}
        >
          <form className="modal-form" onSubmit={saveBus}>
            <p className="confirm-copy">Enter the admin password to save changes to this bus.</p>
            <div className="form-group">
              <label>Admin Password</label>
              <div className="password-field">
                <input
                  type={showEditAdminPassword ? 'text' : 'password'}
                  value={editAdminPassword}
                  onChange={(e) => setEditAdminPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  autoFocus
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowEditAdminPassword((prev) => !prev)}
                  aria-label={showEditAdminPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fa-solid ${showEditAdminPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
                </button>
              </div>
            </div>
            {editError && <p className="login-error">{editError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={backToDetailsView} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Confirm Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deletingBus && (
        <Modal title="Delete Bus" onClose={closeDeleteBus}>
          <form className="modal-form" onSubmit={confirmDeleteBus}>
            <p className="confirm-copy">
              Delete <strong>{deletingBus.id}</strong> ({deletingBus.plate})? Enter the admin password to confirm.
            </p>
            <div className="form-group">
              <label htmlFor="delete-bus-password">Password</label>
              <div className="password-field">
                <input
                  id="delete-bus-password"
                  type={showDeletePassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowDeletePassword((prev) => !prev)}
                  aria-label={showDeletePassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fa-solid ${showDeletePassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
                </button>
              </div>
            </div>
            {deleteError && <p className="login-error">{deleteError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={closeDeleteBus} disabled={deleting}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
