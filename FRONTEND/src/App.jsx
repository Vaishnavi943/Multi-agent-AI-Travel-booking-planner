import { useState, useRef, useEffect } from "react";
import Header from "./components/Header";
import TravelForm from "./components/TravelForm";
import ProgressTracker from "./components/ProgressTracker";
import FlightCards from "./components/FlightCards";
import HotelCards from "./components/HotelCards";
import WeatherPanel from "./components/WeatherPanel";
import ItineraryPanel from "./components/ItineraryPanel";
import Footer from "./components/Footer";
import "./index.css";

const API_BASE = import.meta.env.VITE_API_URL || "";

const INITIAL_STEPS = [
  { id: "flight_agent",    label: "Flights",   icon: "✈️",  status: "waiting" },
  { id: "hotel_agent",     label: "Hotels",    icon: "🏨",  status: "waiting" },
  { id: "weather_agent",   label: "Weather",   icon: "🌤️", status: "waiting" },
  { id: "itinerary_agent", label: "Itinerary", icon: "📋",  status: "waiting" },
];

function safeParseJSON(str) {
  if (!str) return [];
  if (Array.isArray(str)) return str;
  try {
    const cleaned = str.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [steps, setSteps]       = useState(INITIAL_STEPS);
  const [results, setResults]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [threadId, setThreadId] = useState(null);
  const [activeTab, setActiveTab] = useState("flights");
  const resultsRef = useRef(null);

  useEffect(() => {
    if (results && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [results]);

  const markStep = (nodeId, status) =>
    setSteps(prev => prev.map(s => (s.id === nodeId ? { ...s, status } : s)));

  const handleSearch = async (query) => {
    setSteps(INITIAL_STEPS);
    setResults(null);
    setError("");
    setLoading(true);
    setActiveTab("flights");

    const collected = { flight_results: "", hotel_results: "", weather_results: "", itinerary: "" };

    try {
      const resp = await fetch(`${API_BASE}/api/travel/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, thread_id: threadId }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || "Server error");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const event = JSON.parse(line.slice(5).trim());
            if (event.type === "progress") {
              markStep(event.node, "active");
              if (event.data) {
                Object.assign(collected, event.data);
                setResults({ ...collected });
              }
              const idx = INITIAL_STEPS.findIndex(s => s.id === event.node);
              if (idx > 0) markStep(INITIAL_STEPS[idx - 1].id, "done");
            }
            if (event.type === "done") {
              setSteps(prev => prev.map(s => ({ ...s, status: "done" })));
              setThreadId(event.thread_id);
              setLoading(false);
            }
            if (event.type === "error") throw new Error(event.message);
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
      setSteps(INITIAL_STEPS);
    }
  };

  const flights = results ? safeParseJSON(results.flight_results) : [];
  const hotels  = results ? safeParseJSON(results.hotel_results)  : [];

  const TABS = [
    { id: "flights",   label: "Flights",   icon: "✈️",  count: flights.length },
    { id: "hotels",    label: "Hotels",    icon: "🏨",  count: hotels.length },
    { id: "weather",   label: "Weather",   icon: "🌤️", count: null },
    { id: "itinerary", label: "Itinerary", icon: "📋",  count: null },
  ];

  return (
    <div className="app">
      <Header />
      <main className="main">
        <TravelForm onSearch={handleSearch} loading={loading} />

        {error && (
          <div className="error-banner" role="alert">
            <span>⚠️</span>
            <p>{error}</p>
            <button onClick={() => setError("")}>✕</button>
          </div>
        )}

        {(loading || results) && (
          <section className="results-section" ref={resultsRef}>
            <ProgressTracker steps={steps} />

            {results && (
              <div className="tabs-container">
                <div className="tabs-nav" role="tablist">
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                      {tab.count > 0 && <span className="tab-badge">{tab.count}</span>}
                    </button>
                  ))}
                </div>

                <div className="tab-content">
                  {activeTab === "flights"   && <FlightCards flights={flights} />}
                  {activeTab === "hotels"    && <HotelCards hotels={hotels} />}
                  {activeTab === "weather"   && <WeatherPanel raw={results.weather_results} />}
                  {activeTab === "itinerary" && <ItineraryPanel text={results.itinerary} />}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}