function safeStr(val) {
  if (val === null || val === undefined) return "N/A";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function parseWeatherBlock(raw) {
  if (!raw) return null;
  // If it's already an object
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  // Try JSON parse
  try {
    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    // Extract JSON object from string like "Current: {...}\nForecast: {...}"
    const match = str.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return null;
}

function parseAllWeather(raw) {
  if (!raw) return { current: null, forecast: null, rawText: "" };

  const text = typeof raw === "string" ? raw
    : Array.isArray(raw) ? raw.map(i => i?.text || i?.content || JSON.stringify(i)).join("\n")
    : JSON.stringify(raw, null, 2);

  // Split on Current / Forecast sections
  const currentMatch  = text.match(/Current[:\s]*([\s\S]*?)(?=Forecast|$)/i);
  const forecastMatch = text.match(/Forecast[:\s]*([\s\S]*?)$/i);

  const currentRaw  = currentMatch?.[1]?.trim() || "";
  const forecastRaw = forecastMatch?.[1]?.trim() || "";

  // Try to parse each as JSON
  let current  = null;
  let forecast = null;

  try { current  = JSON.parse(currentRaw);  } catch {}
  try { forecast = JSON.parse(forecastRaw); } catch {}

  // Handle list format like [{'type':...,'text':...}]
  if (!current && currentRaw) {
    const jsonMatch = currentRaw.match(/\{[^{}]*\}/g);
    if (jsonMatch) {
      try {
        // replace single quotes with double for JSON parse
        const fixed = jsonMatch[0].replace(/'/g, '"');
        const parsed = JSON.parse(fixed);
        current = parsed.text ? tryParseJSON(parsed.text) : parsed;
      } catch {}
    }
  }

  return { current, forecast, rawText: text, currentRaw, forecastRaw };
}

function tryParseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function CurrentWeather({ data, rawText }) {
  if (!data) {
    // fallback: just show raw text cleaned up
    return (
      <div className="weather-raw">
        {rawText?.split("\n").filter(l => l.trim()).map((line, i) => (
          <p key={i} className="weather-text">{line.replace(/['"{}[\]]/g, "").trim()}</p>
        ))}
      </div>
    );
  }

  const city        = data.city        || data.name        || data.location || "—";
  const temp        = data.temperature || data.temp        || data.main?.temp || "—";
  const feels       = data.feels_like  || data.feelsLike   || data.main?.feels_like || "—";
  const humidity    = data.humidity    || data.main?.humidity || "—";
  const description = data.description || data.weather?.[0]?.description || data.condition || "—";
  const wind        = data.wind_speed  || data.wind?.speed || data.windSpeed || "—";

  return (
    <div className="weather-card">
      <div className="weather-card-top">
        <div>
          <p className="weather-city">📍 {city}</p>
          <p className="weather-desc">{description}</p>
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

function ForecastWeather({ data, rawText }) {
  // data could be array of forecast items or an object with a list
  let items = [];

  if (Array.isArray(data)) {
    items = data;
  } else if (data?.forecast && Array.isArray(data.forecast)) {
    items = data.forecast;
  } else if (data?.list && Array.isArray(data.list)) {
    items = data.list;
  }

  if (items.length === 0) {
    // fallback raw text
    return (
      <div className="weather-raw">
        {rawText?.split("\n").filter(l => l.trim()).slice(0, 8).map((line, i) => (
          <p key={i} className="weather-text">{line.replace(/['"{}[\]]/g, "").trim()}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="forecast-grid">
      {items.slice(0, 6).map((item, i) => {
        const time  = item.datetime || item.dt_txt || item.time || item.date || `Slot ${i + 1}`;
        const temp  = item.temperature || item.temp || item.main?.temp || "—";
        const desc  = item.weather     || item.description || item.weather?.[0]?.description || "—";
        return (
          <div key={i} className="forecast-item">
            <p className="forecast-time">{String(time).replace("T", " ").slice(0, 16)}</p>
            <p className="forecast-temp">{temp !== "—" ? `${temp}°C` : "—"}</p>
            <p className="forecast-desc">{safeStr(desc)}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function WeatherPanel({ raw }) {
  if (!raw) return <div className="empty-state"><p>Weather data loading...</p></div>;

  const { current, forecast, rawText, currentRaw, forecastRaw } = parseAllWeather(raw);

  return (
    <div className="weather-panel">
      <h3 className="weather-section-title">🌤️ Current Weather</h3>
      <CurrentWeather data={current} rawText={currentRaw || rawText} />

      <h3 className="weather-section-title" style={{ marginTop: "1.5rem" }}>📅 Forecast</h3>
      <ForecastWeather data={forecast} rawText={forecastRaw || rawText} />
    </div>
  );
}