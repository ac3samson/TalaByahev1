import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';
import PageState from '../components/PageState';

const emptyFareForm = { routeId: '', from: '', to: '', fare: '', adminPassword: '' };

export default function Fares() {
  const [fares, setFares] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyFareForm);
  const [showForm, setShowForm] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingFare, setEditingFare] = useState(null);
  const [deletingFare, setDeletingFare] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const stopsForRoute = (routeId, routeRows = routes) =>
    routeRows.find((r) => r.id === routeId)?.stops || [];

  const buildFormFromRoutes = (routeRows, prev = emptyFareForm) => {
    const routeId = prev.routeId || routeRows[0]?.id || '';
    const stops = stopsForRoute(routeId, routeRows);
    const from = stops.includes(prev.from) ? prev.from : stops[0] || '';
    const toCandidates = stops.filter((stop) => stop !== from);
    const to = toCandidates.includes(prev.to) ? prev.to : toCandidates[0] || '';
    return {
      ...emptyFareForm,
      routeId,
      from,
      to,
      fare: prev.fare || '',
      adminPassword: '',
    };
  };

  const load = async () => {
    setLoading(true);
    try {
      const [fareRows, routeRows] = await Promise.all([api.fares.list(), api.routes.list()]);
      setFares(fareRows);
      setRoutes(routeRows);
      setForm((prev) => buildFormFromRoutes(routeRows, prev));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Keep route stops fresh when returning to this tab without blocking the UI.
  useEffect(() => {
    const refreshRoutesQuietly = () => {
      api.routes
        .list()
        .then((routeRows) => {
          setRoutes(routeRows);
          setForm((prev) => {
            const stops = stopsForRoute(prev.routeId || routeRows[0]?.id || '', routeRows);
            if (!stops.length) return prev;
            const routeId = prev.routeId || routeRows[0]?.id || '';
            const from = stops.includes(prev.from) ? prev.from : stops[0] || '';
            const toCandidates = stops.filter((stop) => stop !== from);
            const to = toCandidates.includes(prev.to) ? prev.to : toCandidates[0] || '';
            return { ...prev, routeId, from, to };
          });
        })
        .catch(() => {});
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshRoutesQuietly();
    };

    window.addEventListener('focus', refreshRoutesQuietly);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refreshRoutesQuietly);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const formStops = useMemo(() => stopsForRoute(form.routeId), [routes, form.routeId]);

  const routeName = (id) => routes.find((r) => r.id === id)?.name ?? id;

  const setFormRoute = (routeId) => {
    const stops = stopsForRoute(routeId);
    const from = stops[0] || '';
    const to = stops.find((stop) => stop !== from) || '';
    setForm({
      ...form,
      routeId,
      from,
      to,
    });
    setFormError('');
  };

  const openAddForm = () => {
    if (showForm) {
      setShowForm(false);
      setShowAdminPassword(false);
      setFormError('');
      return;
    }

    // Open instantly with cached routes; refresh stops in the background.
    setForm(buildFormFromRoutes(routes));
    setShowAdminPassword(false);
    setFormError('');
    setShowForm(true);

    api.routes
      .list()
      .then((routeRows) => {
        setRoutes(routeRows);
        setForm((prev) => {
          const stops = stopsForRoute(prev.routeId || routeRows[0]?.id || '', routeRows);
          const routeId = prev.routeId || routeRows[0]?.id || '';
          const from = stops.includes(prev.from) ? prev.from : stops[0] || '';
          const toCandidates = stops.filter((stop) => stop !== from);
          const to = toCandidates.includes(prev.to) ? prev.to : toCandidates[0] || '';
          return { ...prev, routeId, from, to };
        });
      })
      .catch(() => {});
  };

  const addFare = async (e) => {
    e.preventDefault();
    if (form.from === form.to) {
      setFormError('From and To stops must be different');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const created = await api.fares.create({
        routeId: form.routeId,
        from: form.from,
        to: form.to,
        fare: Number(form.fare),
        adminPassword: form.adminPassword,
      });
      setFares((prev) => [...prev, created]);
      setForm(buildFormFromRoutes(routes));
      setShowAdminPassword(false);
      setShowForm(false);
      setError(null);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveFare = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.fares.update(editingFare.id, editingFare);
      setFares((prev) => prev.map((fare) => (fare.id === updated.id ? updated : fare)));
      setEditingFare(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (fare) => {
    setDeletingFare(fare);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError('');
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeletingFare(null);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError('');
  };

  const confirmDeleteFare = async (e) => {
    e.preventDefault();
    if (!deletingFare) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.fares.remove(deletingFare.id, deletePassword);
      setFares((prev) => prev.filter((item) => item.id !== deletingFare.id));
      if (editingFare?.id === deletingFare.id) setEditingFare(null);
      setDeletingFare(null);
      setDeletePassword('');
      setError(null);
    } catch (err) {
      setDeleteError(err.message || 'Could not delete fare');
    } finally {
      setDeleting(false);
    }
  };

  const sameStop = form.from && form.to && form.from === form.to;

  return (
    <div>
      <div className="page-header">
        <h2>Fares</h2>
      </div>
      {!loading && error && <div className="page-state error" style={{ marginBottom: '1rem' }}>{error}</div>}
      <PageState loading={loading} error={loading ? error : null}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Fare Matrix</h3>
            <button type="button" className="btn-primary" onClick={openAddForm}>
              {showForm ? 'Cancel' : '+ Add Fare'}
            </button>
          </div>
          {showForm && (
            <form onSubmit={addFare} style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--gray-50)', borderRadius: '10px' }}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Route</label>
                  <select value={form.routeId} onChange={(e) => setFormRoute(e.target.value)} required>
                    {routes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>From</label>
                  <select
                    value={form.from}
                    onChange={(e) => {
                      const from = e.target.value;
                      const nextTo = form.to === from
                        ? formStops.find((stop) => stop !== from) || ''
                        : form.to;
                      setForm({ ...form, from, to: nextTo });
                      setFormError('');
                    }}
                    required
                    disabled={!formStops.length}
                  >
                    {formStops.length === 0 && <option value="">No stops on this route</option>}
                    {formStops.map((stop) => (
                      <option key={`from-${stop}`} value={stop}>
                        {stop}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>To</label>
                  <select
                    value={form.to}
                    onChange={(e) => {
                      setForm({ ...form, to: e.target.value });
                      setFormError('');
                    }}
                    required
                    disabled={!formStops.length}
                  >
                    {formStops.length === 0 && <option value="">No stops on this route</option>}
                    {formStops.map((stop) => (
                      <option key={`to-${stop}`} value={stop}>
                        {stop}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Fare (₱)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.fare}
                    onChange={(e) => setForm({ ...form, fare: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Admin Password</label>
                  <div className="password-field">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      value={form.adminPassword}
                      onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowAdminPassword((prev) => !prev)}
                      aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                    >
                      <i className={`fa-solid ${showAdminPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
              {sameStop && <p className="login-error" style={{ marginTop: '0.75rem' }}>From and To stops must be different</p>}
              {formError && !sameStop && <p className="login-error" style={{ marginTop: '0.75rem' }}>{formError}</p>}
              <button
                type="submit"
                className="btn-secondary"
                style={{ marginTop: '1rem' }}
                disabled={saving || !formStops.length || sameStop}
              >
                {saving ? 'Saving…' : 'Save Fare'}
              </button>
            </form>
          )}
          <table className="table">
            <thead>
              <tr>
                <th>Route</th>
                <th>From</th>
                <th>To</th>
                <th>Fare (₱)</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {fares.map((f) => (
                <tr key={f.id}>
                  <td>{routeName(f.routeId)}</td>
                  <td>{f.from}</td>
                  <td>{f.to}</td>
                  <td>₱{f.fare}</td>
                  <td className="table-actions">
                    <div className="table-action-group">
                      <button type="button" className="icon-btn" aria-label={`Edit fare ${f.from} to ${f.to}`} onClick={() => setEditingFare({ ...f })}>
                        <i className="fa-solid fa-pencil" aria-hidden="true" />
                      </button>
                      <button type="button" className="icon-btn icon-btn-danger" aria-label={`Delete fare ${f.from} to ${f.to}`} onClick={() => openDelete(f)}>
                        <i className="fa-solid fa-trash-can" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageState>

      {editingFare && (
        <Modal title="Edit Fare" onClose={() => setEditingFare(null)}>
          <form className="modal-form" onSubmit={saveFare}>
            <div className="form-group">
              <label>Route</label>
              <select value={editingFare.routeId} onChange={(e) => setEditingFare({ ...editingFare, routeId: e.target.value })}>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>From</label>
              <input value={editingFare.from} onChange={(e) => setEditingFare({ ...editingFare, from: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>To</label>
              <input value={editingFare.to} onChange={(e) => setEditingFare({ ...editingFare, to: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Fare (₱)</label>
              <input
                type="number"
                min="0"
                value={editingFare.fare}
                onChange={(e) => setEditingFare({ ...editingFare, fare: Number(e.target.value) })}
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setEditingFare(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deletingFare && (
        <Modal title="Delete Fare" onClose={closeDelete}>
          <form className="modal-form" onSubmit={confirmDeleteFare}>
            <p className="confirm-copy">
              Delete fare from <strong>{deletingFare.from}</strong> to <strong>{deletingFare.to}</strong>? Enter the admin password to confirm.
            </p>
            <div className="form-group">
              <label htmlFor="delete-fare-password">Password</label>
              <div className="password-field">
                <input
                  id="delete-fare-password"
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
              <button type="button" className="btn-ghost" onClick={closeDelete} disabled={deleting}>
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
