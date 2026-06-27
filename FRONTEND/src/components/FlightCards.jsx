export default function FlightCards({ flights }) {
  if (!flights || flights.length === 0)
    return <div className="empty-state"><p>No flight data available yet.</p></div>;

  return (
    <div className="cards-grid">
      {flights.map((f, i) => (
        <div key={i} className={`info-card ${i === 0 ? "card-featured" : ""}`}>
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
        </div>
      ))}
    </div>
  );
}