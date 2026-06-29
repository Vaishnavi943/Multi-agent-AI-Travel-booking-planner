import { useState, useRef, useEffect } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
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
    const parsed  = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export default function App() {
  const [steps, setSteps]             = useState(INITIAL_STEPS);
  const [results, setResults]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [threadId, setThreadId]       = useState(null);
  const [activeTab, setActiveTab]     = useState("flights");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions]       = useState([]);
  const resultsRef = useRef(null);

  useEffect(() => { fetchSessions(); }, []);

  useEffect(() => {
    if (results && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [results]);

  const fetchSessions = async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/sessions`);
      if (!res.ok) { setSessions([]); return; }
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch { setSessions([]); }
  };

  const markStep = (nodeId, status) =>
    setSteps(prev => prev.map(s => s.id === nodeId ? { ...s, status } : s));

  const resetState = () => {
    setSteps(INITIAL_STEPS);
    setResults(null);
    setError("");
    setActiveTab("flights");
  };

  const handleResume = async (session) => {
    resetState();
    setLoading(true);
    setSidebarOpen(false);
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${session.thread_id}`);
      if (!res.ok) throw new Error("Session not found");
      const data = await res.json();
      setResults(data);
      setThreadId(session.thread_id);
      setSteps(prev => prev.map(s => ({ ...s, status: "done" })));
    } catch (e) {
      setError(e.message || "Could not resume session.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fixed delete — properly removes from state
  const handleDeleteSession = async (sessionThreadId, e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionThreadId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        // Remove from local state immediately
        setSessions(prev => prev.filter(s => s.thread_id !== sessionThreadId));
        // If currently viewing this session, clear it
        if (threadId === sessionThreadId) {
          resetState();
          setThreadId(null);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || "Could not delete session.");
      }
    } catch {
      setError("Network error — could not delete session.");
    }
  };

  const handleSearch = async (query) => {
    resetState();
    setLoading(true);

    const collected = {
      flight_results: "", hotel_results: "",
      weather_results: "", itinerary: "", user_query: query,
    };

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

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

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
              // Add new session to sidebar immediately
              setSessions(prev => [{
                thread_id:  event.thread_id,
                query:      query,
                created_at: new Date().toISOString(),
              }, ...prev.filter(s => s.thread_id !== event.thread_id)]);
            }
            if (event.type === "error") throw new Error(event.message);
          } catch { }
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setLoading(false);
      setSteps(INITIAL_STEPS);
    }
  };

  const flights = results ? safeParseJSON(results.flight_results) : [];
  const hotels  = results ? safeParseJSON(results.hotel_results)  : [];

  const TABS = [
    { id: "flights",   label: "Flights",   icon: "✈️",  count: flights.length },
    { id: "hotels",    label: "Hotels",    icon: "🏨",  count: hotels.length  },
    { id: "weather",   label: "Weather",   icon: "🌤️", count: null           },
    { id: "itinerary", label: "Itinerary", icon: "📋",  count: null           },
  ];

  return (
    <div className="app">
      {/* Sticky Header */}
      <Header
        onMenuClick={() => setSidebarOpen(o => !o)}
        sessionCount={sessions.length}
      />

      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={sessions}
        activeThreadId={threadId}
        onResume={handleResume}
        onDelete={handleDeleteSession}
        onNewChat={() => { resetState(); setThreadId(null); setSidebarOpen(false); }}
      />

      {/* Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

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
                {/* Sticky tab nav */}
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
                  {activeTab === "hotels"    && <HotelCards  hotels={hotels}   />}
                  {activeTab === "weather"   && <WeatherPanel raw={results.weather_results} />}
                  {activeTab === "itinerary" && <ItineraryPanel text={results.itinerary} streaming={loading} />}
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