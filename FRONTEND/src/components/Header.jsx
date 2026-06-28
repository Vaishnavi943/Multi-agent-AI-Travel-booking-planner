export default function Header({ onMenuClick, sessionCount }) {
  return (
    <header className="header">
      <button
        className="header-menu-btn"
        onClick={onMenuClick}
        aria-label="Open past trips"
        title="Past trips"
      >
        <span className="header-menu-icon">☰</span>
        {sessionCount > 0 && (
          <span className="header-menu-badge">{sessionCount}</span>
        )}
      </button>

      <div className="header-content">
        <p className="header-eyebrow">AI-Powered Travel Planner</p>
        <h1>Plan your next <span>adventure</span></h1>
        <p className="header-sub">
          Flights · Hotels · Weather · Full Itinerary — in one go.
        </p>
      </div>
    </header>
  );
}