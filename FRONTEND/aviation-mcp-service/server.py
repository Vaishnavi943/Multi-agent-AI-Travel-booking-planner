"""
HTTP SSE wrapper for aviationstack-mcp.
"""
import os
import sys

port = int(os.getenv("PORT", 8080))

# Try multiple approaches for different FastMCP versions
try:
    from aviationstack_mcp import mcp

    # Approach 1: mcp.run() with no extra args — uses MCP_PORT env var
    os.environ["MCP_PORT"] = str(port)
    os.environ["MCP_HOST"] = "0.0.0.0"
    os.environ["FASTMCP_PORT"] = str(port)
    os.environ["FASTMCP_HOST"] = "0.0.0.0"

    print(f"[aviation-mcp] Starting SSE server on port {port}")
    mcp.run(transport="sse")

except TypeError as e:
    print(f"[aviation-mcp] mcp.run(transport='sse') failed: {e}")
    print("[aviation-mcp] Trying CLI approach...")

    # Approach 2: use the CLI entry point directly
    import subprocess
    result = subprocess.run(
        [sys.executable, "-m", "aviationstack_mcp", "mcp", "run",
         "--transport", "sse", "--host", "0.0.0.0", "--port", str(port)],
        check=True
    )