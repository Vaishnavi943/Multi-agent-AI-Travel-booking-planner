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

# ── Aviation Python path ───────────────────────────────────────────────────
# Locally: aviationstack-mcp needs its own Python 3.13 venv
# Render:  Python 3.13 installed system-wide via render.yaml
def _get_aviation_python() -> str:
    if platform.system() == "Windows":
        # Local Windows — use nested venv (Python 3.13)
        path = BASE_DIR / "aviationstack-mcp" / ".venv" / "Scripts" / "python.exe"
        if path.exists():
            print(f"[MCP] Using nested venv Python: {path}")
            return str(path)
    else:
        # Linux (Render) — use system python3.13
        import shutil
        py313 = shutil.which("python3.13") or shutil.which("python3") or sys.executable
        print(f"[MCP] Using Linux Python: {py313}")
        return py313

    # fallback
    print(f"[MCP] Falling back to sys.executable: {sys.executable}")
    return sys.executable

AVIATION_PYTHON = _get_aviation_python()

# ── Client ──────────────────────────────────────────────────────────────────
client = MultiServerMCPClient(
    {
        "tavily": {
            "transport": "streamable_http",
            "url": f"https://mcp.tavily.com/mcp/?tavilyApiKey={TAVILY_API_KEY}",
        },
        "aviationstack": {
            "transport": "stdio",
            "command": AVIATION_PYTHON,
            "args": ["-m", "aviationstack_mcp", "mcp", "run"],
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


# ── Public API ───────────────────────────────────────────────────────────────

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


# ── Destination extractor ────────────────────────────────────────────────────
_llm = ChatGroq(model="llama-3.3-70b-versatile")

def extract_destination(query: str) -> str:
    prompt = f"""Extract only the destination city or country from this query.
Query: {query}
Return only the destination name, nothing else."""
    response = _llm.invoke(prompt)
    return response.content.strip()