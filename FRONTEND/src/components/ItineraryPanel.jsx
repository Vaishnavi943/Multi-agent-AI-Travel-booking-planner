export default function ItineraryPanel({ text }) {
  if (!text) return <div className="empty-state"><p>Itinerary loading...</p></div>;

  const safe = typeof text === "string"
    ? text
    : typeof text === "object" && text.text ? text.text
    : JSON.stringify(text);

  const lines = safe.split("\n").filter(l => l.trim());

  return (
    <div className="itinerary-panel">
      {lines.map((line, i) => {
        const clean = line.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim();
        if (/^day\s*\d+/i.test(clean) || /^\*\*day/i.test(line))
          return <div key={i} className="day-header"><span className="day-pill">📅</span> {clean}</div>;
        if (line.startsWith("* ") || line.startsWith("- "))
          return <div key={i} className="itinerary-bullet">• {clean.replace(/^[*\-]\s*/, "")}</div>;
        if (clean.length > 0)
          return <p key={i} className="itinerary-text">{clean}</p>;
        return <div key={i} style={{ height: "0.5rem" }} />;
      })}
    </div>
  );
}