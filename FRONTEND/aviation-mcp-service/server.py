"""
Aviation MCP HTTP server.
Bypasses FastMCP.run() and uses uvicorn directly to control host/port.
"""
import os
import sys
import uvicorn

port = int(os.getenv("PORT", 8080))
print(f"[aviation-mcp] Starting on 0.0.0.0:{port}")

from aviationstack_mcp import mcp

# Get the ASGI app from FastMCP directly
# FastMCP exposes the underlying Starlette/ASGI app
if hasattr(mcp, 'get_asgi_app'):
    asgi_app = mcp.get_asgi_app()
elif hasattr(mcp, 'http_app'):
    asgi_app = mcp.http_app()
elif hasattr(mcp, '_asgi_app'):
    asgi_app = mcp._asgi_app
elif hasattr(mcp, 'asgi_app'):
    asgi_app = mcp.asgi_app
else:
    # Last resort: use streamable-http app attribute
    mcp.run(transport="streamable-http")  # let it init internals
    asgi_app = getattr(mcp, '_http_app', None) or getattr(mcp, 'app', None)

if asgi_app is None:
    print("[aviation-mcp] ERROR: Could not get ASGI app from FastMCP")
    print(f"[aviation-mcp] Available attrs: {[a for a in dir(mcp) if not a.startswith('__')]}")
    sys.exit(1)

if __name__ == "__main__":
    uvicorn.run(asgi_app, host="0.0.0.0", port=port)