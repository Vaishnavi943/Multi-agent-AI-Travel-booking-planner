export default function WeatherPanel({ raw }) {
  if (!raw) return <div className="empty-state"><p>Weather data loading...</p></div>;

  const text = typeof raw === "string"
    ? raw
    : Array.isArray(raw)
      ? raw.map(i => i?.text || i?.content || JSON.stringify(i)).join("\n")
      : JSON.stringify(raw, null, 2);

  const lines = text.split("\n").filter(l => l.trim());

  return (
    <div className="weather-panel">
      {lines.map((line, i) => {
        if (line.toLowerCase().includes("current weather") || line.toLowerCase().includes("forecast"))
          return <h3 key={i} className="weather-section-title">{line.replace(/[*#]/g, "").trim()}</h3>;
        if (line.includes("temperature") || line.includes("weather"))
          return (
            <div key={i} className="weather-row">
              <span className="weather-icon">🌡️</span>
              <span>{line.replace(/['"{}[\]]/g, "").trim()}</span>
            </div>
          );
        if (line.includes("datetime"))
          return (
            <div key={i} className="weather-time">
              🕐 {line.replace(/['"{}[\]:]/g, "").replace("datetime", "").trim()}
            </div>
          );
        return <p key={i} className="weather-text">{line.replace(/[*#]/g, "").trim()}</p>;
      })}
    </div>
  );
}