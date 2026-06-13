const ShareRequestsModal = ({ isOpen, onClose, requests, onAccept, onReject, loading }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/80 bg-white shadow-2xl shadow-indigo-950/20">
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Pending invitations</h2>
              <p className="text-sm text-indigo-700">{requests.length} pending request{requests.length === 1 ? "" : "s"}</p>
            </div>
          </div>

          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-white hover:text-slate-900">
            Close
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-5">
          {requests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 px-6 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="mt-4 font-semibold text-slate-800">All caught up</p>
              <p className="mt-1 text-sm text-slate-500">No pending invitations right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <article key={request._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">{request.fromUser?.username || request.fromUser?.email || "Someone"}</span> invited you to collaborate on
                  </p>
                  <h3 className="mt-1 truncate text-base font-bold text-slate-950">{request.document?.title || "Untitled Document"}</h3>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => onReject(request._id)}
                      className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => onAccept(request._id)}
                      className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Accept
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareRequestsModal;
