import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  getDocuments,
  createDocument,
  deleteDocument,
  getShareRequests,
  acceptShareRequest,
  rejectShareRequest,
} from "../api/documentService";
import ShareRequestsModal from "../components/ShareRequestsModal";
import axiosInstance from "../api/axios";

/* ─── Inline style objects (guaranteed to render regardless of Tailwind) ─── */
const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f0f4ff 0%, #f8fafc 60%, #eef2ff 100%)",
    fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
  },

  /* ── NAVBAR ── */
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(99,102,241,0.12)",
    boxShadow: "0 1px 20px rgba(99,102,241,0.08)",
    padding: "0 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "64px",
  },
  navLogo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textDecoration: "none",
  },
  navLogoIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  navTitle: {
    fontSize: "20px",
    fontWeight: "700",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    letterSpacing: "-0.3px",
  },
  navRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  navWelcome: {
    fontSize: "14px",
    color: "#64748b",
    fontWeight: "400",
  },
  navUsername: {
    fontWeight: "600",
    color: "#1e293b",
  },
  navBellBtn: {
    position: "relative",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    borderRadius: "10px",
    color: "#64748b",
    transition: "background 0.15s, color 0.15s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  navBadge: {
    position: "absolute",
    top: "4px",
    right: "4px",
    background: "#ef4444",
    color: "#fff",
    fontSize: "10px",
    fontWeight: "700",
    lineHeight: "1",
    minWidth: "17px",
    height: "17px",
    borderRadius: "99px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid white",
    padding: "0 3px",
  },
  navAvatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    fontWeight: "700",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logoutBtn: {
    padding: "7px 16px",
    borderRadius: "8px",
    border: "1px solid #fecaca",
    background: "#fff",
    color: "#ef4444",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.15s",
  },

  /* ── MAIN CONTENT ── */
  main: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "40px 32px",
  },
  heroRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "36px",
    flexWrap: "wrap",
    gap: "16px",
  },
  heroTitle: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: "-0.5px",
  },
  heroSub: {
    fontSize: "14px",
    color: "#64748b",
    marginTop: "4px",
  },
  newDocBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 22px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
    transition: "all 0.2s",
    letterSpacing: "0.1px",
  },

  /* ── GRID ── */
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "20px",
  },

  /* ── CARD ── */
  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    border: "1px solid rgba(99,102,241,0.1)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
    transition: "box-shadow 0.2s, transform 0.2s, border-color 0.2s",
    cursor: "default",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  cardIconWrap: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#1e293b",
    margin: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardDate: {
    fontSize: "12px",
    color: "#94a3b8",
    margin: "0",
  },
  cardFooter: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
    paddingTop: "12px",
    borderTop: "1px solid #f1f5f9",
    marginTop: "auto",
  },
  openBtn: {
    flex: 1,
    padding: "8px 0",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
  deleteBtn: {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "1px solid #fecaca",
    background: "#fff",
    color: "#ef4444",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.15s",
  },

  /* ── EMPTY / LOADING ── */
  emptyCard: {
    gridColumn: "1 / -1",
    textAlign: "center",
    padding: "64px 32px",
    background: "#fff",
    borderRadius: "16px",
    border: "1px dashed #c7d2fe",
  },
  emptyTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#475569",
    margin: "16px 0 8px",
  },
  emptyText: {
    fontSize: "14px",
    color: "#94a3b8",
    margin: "0",
  },

  errorBar: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "13px",
    marginBottom: "20px",
  },

  /* ── SKELETON ── */
  skeleton: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "20px",
  },
  skeletonCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    border: "1px solid #f1f5f9",
  },
  skeletonBlock: (w, h, radius = "8px") => ({
    background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s infinite",
    width: w,
    height: h,
    borderRadius: radius,
    marginBottom: "8px",
  }),
};

/* ── Doc icon SVG ── */
const DocIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" fill="#a5b4fc" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 2V8H20" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 13H8" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 17H8" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 9H9H8" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

/* ─── Skeleton loader ─── */
const SkeletonGrid = () => (
  <div style={S.skeleton}>
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} style={S.skeletonCard}>
        <div style={S.skeletonBlock("40px", "40px", "12px")} />
        <div style={S.skeletonBlock("70%", "16px")} />
        <div style={S.skeletonBlock("50%", "12px")} />
        <div style={{ ...S.skeletonBlock("100%", "34px", "8px"), marginTop: "12px", marginBottom: 0 }} />
      </div>
    ))}
  </div>
);

/* ─── MAIN COMPONENT ─── */
const DashboardPage = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [shareRequests, setShareRequests] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        const [docs, requests] = await Promise.all([getDocuments(), getShareRequests()]);
        if (!isMounted) return;
        setDocuments(docs);
        setShareRequests(requests);
      } catch {
        if (isMounted) {
          setError("Failed to load documents. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchInitialData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleAcceptRequest = async (requestId) => {
    try {
      setActionLoading(true);
      await acceptShareRequest(requestId);
      setShareRequests((prev) => prev.filter((req) => req._id !== requestId));
      const docs = await getDocuments();
      setDocuments(docs);
    } catch {
      alert("Failed to accept request");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      setActionLoading(true);
      await rejectShareRequest(requestId);
      setShareRequests((prev) => prev.filter((req) => req._id !== requestId));
    } catch {
      alert("Failed to reject request");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateDocument = async () => {
    const title = window.prompt("Enter document title", "Untitled");
    if (title === null) return; // user cancelled
    try {
      const newDoc = await createDocument({ title: title.trim() || "Untitled", content: "" });
      navigate(`/documents/${newDoc._id}`);
    } catch {
      setError("Failed to create document. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await axiosInstance.post("/auth/logout");
      setUser(null);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleDeleteDocument = async (id) => {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    try {
      setDeletingId(id);
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc._id !== id));
    } catch {
      setError("Failed to delete document. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.slice(0, 2).toUpperCase();
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <>
      {/* Shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .doc-card:hover {
          box-shadow: 0 8px 32px rgba(99,102,241,0.15) !important;
          transform: translateY(-2px) !important;
          border-color: rgba(99,102,241,0.25) !important;
        }
        .new-doc-btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99,102,241,0.45) !important;
        }
        .open-btn:hover { opacity: 0.85; }
        .delete-btn:hover { background: #fef2f2 !important; }
        .logout-btn:hover { background: #fef2f2 !important; }
        .bell-btn:hover { background: #f1f5f9 !important; color: #6366f1 !important; }
      `}</style>

      <div style={S.page}>
        {/* ── NAVBAR ── */}
        <nav style={S.nav}>
          {/* Logo */}
          <div style={S.navLogo}>
            <div style={S.navLogoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </div>
            <span style={S.navTitle}>Collabify</span>
          </div>

          {/* Right side */}
          <div style={S.navRight}>
            {/* Bell */}
            <button
              className="bell-btn"
              style={S.navBellBtn}
              onClick={() => setIsModalOpen(true)}
              title="Share Requests"
            >
              <BellIcon />
              {shareRequests.length > 0 && (
                <span style={S.navBadge}>{shareRequests.length}</span>
              )}
            </button>

            {/* Avatar + name */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={S.navAvatar}>{getInitials(user?.username)}</div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b", lineHeight: "1.2" }}>
                  {user?.username}
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: "1.2" }}>
                  {user?.email || "Collaborator"}
                </div>
              </div>
            </div>

            {/* Logout */}
            <button className="logout-btn" style={S.logoutBtn} onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </nav>

        {/* ── MAIN ── */}
        <main style={S.main}>
          {/* Header row */}
          <div style={S.heroRow}>
            <div>
              <h1 style={S.heroTitle}>My Documents</h1>
              <p style={S.heroSub}>
                {loading ? "" : `${documents.length} document${documents.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <button
              className="new-doc-btn"
              style={S.newDocBtn}
              onClick={handleCreateDocument}
            >
              <PlusIcon /> New Document
            </button>
          </div>

          {/* Error bar */}
          {error && <div style={S.errorBar}>{error}</div>}

          {/* Content */}
          {loading ? (
            <SkeletonGrid />
          ) : documents.length === 0 ? (
            <div style={S.grid}>
              <div style={S.emptyCard}>
                <div style={{ ...S.navLogoIcon, width: "64px", height: "64px", margin: "0 auto", borderRadius: "16px" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                </div>
                <p style={S.emptyTitle}>No documents yet</p>
                <p style={S.emptyText}>Create your first document to start collaborating!</p>
                <button
                  className="new-doc-btn"
                  style={{ ...S.newDocBtn, margin: "20px auto 0", display: "inline-flex" }}
                  onClick={handleCreateDocument}
                >
                  <PlusIcon /> Create Document
                </button>
              </div>
            </div>
          ) : (
            <div style={S.grid}>
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  className="doc-card"
                  style={S.card}
                >
                  {/* Card top */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <div style={S.cardIconWrap}>
                      <DocIcon />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={S.cardTitle}>{doc.title || "Untitled"}</h3>
                      <p style={S.cardDate}>
                        Updated {formatDate(doc.updatedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Card footer */}
                  <div style={S.cardFooter}>
                    <button
                      className="open-btn"
                      style={S.openBtn}
                      onClick={() => navigate(`/documents/${doc._id}`)}
                    >
                      Open
                    </button>
                    <button
                      className="delete-btn"
                      style={{
                        ...S.deleteBtn,
                        opacity: deletingId === doc._id ? 0.5 : 1,
                        cursor: deletingId === doc._id ? "not-allowed" : "pointer",
                      }}
                      onClick={() => handleDeleteDocument(doc._id)}
                      disabled={deletingId === doc._id}
                    >
                      {deletingId === doc._id ? "..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Modal */}
        <ShareRequestsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          requests={shareRequests}
          onAccept={handleAcceptRequest}
          onReject={handleRejectRequest}
          loading={actionLoading}
        />
      </div>
    </>
  );
};

export default DashboardPage;
