function parseWeatherText(raw) {
  if (!raw) return null;

  let text = typeof raw === "string" ? raw
    : Array.isArray(raw) ? raw.map(i => i?.text || i?.content || JSON.stringify(i)).join("\n")
    : JSON.stringify(raw);

  // Remove "type: text, text:" prefix that MCP adds
  text = text.replace(/^type:\s*text,?\s*text:\s*/i, "").trim();
  text = text.replace(/,?\s*id:\s*lc_[a-f0-9-]+/g, "").trim();

  const result = {};
  const pairs = text.split(/,\s*\\n\s*|,\s*\n\s*/);
  pairs.forEach(pair => {
    const match = pair.replace(/\\n/g, "").match(/^(\w+(?:_\w+)*):\s*(.+)$/);
    if (match) result[match[1].trim()] = match[2].trim();
  });

  return Object.keys(result).length > 0 ? result : null;
}

function parseForecastItems(raw) {
  if (!raw) return [];

  let text = typeof raw === "string" ? raw
    : Array.isArray(raw) ? raw.map(i => i?.text || i?.content || JSON.stringify(i)).join("\n")
    : JSON.stringify(raw);

  text = text.replace(/^type:\s*text,?\s*text:\s*/i, "").trim();
  text = text.replace(/,?\s*id:\s*lc_[a-f0-9-]+/g, "").trim();
  text = text.replace(/^city:\s*[^,\\n]+[,\\n]\s*forecast:\s*/i, "").trim();

  const items = [];
  // Split on double newline patterns
  const blocks = text.split(/\\n\s*,\s*\\n|\\n\\n/).filter(b => b.trim());

  blocks.forEach(block => {
    const obj = {};
    block.split(/,\s*\\n\s*|\\n,\s*/).forEach(pair => {
      const m = pair.replace(/\\n/g, "").trim().match(/^(\w+(?:_\w+)*):\s*(.+)$/);
      if (m) obj[m[1].trim()] = m[2].trim();
    });
    if (obj.datetime || obj.temperature) items.push(obj);
  });

  return items;
}

function getWeatherEmoji(cond) {
  const c = (cond || "").toLowerCase();
  if (c.includes("rain"))   return "🌧️";
  if (c.includes("cloud"))  return "☁️";
  if (c.includes("clear") || c.includes("sun")) return "☀️";
  if (c.includes("snow"))   return "❄️";
  if (c.includes("storm"))  return "⛈️";
  if (c.includes("fog") || c.includes("mist")) return "🌫️";
  return "🌤️";
}

function WeatherCard({ data }) {
  if (!data) return null;
  const city     = data.city           || "—";
  const temp     = data.temperature_c  || data.temperature || "—";
  const feels    = data.feels_like_c   || data.feels_like  || "—";
  const humidity = data.humidity       || "—";
  const condition= data.condition      || data.weather     || "—";
  const wind     = data.wind_speed     || "—";

  return (
    <div className="weather-card">
      <div className="weather-card-top">
        <div>
          <p className="weather-city">📍 {city}</p>
          <p className="weather-desc">{getWeatherEmoji(condition)} {condition}</p>
        </div>
        <div className="weather-temp">{temp !== "—" ? `${temp}°C` : "—"}</div>
      </div>
      <div className="weather-stats">
        <div className="weather-stat"><span>🌡️</span><span>Feels like</span><strong>{feels !== "—" ? `${feels}°C` : "—"}</strong></div>
        <div className="weather-stat"><span>💧</span><span>Humidity</span><strong>{humidity !== "—" ? `${humidity}%` : "—"}</strong></div>
        <div className="weather-stat"><span>💨</span><span>Wind</span><strong>{wind !== "—" ? `${wind} m/s` : "—"}</strong></div>
      </div>
    </div>
  );
}

function ForecastGrid({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="forecast-grid">
      {items.slice(0, 6).map((item, i) => {
        const dt   = (item.datetime || "").replace("T", " ").slice(0, 16);
        const temp = item.temperature || "—";
        const cond = item.weather || item.condition || "—";
        return (
          <div key={i} className="forecast-item">
            <p className="forecast-time">{dt || `Slot ${i + 1}`}</p>
            <p className="forecast-emoji">{getWeatherEmoji(cond)}</p>
            <p className="forecast-temp">{temp !== "—" ? `${temp}°C` : "—"}</p>
            <p className="forecast-desc">{cond}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function WeatherPanel({ raw }) {
  if (!raw) return <div className="empty-state"><p>Weather data loading...</p></div>;

  const text = typeof raw === "string" ? raw
    : Array.isArray(raw) ? raw.map(i => i?.text || i?.content || JSON.stringify(i)).join("\n")
    : JSON.stringify(raw);

  const currentMatch  = text.match(/Current:\s*([\s\S]*?)(?=\nForecast:|$)/i);
  const forecastMatch = text.match(/Forecast:\s*([\s\S]*?)$/i);

  const currentRaw   = currentMatch?.[1]?.trim()  || "";
  const forecastRaw  = forecastMatch?.[1]?.trim() || "";
  const currentData  = parseWeatherText(currentRaw);
  const forecastItems = parseForecastItems(forecastRaw);

  return (
    <div className="weather-panel">
      <h3 className="weather-section-title">🌤️ Current Weather</h3>
      {currentData
        ? <WeatherCard data={currentData} />
        : <p className="weather-text">{currentRaw.replace(/\\n/g, " ").replace(/type:\s*text,?\s*text:\s*/i, "").trim()}</p>
      }
      {forecastItems.length > 0 && (
        <>
          <h3 className="weather-section-title" style={{ marginTop: "1.5rem" }}>📅 Forecast</h3>
          <ForecastGrid items={forecastItems} />
        </>
      )}
    </div>
  );
}