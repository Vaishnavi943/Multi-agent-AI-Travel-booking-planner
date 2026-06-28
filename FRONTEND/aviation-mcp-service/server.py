"""
HTTP wrapper for aviationstack-mcp using FastMCP streamable-http transport.
"""
import os

port = int(os.getenv("PORT", 8080))

from aviationstack_mcp import mcp  # FastMCP instance

if __name__ == "__main__":
    print(f"[aviation-mcp] Starting on port {port}")
    try:
        # Try streamable-http first (recommended for new projects)
        mcp.run(transport="streamable-http", host="0.0.0.0", port=port)
    except TypeError:
        try:
            # Fallback: sse transport
            mcp.run(transport="sse", host="0.0.0.0", port=port)
        except TypeError:
            # Last resort: no port arg (older FastMCP)
            os.environ["PORT"] = str(port)
            mcp.run(transport="sse")