import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';
import PageState from '../components/PageState';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', password: '', adminPassword: '' });
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editView, setEditView] = useState('details');
  const [editPassword, setEditPassword] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditAdminPassword, setShowEditAdminPassword] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingEmployee, setDeletingEmployee] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await api.employees.list();
      setEmployees(rows);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Refresh so presence-based Active/Inactive stays current.
    const id = setInterval(() => {
      api.employees
        .list()
        .then(setEmployees)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const addEmployee = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const created = await api.employees.create({
        name: form.name,
        route: '—',
        role: 'Conductor',
        password: form.password,
        adminPassword: form.adminPassword,
      });
      setEmployees((prev) => [...prev, created]);
      setForm({ name: '', password: '', adminPassword: '' });
      setShowEmployeePassword(false);
      setShowAdminPassword(false);
      setFormError('');
      setShowForm(false);
      setError(null);
    } catch (err) {
      setFormError(err.message || 'Could not save employee');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (emp) => {
    setEditingEmployee({ ...emp });
    setEditView('details');
    setEditPassword('');
    setEditAdminPassword('');
    setShowEditPassword(false);
    setShowEditAdminPassword(false);
    setEditError('');
  };

  const closeEdit = (force = false) => {
    if (saving && !force) return;
    setEditingEmployee(null);
    setEditView('details');
    setEditPassword('');
    setEditAdminPassword('');
    setShowEditPassword(false);
    setShowEditAdminPassword(false);
    setEditError('');
  };

  const openPasswordView = () => {
    setEditView('password');
    setEditPassword('');
    setEditAdminPassword('');
    setShowEditPassword(false);
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
    setEditPassword('');
    setEditAdminPassword('');
    setShowEditPassword(false);
    setShowEditAdminPassword(false);
    setEditError('');
  };

  const saveEmployee = async (e) => {
    e.preventDefault();
    setSaving(true);
    setEditError('');
    try {
      const updated = await api.employees.update(editingEmployee.id, {
        name: editingEmployee.name,
        route: editingEmployee.route,
        adminPassword: editAdminPassword,
      });
      setEmployees((prev) => prev.map((emp) => (emp.id === updated.id ? updated : emp)));
      setError(null);
      setSaving(false);
      closeEdit(true);
      return;
    } catch (err) {
      setEditError(err.message || 'Could not save employee');
    } finally {
      setSaving(false);
    }
  };

  const saveEmployeePassword = async (e) => {
    e.preventDefault();
    setSaving(true);
    setEditError('');
    try {
      await api.employees.update(editingEmployee.id, {
        password: editPassword,
        adminPassword: editAdminPassword,
      });
      setError(null);
      setSaving(false);
      closeEdit(true);
      return;
    } catch (err) {
      setEditError(err.message || 'Could not change password');
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (emp) => {
    setDeletingEmployee(emp);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError('');
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeletingEmployee(null);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError('');
  };

  const confirmDeleteEmployee = async (e) => {
    e.preventDefault();
    if (!deletingEmployee) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.employees.remove(deletingEmployee.id, deletePassword);
      setEmployees((prev) => prev.filter((item) => item.id !== deletingEmployee.id));
      if (editingEmployee?.id === deletingEmployee.id) setEditingEmployee(null);
      setDeletingEmployee(null);
      setDeletePassword('');
      setError(null);
    } catch (err) {
      setDeleteError(err.message || 'Could not delete employee');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Employees</h2>
      </div>
      {!loading && error && <div className="page-state error" style={{ marginBottom: '1rem' }}>{error}</div>}
      <PageState loading={loading} error={loading ? error : null}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Employee List</h3>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setShowForm(!showForm);
                setShowEmployeePassword(false);
                setShowAdminPassword(false);
                setForm({ name: '', password: '', adminPassword: '' });
                setFormError('');
              }}
            >
              {showForm ? 'Cancel' : '+ Add Employee'}
            </button>
          </div>
          {showForm && (
            <form onSubmit={addEmployee} style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--gray-50)', borderRadius: '10px' }}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Full Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Employee Password</label>
                  <div className="password-field">
                    <input
                      type={showEmployeePassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      minLength={4}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowEmployeePassword((prev) => !prev)}
                      aria-label={showEmployeePassword ? 'Hide password' : 'Show password'}
                    >
                      <i className={`fa-solid ${showEmployeePassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
                    </button>
                  </div>
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
              {formError && <p className="login-error" style={{ marginTop: '0.75rem' }}>{formError}</p>}
              <button type="submit" className="btn-secondary" style={{ marginTop: '1rem' }} disabled={saving}>
                {saving ? 'Saving…' : 'Save Employee'}
              </button>
            </form>
          )}
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.id}</td>
                  <td>{emp.name}</td>
                  <td>
                    <span className="badge">{emp.status}</span>
                  </td>
                  <td className="table-actions">
                    <div className="table-action-group">
                      <button type="button" className="icon-btn" aria-label={`Edit ${emp.name}`} onClick={() => openEdit(emp)}>
                        <i className="fa-solid fa-pencil" aria-hidden="true" />
                      </button>
                      <button type="button" className="icon-btn icon-btn-danger" aria-label={`Delete ${emp.name}`} onClick={() => openDelete(emp)}>
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

      {editingEmployee && editView === 'details' && (
        <Modal title="Edit Employee" onClose={closeEdit}>
          <form className="modal-form" onSubmit={openSaveConfirm}>
            <div className="form-group">
              <label>Employee ID</label>
              <input value={editingEmployee.id} disabled />
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <input
                value={editingEmployee.name}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Assigned Route</label>
              <select
                value={editingEmployee.route}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, route: e.target.value })}
              >
                <option>Route 1</option>
                <option>Route 2</option>
                <option>—</option>
              </select>
            </div>
            <div className="modal-actions modal-actions-split">
              <button type="button" className="change-password-link" onClick={openPasswordView}>
                Change password
              </button>
              <div className="modal-actions-right">
                <button type="button" className="btn-ghost" onClick={closeEdit} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {editingEmployee && editView === 'confirm-save' && (
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
          <form className="modal-form" onSubmit={saveEmployee}>
            <p className="confirm-copy">Enter the admin password to save changes to this employee.</p>
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

      {editingEmployee && editView === 'password' && (
        <Modal
          title={
            <span className="modal-title-with-back">
              <button type="button" className="modal-back-btn" onClick={backToDetailsView} aria-label="Go back">
                <i className="fa-solid fa-arrow-left" aria-hidden="true" />
              </button>
              Change Password
            </span>
          }
          onClose={closeEdit}
        >
          <form className="modal-form" onSubmit={saveEmployeePassword}>
            <div className="form-group">
              <label>New Employee Password</label>
              <div className="password-field">
                <input
                  type={showEditPassword ? 'text' : 'password'}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  required
                  minLength={4}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowEditPassword((prev) => !prev)}
                  aria-label={showEditPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fa-solid ${showEditPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Admin Password</label>
              <div className="password-field">
                <input
                  type={showEditAdminPassword ? 'text' : 'password'}
                  value={editAdminPassword}
                  onChange={(e) => setEditAdminPassword(e.target.value)}
                  required
                  placeholder="Enter admin password to confirm"
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
                {saving ? 'Saving…' : 'Save Password'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deletingEmployee && (
        <Modal title="Delete Employee" onClose={closeDelete}>
          <form className="modal-form" onSubmit={confirmDeleteEmployee}>
            <p className="confirm-copy">
              Delete <strong>{deletingEmployee.name}</strong> ({deletingEmployee.id})? Enter the admin password to confirm.
            </p>
            <div className="form-group">
              <label htmlFor="delete-password">Password</label>
              <div className="password-field">
                <input
                  id="delete-password"
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
