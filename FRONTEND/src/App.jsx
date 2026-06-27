import { useState, useRef, useEffect } from "react";
import TravelForm from "./components/TravelForm";
import ProgressTracker from "./components/ProgressTracker";
import ResultsPanel from "./components/ResultsPanel";
import Header from "./components/Header";
import "./index.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const INITIAL_STEPS = [
  { id: "flight_agent",     label: "Flights",    icon: "✈️",  status: "waiting" },
  { id: "hotel_agent",      label: "Hotels",     icon: "🏨",  status: "waiting" },
  { id: "weather_agent",    label: "Weather",    icon: "🌤️", status: "waiting" },
  { id: "itinerary_agent",  label: "Itinerary",  icon: "📋",  status: "waiting" },
];

export default function App() {
  const [steps, setSteps]       = useState(INITIAL_STEPS);
  const [results, setResults]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [threadId, setThreadId] = useState(null);
  const esRef = useRef(null);

  // cleanup SSE on unmount
  useEffect(() => () => esRef.current?.close(), []);

  const resetState = () => {
    setSteps(INITIAL_STEPS);
    setResults(null);
    setError("");
  };

  const markStep = (nodeId, status) =>
    setSteps(prev =>
      prev.map(s => (s.id === nodeId ? { ...s, status } : s))
    );

  const handleSearch = async (query) => {
    resetState();
    setLoading(true);

    // close any previous SSE stream
    esRef.current?.close();

    // We'll collect data streamed from the backend
    const collected = {
      flight_results: "",
      hotel_results: "",
      weather_results: "",
      itinerary: "",
      llm_calls: 0,
    };

    // Use fetch + ReadableStream for SSE so we can POST with a body
    try {
      const resp = await fetch(`${API_BASE}/api/travel/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, thread_id: threadId }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || "Server error");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE lines: split on double newline
        const parts = buffer.split("\n\n");
        buffer = parts.pop(); // keep incomplete chunk

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "progress") {
              markStep(event.node, "active");

              // accumulate partial data
              if (event.data) {
                Object.assign(collected, event.data);
                setResults({ ...collected });
              }

              // mark previous steps done
              const idx = INITIAL_STEPS.findIndex(s => s.id === event.node);
              if (idx > 0) {
                markStep(INITIAL_STEPS[idx - 1].id, "done");
              }
            }

            if (event.type === "done") {
              // mark all steps done
              setSteps(prev => prev.map(s => ({ ...s, status: "done" })));
              setThreadId(event.thread_id);
              setLoading(false);
            }

            if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch {
            /* skip malformed SSE lines */
          }
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
      setSteps(INITIAL_STEPS);
    }
  };

  return (
    <div className="app">
      <Header />

      <main className="main">
        <TravelForm onSearch={handleSearch} loading={loading} />

        {error && (
          <div className="error-banner" role="alert">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
            <button className="error-dismiss" onClick={() => setError("")}>✕</button>
          </div>
        )}

        {(loading || results) && (
          <section className="results-section">
            <ProgressTracker steps={steps} />
            {results && <ResultsPanel results={results} threadId={threadId} />}
          </section>
        )}
      </main>

      <footer className="footer">
        <p>Powered by LangGraph · Groq · FastAPI</p>
      </footer>
    </div>
  );
}