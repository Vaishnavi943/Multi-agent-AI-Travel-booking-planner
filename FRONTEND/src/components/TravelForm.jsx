import { useState } from "react";

const EXAMPLES = [
  "Trip from Mumbai to Paris for 7 days in July",
  "Weekend getaway from Delhi to Goa",
  "Backpacking Thailand from Bangalore, 2 weeks",
  "Honeymoon trip to Maldives from Kolkata",
];

export default function TravelForm({ onSearch, loading }) {
  const [query, setQuery] = useState("");

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    onSearch(q);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="travel-form">
      <label htmlFor="travel-query">Where do you want to go?</label>

      <div className="input-row">
        <textarea
          id="travel-query"
          placeholder="e.g. 7-day trip from Mumbai to Tokyo in October, budget ₹1.5L…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          aria-label="Travel query"
        />
        <button
          className={`btn-search ${loading ? "loading" : ""}`}
          onClick={submit}
          disabled={loading || !query.trim()}
          aria-label="Search travel options"
        >
          {loading ? "Planning…" : "Plan Trip ✈️"}
        </button>
      </div>

      <div className="example-chips">
        <span>Try:</span>
        {EXAMPLES.map(ex => (
          <button
            key={ex}
            className="chip"
            onClick={() => { setQuery(ex); }}
            disabled={loading}
          >
            {ex.split(" ").slice(0, 5).join(" ")}…
          </button>
        ))}
      </div>
    </div>
  );
}