# ✈️ Multi-Agent AI Travel Booking System

A full-stack AI travel planning app built on **LangGraph** multi-agent system, **MCP (Model Context Protocol)**, **FastAPI**, and **React**. Users type a travel query and get real-time flight options, hotel recommendations, weather forecasts, and a complete day-by-day itinerary — all powered by AI agents working in parallel.

**Live Demo:** https://multi-agent-ai-travel-booking-plann.vercel.app

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React Frontend (Vite + Vercel)                         │
│  TravelForm → ProgressTracker → Tabs → Cards            │
└──────────────────────┬──────────────────────────────────┘
                       │ POST /api/travel/stream (SSE)
┌──────────────────────▼──────────────────────────────────┐
│  FastAPI Backend (Railway)                              │
│  /health · /api/travel · /api/travel/stream             │
└──────────────────────┬──────────────────────────────────┘
                       │ LangGraph Agent Pipeline
┌──────────────────────▼──────────────────────────────────┐
│  flight_agent → hotel_agent →                           │
│  weather_agent → itinerary_agent                        │
│  Checkpointer: PostgreSQL (Neon)                        │
└──────────────────────┬──────────────────────────────────┘
                       │ MCP Servers
┌──────────────────────▼──────────────────────────────────┐
│  custom_aviation_mcp_server.py  ← AviationStack API     │
│  custom_weather_mcp_server.py   ← OpenWeather API       │
│  Tavily MCP (remote HTTP)       ← hotel web search      │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
Multi-Agent AI Travel Booking System/
├── BACKEND/
│   ├── api.py                         ← FastAPI production app
│   ├── main.py                        ← original LangGraph CLI script
│   ├── mcp_client.py                  ← MCP tool wrappers
│   ├── custom_aviation_mcp_server.py  ← custom aviation MCP server
│   ├── custom_weather_mcp_server.py   ← custom weather MCP server
│   ├── aviationstack-mcp/             ← cloned GitHub repo (local ref)
│   ├── requirements.txt
│   ├── railway.toml
│   ├── Procfile
│   └── .env                           ← never commit this
├── FRONTEND/
│   ├── src/
│   │   ├── App.jsx                    ← main app with SSE streaming
│   │   ├── index.css                  ← all styles
│   │   └── components/
│   │       ├── Header.jsx             ← hero banner
│   │       ├── TravelForm.jsx         ← search input + chips
│   │       ├── ProgressTracker.jsx    ← animated agent steps
│   │       ├── FlightCards.jsx        ← clickable flight cards
│   │       ├── HotelCards.jsx         ← hotel cards with ratings
│   │       ├── WeatherPanel.jsx       ← weather + forecast grid
│   │       ├── ItineraryPanel.jsx     ← day-by-day itinerary
│   │       └── Footer.jsx             ← developer contact links
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── .env.local                     ← never commit this
└── README.md
```

---

## Tech Stack

| Layer       | Technology                                          |
|-------------|-----------------------------------------------------|
| Frontend    | React 18, Vite, CSS, Nginx                          |
| Backend     | FastAPI, Uvicorn, Python 3.12                       |
| AI Agents   | LangGraph, LangChain, Groq (llama-3.3-70b)          |
| MCP         | Custom Aviation MCP, Custom Weather MCP, Tavily MCP |
| Database    | PostgreSQL via Neon (LangGraph checkpointer)        |
| Package mgr | uv (Python), npm (Node)                             |
| Deployment  | Railway (backend) + Vercel (frontend) + Neon (DB)   |

---

## Local Development

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL running locally
- `uv` installed: `pip install uv`

### Step 1 — Create local database

```bash
psql -U postgres -c "CREATE DATABASE lg_memory_travel_booking_system;"
```

### Step 2 — Backend setup

```bash
cd BACKEND
uv pip install -r requirements.txt
```

Create `BACKEND/.env`:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/lg_memory_travel_booking_system
GROQ_API_KEY=your_groq_key_here
TAVILY_API_KEY=your_tavily_key_here
AVIATION_API_KEY=your_aviationstack_key_here
OPENWEATHER_API_KEY=your_openweather_key_here
FRONTEND_URL=http://localhost:5173
```

Start the backend:
```bash
uvicorn api:app --reload --port 8000
```

API docs available at: http://127.0.0.1:8000/docs

### Step 3 — Frontend setup

```bash
cd FRONTEND
npm install
npm run dev        # → http://localhost:5173
```

Create `FRONTEND/.env.local`:
```env
VITE_API_URL=
```

Leave `VITE_API_URL` blank — Vite proxies `/api/*` to `http://localhost:8000` automatically via `vite.config.js`.

---

## Deploying to Production

### Services used (all free, no card required)

| Service | Purpose       | Website       |
|---------|---------------|---------------|
| Railway | FastAPI backend | railway.app |
| Vercel  | React frontend  | vercel.app  |
| Neon    | PostgreSQL DB   | neon.tech   |

---

### Step 1 — Set up Neon database

1. Go to https://neon.tech → Sign up free with GitHub
2. Create new project
3. Go to **Connect** → click **Show password** → copy full connection string:
```
postgresql://neondb_owner:password@ep-xxx.neon.tech/neondb?sslmode=require
```

---

### Step 2 — Deploy backend to Railway

1. Go to https://railway.app → Sign up with GitHub
2. **New Project → Deploy from GitHub repo**
3. Select your repo → set **Root Directory** to `BACKEND`
4. Railway auto-detects `requirements.txt` and installs dependencies
5. Go to **Variables** tab and add all env vars:

| Key                  | Value                                    |
|----------------------|------------------------------------------|
| `DATABASE_URL`       | your Neon connection string              |
| `GROQ_API_KEY`       | your Groq API key                        |
| `TAVILY_API_KEY`     | your Tavily API key                      |
| `AVIATION_API_KEY`   | your AviationStack API key               |
| `OPENWEATHER_API_KEY`| your OpenWeather API key                 |
| `FRONTEND_URL`       | fill after Vercel deploy (Step 3)        |

6. Go to **Settings → Networking → Generate Domain** with port `8000`
7. Copy your Railway backend URL: `https://your-app.up.railway.app`
8. Test health: `https://your-app.up.railway.app/health`
   Should return: `{"status":"ok","db_connected":true,...}`

---

### Step 3 — Deploy frontend to Vercel

1. Go to https://vercel.com → Sign up with GitHub
2. **New Project → Import GitHub repo**
3. Set **Root Directory** to `FRONTEND`
4. Add environment variable:

| Key            | Value                                    |
|----------------|------------------------------------------|
| `VITE_API_URL` | your Railway backend URL from Step 2     |

5. Click **Deploy**
6. Copy your Vercel URL: `https://your-app.vercel.app`

---

### Step 4 — Connect frontend URL to backend

Go to **Railway → Backend → Variables** and update:
```
FRONTEND_URL = https://your-app.vercel.app
```

Railway redeploys automatically.

---

### Step 5 — Tighten CORS after confirming it works

In `BACKEND/api.py` change:
```python
# Before (development)
allow_origins=["*"],
allow_credentials=False,

# After (production)
allow_origins=[FRONTEND_URL],
allow_credentials=False,
```

Push to GitHub — Railway redeploys automatically.

---

## API Reference

### `GET /health`
Health check used by Railway.
```json
{
  "status": "ok",
  "db_connected": true,
  "database_url_set": true,
  "groq_key_set": true
}
```

### `POST /api/travel`
Synchronous — waits for all agents to finish.

**Request:**
```json
{
  "query": "7 days in Tokyo from Mumbai",
  "thread_id": null
}
```

**Response:**
```json
{
  "thread_id": "uuid",
  "flight_results": "[{...}, {...}, {...}]",
  "hotel_results": "[{...}, {...}, {...}]",
  "weather_results": "Current: ...\nForecast: ...",
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

## MCP Servers

### custom_aviation_mcp_server.py
Built with the `mcp` library. Calls AviationStack REST API and exposes tools over stdio.

**Tools:**
- `list_airports` — airports with IATA codes and country
- `list_airlines` — airlines with IATA codes and status
- `get_flights` — real-time flights by departure/arrival IATA

### custom_weather_mcp_server.py
Custom MCP server using OpenWeather API over stdio.

**Tools:**
- `get_current_weather` — temperature, humidity, wind, condition
- `get_forecast` — 5-day forecast with 3-hour intervals

### Tavily MCP
Remote MCP server over streamable HTTP for real-time hotel web search.

**Tool:** `tavily_search`

---

## Frontend Features

| Feature | Description |
|---|---|
| Tab-based results | Flights / Hotels / Weather / Itinerary tabs |
| Clickable flight cards | Each card links to Google Flights search |
| Hotel cards | Star ratings, price/night, highlight tags |
| Weather cards | Temperature, feels like, humidity, wind + forecast grid |
| Itinerary | Day headers, section labels, bullet points |
| Real-time progress | Animated step tracker as agents run |
| SSE streaming | Results appear as each agent finishes |
| Example chips | One-tap query suggestions |
| Responsive | Mobile and desktop layouts |
| Footer | Developer contact links |

---

## Key Design Decisions & Bug Fixes

| Decision | Reason |
|---|---|
| `AsyncPostgresSaver` instead of `PostgresSaver` | FastAPI runs its own async event loop — sync checkpointer causes `asyncio.run()` conflict |
| Graph compiled once in `lifespan` | Avoids re-creating DB connection on every request |
| `request.app.state.graph` in endpoints | Safely accesses the compiled graph without using globals |
| SSE streaming endpoint | Shows real-time agent progress in UI |
| LLM returns JSON for flights/hotels | Enables structured card UI and saves tokens |
| Single `CORSMiddleware` | Adding it twice causes header conflicts in FastAPI |
| `allow_credentials=False` with `allow_origins=["*"]` | Required by CORS spec — wildcard origin + credentials is rejected by browsers |
| Custom MCP servers | `aviationstack-mcp` package is hardcoded to `127.0.0.1:8000` and ignores host/port args |
| LLM fallback in agents | MCP failures don't break the entire response |
| Startup-safe lifespan | DB errors are caught and logged — app starts even if DB is temporarily unavailable |
| `sys.executable` for MCP subprocesses | Works on Windows locally and Linux on Railway without path changes |

---

## Environment Variables Reference

### Backend (.env)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `GROQ_API_KEY` | ✅ | Groq API key for LLM |
| `TAVILY_API_KEY` | ✅ | Tavily API key for web search |
| `AVIATION_API_KEY` | ✅ | AviationStack API key |
| `OPENWEATHER_API_KEY` | ✅ | OpenWeather API key |
| `FRONTEND_URL` | ✅ | Frontend URL for CORS |

### Frontend (.env.local)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ prod / ❌ local | Backend URL (blank = use Vite proxy) |

---

## Getting API Keys (all free)

| API | Free Tier | Sign Up |
|---|---|---|
| Groq | 100 req/min | console.groq.com |
| Tavily | 1000 searches/month | tavily.com |
| AviationStack | 100 req/month | aviationstack.com |
| OpenWeather | 1000 req/day | openweathermap.org |

---


Built with LangGraph · MCP · Groq · FastAPI · React