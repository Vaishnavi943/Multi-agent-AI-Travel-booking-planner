import { useEffect } from "react";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)   return "Just now";
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  } catch { return ""; }
}

export default function Sidebar({
  open, onClose, sessions, activeThreadId,
  onResume, onDelete, onNewChat,
}) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label="Chat history">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span>🗂️</span>
          <span>Past Trips</span>
        </div>
        <button className="sidebar-close" onClick={onClose} aria-label="Close sidebar">✕</button>
      </div>

      {/* New chat button */}
      <button className="sidebar-new-btn" onClick={onNewChat}>
        <span>✈️</span>
        <span>New Trip</span>
      </button>

      {/* Sessions list */}
      <div className="sidebar-list">
        {sessions.length === 0 ? (
          <div className="sidebar-empty">
            <p>🌍</p>
            <p>No past trips yet.</p>
            <p>Plan your first trip!</p>
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.thread_id}
              className={`sidebar-item ${activeThreadId === session.thread_id ? "sidebar-item-active" : ""}`}
              onClick={() => onResume(session)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === "Enter" && onResume(session)}
            >
              <div className="sidebar-item-icon">✈️</div>
              <div className="sidebar-item-content">
                <p className="sidebar-item-query">
                  {session.query?.length > 40
                    ? session.query.slice(0, 40) + "…"
                    : session.query || "Travel query"}
                </p>
                <p className="sidebar-item-time">{timeAgo(session.created_at)}</p>
              </div>
              <button
                className="sidebar-item-delete"
                onClick={(e) => onDelete(session.thread_id, e)}
                aria-label="Delete session"
                title="Delete"
              >🗑️</button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <p>💾 Powered by PostgreSQL</p>
        <p>{sessions.length} trip{sessions.length !== 1 ? "s" : ""} saved</p>
      </div>
    </aside>
  );
}