import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';
import PageState from '../components/PageState';

const emptyRouteForm = { name: '', code: '', stops: '', distanceKm: '', adminPassword: '' };

function parseStops(value) {
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyRouteForm);
  const [showForm, setShowForm] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingRoute, setEditingRoute] = useState(null);
  const [editView, setEditView] = useState('details');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [showEditAdminPassword, setShowEditAdminPassword] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingRoute, setDeletingRoute] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRoutes(await api.routes.list());
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

  const addRoute = async (e) => {
    e.preventDefault();
    const stops = parseStops(form.stops);
    if (stops.length < 2) {
      setFormError('Enter at least two stops (origin and destination)');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const created = await api.routes.create({
        name: form.name,
        code: form.code,
        stops,
        distanceKm: Number(form.distanceKm),
        adminPassword: form.adminPassword,
      });
      setRoutes((prev) => [...prev, created]);
      setForm(emptyRouteForm);
      setShowAdminPassword(false);
      setFormError('');
      setShowForm(false);
      setError(null);
    } catch (err) {
      setFormError(err.message || 'Could not save route');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (route) => {
    setEditingRoute({
      ...route,
      stops: route.stops.join(', '),
      distanceKm: route.distanceKm,
    });
    setEditView('details');
    setEditAdminPassword('');
    setShowEditAdminPassword(false);
    setEditError('');
  };

  const closeEdit = (force = false) => {
    if (saving && !force) return;
    setEditingRoute(null);
    setEditView('details');
    setEditAdminPassword('');
    setShowEditAdminPassword(false);
    setEditError('');
  };

  const openSaveConfirm = (e) => {
    e.preventDefault();
    const stops = parseStops(editingRoute?.stops);
    if (stops.length < 2) {
      setEditError('Enter at least two stops (origin and destination)');
      return;
    }
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

  const saveRoute = async (e) => {
    e.preventDefault();
    const stops = parseStops(editingRoute.stops);
    if (stops.length < 2) {
      setEditError('Enter at least two stops (origin and destination)');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const payload = {
        name: editingRoute.name,
        code: editingRoute.code,
        stops,
        distanceKm: Number(editingRoute.distanceKm),
        adminPassword: editAdminPassword,
      };
      const updated = await api.routes.update(editingRoute.id, payload);
      setRoutes((prev) => prev.map((route) => (route.id === updated.id ? updated : route)));
      setError(null);
      setSaving(false);
      closeEdit(true);
    } catch (err) {
      setEditError(err.message || 'Could not save route');
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (route) => {
    setDeletingRoute(route);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError('');
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeletingRoute(null);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError('');
  };

  const confirmDeleteRoute = async (e) => {
    e.preventDefault();
    if (!deletingRoute) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.routes.remove(deletingRoute.id, deletePassword);
      setRoutes((prev) => prev.filter((item) => item.id !== deletingRoute.id));
      if (editingRoute?.id === deletingRoute.id) closeEdit(true);
      setDeletingRoute(null);
      setDeletePassword('');
      setError(null);
    } catch (err) {
      setDeleteError(err.message || 'Could not delete route');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Routes</h2>
      </div>
      {!loading && error && <div className="page-state error" style={{ marginBottom: '1rem' }}>{error}</div>}
      <PageState loading={loading} error={loading ? error : null}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Route List</h3>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setShowForm(!showForm);
                setShowAdminPassword(false);
                setForm(emptyRouteForm);
                setFormError('');
              }}
            >
              {showForm ? 'Cancel' : '+ Add Route'}
            </button>
          </div>
          {showForm && (
            <form onSubmit={addRoute} style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--gray-50)', borderRadius: '10px' }}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Route Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Route Code</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Distance (km)</label>
                  <input type="number" value={form.distanceKm} onChange={(e) => setForm({ ...form, distanceKm: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Admin Password</label>
                  <div className="password-field">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      value={form.adminPassword}
                      onChange={(e) => {
                        setForm({ ...form, adminPassword: e.target.value });
                        setFormError('');
                      }}
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
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Stops (comma-separated)</label>
                <input
                  value={form.stops}
                  onChange={(e) => {
                    setForm({ ...form, stops: e.target.value });
                    setFormError('');
                  }}
                  required
                  placeholder="Terminal A, Terminal B"
                />
              </div>
              {formError && <p className="login-error" style={{ marginTop: '0.75rem' }}>{formError}</p>}
              <button type="submit" className="btn-secondary" style={{ marginTop: '1rem' }} disabled={saving}>
                {saving ? 'Saving…' : 'Save Route'}
              </button>
            </form>
          )}
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Stops</th>
                <th>Distance</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r.id}>
                  <td>{r.code}</td>
                  <td>{r.name}</td>
                  <td>{r.stops.join(' → ')}</td>
                  <td>{r.distanceKm} km</td>
                  <td className="table-actions">
                    <div className="table-action-group">
                      <button type="button" className="icon-btn" aria-label={`Edit ${r.name}`} onClick={() => openEdit(r)}>
                        <i className="fa-solid fa-pencil" aria-hidden="true" />
                      </button>
                      <button type="button" className="icon-btn icon-btn-danger" aria-label={`Delete ${r.name}`} onClick={() => openDelete(r)}>
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

      {editingRoute && editView === 'details' && (
        <Modal title="Edit Route" onClose={closeEdit}>
          <form className="modal-form" onSubmit={openSaveConfirm}>
            <div className="form-group">
              <label>Route Code</label>
              <input
                value={editingRoute.code}
                onChange={(e) => setEditingRoute({ ...editingRoute, code: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Route Name</label>
              <input
                value={editingRoute.name}
                onChange={(e) => setEditingRoute({ ...editingRoute, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Distance (km)</label>
              <input
                type="number"
                min="0"
                value={editingRoute.distanceKm}
                onChange={(e) => setEditingRoute({ ...editingRoute, distanceKm: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Stops (comma-separated)</label>
              <input
                value={editingRoute.stops}
                onChange={(e) => {
                  setEditingRoute({ ...editingRoute, stops: e.target.value });
                  setEditError('');
                }}
                required
                placeholder="Terminal A, Terminal B"
              />
            </div>
            {editError && <p className="login-error">{editError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={closeEdit} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingRoute && editView === 'confirm-save' && (
        <Modal
          title={
            <span className="modal-title-with-back">
              <button type="button" className="modal-back-btn" onClick={backToDetailsView} aria-label="Go back">
                <i className="fa-solid fa-arrow-left" aria-hidden="true" />
              </button>
              Confirm Changes
            </span>
          }
          onClose={closeEdit}
        >
          <form className="modal-form" onSubmit={saveRoute}>
            <p className="confirm-copy">Enter the admin password to save changes to this route.</p>
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

      {deletingRoute && (
        <Modal title="Delete Route" onClose={closeDelete}>
          <form className="modal-form" onSubmit={confirmDeleteRoute}>
            <p className="confirm-copy">
              Delete <strong>{deletingRoute.name}</strong> ({deletingRoute.code})? Enter the admin password to confirm.
            </p>
            <div className="form-group">
              <label htmlFor="delete-route-password">Password</label>
              <div className="password-field">
                <input
                  id="delete-route-password"
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
