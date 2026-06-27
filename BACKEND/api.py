import os
import uuid
import asyncio
from contextlib import asynccontextmanager
from typing import Optional

import dotenv
dotenv.load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import psycopg
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, AnyMessage
from langchain_groq import ChatGroq
from typing import TypedDict, Annotated
import operator
import json

from mcp_client import (
    tavily_mcp_search,
    get_airlines,
    get_airports,
    aviation_mcp_call,
    extract_destination,
    forecast_mcp_search,
    weather_mcp_search,
)

DATABASE_URL = os.getenv("DATABASE_URL")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise RuntimeError("Missing GROQ_API_KEY in environment.")

llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)


# ── State ────────────────────────────────────────────────────────────────────
class TravelState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
    user_query: str
    flight_results: str
    hotel_results: str
    itinerary: str
    llm_calls: int
    weather_results: str


# ── Prompts ───────────────────────────────────────────────────────────────────
FLIGHT_AGENT_PROMPT = """
You are a travel flight expert.

User Query: {query}
Airport Information: {airport_data}
Airline Information: {airline_data}

Generate:
1. Likely departure airport
2. Likely arrival airport
3. Airlines serving this route
4. Typical flight duration
5. Estimated airfare range
6. Peak season pricing warning
7. Booking advice

Return concise travel guidance.
"""


# ── Agents ────────────────────────────────────────────────────────────────────
async def flight_agent(state: TravelState):
    query = state["user_query"]
    try:
        airports = await aviation_mcp_call("list_airports")
        airlines = await aviation_mcp_call("list_airlines")
        prompt = FLIGHT_AGENT_PROMPT.format(
            query=query,
            airport_data=str(airports)[:3000],
            airline_data=str(airlines)[:3000],
        )
        response = llm.invoke([
            SystemMessage(content="You are an expert travel flight planner."),
            HumanMessage(content=prompt),
        ])
        flight_data = response.content
    except Exception as e:
        flight_data = f"Flight information unavailable: {str(e)}"

    return {
        "flight_results": flight_data,
        "messages": [AIMessage(content="Flight recommendations generated")],
        "llm_calls": state.get("llm_calls", 0) + 1,
    }


async def hotel_agent(state: TravelState):
    query = f"Best hotels for {state['user_query']}"
    hotel_results = await tavily_mcp_search(query)
    return {
        "hotel_results": hotel_results,
        "messages": [AIMessage(content="Hotel information fetched")],
        "llm_calls": state.get("llm_calls", 0) + 1,
    }


async def weather_agent(state: TravelState):
    city = extract_destination(state["user_query"])
    weather_data = await weather_mcp_search(city)
    forecast_data = await forecast_mcp_search(city)
    return {
        "weather_results": f"Current Weather:\n{weather_data}\n\nForecast:\n{forecast_data}",
        "messages": [AIMessage(content="Weather information fetched")],
    }


async def itinerary_agent(state: TravelState):
    prompt = f"""
Create a travel itinerary.
User Query: {state['user_query']}
Flight Results: {state['flight_results']}
Hotel Results: {state['hotel_results']}
Weather Information: {state['weather_results']}
"""
    response = llm.invoke([
        SystemMessage(content="You are an expert travel planner. Give specific, accurate answers concisely."),
        HumanMessage(content=prompt),
    ])
    return {
        "itinerary": response.content,
        "messages": [response],
        "llm_calls": state.get("llm_calls", 0) + 1,
    }


# ── Graph ─────────────────────────────────────────────────────────────────────
def build_graph():
    graph = StateGraph(TravelState)
    graph.add_node("flight_agent", flight_agent)
    graph.add_node("hotel_agent", hotel_agent)
    graph.add_node("weather_agent", weather_agent)
    graph.add_node("itinerary_agent", itinerary_agent)
    graph.add_edge(START, "flight_agent")
    graph.add_edge("flight_agent", "hotel_agent")
    graph.add_edge("hotel_agent", "weather_agent")
    graph.add_edge("weather_agent", "itinerary_agent")
    graph.add_edge("itinerary_agent", END)
    return graph


# ── FastAPI ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    with PostgresSaver.from_conn_string(DATABASE_URL) as cp:
        cp.setup()
    yield


app = FastAPI(title="Travel AI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    # after production -> allow_origins=["https://travel-ai-frontend.onrender.com"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TravelRequest(BaseModel):
    query: str
    thread_id: Optional[str] = None   # pass to continue a session


class TravelResponse(BaseModel):
    thread_id: str
    flight_results: str
    hotel_results: str
    weather_results: str
    itinerary: str
    llm_calls: int


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/travel", response_model=TravelResponse)
async def travel(req: TravelRequest):
    thread_id = req.thread_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    try:
        with PostgresSaver.from_conn_string(DATABASE_URL) as checkpointer:
            app_graph = build_graph().compile(checkpointer=checkpointer)
            result = await app_graph.invoke(
                {
                    "messages": [HumanMessage(content=req.query)],
                    "user_query": req.query,
                    "flight_results": "",
                    "hotel_results": "",
                    "itinerary": "",
                    "llm_calls": 0,
                    "weather_results": "",
                },
                config=config,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return TravelResponse(
        thread_id=thread_id,
        flight_results=result.get("flight_results", ""),
        hotel_results=result.get("hotel_results", ""),
        weather_results=result.get("weather_results", ""),
        itinerary=result.get("itinerary", ""),
        llm_calls=result.get("llm_calls", 0),
    )


@app.post("/api/travel/stream")
async def travel_stream(req: TravelRequest):
    """SSE endpoint — streams agent progress events then final result."""
    thread_id = req.thread_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    async def event_generator():
        agent_labels = {
            "flight_agent": "✈️ Finding flights...",
            "hotel_agent": "🏨 Searching hotels...",
            "weather_agent": "🌤️ Checking weather...",
            "itinerary_agent": "📋 Building itinerary...",
        }
        try:
            with PostgresSaver.from_conn_string(DATABASE_URL) as checkpointer:
                app_graph = build_graph().compile(checkpointer=checkpointer)
                async for chunk in app_graph.stream(
                    {
                        "messages": [HumanMessage(content=req.query)],
                        "user_query": req.query,
                        "flight_results": "",
                        "hotel_results": "",
                        "itinerary": "",
                        "llm_calls": 0,
                        "weather_results": "",
                    },
                    config=config,
                    stream_mode="updates",
                ):
                    for node_name, node_output in chunk.items():
                        label = agent_labels.get(node_name, f"Running {node_name}...")
                        event = {
                            "type": "progress",
                            "node": node_name,
                            "label": label,
                            "data": {
                                k: v
                                for k, v in node_output.items()
                                if k != "messages"
                            },
                        }
                        yield f"data: {json.dumps(event)}\n\n"
                        await asyncio.sleep(0)   # flush

            # final done event
            yield f"data: {json.dumps({'type': 'done', 'thread_id': thread_id})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


    