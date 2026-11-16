import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api';
import Modal from './Modal';
import './Layout.css';

const links = [
  { to: '/', label: 'Dashboard', icon: 'fa-table-columns' },
  { to: '/employees', label: 'Employees', icon: 'fa-user-tie' },
  { to: '/routes', label: 'Routes', icon: 'fa-route' },
  { to: '/fares', label: 'Fares', icon: 'fa-money-bill' },
  { to: '/monitoring', label: 'Monitoring', icon: 'fa-display' },
  { to: '/reports', label: 'Reports', icon: 'fa-chart-column' },
  { to: '/support', label: 'Support', icon: 'fa-headset' },
];

export default function Layout({ onLogout, children }) {
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [pendingTrip, setPendingTrip] = useState(null);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionError, setDecisionError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadPending = async () => {
      try {
        const rows = await api.trips.pending();
        if (cancelled) return;
        setPendingTrip((current) => {
          if (current && rows.some((row) => row.id === current.id)) {
            return rows.find((row) => row.id === current.id) || rows[0] || null;
          }
          return rows[0] || null;
        });
        setDecisionError('');
      } catch {
        // Keep showing the current popup if polling fails briefly.
      }
    };

    loadPending();
    const id = setInterval(loadPending, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const approveTrip = async () => {
    if (!pendingTrip || decisionBusy) return;
    setDecisionBusy(true);
    setDecisionError('');
    try {
      await api.trips.approve(pendingTrip.id);
      setPendingTrip(null);
    } catch (err) {
      setDecisionError(err.message || 'Could not approve trip');
    } finally {
      setDecisionBusy(false);
    }
  };

  const rejectTrip = async () => {
    if (!pendingTrip || decisionBusy) return;
    setDecisionBusy(true);
    setDecisionError('');
    try {
      await api.trips.reject(pendingTrip.id);
      setPendingTrip(null);
    } catch (err) {
      setDecisionError(err.message || 'Could not reject trip');
    } finally {
      setDecisionBusy(false);
    }
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <img src="/portal-logo.png" alt="" className="brand-logo" />
          <div>
            <h1>TalaByahe</h1>
            <p>Admin Portal</p>
          </div>
        </div>
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              <i className={`fa-solid ${link.icon} nav-icon`} aria-hidden="true" />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" onClick={() => setConfirmSignOut(true)} className="btn-outline">
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>

      {pendingTrip && !decisionBusy && (
        <Modal title="Trip Start Request" dismissible={false}>
          <p className="confirm-copy">
            <strong>{pendingTrip.conductorName}</strong> ({pendingTrip.conductorId}) wants to start a session.
          </p>
          <div className="approval-details">
            <div>
              <span className="approval-label">Trip</span>
              <strong>{pendingTrip.id}</strong>
            </div>
            <div>
              <span className="approval-label">Route</span>
              <strong>{pendingTrip.routeName}</strong>
            </div>
            <div>
              <span className="approval-label">Bus</span>
              <strong>
                {pendingTrip.busId} · {pendingTrip.busPlate}
              </strong>
            </div>
          </div>
          {decisionError && <p className="login-error">{decisionError}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={rejectTrip}>
              Reject
            </button>
            <button type="button" className="btn-primary" onClick={approveTrip}>
              Approve
            </button>
          </div>
        </Modal>
      )}

      {decisionBusy && (
        <Modal title="Please wait…" dismissible={false}>
          <p className="confirm-copy">Processing the trip start request.</p>
        </Modal>
      )}

      {confirmSignOut && (
        <Modal title="Sign out" onClose={() => setConfirmSignOut(false)}>
          <p className="confirm-copy">Are you sure you want to sign out?</p>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setConfirmSignOut(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setConfirmSignOut(false);
                onLogout();
              }}
            >
              Sign out
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
