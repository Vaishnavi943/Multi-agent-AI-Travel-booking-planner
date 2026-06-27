// Extract IATA codes from route string like "DEL → GOI" or "DEL - GOI"
function extractCodes(route) {
  if (!route) return { from: "", to: "" };
  const parts = route.split(/[→\-–—\/]/).map(s => s.trim());
  return {
    from: parts[0] || "",
    to:   parts[1] || "",
  };
}

// Build Google Flights search URL
function buildFlightURL(flight) {
  const { from, to } = extractCodes(flight.route);
  if (from && to) {
    return `https://www.google.com/travel/flights?q=flights+from+${encodeURIComponent(from)}+to+${encodeURIComponent(to)}`;
  }
  // fallback: search by airline + route text
  const q = `${flight.airline || ""} flights ${flight.route || ""}`.trim();
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

export default function FlightCards({ flights }) {
  if (!flights || flights.length === 0)
    return <div className="empty-state"><p>No flight data available yet.</p></div>;

  return (
    <div className="cards-grid">
      {flights.map((f, i) => {
        const url = buildFlightURL(f);
        return (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`info-card flight-card-link ${i === 0 ? "card-featured" : ""}`}
            aria-label={`Search ${f.airline} flights ${f.route}`}
          >
            {i === 0 && <span className="card-badge">Best value</span>}

            <div className="card-top">
              <div className="card-airline">
                <span className="airline-icon">✈️</span>
                <span className="airline-name">{f.airline || "Airline"}</span>
              </div>
              <div className="card-price">{f.price || "—"}</div>
            </div>

            <div className="card-route">{f.route || "Route unavailable"}</div>

            <div className="card-meta-row">
              <span className="meta-pill">⏱ {f.duration || "—"}</span>
              <span className="meta-pill">💺 {f.class || "Economy"}</span>
            </div>

            {f.note && <p className="card-note">{f.note}</p>}

            <div className="card-cta">
              <span>Search on Google Flights</span>
              <span className="cta-arrow">→</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}