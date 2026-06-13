import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  acceptShareRequest,
  createDocument,
  deleteDocument,
  getDocuments,
  getShareRequests,
  rejectShareRequest,
} from "../api/documentService";
import ShareRequestsModal from "../components/ShareRequestsModal";
import { useAuth } from "../context/AuthContext";

const AppLogo = () => (
  <div className="flex items-center gap-3">
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 4.75h8.25L18 8.5v10.75H6V4.75Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14 4.75V9h4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8.8 12.5h6.4M8.8 15.5h4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
    <div>
      <p className="text-lg font-bold tracking-tight text-slate-950">Collabify</p>
      <p className="hidden text-xs font-medium text-slate-500 sm:block">Document workspace</p>
    </div>
  </div>
);

const DocumentIcon = () => (
  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v5h5M8.5 13h7M8.5 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SkeletonGrid = () => (
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
    {[1, 2, 3, 4, 5, 6].map((item) => (
      <div key={item} className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-sm">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-200" />
        <div className="mt-5 h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-slate-100" />
        <div className="mt-6 h-10 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
    ))}
  </div>
);

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [shareRequests, setShareRequests] = useState([]);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDocumentTitle, setNewDocumentTitle] = useState("Untitled Document");
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refreshShareRequests = useCallback(
    async ({ showError = false } = {}) => {
      if (!user) return [];

      try {
        const requests = await getShareRequests();
        setShareRequests(requests || []);
        return requests || [];
      } catch {
        if (showError) setError("Failed to load invitations. Please try again.");
        return [];
      }
    },
    [user]
  );

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const fetchInitialData = async () => {
      try {
        setError("");
        const [docs, requests] = await Promise.all([getDocuments(), getShareRequests()]);
        if (!isMounted) return;
        setDocuments(docs || []);
        setShareRequests(requests || []);
      } catch {
        if (isMounted) setError("Failed to load your workspace. Please try again.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInitialData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    const handleFocus = () => {
      refreshShareRequests();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshShareRequests, user]);

  const handleOpenRequests = async () => {
    setIsRequestsOpen(true);
    await refreshShareRequests({ showError: true });
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      setActionLoading(true);
      setError("");
      await acceptShareRequest(requestId);
      setShareRequests((prev) => prev.filter((request) => request._id !== requestId));
      setDocuments(await getDocuments());
      setMessage("Invitation accepted.");
    } catch {
      setError("Failed to accept invitation.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      setActionLoading(true);
      setError("");
      await rejectShareRequest(requestId);
      setShareRequests((prev) => prev.filter((request) => request._id !== requestId));
      setMessage("Invitation declined.");
    } catch {
      setError("Failed to decline invitation.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateDocument = async (event) => {
    event.preventDefault();

    try {
      setActionLoading(true);
      setError("");
      const newDoc = await createDocument({
        title: newDocumentTitle.trim() || "Untitled Document",
        content: { ops: [] },
      });
      setIsCreateOpen(false);
      setNewDocumentTitle("Untitled Document");
      navigate(`/documents/${newDoc._id}`);
    } catch {
      setError("Failed to create document. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;
    if (!isOwnedDocument(documentToDelete)) {
      setDocumentToDelete(null);
      return;
    }

    try {
      setDeletingId(documentToDelete._id);
      setError("");
      await deleteDocument(documentToDelete._id);
      setDocuments((prev) => prev.filter((doc) => doc._id !== documentToDelete._id));
      setMessage("Document deleted.");
      setDocumentToDelete(null);
    } catch {
      setError("Failed to delete document. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (Number.isNaN(date.getTime())) return "recently";
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getOwnerId = (doc) => {
    const owner = doc?.owner;
    if (!owner) return "";
    if (typeof owner === "string") return owner;
    return owner._id || owner.id || "";
  };

  const isOwnedDocument = (doc) => {
    const userId = user?.id || user?._id;
    return Boolean(userId && getOwnerId(doc).toString() === userId.toString());
  };

  const renderDocumentCard = (doc) => {
    const isOwner = isOwnedDocument(doc);

    return (
      <article
        key={doc._id}
        className="group flex min-h-[190px] flex-col rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm shadow-indigo-950/5 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-950/10"
      >
        <div className="flex items-start gap-4">
          <DocumentIcon />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3 className="min-w-0 flex-1 truncate text-base font-bold text-slate-950">{doc.title || "Untitled Document"}</h3>
              {!isOwner && (
                <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-100">
                  Shared
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">Updated {formatDate(doc.updatedAt)}</p>
          </div>
        </div>

        <div className="mt-auto flex gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => navigate(`/documents/${doc._id}`)}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Open
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => setDocumentToDelete(doc)}
              disabled={deletingId === doc._id}
              className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingId === doc._id ? "..." : "Delete"}
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-100 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <AppLogo />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenRequests}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              title="Pending invitations"
            >
              <BellIcon />
              {shareRequests.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {shareRequests.length}
                </span>
              )}
            </button>

            <div className="hidden items-center gap-3 rounded-2xl border border-white/80 bg-white/70 px-3 py-2 shadow-sm sm:flex">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-sm font-bold text-white">
                {getInitials(user?.username)}
              </div>
              <div className="max-w-[180px]">
                <p className="truncate text-sm font-bold text-slate-900">{user?.username || "User"}</p>
                <p className="truncate text-xs text-slate-500">{user?.email || "Collaborator"}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              Sign out
            </button>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8 flex flex-col gap-5 rounded-3xl border border-white/80 bg-white/75 p-6 shadow-xl shadow-indigo-950/5 backdrop-blur sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Workspace</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">My Documents</h1>
            <p className="mt-2 text-sm text-slate-500">
              {loading ? "Loading documents..." : `${documents.length} document${documents.length === 1 ? "" : "s"} in your workspace`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-purple-700"
          >
            <PlusIcon />
            New Document
          </button>
        </section>

        {(error || message) && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
              error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || message}
          </div>
        )}

        {loading ? (
          <SkeletonGrid />
        ) : documents.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-indigo-200 bg-white/75 px-6 py-16 text-center shadow-sm backdrop-blur">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600">
              <PlusIcon />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-950">No documents yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Create your first document or accept an invitation from the bell menu to start collaborating.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-purple-700"
            >
              <PlusIcon />
              Create Document
            </button>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {documents.map((doc) => renderDocumentCard(doc))}
          </section>
        )}
      </main>

      <ShareRequestsModal
        isOpen={isRequestsOpen}
        onClose={() => setIsRequestsOpen(false)}
        requests={shareRequests}
        onAccept={handleAcceptRequest}
        onReject={handleRejectRequest}
        loading={actionLoading}
      />

      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsCreateOpen(false);
          }}
        >
          <form onSubmit={handleCreateDocument} className="w-full max-w-md rounded-2xl border border-white/80 bg-white p-6 shadow-2xl shadow-indigo-950/20">
            <h2 className="text-xl font-bold text-slate-950">Create document</h2>
            <p className="mt-1 text-sm text-slate-500">Name your document before opening the editor.</p>
            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Document title
              <input
                autoFocus
                value={newDocumentTitle}
                onChange={(event) => setNewDocumentTitle(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {documentToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDocumentToDelete(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white p-6 shadow-2xl shadow-indigo-950/20">
            <h2 className="text-xl font-bold text-slate-950">Delete document?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This will permanently delete <span className="font-semibold text-slate-800">{documentToDelete.title || "Untitled Document"}</span>.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setDocumentToDelete(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDocument}
                disabled={deletingId === documentToDelete._id}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === documentToDelete._id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
