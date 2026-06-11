export const ActionToolbar = ({ onUndo, onRedo, onSave }) => (
  <div className="ribbon-section">
    <div className="ribbon-group">
      <span className="ql-formats">
        <button onClick={onUndo} title="Undo (Ctrl+Z)" className="ribbon-action-btn">
          <svg viewBox="0 0 18 18"><path className="ql-fill ql-stroke" d="M4.5,9a5.5,5.5,0,1,1,11,0v3.5H13V9a3.5,3.5,0,1,0-7,0v.5h2L4.5,13,1,9.5h2V9Z"/></svg>
        </button>
        <button onClick={onRedo} title="Redo (Ctrl+Y)" className="ribbon-action-btn">
          <svg viewBox="0 0 18 18"><path className="ql-fill ql-stroke" d="M13.5,9a5.5,5.5,0,1,0-11,0v3.5H4.5V9a3.5,3.5,0,1,1,7,0v.5h-2L13.5,13l3.5-3.5h-2V9Z"/></svg>
        </button>
        <button onClick={onSave} title="Force Save (Ctrl+S)" className="ribbon-action-btn" style={{ stroke: '#4f46e5', padding: '2px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
        </button>
      </span>
    </div>
    <div className="ribbon-label">Actions</div>
  </div>
);
