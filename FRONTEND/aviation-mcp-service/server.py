"""
Aviation MCP HTTP server for Railway deployment.
Uses asyncio.run + run_async with explicit host/port.
"""
import asyncio
import os

port = int(os.getenv("PORT", 8080))
print(f"[aviation-mcp] Starting on 0.0.0.0:{port}")

from aviationstack_mcp import mcp

if __name__ == "__main__":
    asyncio.run(
        mcp.run_async(
            transport="streamable-http",
            host="0.0.0.0",
            port=port,
        )
    )