export default function ItineraryPanel({ text }) {
  if (!text) return <div className="empty-state"><p>Itinerary loading...</p></div>;

  const safe = typeof text === "string" ? text
    : typeof text === "object" && text?.text ? text.text
    : JSON.stringify(text);

  // Clean markdown symbols
  const lines = safe
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const rendered = lines.map((line, i) => {
    // Remove ** bold markers for display
    const clean = line.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim();

    // Day header: "Day 1", "**Day 1**", "### Day 1"
    if (/^day\s*\d+/i.test(clean)) {
      return (
        <div key={i} className="day-header">
          <span className="day-pill">📅</span>
          <span>{clean}</span>
        </div>
      );
    }

    // Section headers: Morning, Afternoon, Evening, Check-in, etc.
    if (/^(morning|afternoon|evening|night|check.in|check.out|breakfast|lunch|dinner|arrival|departure):/i.test(clean)) {
      const [label, ...rest] = clean.split(":");
      return (
        <div key={i} className="itinerary-section">
          <span className="itinerary-section-label">{label}:</span>
          <span>{rest.join(":").trim()}</span>
        </div>
      );
    }

    // Bullet points
    if (line.startsWith("* ") || line.startsWith("- ") || line.startsWith("• ")) {
      return (
        <div key={i} className="itinerary-bullet">
          <span className="bullet-dot">•</span>
          <span>{clean.replace(/^[*\-•]\s*/, "")}</span>
        </div>
      );
    }

    // Numbered list
    if (/^\d+\.\s/.test(clean)) {
      return (
        <div key={i} className="itinerary-bullet">
          <span className="bullet-dot">{clean.match(/^\d+/)[0]}.</span>
          <span>{clean.replace(/^\d+\.\s*/, "")}</span>
        </div>
      );
    }

    // Regular text
    return <p key={i} className="itinerary-text">{clean}</p>;
  });

  return (
    <div className="itinerary-panel">
      {rendered}
    </div>
  );
}