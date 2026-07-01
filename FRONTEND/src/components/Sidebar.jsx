import { useEffect, useState } from "react";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  try {
    const diff  = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)   return "Just now";
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7)   return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch { return ""; }
}

function shortenQuery(query) {
  if (!query || query === "Travel query") return "Travel query";
  const clean = query.replace(/^(plan a?|i want to|i need|help me)\s*/i, "").trim();
  const cap   = clean.charAt(0).toUpperCase() + clean.slice(1);
  return cap.length > 34 ? cap.slice(0, 34) + "…" : cap;
}

function groupByDate(sessions) {
  const now = Date.now();
  const out = { Today: [], Yesterday: [], "This week": [], "Older": [] };
  sessions.forEach(s => {
    const d = (now - new Date(s.created_at || 0).getTime()) / 86400000;
    if (d < 1)      out["Today"].push(s);
    else if (d < 2) out["Yesterday"].push(s);
    else if (d < 7) out["This week"].push(s);
    else            out["Older"].push(s);
  });
  return out;
}

export default function Sidebar({
  open, onClose, sessions, sessionsLoading,
  activeThreadId, onResume, onDelete, onNewChat,
}) {
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    e.preventDefault();
    setDeletingId(id);
    await onDelete(id, e);
    setDeletingId(null);
  };

  const groups = groupByDate(sessions);

  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-title"><span>✈️</span><span>Past Trips</span></div>
        <button className="sidebar-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <button className="sidebar-new-btn" onClick={onNewChat}>
        <span>✏️</span><span>New Trip</span>
      </button>

      <div className="sidebar-list">
        {sessionsLoading ? (
          <p className="sidebar-loading">Loading trips…</p>
        ) : sessions.length === 0 ? (
          <div className="sidebar-empty">
            <p>🌍</p><p>No past trips yet</p><p>Plan your first adventure!</p>
          </div>
        ) : (
          Object.entries(groups).map(([label, items]) =>
            items.length === 0 ? null : (
              <div key={label} className="sidebar-group">
                <p className="sidebar-group-label">{label}</p>
                {items.map(s => (
                  <div
                    key={s.thread_id}
                    className={`sidebar-item ${activeThreadId === s.thread_id ? "sidebar-item-active" : ""} ${deletingId === s.thread_id ? "sidebar-item-deleting" : ""}`}
                    onClick={() => !deletingId && onResume(s)}
                    role="button" tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && onResume(s)}
                  >
                    <div className="sidebar-item-content">
                      <p className="sidebar-item-query">{shortenQuery(s.query)}</p>
                      <p className="sidebar-item-time">{timeAgo(s.created_at)}</p>
                    </div>
                    <button
                      className="sidebar-item-delete"
                      onClick={e => handleDelete(s.thread_id, e)}
                      title="Delete" disabled={!!deletingId}
                    >
                      {deletingId === s.thread_id ? "⏳" : "🗑️"}
                    </button>
                  </div>
                ))}
              </div>
            )
          )
        )}
      </div>

      <div className="sidebar-footer">
        <span>💾 PostgreSQL</span>
        <span>{sessions.length} trip{sessions.length !== 1 ? "s" : ""}</span>
      </div>
    </aside>
  );
}