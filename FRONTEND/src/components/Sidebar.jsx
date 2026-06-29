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
  if (!query || query === "Travel query") return "New Trip";
  const clean = query
    .replace(/^(plan|plan a|i want to|i need|help me)/i, "")
    .trim();
  // Capitalize first letter
  const cap = clean.charAt(0).toUpperCase() + clean.slice(1);
  return cap.length > 36 ? cap.slice(0, 36) + "…" : cap;
}

function groupSessions(sessions) {
  const now    = Date.now();
  const groups = { Today: [], Yesterday: [], "This week": [], Older: [] };
  sessions.forEach(s => {
    if (!s.created_at) { groups.Older.push(s); return; }
    const diff = now - new Date(s.created_at).getTime();
    const days = diff / 86400000;
    if (days < 1)      groups.Today.push(s);
    else if (days < 2) groups.Yesterday.push(s);
    else if (days < 7) groups["This week"].push(s);
    else               groups.Older.push(s);
  });
  return groups;
}

export default function Sidebar({
  open, onClose, sessions, activeThreadId,
  onResume, onDelete, onNewChat,
}) {
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleDelete = async (threadId, e) => {
    e.stopPropagation();
    e.preventDefault();
    setDeletingId(threadId);
    await onDelete(threadId, e);
    setDeletingId(null);
  };

  const groups = groupSessions(sessions);
  const hasAny = sessions.length > 0;

  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label="Past trips">

      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span>✈️</span>
          <span>Past Trips</span>
        </div>
        <button className="sidebar-close" onClick={onClose}>✕</button>
      </div>

      {/* New Trip */}
      <button className="sidebar-new-btn" onClick={onNewChat}>
        <span>✏️</span>
        <span>New Trip</span>
      </button>

      {/* Sessions list grouped like ChatGPT */}
      <div className="sidebar-list">
        {!hasAny ? (
          <div className="sidebar-empty">
            <p>🌍</p>
            <p>No past trips yet</p>
            <p>Plan your first adventure!</p>
          </div>
        ) : (
          Object.entries(groups).map(([label, items]) =>
            items.length === 0 ? null : (
              <div key={label} className="sidebar-group">
                <p className="sidebar-group-label">{label}</p>
                {items.map(session => (
                  <div
                    key={session.thread_id}
                    className={`sidebar-item ${activeThreadId === session.thread_id ? "sidebar-item-active" : ""} ${deletingId === session.thread_id ? "sidebar-item-deleting" : ""}`}
                    onClick={() => onResume(session)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && onResume(session)}
                  >
                    <div className="sidebar-item-content">
                      <p className="sidebar-item-query">
                        {shortenQuery(session.query)}
                      </p>
                      <p className="sidebar-item-time">
                        {timeAgo(session.created_at)}
                      </p>
                    </div>
                    <button
                      className="sidebar-item-delete"
                      onClick={(e) => handleDelete(session.thread_id, e)}
                      aria-label="Delete trip"
                      title="Delete"
                      disabled={deletingId === session.thread_id}
                    >
                      {deletingId === session.thread_id ? "⏳" : "🗑️"}
                    </button>
                  </div>
                ))}
              </div>
            )
          )
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <span>💾 Stored in PostgreSQL</span>
        <span>{sessions.length} trip{sessions.length !== 1 ? "s" : ""}</span>
      </div>
    </aside>
  );
}