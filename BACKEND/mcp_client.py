from ast import main
import os
import asyncio

from dotenv import load_dotenv
from langchain_mcp_adapters.client import MultiServerMCPClient

# load_dotenv()
load_dotenv(override=True)
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
AVIATION_API_KEY = os.getenv("AVIATION_API_KEY")

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

client = MultiServerMCPClient(
    {   
        # remote MCP Server
        "tavily": {
            "transport": "streamable_http",
            "url": f"https://mcp.tavily.com/mcp/?tavilyApiKey={TAVILY_API_KEY}"
        },

        # Local MCP Server
        "aviationstack": {
            "transport": "stdio",
            "command": r"D:\Projects-stuffs\Multi-Agent AI Travel Booking System\BACKEND\aviationstack-mcp\.venv\Scripts\python.exe",
            "args": [
                "-m",
                "aviationstack_mcp",
                "mcp",
                "run"
            ],
            "env": {
                "AVIATION_API_KEY": AVIATION_API_KEY
            }
        },

        #Custome MCP Server
        "weather": {
            "transport": "stdio",
            "command": r"D:\Projects-stuffs\Multi-Agent AI Travel Booking System\BACKEND\.venv\Scripts\python.exe",
            "args": [
                r"D:\Projects-stuffs\Multi-Agent AI Travel Booking System\BACKEND\custom_weather_mcp_server.py"
            ],
            "env": {
                "OPENWEATHER_API_KEY": OPENWEATHER_API_KEY
            }
        }
    }
)



search_tool = None
aviation_tools = {}

async def initialize_mcp():

    global search_tool
    global aviation_tools

    print("[INIT] initialize_mcp() called")

    if search_tool is not None and aviation_tools:
        print("[INIT] Already initialized")
        return

    print("[INIT] Loading tools...")

    tools = await client.get_tools()

    print(f"[INIT] Loaded {len(tools)} tools")

    for tool in tools:
        print(tool.name)

    search_tool = next(
        tool
        for tool in tools
        if tool.name == "tavily_search"
    )

    aviation_tools = {
        tool.name: tool
        for tool in tools
        if tool.name != "tavily_search"
    }

    print("[INIT] Initialization completed")


async def tavily_mcp_search(query: str):
    await initialize_mcp()
    result = await search_tool.ainvoke(
        {
            "query": query
        }
    )
    return result




async def aviation_mcp_call(tool_name: str, tool_args: dict = None):

    print(f"\n[MCP] aviation_mcp_call started")
    print(f"[MCP] Requested tool: {tool_name}")
    print("[MCP] Calling client.get_tools()...")

    tools = await client.get_tools()

    print("[MCP] client.get_tools() completed")
    print(f"[MCP] Total tools found: {len(tools)}")

    for t in tools:
        print(f" - {t.name}")

    tool = next(
        t for t in tools
        if t.name == tool_name
    )

    print(f"[MCP] Found tool: {tool.name}")
    print("[MCP] Invoking tool...")

    result = await tool.ainvoke(tool_args or {})

    print("[MCP] Tool invocation completed")

    return result



async def get_airports():

    await initialize_mcp()

    tool = aviation_tools.get("list_airports")

    if not tool:
        return "Airport tool unavailable"

    result = await tool.ainvoke({})

    return result


async def get_airlines():

    await initialize_mcp()

    tool = aviation_tools.get("list_airlines")

    if not tool:
        return "Airline tool unavailable"

    result = await tool.ainvoke({})

    return result


weather_tool = None
forecast_tool = None


async def initialize_weather_tools():

    global weather_tool, forecast_tool

    if weather_tool is not None:
        return

    tools = await client.get_tools()

    weather_tool = next(
        t for t in tools
        if t.name == "get_current_weather"
    )

    forecast_tool = next(
        t for t in tools
        if t.name == "get_forecast"
    )


async def weather_mcp_search(city: str):

    await initialize_weather_tools()

    return await weather_tool.ainvoke(
        {
            "city": city
        }
    )


async def forecast_mcp_search(city: str):

    await initialize_weather_tools()

    return await forecast_tool.ainvoke(
        {
            "city": city
        }
    )




from langchain_groq import ChatGroq

# LLM
llm = ChatGroq(
    model="llama-3.3-70b-versatile"
)

###################################
# Destination Extractor
###################################

def extract_destination(query: str):

    prompt = f"""
    Extract only the destination city or country.

    Query:
    {query}

    Return only destination name.
    """

    response = llm.invoke(prompt)

    return response.content.strip()


if __name__ == "__main__":
    asyncio.run(main())