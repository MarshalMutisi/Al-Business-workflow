"""Client for the CRM MCP server, launched as a subprocess over stdio."""

import json
import sys
from typing import Any

from langsmith import trace
from mcp import Client, StdioServerParameters

from ..config import get_settings


class CRMError(RuntimeError):
    pass


class CRMClient:
    """Long-lived MCP connection. Use `async with crm:` for the app's lifetime."""

    def __init__(self) -> None:
        self._client: Client | None = None

    async def __aenter__(self) -> "CRMClient":
        settings = get_settings()
        params = StdioServerParameters(
            command=sys.executable,
            args=["-m", "ai_bussiness_workflow.mcp_servers.crm_server"],
            # The subprocess only gets a minimal default environment, so pass what it needs.
            env={"SUPABASE_URL": settings.supabase_url, "SUPABASE_SERVICE_ROLE_KEY": settings.supabase_key},
        )
        self._client = Client(params, read_timeout_seconds=30)
        await self._client.__aenter__()
        return self

    async def __aexit__(self, *exc_info: Any) -> None:
        if self._client is not None:
            await self._client.__aexit__(*exc_info)
            self._client = None

    async def call(self, tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
        # MCP calls are not LangChain runs, so trace them explicitly; they nest under the calling graph node.
        with trace(f"crm.{tool}", run_type="tool", inputs=arguments) as run:
            output = await self._call(tool, arguments)
            run.end(outputs=output)
            return output

    async def _call(self, tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if self._client is None:
            raise RuntimeError("CRM MCP client is not connected")
        result = await self._client.call_tool(tool, arguments)
        text = "\n".join(getattr(block, "text", "") for block in result.content)
        if result.is_error:
            raise CRMError(f"CRM tool {tool} failed: {text}")
        if isinstance(result.structured_content, dict):
            return result.structured_content
        return json.loads(text)


crm = CRMClient()
