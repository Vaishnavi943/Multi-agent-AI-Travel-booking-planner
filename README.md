# ✈️ Travel AI Planner

A full-stack AI travel planning app built on **LangGraph** agents, **FastAPI**, and **React**.

```
┌─────────────────────────────────────────────┐
│  React Frontend (Vite)                      │
│  TravelForm → ProgressTracker → Results     │
└──────────────────┬──────────────────────────┘
                   │ POST /api/travel/stream (SSE)
┌──────────────────▼──────────────────────────┐
│  FastAPI  (api.py)                          │
│  /health · /api/travel · /api/travel/stream │
└──────────────────┬──────────────────────────┘
                   │ LangGraph
┌──────────────────▼──────────────────────────┐
│  Agents: flight → hotel → weather →         │
│          itinerary                          │
│  Checkpointer: PostgreSQL                   │
└─────────────────────────────────────────────┘
```

---

## Project Structure

```
travel-ai-app/
├── backend/
│   ├── main.py            ← original LangGraph script (untouched)
│   ├── api.py             ← NEW: FastAPI wrapper
│   ├── mcp_client.py      ← your existing MCP tools (keep as-is)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── components/
│   │       ├── Header.jsx
│   │       ├── TravelForm.jsx
│   │       ├── ProgressTracker.jsx
│   │       └── ResultsPanel.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
└── render.yaml            ← Render Blueprint (deploys both services)
```

---

## Local Development

### 1. Backend

```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL, GROQ_API_KEY, TAVILY_API_KEY
pip install -r requirements.txt
uvicorn api:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
cp .env.example .env          # leave VITE_API_URL blank for local dev (proxy handles it)
npm install
npm run dev                   # → http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:8000` automatically.

---

## Deploying to Render

### Prerequisites
- Push your project to a GitHub (or GitLab) repository.
- Make sure `backend/mcp_client.py` is committed (it's needed by `api.py`).

### Step 1 — Connect repo to Render
1. Go to https://dashboard.render.com → **New → Blueprint**
2. Connect your GitHub repo.
3. Render detects `render.yaml` automatically and shows both services + the database.
4. Click **Apply**.

### Step 2 — Set secret environment variables
In the Render dashboard, go to each service's **Environment** tab and add:

| Service  | Key             | Value                        |
|----------|-----------------|------------------------------|
| Backend  | `GROQ_API_KEY`  | your Groq API key            |
| Backend  | `TAVILY_API_KEY`| your Tavily API key          |
| Frontend | `VITE_API_URL`  | `https://travel-ai-backend.onrender.com` |

> `DATABASE_URL` is injected automatically from the Render Postgres database.

### Step 3 — Trigger deploys
Both services will build and deploy. The frontend build runs `npm run build` and serves the `dist/` folder as a static site.

### Step 4 — CORS (already handled)
`api.py` uses `allow_origins=["*"]`. Once in production, change this to:
```python
allow_origins=["https://travel-ai-frontend.onrender.com"]
```

---

## API Reference

### `POST /api/travel`
Synchronous — waits for all agents to finish, returns JSON.

```json
// Request
{ "query": "7 days in Tokyo from Mumbai", "thread_id": null }

// Response
{
  "thread_id": "uuid",
  "flight_results": "...",
  "hotel_results": "...",
  "weather_results": "...",
  "itinerary": "...",
  "llm_calls": 3
}
```

### `POST /api/travel/stream`
Server-Sent Events stream — yields progress events as each agent completes.

```
data: {"type":"progress","node":"flight_agent","label":"✈️ Finding flights...","data":{...}}
data: {"type":"progress","node":"hotel_agent","label":"🏨 Searching hotels...","data":{...}}
data: {"type":"progress","node":"weather_agent","label":"🌤️ Checking weather...","data":{...}}
data: {"type":"progress","node":"itinerary_agent","label":"📋 Building itinerary...","data":{...}}
data: {"type":"done","thread_id":"uuid"}
```

### `GET /health`
Returns `{"status": "ok"}` — used by Render as the health check endpoint.

---

## Changes Made to Original `main.py`

| What              | Why                                                     |
|-------------------|---------------------------------------------------------|
| Extracted agents into `api.py` | Keep `main.py` intact for CLI use    |
| Added `lifespan` context | PostgresSaver setup on startup                  |
| Added streaming endpoint | Real-time UI progress updates via SSE           |
| Added `weather_results` to initial state | Prevents `KeyError` at runtime |
| CORS middleware   | Allows frontend origin to call the API                  |This project extends the Multi-Agent Travel Planning System built in Part 1 by integrating MCP (Model Context Protocol) servers for real-time flight and weather data.