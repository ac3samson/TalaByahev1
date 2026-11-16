export default function Modal({ title, onClose, children, dismissible = true }) {
  return (
    <div className="modal-overlay" onClick={dismissible ? onClose : undefined}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h3 id="modal-title">{title}</h3>
          {dismissible ? (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          ) : (
            <span className="modal-header-spacer" aria-hidden="true" />
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
