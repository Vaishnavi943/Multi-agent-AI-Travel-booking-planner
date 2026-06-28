import { useState, useEffect, useRef } from "react";

// Token-by-token streaming effect
function StreamingText({ text }) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    if (!text) return;
    indexRef.current = 0;
    setDisplayed("");

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        // Print 3 chars at a time for readable speed
        const chunk = text.slice(indexRef.current, indexRef.current + 3);
        setDisplayed(prev => prev + chunk);
        indexRef.current += 3;
      } else {
        clearInterval(interval);
      }
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="streaming-text">
      {displayed}
      {displayed.length < (text?.length || 0) && (
        <span className="streaming-cursor">▋</span>
      )}
    </div>
  );
}

function renderLines(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  return lines.map((line, i) => {
    const clean = line.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim();

    if (/^day\s*\d+/i.test(clean)) {
      return (
        <div key={i} className="day-header">
          <span className="day-pill">📅</span>
          <span>{clean}</span>
        </div>
      );
    }

    if (/^(morning|afternoon|evening|night|check.in|check.out|breakfast|lunch|dinner|arrival|departure):/i.test(clean)) {
      const [label, ...rest] = clean.split(":");
      return (
        <div key={i} className="itinerary-section">
          <span className="itinerary-section-label">{label}:</span>
          <span>{rest.join(":").trim()}</span>
        </div>
      );
    }

    if (line.startsWith("* ") || line.startsWith("- ") || line.startsWith("• ")) {
      return (
        <div key={i} className="itinerary-bullet">
          <span className="bullet-dot">•</span>
          <span>{clean.replace(/^[*\-•]\s*/, "")}</span>
        </div>
      );
    }

    if (/^\d+\.\s/.test(clean)) {
      return (
        <div key={i} className="itinerary-bullet">
          <span className="bullet-dot">{clean.match(/^\d+/)[0]}.</span>
          <span>{clean.replace(/^\d+\.\s*/, "")}</span>
        </div>
      );
    }

    return <p key={i} className="itinerary-text">{clean}</p>;
  });
}

export default function ItineraryPanel({ text, streaming }) {
  const [isStreaming, setIsStreaming]   = useState(false);
  const [streamDone, setStreamDone]     = useState(false);
  const prevTextRef = useRef("");

  useEffect(() => {
    if (text && text !== prevTextRef.current) {
      prevTextRef.current = text;
      setIsStreaming(true);
      setStreamDone(false);
      // After streaming completes, switch to structured view
      const len     = text.length;
      const duration = Math.min(len / 3 * 16, 8000); // cap at 8s
      const timer   = setTimeout(() => {
        setIsStreaming(false);
        setStreamDone(true);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [text]);

  if (!text) {
    return (
      <div className="empty-state">
        {streaming
          ? <p className="streaming-waiting">📋 Building your itinerary...</p>
          : <p>Itinerary will appear here.</p>}
      </div>
    );
  }

  return (
    <div className="itinerary-panel">
      {isStreaming && !streamDone ? (
        // Token-by-token streaming view
        <StreamingText text={text} />
      ) : (
        // Structured formatted view after streaming
        renderLines(text)
      )}
    </div>
  );
}