export default function Header({ onMenuClick, sessionCount, onLogoClick }) {
  return (
    <header className="header">
      {/* Hamburger menu */}
      <button
        className="header-menu-btn"
        onClick={onMenuClick}
        aria-label="Open past trips"
        title="Past trips"
      >
        <span>☰</span>
        {sessionCount > 0 && (
          <span className="header-menu-badge">{sessionCount}</span>
        )}
      </button>

      {/* Clickable logo → new trip */}
      <div className="header-content" onClick={onLogoClick} style={{ cursor: "pointer" }}>
        <p className="header-eyebrow">AI-Powered Travel Planner</p>
        <h1>Plan your next <span>adventure</span></h1>
        <p className="header-sub">
          Flights · Hotels · Weather · Full Itinerary — in one go.
        </p>
      </div>
    </header>
  );
}