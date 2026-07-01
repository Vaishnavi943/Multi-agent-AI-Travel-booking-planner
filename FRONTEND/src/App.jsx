import { useState, useRef, useEffect, useCallback } from "react";
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

// ── Key fix: use a unique key to force full re-render on new trip ──────────
let dashboardKey = 0;

export default function App() {
  const [key, setKey]                 = useState(0);           // forces re-render
  const [steps, setSteps]             = useState(INITIAL_STEPS);
  const [results, setResults]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [threadId, setThreadId]       = useState(null);
  const [activeTab, setActiveTab]     = useState("flights");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions]       = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const resultsRef = useRef(null);
  const abortRef   = useRef(null);   // to cancel ongoing stream

  // ── Fetch sessions from backend (persists across refresh) ─────────────────
  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/sessions`);
      if (!res.ok) { setSessions([]); return; }
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // Fetch on every page load — this is what persists across refresh
  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Scroll to results when they appear
  useEffect(() => {
    if (results && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [results]);

  const markStep = (nodeId, status) =>
    setSteps(prev => prev.map(s => s.id === nodeId ? { ...s, status } : s));

  // ── New Trip: cancel stream, reset everything, force re-render ────────────
  const handleNewChat = useCallback(() => {
    // Cancel any ongoing fetch
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    dashboardKey++;
    setKey(dashboardKey);        // ← forces child components to remount
    setSteps(INITIAL_STEPS);
    setResults(null);
    setError("");
    setActiveTab("flights");
    setThreadId(null);
    setLoading(false);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ── Resume past session ───────────────────────────────────────────────────
  const handleResume = useCallback(async (session) => {
    // Cancel ongoing stream first
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setError("");
    setResults(null);
    setLoading(true);
    setSidebarOpen(false);
    setSteps(INITIAL_STEPS.map(s => ({ ...s, status: "done" })));
    setActiveTab("flights");

    try {
      const res = await fetch(`${API_BASE}/api/sessions/${session.thread_id}`);
      if (!res.ok) throw new Error("Session not found");
      const data = await res.json();
      setResults(data);
      setThreadId(session.thread_id);
    } catch (e) {
      setError(e.message || "Could not resume session.");
      setSteps(INITIAL_STEPS);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Delete session ────────────────────────────────────────────────────────
  const handleDeleteSession = useCallback(async (sessionThreadId, e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionThreadId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.thread_id !== sessionThreadId));
        if (threadId === sessionThreadId) handleNewChat();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || "Could not delete session.");
      }
    } catch {
      setError("Network error — could not delete.");
    }
  }, [threadId, handleNewChat]);

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (query) => {
    // Cancel previous stream
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setSteps(INITIAL_STEPS);
    setResults(null);
    setError("");
    setActiveTab("flights");
    setLoading(true);

    const collected = {
      flight_results: "", hotel_results: "",
      weather_results: "", itinerary: "", user_query: query,
    };

    try {
      const resp = await fetch(`${API_BASE}/api/travel/stream`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query }),
        signal:  controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${resp.status}`);
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
              const idx = INITIAL_STEPS.findIndex(s => s.id === event.node);
              if (idx > 0) markStep(INITIAL_STEPS[idx - 1].id, "done");

              if (event.data) {
                Object.assign(collected, event.data);
                // Force a new object reference so React re-renders
                setResults(prev => ({ ...collected }));
              }
            }

            if (event.type === "done") {
              setSteps(prev => prev.map(s => ({ ...s, status: "done" })));
              setThreadId(event.thread_id);
              setLoading(false);
              abortRef.current = null;
              // Add to sidebar with real query name
              setSessions(prev => {
                const filtered = prev.filter(s => s.thread_id !== event.thread_id);
                return [{
                  thread_id:  event.thread_id,
                  query,
                  created_at: new Date().toISOString(),
                }, ...filtered];
              });
            }

            if (event.type === "error") throw new Error(event.message);
          } catch (parseErr) {
            if (parseErr.message !== "Unexpected end of JSON input") {
              console.warn("SSE parse error:", parseErr);
            }
          }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") return; // user cancelled
      console.error("Stream error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
      setSteps(INITIAL_STEPS);
    }
  }, []);

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
      {/* Sticky header */}
      <Header
        onMenuClick={() => setSidebarOpen(o => !o)}
        sessionCount={sessions.length}
        onLogoClick={handleNewChat}
      />

      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={sessions}
        sessionsLoading={sessionsLoading}
        activeThreadId={threadId}
        onResume={handleResume}
        onDelete={handleDeleteSession}
        onNewChat={handleNewChat}
      />
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content — key prop forces full remount on new trip */}
      <main className="main" key={key}>
        <TravelForm onSearch={handleSearch} loading={loading} />

        {error && (
          <div className="error-banner" role="alert">
            <span>⚠️</span>
            <p>{error}</p>
            <button onClick={() => setError("")}>✕</button>
          </div>
        )}

        {/* Empty home state */}
        {!loading && !results && !error && (
          <div className="empty-home">
            <p className="empty-home-icon">🌍</p>
            <p className="empty-home-text">Where do you want to go?</p>
            <p className="empty-home-sub">Type your travel query above to get started</p>
          </div>
        )}

        {/* Results */}
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