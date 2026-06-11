const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.5)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modal: {
    background: '#fff',
    borderRadius: '20px',
    boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
    width: '100%',
    maxWidth: '440px',
    overflow: 'hidden',
    fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #f1f5f9',
    background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  headerIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#1e293b',
    margin: 0,
  },
  closeBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    background: '#f1f5f9',
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    transition: 'background 0.15s',
  },
  body: {
    padding: '16px',
    maxHeight: '360px',
    overflowY: 'auto',
  },
  empty: {
    textAlign: 'center',
    padding: '40px 24px',
    color: '#94a3b8',
    fontSize: '14px',
  },
  reqCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  reqFrom: {
    fontSize: '13px',
    color: '#475569',
    margin: 0,
  },
  reqDocTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1e293b',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  reqActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  acceptBtn: {
    padding: '7px 18px',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  rejectBtn: {
    padding: '7px 18px',
    borderRadius: '8px',
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#ef4444',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  footer: {
    padding: '14px 24px',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  footerClose: {
    padding: '8px 20px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};

const ShareRequestsModal = ({ isOpen, onClose, requests, onAccept, onReject, loading }) => {
  if (!isOpen) return null;

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.headerLeft}>
            <div style={S.headerIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div>
              <h2 style={S.headerTitle}>Pending Invitations</h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#6366f1', fontWeight: '500' }}>
                {requests.length} pending
              </p>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {requests.length === 0 ? (
            <div style={S.empty}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎉</div>
              <p style={{ margin: 0, fontWeight: '600', color: '#475569' }}>All caught up!</p>
              <p style={{ margin: '4px 0 0', fontSize: '13px' }}>No pending invitations right now.</p>
            </div>
          ) : (
            requests.map((req) => (
              <div key={req._id} style={S.reqCard}>
                <div>
                  <p style={S.reqFrom}>
                    <strong>{req.fromUser?.username || req.fromUser?.email}</strong> invited you to collaborate on:
                  </p>
                  <p style={S.reqDocTitle}>{req.document?.title || 'Untitled'}</p>
                </div>
                <div style={S.reqActions}>
                  <button
                    style={{ ...S.rejectBtn, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                    disabled={loading}
                    onClick={() => onReject(req._id)}
                  >
                    Decline
                  </button>
                  <button
                    style={{ ...S.acceptBtn, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                    disabled={loading}
                    onClick={() => onAccept(req._id)}
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button style={S.footerClose} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ShareRequestsModal;
