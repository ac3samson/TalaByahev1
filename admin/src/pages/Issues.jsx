import { useEffect, useState } from 'react';
import { api } from '../api';
import PageState from '../components/PageState';

function todayInManila() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
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
          <input id={id} type="date" value={date} onChange={(e) => onChange(e.target.value)} />
          <button type="button" className="btn-ghost" onClick={onClose}>
            Okay
          </button>
        </div>
      )}
    </div>
  );
}

export default function Issues() {
  const [issueReports, setIssueReports] = useState([]);
  const [date, setDate] = useState(todayInManila);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.issueReports
        .list(date)
        .then((rows) => {
          if (cancelled) return;
          setIssueReports(rows);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(err.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    setLoading(true);
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [date]);

  return (
    <div>
      <div className="page-header">
        <h2>Support</h2>
      </div>
      <PageState loading={loading && !issueReports.length} error={!issueReports.length ? error : null}>
        {error && issueReports.length > 0 && (
          <div className="page-state error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}
        <div className="card">
          <div className="card-header-row">
            <h3>Issue Reports</h3>
            <DateFilter
              id="issues-date"
              open={filterOpen}
              date={date}
              onToggle={() => setFilterOpen((open) => !open)}
              onChange={setDate}
              onClose={() => setFilterOpen(false)}
            />
          </div>
          {issueReports.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Reported by</th>
                  <th>Trip from</th>
                  <th>Category</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {issueReports.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.reportedBy}</td>
                    <td>{item.tripFrom}</td>
                    <td>
                      <span className="badge badge-category">{item.category}</span>
                    </td>
                    <td>{item.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !loading && <p className="confirm-copy">No issue reports found for this date.</p>
          )}
        </div>
      </PageState>
    </div>
  );
}
