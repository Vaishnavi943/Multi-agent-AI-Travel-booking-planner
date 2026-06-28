"""
Custom Aviation MCP Server using AviationStack REST API.
Mirrors the pattern of custom_weather_mcp_server.py.
Run as stdio MCP server — same as weather server.
"""
import os
import json
import asyncio
import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

AVIATION_API_KEY = os.getenv("AVIATION_API_KEY", "")
BASE_URL = "http://api.aviationstack.com/v1"

server = Server("aviation-mcp")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="list_airports",
            description="List airports using AviationStack API",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "default": 10}
                }
            }
        ),
        Tool(
            name="list_airlines",
            description="List airlines using AviationStack API",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "default": 10}
                }
            }
        ),
        Tool(
            name="get_flights",
            description="Get flights between airports",
            inputSchema={
                "type": "object",
                "properties": {
                    "dep_iata": {"type": "string", "description": "Departure IATA code"},
                    "arr_iata": {"type": "string", "description": "Arrival IATA code"},
                    "limit":    {"type": "integer", "default": 5}
                }
            }
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    async with httpx.AsyncClient() as client:

        if name == "list_airports":
            try:
                resp = await client.get(
                    f"{BASE_URL}/airports",
                    params={"access_key": AVIATION_API_KEY, "limit": arguments.get("limit", 10)},
                    timeout=15,
                )
                data = resp.json()
                airports = data.get("data", [])
                result = [
                    {
                        "name":    a.get("airport_name"),
                        "iata":    a.get("iata_code"),
                        "city":    a.get("city_iata_code"),
                        "country": a.get("country_name"),
                    }
                    for a in airports
                ]
                return [TextContent(type="text", text=json.dumps(result))]
            except Exception as e:
                return [TextContent(type="text", text=json.dumps({"error": str(e)}))]

        elif name == "list_airlines":
            try:
                resp = await client.get(
                    f"{BASE_URL}/airlines",
                    params={"access_key": AVIATION_API_KEY, "limit": arguments.get("limit", 10)},
                    timeout=15,
                )
                data = resp.json()
                airlines = data.get("data", [])
                result = [
                    {
                        "name":    a.get("airline_name"),
                        "iata":    a.get("iata_code"),
                        "country": a.get("country_name"),
                        "status":  a.get("status"),
                    }
                    for a in airlines
                ]
                return [TextContent(type="text", text=json.dumps(result))]
            except Exception as e:
                return [TextContent(type="text", text=json.dumps({"error": str(e)}))]

        elif name == "get_flights":
            try:
                params = {
                    "access_key": AVIATION_API_KEY,
                    "limit": arguments.get("limit", 5),
                }
                if arguments.get("dep_iata"):
                    params["dep_iata"] = arguments["dep_iata"]
                if arguments.get("arr_iata"):
                    params["arr_iata"] = arguments["arr_iata"]

                resp = await client.get(
                    f"{BASE_URL}/flights",
                    params=params,
                    timeout=15,
                )
                data = resp.json()
                flights = data.get("data", [])
                result = [
                    {
                        "flight":     f.get("flight", {}).get("iata"),
                        "airline":    f.get("airline", {}).get("name"),
                        "departure":  f.get("departure", {}).get("iata"),
                        "arrival":    f.get("arrival", {}).get("iata"),
                        "status":     f.get("flight_status"),
                    }
                    for f in flights
                ]
                return [TextContent(type="text", text=json.dumps(result))]
            except Exception as e:
                return [TextContent(type="text", text=json.dumps({"error": str(e)}))]

        return [TextContent(type="text", text=json.dumps({"error": f"Unknown tool: {name}"}))]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())