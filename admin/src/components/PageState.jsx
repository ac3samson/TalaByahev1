export default function PageState({ loading, error, empty, children }) {
  if (loading) {
    return <div className="page-state">Loading…</div>;
  }

  if (error) {
    return <div className="page-state error">Could not reach the database: {error}</div>;
  }

  if (empty) {
    return <div className="page-state">{empty}</div>;
  }

  return children;
}
