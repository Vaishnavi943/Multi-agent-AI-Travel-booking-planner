import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

import os
import uuid
import asyncio
from contextlib import asynccontextmanager
from typing import Optional, Annotated

import dotenv
dotenv.load_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, AnyMessage
from langchain_groq import ChatGroq
from typing import TypedDict
import operator
import json
import psycopg

DATABASE_URL = os.getenv("DATABASE_URL")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise RuntimeError("Missing GROQ_API_KEY")
if not DATABASE_URL:
    raise RuntimeError("Missing DATABASE_URL")

llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)


class TravelState(TypedDict):
    messages:        Annotated[list[AnyMessage], operator.add]
    user_query:      str
    flight_results:  str
    hotel_results:   str
    itinerary:       str
    llm_calls:       int
    weather_results: str


FLIGHT_PROMPT = """
You are a travel flight expert. User Query: {query}
Airport Info: {airport_data}  Airline Info: {airline_data}
Return EXACTLY 3 flight options as a JSON array (no extra text):
[{{"airline":"Name","route":"A → B","duration":"Xh","price":"₹X","class":"Economy","note":"note"}}]
"""
HOTEL_PROMPT = """
You are a hotel expert. User Query: {query}
Web Search Results: {search_data}
Return EXACTLY 3 hotel options as a JSON array (no extra text):
[{{"name":"Name","location":"Area, City","rating":"4.5","price_per_night":"₹X","highlights":"Pool, Beach"}}]
"""
FLIGHT_FALLBACK = """
Suggest 3 realistic flight options for: {query}
Return EXACTLY 3 as JSON array (no extra text):
[{{"airline":"Name","route":"A → B","duration":"Xh","price":"estimated","class":"Economy","note":"note"}}]
"""
WEATHER_FALLBACK = "Provide typical weather for {city} for: {query}. Cover temp range, conditions, packing tips."


async def flight_agent(state: TravelState):
    query = state["user_query"]
    try:
        from mcp_client import aviation_mcp_call
        airports = await aviation_mcp_call("list_airports")
        airlines = await aviation_mcp_call("list_airlines")
        response = await llm.ainvoke([
            SystemMessage(content="Return only valid JSON arrays, no markdown."),
            HumanMessage(content=FLIGHT_PROMPT.format(query=query, airport_data=str(airports)[:2000], airline_data=str(airlines)[:2000])),
        ])
        flight_data = response.content
    except Exception as e:
        logger.warning(f"Aviation MCP failed, using LLM fallback: {e}")
        try:
            response    = await llm.ainvoke([SystemMessage(content="Return only valid JSON arrays, no markdown."), HumanMessage(content=FLIGHT_FALLBACK.format(query=query))])
            flight_data = response.content
        except Exception as e2:
            logger.error(f"Flight fallback failed: {e2}")
            flight_data = "[]"
    return {"flight_results": flight_data, "messages": [AIMessage(content="Flights found")], "llm_calls": state.get("llm_calls", 0) + 1}


async def hotel_agent(state: TravelState):
    try:
        from mcp_client import tavily_mcp_search
        search_data = await tavily_mcp_search(f"Best hotels for {state['user_query']}")
        response    = await llm.ainvoke([SystemMessage(content="Return only valid JSON arrays, no markdown."), HumanMessage(content=HOTEL_PROMPT.format(query=state["user_query"], search_data=str(search_data)[:2000]))])
        hotel_data  = response.content
    except Exception as e:
        logger.error(f"Hotel agent error: {e}")
        hotel_data = "[]"
    return {"hotel_results": hotel_data, "messages": [AIMessage(content="Hotels found")], "llm_calls": state.get("llm_calls", 0) + 1}


async def weather_agent(state: TravelState):
    try:
        from mcp_client import weather_mcp_search, forecast_mcp_search, extract_destination
        city = extract_destination(state["user_query"])
        weather_data  = await weather_mcp_search(city)
        forecast_data = await forecast_mcp_search(city)
        weather_str   = f"Current: {weather_data}\nForecast: {forecast_data}"
    except Exception as e:
        logger.warning(f"Weather MCP failed, LLM fallback: {e}")
        try:
            from mcp_client import extract_destination
            city = extract_destination(state["user_query"])
        except Exception:
            city = "the destination"
        try:
            response    = await llm.ainvoke([SystemMessage(content="Travel weather expert."), HumanMessage(content=WEATHER_FALLBACK.format(city=city, query=state["user_query"]))])
            weather_str = response.content
        except Exception:
            weather_str = "Weather unavailable."
    return {"weather_results": weather_str, "messages": [AIMessage(content="Weather fetched")]}


async def itinerary_agent(state: TravelState):
    prompt = f"Create a concise day-by-day travel itinerary.\nQuery: {state['user_query']}\nFlights: {state['flight_results']}\nHotels: {state['hotel_results']}\nWeather: {state['weather_results']}\nFormat as clear day-by-day plan."
    response = await llm.ainvoke([SystemMessage(content="Expert travel planner. Be concise."), HumanMessage(content=prompt)])
    return {"itinerary": response.content, "messages": [response], "llm_calls": state.get("llm_calls", 0) + 1}


def build_graph():
    graph = StateGraph(TravelState)
    graph.add_node("flight_agent",    flight_agent)
    graph.add_node("hotel_agent",     hotel_agent)
    graph.add_node("weather_agent",   weather_agent)
    graph.add_node("itinerary_agent", itinerary_agent)
    graph.add_edge(START, "flight_agent")
    graph.add_edge("flight_agent", "hotel_agent")
    graph.add_edge("hotel_agent", "weather_agent")
    graph.add_edge("weather_agent", "itinerary_agent")
    graph.add_edge("itinerary_agent", END)
    return graph


_checkpointer_cm = None
_checkpointer    = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _checkpointer_cm, _checkpointer
    try:
        _checkpointer_cm = AsyncPostgresSaver.from_conn_string(DATABASE_URL)
        _checkpointer    = await _checkpointer_cm.__aenter__()
        await _checkpointer.setup()
        app.state.graph        = build_graph().compile(checkpointer=_checkpointer)
        app.state.checkpointer = _checkpointer
        app.state.db_ok        = True
        logger.info("✅ LangGraph + PostgreSQL initialized")
    except Exception as e:
        logger.error(f"❌ Startup error: {e}")
        app.state.graph = None
        app.state.db_ok = False
    yield
    if _checkpointer_cm:
        try:
            await _checkpointer_cm.__aexit__(None, None, None)
        except Exception as e:
            logger.error(f"Cleanup error: {e}")


app = FastAPI(title="Travel AI API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])


class TravelRequest(BaseModel):
    query:     str
    thread_id: Optional[str] = None

class TravelResponse(BaseModel):
    thread_id: str; flight_results: str; hotel_results: str
    weather_results: str; itinerary: str; llm_calls: int


@app.get("/health")
async def health(request: Request):
    return {"status": "ok", "db_connected": getattr(request.app.state, "db_ok", False)}


@app.post("/api/travel", response_model=TravelResponse)
async def travel(req: TravelRequest, request: Request):
    graph_app = request.app.state.graph
    if not graph_app: raise HTTPException(status_code=503, detail="Database not connected.")
    thread_id = req.thread_id or str(uuid.uuid4())
    config    = {"configurable": {"thread_id": thread_id}}
    try:
        result = await graph_app.ainvoke(
            {"messages": [HumanMessage(content=req.query)], "user_query": req.query,
             "flight_results": "", "hotel_results": "", "weather_results": "", "itinerary": "", "llm_calls": 0},
            config=config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return TravelResponse(thread_id=thread_id, flight_results=result.get("flight_results","[]"),
        hotel_results=result.get("hotel_results","[]"), weather_results=result.get("weather_results",""),
        itinerary=result.get("itinerary",""), llm_calls=result.get("llm_calls",0))


@app.post("/api/travel/stream")
async def travel_stream(req: TravelRequest, request: Request):
    graph_app = request.app.state.graph
    if not graph_app: raise HTTPException(status_code=503, detail="Database not connected.")
    thread_id = req.thread_id or str(uuid.uuid4())
    config    = {"configurable": {"thread_id": thread_id}}

    async def event_generator():
        agent_labels = {"flight_agent":"Finding flights","hotel_agent":"Searching hotels","weather_agent":"Checking weather","itinerary_agent":"Building itinerary"}
        try:
            async for chunk in graph_app.astream(
                {"messages": [HumanMessage(content=req.query)], "user_query": req.query,
                 "flight_results": "", "hotel_results": "", "weather_results": "", "itinerary": "", "llm_calls": 0},
                config=config, stream_mode="updates"):
                for node_name, node_output in chunk.items():
                    yield f"data: {json.dumps({'type':'progress','node':node_name,'label':agent_labels.get(node_name,node_name),'data':{k:v for k,v in node_output.items() if k!='messages'}})}\n\n"
                    await asyncio.sleep(0)
            yield f"data: {json.dumps({'type':'done','thread_id':thread_id})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type':'error','message':str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Sessions ──────────────────────────────────────────────────────────────────

@app.get("/api/sessions")
async def get_sessions(request: Request):
    """Get all sessions — extract user_query from checkpoint state values."""
    if not getattr(request.app.state, "db_ok", False):
        return {"sessions": []}
    try:
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                # Get latest checkpoint per thread with its metadata
                await cur.execute("""
                    SELECT DISTINCT ON (thread_id)
                        thread_id,
                        checkpoint->>'ts' as created_at,
                        metadata
                    FROM checkpoints
                    ORDER BY thread_id, checkpoint->>'ts' DESC
                """)
                rows = await cur.fetchall()
                sessions = []
                for thread_id, created_at, metadata in rows:
                    query = "Travel query"
                    # ✅ Extract user_query from the writes in metadata
                    try:
                        if metadata:
                            if isinstance(metadata, str):
                                metadata = json.loads(metadata)
                            writes = metadata.get("writes", {})
                            if writes:
                                for node_data in writes.values():
                                    if isinstance(node_data, dict) and node_data.get("user_query"):
                                        query = node_data["user_query"]
                                        break
                    except Exception:
                        pass
                    sessions.append({
                        "thread_id":  thread_id,
                        "query":      query,
                        "created_at": created_at or "",
                    })
                # Sort by created_at descending
                sessions.sort(key=lambda x: x["created_at"], reverse=True)
                return {"sessions": sessions[:30]}
    except Exception as e:
        logger.error(f"Sessions fetch error: {e}")
        return {"sessions": []}


@app.get("/api/sessions/{thread_id}")
async def get_session(thread_id: str, request: Request):
    """Resume a session."""
    graph_app = request.app.state.graph
    if not graph_app: raise HTTPException(status_code=503, detail="Database not connected.")
    try:
        config = {"configurable": {"thread_id": thread_id}}
        state  = await graph_app.aget_state(config)
        if not state or not state.values:
            raise HTTPException(status_code=404, detail="Session not found.")
        v = state.values
        return {
            "thread_id":       thread_id,
            "user_query":      v.get("user_query",      ""),
            "flight_results":  v.get("flight_results",  "[]"),
            "hotel_results":   v.get("hotel_results",   "[]"),
            "weather_results": v.get("weather_results", ""),
            "itinerary":       v.get("itinerary",       ""),
            "llm_calls":       v.get("llm_calls",       0),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/sessions/{thread_id}")
async def delete_session(thread_id: str, request: Request):
    """Delete ALL checkpoints and writes for a session."""
    if not getattr(request.app.state, "db_ok", False):
        raise HTTPException(status_code=503, detail="Database not connected.")
    try:
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                # Delete from checkpoints table
                await cur.execute(
                    "DELETE FROM checkpoints WHERE thread_id = %s",
                    (thread_id,)
                )
                deleted_checkpoints = cur.rowcount

                # Also delete from checkpoint_writes if exists
                try:
                    await cur.execute(
                        "DELETE FROM checkpoint_writes WHERE thread_id = %s",
                        (thread_id,)
                    )
                except Exception:
                    pass  # table may not exist

                # Also delete from checkpoint_blobs if exists
                try:
                    await cur.execute(
                        "DELETE FROM checkpoint_blobs WHERE thread_id = %s",
                        (thread_id,)
                    )
                except Exception:
                    pass

                await conn.commit()
                logger.info(f"Deleted session {thread_id}: {deleted_checkpoints} checkpoints")
        return {"deleted": True, "thread_id": thread_id}
    except Exception as e:
        logger.error(f"Delete session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))