import asyncio
from mcp_client import aviation_mcp_call

async def main():

    print("Before MCP call")

    result = await aviation_mcp_call("list_airports")

    print("After MCP call")

    print(result)

asyncio.run(main())