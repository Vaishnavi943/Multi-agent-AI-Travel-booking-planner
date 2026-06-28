"""
HTTP wrapper for aviationstack-mcp.
Forces FastMCP to use Railway's PORT and bind to 0.0.0.0.
"""
import os
import sys

# Must set these BEFORE importing FastMCP
port = int(os.getenv("PORT", 8080))
os.environ["HOST"] = "0.0.0.0"
os.environ["PORT"] = str(port)

print(f"[aviation-mcp] Starting on 0.0.0.0:{port}")

from aviationstack_mcp import mcp

if __name__ == "__main__":
    # FastMCP streamable-http with explicit host and port
    mcp.run(
        transport="streamable-http",
        host="0.0.0.0",
        port=port,
    )