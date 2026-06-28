"""
Standalone HTTP wrapper for aviationstack-mcp.
Runs the MCP server over SSE so Railway can host it.
"""
import os
import sys
from aviationstack_mcp import mcp  # imports the FastMCP instance

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    # FastMCP supports .run() with transport options
    mcp.run(transport="sse", port=port, host="0.0.0.0")