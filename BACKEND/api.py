 # after production -> allow_origins=["https://travel-ai-frontend.onrender.com"]

import os
import uuid
import asyncio
import re
from contextlib import asynccontextmanager
from typing import Optional

import dotenv
dotenv.load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, AnyMessage
from langchain_groq import ChatGroq
from typing import TypedDict, Annotated
import operator
import json

from mcp_client import (
    tavily_mcp_search,
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


class TravelState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
    user_query: str
    flight_results: str
    hotel_results: str
    itinerary: str
    llm_calls: int
    weather_results: str


FLIGHT_PROMPT = """
You are a travel flight expert. User Query: {query}
Airport Info: {airport_data}
Airline Info: {airline_data}

Return EXACTLY 3 flight options as a JSON array (no extra text):
[
  {{
    "airline": "Airline Name",
    "route": "DEL → GOI",
    "duration": "2h 30m",
    "price": "₹8,500",
    "class": "Economy",
    "note": "Direct flight"
  }}
]
"""

HOTEL_PROMPT = """
You are a hotel expert. User Query: {query}
Web Search Results: {search_data}

Return EXACTLY 3 hotel options as a JSON array (no extra text):
[
  {{
    "name": "Hotel Name",
    "location": "Area, City",
    "rating": "4.5",
    "price_per_night": "₹5,000",
    "highlights": "Pool, Beach view, Free breakfast"
  }}
]
"""


async def flight_agent(state: TravelState):
    query = state["user_query"]
    try:
        airports = await aviation_mcp_call("list_airports")
        airlines = await aviation_mcp_call("list_airlines")
        prompt = FLIGHT_PROMPT.format(
            query=query,
            airport_data=str(airports)[:2000],
            airline_data=str(airlines)[:2000],
        )
        response = await llm.ainvoke([
            SystemMessage(content="You are a travel flight expert. Return only valid JSON arrays, no markdown, no explanation."),
            HumanMessage(content=prompt),
        ])
        flight_data = response.content
    except Exception as e:
        flight_data = "[]"

    return {
        "flight_results": flight_data,
        "messages": [AIMessage(content="Flights found")],
        "llm_calls": state.get("llm_calls", 0) + 1,
    }


async def hotel_agent(state: TravelState):
    query = f"Best hotels for {state['user_query']}"
    try:
        search_data = await tavily_mcp_search(query)
        prompt = HOTEL_PROMPT.format(
            query=state["user_query"],
            search_data=str(search_data)[:2000],
        )
        response = await llm.ainvoke([
            SystemMessage(content="You are a hotel expert. Return only valid JSON arrays, no markdown, no explanation."),
            HumanMessage(content=prompt),
        ])
        hotel_data = response.content
    except Exception as e:
        hotel_data = "[]"

    return {
        "hotel_results": hotel_data,
        "messages": [AIMessage(content="Hotels found")],
        "llm_calls": state.get("llm_calls", 0) + 1,
    }


async def weather_agent(state: TravelState):
    city = extract_destination(state["user_query"])
    try:
        weather_data = await weather_mcp_search(city)
        forecast_data = await forecast_mcp_search(city)
        weather_str = f"Current: {weather_data}\nForecast: {forecast_data}"
    except Exception as e:
        weather_str = f"Weather unavailable: {str(e)}"

    return {
        "weather_results": weather_str,
        "messages": [AIMessage(content="Weather fetched")],
    }


async def itinerary_agent(state: TravelState):
    prompt = f"""
Create a concise day-by-day travel itinerary.
Query: {state['user_query']}
Flights: {state['flight_results']}
Hotels: {state['hotel_results']}
Weather: {state['weather_results']}

Format as clear day-by-day plan. Be specific with timings and activities.
"""
    response = await llm.ainvoke([
        SystemMessage(content="Expert travel planner. Be concise and specific."),
        HumanMessage(content=prompt),
    ])
    return {
        "itinerary": response.content,
        "messages": [response],
        "llm_calls": state.get("llm_calls", 0) + 1,
    }


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncPostgresSaver.from_conn_string(DATABASE_URL) as cp:
        await cp.setup()
    yield


app = FastAPI(title="Travel AI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TravelRequest(BaseModel):
    query: str
    thread_id: Optional[str] = None


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
        async with AsyncPostgresSaver.from_conn_string(DATABASE_URL) as checkpointer:
            await checkpointer.setup()
            app_graph = build_graph().compile(checkpointer=checkpointer)
            result = await app_graph.ainvoke(
                {"messages": [HumanMessage(content=req.query)], "user_query": req.query,
                 "flight_results": "", "hotel_results": "", "itinerary": "", "llm_calls": 0, "weather_results": ""},
                config=config,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return TravelResponse(
        thread_id=thread_id,
        flight_results=result.get("flight_results", "[]"),
        hotel_results=result.get("hotel_results", "[]"),
        weather_results=result.get("weather_results", ""),
        itinerary=result.get("itinerary", ""),
        llm_calls=result.get("llm_calls", 0),
    )


@app.post("/api/travel/stream")
async def travel_stream(req: TravelRequest):
    thread_id = req.thread_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    async def event_generator():
        agent_labels = {
            "flight_agent":    "Finding flights",
            "hotel_agent":     "Searching hotels",
            "weather_agent":   "Checking weather",
            "itinerary_agent": "Building itinerary",
        }
        try:
            async with AsyncPostgresSaver.from_conn_string(DATABASE_URL) as checkpointer:
                await checkpointer.setup()
                app_graph = build_graph().compile(checkpointer=checkpointer)
                async for chunk in app_graph.astream(
                    {"messages": [HumanMessage(content=req.query)], "user_query": req.query,
                     "flight_results": "", "hotel_results": "", "itinerary": "", "llm_calls": 0, "weather_results": ""},
                    config=config, stream_mode="updates",
                ):
                    for node_name, node_output in chunk.items():
                        event = {
                            "type": "progress",
                            "node": node_name,
                            "label": agent_labels.get(node_name, node_name),
                            "data": {k: v for k, v in node_output.items() if k != "messages"},
                        }
                        yield f"data: {json.dumps(event)}\n\n"
                        await asyncio.sleep(0)
            yield f"data: {json.dumps({'type': 'done', 'thread_id': thread_id})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")