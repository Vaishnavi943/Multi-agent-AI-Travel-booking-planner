import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.tools import load_mcp_tools
from langchain_groq import ChatGroq

load_dotenv(override=True)

BASE_DIR            = Path(__file__).parent
TAVILY_API_KEY      = os.getenv("TAVILY_API_KEY")
AVIATION_API_KEY    = os.getenv("AVIATION_API_KEY")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

print(f"[MCP] Using Python: {sys.executable}")
print(f"[MCP] AVIATION_API_KEY set: {bool(AVIATION_API_KEY)}")

# ── Client ─────────────────────────────────────────────────────────────────────
# Both aviation and weather use stdio with sys.executable
# since custom_aviation_mcp_server.py is in the same BACKEND folder
# and installed in the same venv — works locally AND on Railway
client = MultiServerMCPClient(
    {
        "tavily": {
            "transport": "streamable_http",
            "url": f"https://mcp.tavily.com/mcp/?tavilyApiKey={TAVILY_API_KEY}",
        },
        "aviationstack": {
            "transport": "stdio",
            "command": sys.executable,
            "args": [str(BASE_DIR / "custome_aviation_mcp_server.py")],
            "env": {
                **os.environ.copy(),
                "AVIATION_API_KEY": AVIATION_API_KEY,
            },
        },
        "weather": {
            "transport": "stdio",
            "command": sys.executable,
            "args": [str(BASE_DIR / "custom_weather_mcp_server.py")],
            "env": {
                **os.environ.copy(),
                "OPENWEATHER_API_KEY": OPENWEATHER_API_KEY,
            },
        },
    }
)


# ── Public API ─────────────────────────────────────────────────────────────────

async def tavily_mcp_search(query: str):
    async with client.session("tavily") as session:
        tools = await load_mcp_tools(session)
        tool  = next(t for t in tools if t.name == "tavily_search")
        return await tool.ainvoke({"query": query})


async def aviation_mcp_call(tool_name: str, tool_args: dict = None):
    print(f"[MCP] aviation_mcp_call: {tool_name}")
    async with client.session("aviationstack") as session:
        tools = await load_mcp_tools(session)
        print(f"[MCP] aviation tools: {[t.name for t in tools]}")
        tool  = next((t for t in tools if t.name == tool_name), None)
        if not tool:
            raise ValueError(f"Tool '{tool_name}' not found. Available: {[t.name for t in tools]}")
        return await tool.ainvoke(tool_args or {})


async def get_airports():
    return await aviation_mcp_call("list_airports")


async def get_airlines():
    return await aviation_mcp_call("list_airlines")


async def weather_mcp_search(city: str):
    async with client.session("weather") as session:
        tools = await load_mcp_tools(session)
        tool  = next(t for t in tools if t.name == "get_current_weather")
        return await tool.ainvoke({"city": city})


async def forecast_mcp_search(city: str):
    async with client.session("weather") as session:
        tools = await load_mcp_tools(session)
        tool  = next(t for t in tools if t.name == "get_forecast")
        return await tool.ainvoke({"city": city})


# ── Destination extractor ──────────────────────────────────────────────────────
def extract_destination(query: str) -> str:
    llm = ChatGroq(model="llama-3.3-70b-versatile")
    prompt = f"""Extract only the destination city or country from this query.
Query: {query}
Return only the destination name, nothing else."""
    response = llm.invoke(prompt)
    return response.content.strip()