"""
Custom Aviation MCP HTTP server.
Bypasses aviationstack-mcp package entirely.
Calls AviationStack REST API directly and exposes as MCP over HTTP.
"""
import asyncio
import os
import json
import httpx
from fastmcp import FastMCP

AVIATION_API_KEY = os.getenv("AVIATION_API_KEY", "")
AVIATION_BASE_URL = "http://api.aviationstack.com/v1"
PORT = int(os.getenv("PORT", 8080))

# Create our own FastMCP server
mcp = FastMCP("Aviation MCP Server", stateless_http=True)


@mcp.tool()
async def list_airports(limit: int = 10) -> str:
    """List airports using AviationStack API"""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{AVIATION_BASE_URL}/airports",
                params={"access_key": AVIATION_API_KEY, "limit": limit},
                timeout=10,
            )
            data = resp.json()
            airports = data.get("data", [])
            result = [
                {
                    "name": a.get("airport_name"),
                    "iata": a.get("iata_code"),
                    "icao": a.get("icao_code"),
                    "city": a.get("city_iata_code"),
                    "country": a.get("country_name"),
                }
                for a in airports[:limit]
            ]
            return json.dumps(result)
        except Exception as e:
            return json.dumps({"error": str(e)})


@mcp.tool()
async def list_airlines(limit: int = 10) -> str:
    """List airlines using AviationStack API"""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{AVIATION_BASE_URL}/airlines",
                params={"access_key": AVIATION_API_KEY, "limit": limit},
                timeout=10,
            )
            data = resp.json()
            airlines = data.get("data", [])
            result = [
                {
                    "name": a.get("airline_name"),
                    "iata": a.get("iata_code"),
                    "icao": a.get("icao_code"),
                    "country": a.get("country_name"),
                    "status": a.get("status"),
                }
                for a in airlines[:limit]
            ]
            return json.dumps(result)
        except Exception as e:
            return json.dumps({"error": str(e)})


@mcp.tool()
async def get_flights(
    dep_iata: str = "",
    arr_iata: str = "",
    airline_iata: str = "",
    limit: int = 5,
) -> str:
    """Get real-time flights from AviationStack API"""
    async with httpx.AsyncClient() as client:
        try:
            params = {"access_key": AVIATION_API_KEY, "limit": limit}
            if dep_iata:
                params["dep_iata"] = dep_iata
            if arr_iata:
                params["arr_iata"] = arr_iata
            if airline_iata:
                params["airline_iata"] = airline_iata

            resp = await client.get(
                f"{AVIATION_BASE_URL}/flights",
                params=params,
                timeout=10,
            )
            data = resp.json()
            flights = data.get("data", [])
            result = [
                {
                    "flight_number": f.get("flight", {}).get("iata"),
                    "airline": f.get("airline", {}).get("name"),
                    "departure": f.get("departure", {}).get("airport"),
                    "departure_iata": f.get("departure", {}).get("iata"),
                    "arrival": f.get("arrival", {}).get("airport"),
                    "arrival_iata": f.get("arrival", {}).get("iata"),
                    "status": f.get("flight_status"),
                }
                for f in flights[:limit]
            ]
            return json.dumps(result)
        except Exception as e:
            return json.dumps({"error": str(e)})


@mcp.tool()
async def health_check() -> str:
    """Health check for the aviation MCP server"""
    return json.dumps({"status": "ok", "api_key_set": bool(AVIATION_API_KEY)})


if __name__ == "__main__":
    print(f"[aviation-mcp] Starting custom MCP server on 0.0.0.0:{PORT}")
    asyncio.run(
        mcp.run_async(
            transport="streamable-http",
            host="0.0.0.0",
            port=PORT,
        )
    )