import { useState } from "react";

// Safely convert any value to a plain string for rendering
function toText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          // LangChain message object: {type, text, id} or {type, content}
          return item.text || item.content || JSON.stringify(item);
        }
        return String(item);
      })
      .join("\n");
  }
  if (typeof value === "object") {
    return value.text || value.content || JSON.stringify(value, null, 2);
  }
  return String(value);
}

function ResultCard({ title, icon, content, colorClass, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  const text = toText(content);
  if (!text) return null;

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
          <p className="card-text">{text}</p>
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