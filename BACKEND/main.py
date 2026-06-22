import os
import dotenv
dotenv.load_dotenv()

from typing import TypedDict, Annotated
import operator
import psycopg
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from langchain_core.messages import (
    AnyMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
)
from langchain_groq import ChatGroq
from langchain_mistralai import ChatMistralAI

from tools.tavily_tool import tavily_search
from tools.flight_tool import search_flights
from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

MISTRALAI_API_KEY = os.getenv("MISTRALAI_API_KEY")
if not MISTRALAI_API_KEY:
    raise RuntimeError("Missing MISTRALAI_API_KEY in environment. Add it to .env or your shell environment.")

# model
llm = ChatMistralAI(
    api_key=MISTRALAI_API_KEY,
    model_name="mistral-small",
    max_tokens=50,
    temperature=0
)

# LANGGRAPH

# creating state
class TravelState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
    user_query: str
    flight_results: str
    hotel_results: str
    itinerary: str
    llm_calls: int


# flight agent (node)
def flight_agent(state: TravelState):
    query = state["user_query"]
    flight_data = search_flights(query)
    return {
        "flight_results": flight_data,
        "messages": [
            AIMessage(content=f"Flight results fetched")
        ],
        "llm_calls": state.get("llm_calls", 0) + 1
    }


# hotel agent
def hotel_agent(state: TravelState):
    query = f"Best hotels for {state['user_query']}"
    hotel_results = tavily_search(query)

    return {
        "hotel_results": hotel_results,
        "messages": [
            AIMessage(content="Hotel information fetched")
        ],
        "llm_calls": state.get("llm_calls", 0) + 1
    }


# Itinerary Agent
def itinerary_agent(state: TravelState):

    prompt = f"""
    Create a travel itinerary.
    User Query:
    {state['user_query']}

    Flight Results:
    {state['flight_results']}

    Hotel Results:
    {state['hotel_results']}
    """

    response = llm.invoke([
        SystemMessage(
            content="You are an expert travel planner.Your task is to give more specific and accurate answer without using many tokens."
        ),
        HumanMessage(content=prompt)
    ])

    return {
        "itinerary": response.content,
        "messages": [response],
        "llm_calls": state.get("llm_calls", 0) + 1
    }


# Final Response Agent
def final_agent(state: TravelState):

    final_prompt = f"""
    Generate final travel response.

    Flights:
    {state['flight_results']}

    Hotels:
    {state['hotel_results']}

    Itinerary:
    {state['itinerary']}
    """

    response = llm.invoke([
        HumanMessage(content=final_prompt)
    ])

    return {
        "messages": [response],
        "llm_calls": state.get("llm_calls", 0) + 1
    }


graph = StateGraph(TravelState)

graph.add_node("flight_agent", flight_agent)
graph.add_node("hotel_agent", hotel_agent)
graph.add_node("itinerary_agent", itinerary_agent)
graph.add_node("final_agent", final_agent)

graph.add_edge(START, "flight_agent")
graph.add_edge("flight_agent", "hotel_agent")
graph.add_edge("hotel_agent", "itinerary_agent")
graph.add_edge("itinerary_agent", "final_agent")
graph.add_edge("final_agent", END)




# 1. Use a context manager to enter the connection string generator
with PostgresSaver.from_conn_string(os.getenv("DATABASE_URL")) as checkpointer:
    
    # 2. Call .setup() on the actual checkpointer object inside the block
    checkpointer.setup()
    
    # 3. Compile your graph app here while the connection is alive
    app = graph.compile(checkpointer=checkpointer)

# 4. Your runtime block
if __name__ == "__main__":
    config = {"configurable": {"thread_id": "vaishnavi"}}
    user_input = input("Enter travel request: ")

    # Enter the context manager again to invoke the graph safely
    with PostgresSaver.from_conn_string(os.getenv("DATABASE_URL")) as checkpointer:
        app = graph.compile(checkpointer=checkpointer) # Re-bind live checkpointer
        
        result = app.invoke(
            {
                "messages": [HumanMessage(content=user_input)],
                "user_query": user_input,
                "flight_results": "",
                "hotel_results": "",
                "itinerary": "",
                "llm_calls": 0
            },
            config=config
        )

    print("\nFINAL RESPONSE:\n")
    for msg in result["messages"]:
        print(msg.content)












