function Stars({ rating }) {
  const n = parseFloat(rating) || 0;
  return (
    <span className="stars" aria-label={`Rating: ${rating}`}>
      {"★".repeat(Math.floor(n))}{"☆".repeat(5 - Math.floor(n))}
      <span className="star-num">{rating}</span>
    </span>
  );
}

export default function HotelCards({ hotels }) {
  if (!hotels || hotels.length === 0)
    return <div className="empty-state"><p>No hotel data available yet.</p></div>;

  return (
    <div className="cards-grid">
      {hotels.map((h, i) => (
        <div key={i} className={`info-card ${i === 0 ? "card-featured" : ""}`}>
          {i === 0 && <span className="card-badge">Top pick</span>}
          <div className="card-top">
            <div className="hotel-name">{h.name || "Hotel"}</div>
            <div className="card-price">{h.price_per_night || "—"}<span className="per-night">/night</span></div>
          </div>
          <div className="card-location">📍 {h.location || "Location unavailable"}</div>
          <Stars rating={h.rating || "4.0"} />
          {h.highlights && (
            <div className="card-meta-row" style={{ marginTop: "0.6rem", flexWrap: "wrap" }}>
              {h.highlights.split(",").map((tag, j) => (
                <span key={j} className="meta-pill">{tag.trim()}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}