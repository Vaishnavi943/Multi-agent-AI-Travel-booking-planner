import { useState } from "react";

function ResultCard({ title, icon, content, colorClass, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  if (!content) return null;

  return (
    <div className={`result-card ${colorClass}`}>
      <button
        className="card-header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="card-title">
          <span className="card-title-icon">{icon}</span>
          <h3>{title}</h3>
        </div>
        <span className={`card-chevron ${open ? "open" : ""}`}>▼</span>
      </button>

      {open && (
        <div className="card-body">
          <p className="card-text">{content}</p>
        </div>
      )}
    </div>
  );
}

export default function ResultsPanel({ results, threadId }) {
  return (
    <div className="results-panel">
      {threadId && (
        <span className="thread-badge">🔗 Session: {threadId.slice(0, 8)}…</span>
      )}

      <ResultCard
        title="Flight Recommendations"
        icon="✈️"
        content={results.flight_results}
        colorClass="flights"
        defaultOpen
      />
      <ResultCard
        title="Hotel Options"
        icon="🏨"
        content={results.hotel_results}
        colorClass="hotels"
        defaultOpen
      />
      <ResultCard
        title="Weather & Forecast"
        icon="🌤️"
        content={results.weather_results}
        colorClass="weather"
        defaultOpen
      />
      <ResultCard
        title="Your Itinerary"
        icon="📋"
        content={results.itinerary}
        colorClass="itinerary"
        defaultOpen
      />
    </div>
  );
}