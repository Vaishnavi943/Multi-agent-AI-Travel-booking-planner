# ✈️ Multi-Agent AI Travel Booking System

A full-stack AI travel planning app built on **LangGraph** agents, **MCP (Model Context Protocol)**, **FastAPI**, and **React**.

```
┌─────────────────────────────────────────────────┐
│  React Frontend (Vite)                          │
│  TravelForm → ProgressTracker → Tabs → Cards   │
└──────────────────┬──────────────────────────────┘
                   │ POST /api/travel/stream (SSE)
┌──────────────────▼──────────────────────────────┐
│  FastAPI  (api.py)                              │
│  /health · /api/travel · /api/travel/stream     │
└──────────────────┬──────────────────────────────┘
                   │ LangGraph Agents
┌──────────────────▼──────────────────────────────┐
│  flight_agent → hotel_agent →                   │
│  weather_agent → itinerary_agent                │
│  Checkpointer: PostgreSQL (AsyncPostgresSaver)  │
└──────────────────┬──────────────────────────────┘
                   │ MCP Servers
┌──────────────────▼──────────────────────────────┐
│  aviationstack-mcp  (local, cloned from GitHub) │
│  custom_weather_mcp_server.py  (custom built)   │
│  Tavily MCP  (hotel search)                     │
└─────────────────────────────────────────────────┘
```

---

## Project Structure

```
Multi-Agent AI Travel Booking System/
├── BACKEND/
│   ├── aviationstack-mcp/         ← cloned from GitHub (local MCP server)
│   │   ├── index.js
│   │   └── package.json
│   ├── testing_mcp/               ← MCP testing utilities
│   ├── .venv/                     ← Python virtual environment (uv)
│   ├── api.py                     ← FastAPI app (production)
│   ├── main.py                    ← original LangGraph CLI script
│   ├── mcp_client.py              ← MCP tool wrappers
│   ├── custom_weather_mcp_server.py ← custom weather MCP server
│   ├── requirements.txt
│   └── .env
├── FRONTEND/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── components/
│   │       ├── Header.jsx
│   │       ├── TravelForm.jsx
│   │       ├── ProgressTracker.jsx
│   │       ├── FlightCards.jsx
│   │       ├── HotelCards.jsx
│   │       ├── WeatherPanel.jsx
│   │       ├── ItineraryPanel.jsx
│   │       └── Footer.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── .env.local
├── render.yaml                    ← Render Blueprint (deploys both services)
└── README.md
```

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 18, Vite, plain CSS                       |
| Backend    | FastAPI, Uvicorn, Python 3.12                   |
| AI Agents  | LangGraph, LangChain, Groq (llama-3.3-70b)      |
| MCP        | AviationStack MCP, Custom Weather MCP, Tavily   |
| Database   | PostgreSQL (LangGraph checkpointer)             |
| Package mgr| uv (Python), npm (Node)                         |
| Deploy     | Render (backend + frontend + postgres)          |

---

## Local Development

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL running locally
- `uv` installed (`pip install uv`)

### 1. Database Setup

```bash
psql -U postgres -c "CREATE DATABASE lg_memory_travel_booking_system;"
```

### 2. MCP Servers — start before backend

**AviationStack MCP** (in a separate terminal):
```bash
cd BACKEND/aviationstack-mcp
npm install
node index.js
```

**Custom Weather MCP** (in another terminal):
```bash
cd BACKEND
python custom_weather_mcp_server.py
```

### 3. Backend

```bash
cd BACKEND
uv pip install --system -r requirements.txt
```

Create `.env`:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/lg_memory_travel_booking_system
GROQ_API_KEY=your_groq_key_here
TAVILY_API_KEY=your_tavily_key_here
AVIATIONSTACK_API_KEY=your_aviationstack_key_here
FRONTEND_URL=http://localhost:5173
```

Start the backend:
```bash
uvicorn api:app --reload --port 8000
```

API docs: http://127.0.0.1:8000/docs

### 4. Frontend

```bash
cd FRONTEND
npm install
npm run dev        # → http://localhost:5173
```

Create `FRONTEND/.env.local`:
```env
VITE_API_URL=
```
Leave `VITE_API_URL` blank — Vite proxies `/api/*` to `http://localhost:8000` automatically.

---

## Deploying to Render

### Prerequisites
- Push your entire project to GitHub.
- Make sure `BACKEND/aviationstack-mcp/` has **no nested `.git` folder** (delete it before pushing):

```powershell
# PowerShell
Remove-Item -Recurse -Force BACKEND/aviationstack-mcp/.git
```

### Step 1 — Connect repo to Render
1. Go to https://dashboard.render.com → **New → Blueprint**
2. Connect your GitHub repo.
3. Render detects `render.yaml` and shows both services + the database.
4. Click **Apply**.

### Step 2 — Set environment variables in Render dashboard

**Backend service:**

| Key                    | Value                                    |
|------------------------|------------------------------------------|
| `GROQ_API_KEY`         | your Groq API key                        |
| `TAVILY_API_KEY`       | your Tavily API key                      |
| `AVIATIONSTACK_API_KEY`| your AviationStack API key               |
| `FRONTEND_URL`         | `https://multi-agent-ai-travel-booking-system-frontend.onrender.com` |
| `DATABASE_URL`         | ✅ auto-injected by Render               |

**Frontend service:**

| Key            | Value                                                                  |
|----------------|------------------------------------------------------------------------|
| `VITE_API_URL` | `https://multi-agent-ai-travel-booking-system-backend.onrender.com`   |

### Step 3 — After first deploy, tighten CORS

In `BACKEND/api.py`, change:
```python
# Before
allow_origins=["*"],

# After
allow_origins=[FRONTEND_URL],
```
Then `git push` — Render redeploys automatically.

---

## API Reference

### `GET /health`
Health check used by Render.
```json
{ "status": "ok" }
```

### `POST /api/travel`
Synchronous — waits for all agents, returns full result.

```json
// Request
{ "query": "7 days in Tokyo from Mumbai", "thread_id": null }

// Response
{
  "thread_id": "uuid",
  "flight_results": "[{...}, {...}, {...}]",
  "hotel_results":  "[{...}, {...}, {...}]",
  "weather_results": "Current: ... Forecast: ...",
  "itinerary": "Day 1: ...",
  "llm_calls": 4
}
```

### `POST /api/travel/stream`
Server-Sent Events — streams progress as each agent completes.

```
data: {"type":"progress","node":"flight_agent","label":"Finding flights","data":{...}}
data: {"type":"progress","node":"hotel_agent","label":"Searching hotels","data":{...}}
data: {"type":"progress","node":"weather_agent","label":"Checking weather","data":{...}}
data: {"type":"progress","node":"itinerary_agent","label":"Building itinerary","data":{...}}
data: {"type":"done","thread_id":"uuid"}
```

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| `AsyncPostgresSaver` instead of `PostgresSaver` | FastAPI runs its own event loop — sync checkpointer causes `asyncio.run()` conflicts |
| Graph compiled once at startup (lifespan) | Avoids re-creating DB connection on every request |
| `request.app.state.graph` in endpoints | Safely accesses the compiled graph without globals |
| SSE streaming (`/api/travel/stream`) | Shows real-time agent progress in the UI |
| LLM returns JSON for flights/hotels | Structured cards in UI, saves tokens vs freeform text |
| Single CORSMiddleware | Adding it twice causes header conflicts in FastAPI |

---

## Frontend Features

- **Tab-based results** — Flights / Hotels / Weather / Itinerary
- **Clickable flight cards** — tap any card to search on Google Flights
- **Hotel cards** — star ratings, price/night, highlight tags
- **Real-time progress tracker** — shows which agent is currently running
- **Example query chips** — one-tap to fill the search box
- **Responsive** — works on mobile and desktop
- **Footer** — developer contact links (Email, LinkedIn, GitHub)

---

## Developer

**Kumari Vaishnavi** — AI & Full Stack Developer · 
[✉️ Email](mailto:vaishnavi@example.com) · [💼 LinkedIn](https://linkedin.com/in/vaishnavi) · [🐙 GitHub](https://github.com/vaishnavi)
