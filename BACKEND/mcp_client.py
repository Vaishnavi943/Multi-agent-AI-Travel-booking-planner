import os
import sys
import platform
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
AVIATION_MCP_URL    = os.getenv("AVIATION_MCP_URL")  # set on Railway

def _get_aviation_config():
    if AVIATION_MCP_URL:
        print(f"[MCP] Aviation using HTTP: {AVIATION_MCP_URL}")
        return {
            "transport": "streamable_http",
            "url": f"{AVIATION_MCP_URL}/mcp",
        }
    elif platform.system() == "Windows":
        venv_python = BASE_DIR / "aviationstack-mcp" / ".venv" / "Scripts" / "python.exe"
        print(f"[MCP] Aviation using stdio Windows: {venv_python}")
        return {
            "transport": "stdio",
            "command": str(venv_python),
            "args": ["-m", "aviationstack_mcp", "mcp", "run"],
            "env": {**os.environ.copy(), "AVIATION_API_KEY": AVIATION_API_KEY},
        }
    else:
        venv_python = BASE_DIR / "aviationstack-mcp" / ".venv" / "bin" / "python"
        print(f"[MCP] Aviation using stdio Linux: {venv_python}")
        return {
            "transport": "stdio",
            "command": str(venv_python),
            "args": ["-m", "aviationstack_mcp", "mcp", "run"],
            "env": {**os.environ.copy(), "AVIATION_API_KEY": AVIATION_API_KEY},
        }


client = MultiServerMCPClient(
    {
        "tavily": {
            "transport": "streamable_http",
            "url": f"https://mcp.tavily.com/mcp/?tavilyApiKey={TAVILY_API_KEY}",
        },
        "aviationstack": _get_aviation_config(),
        "weather": {
            "transport": "stdio",
            "command": sys.executable,
            "args": [str(BASE_DIR / "custom_weather_mcp_server.py")],
            "env": {**os.environ.copy(), "OPENWEATHER_API_KEY": OPENWEATHER_API_KEY},
        },
    }
)


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


def extract_destination(query: str) -> str:
    llm = ChatGroq(model="llama-3.3-70b-versatile")
    prompt = f"""Extract only the destination city or country from this query.
Query: {query}
Return only the destination name, nothing else."""
    response = llm.invoke(prompt)
    return response.content.strip()