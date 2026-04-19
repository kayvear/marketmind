"""
main.py — Phase 4: FastAPI Backend

Wraps the Claude + MCP agent in HTTP endpoints so the Next.js frontend can call it.

Endpoints:
  GET  /health                                  → sanity check (Phase 1, unchanged)
  GET  /api/market/overview                     → calls get_market_overview() via MCP directly
  GET  /api/market/history/{symbol}             → calls get_historical_prices() via MCP directly
  GET  /api/economics/overview                  → calls get_economic_overview() via MCP directly
  GET  /api/economics/history/{series_id}       → calls get_economic_series() via MCP directly
  POST /api/chat                                → runs the full agentic loop, streams tokens via SSE
"""

import json
from contextlib import asynccontextmanager
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from pydantic import BaseModel

load_dotenv()

# Path to the MCP server directory — same logic as agent.py
MCP_SERVER_DIR = Path(__file__).parent.parent / "mcp-server"


# ---------------------------------------------------------------------------
# MCP result parser
# ---------------------------------------------------------------------------
# FastMCP serialises tool return values as TextContent objects, but the
# number of TextContent objects depends on what the tool returned:
#
#   Tool returns dict       → one TextContent  containing the full JSON
#   Tool returns list[dict] → one TextContent  PER ITEM in the list
#
# So for market history (which returns a list), joining with spaces gives:
#   '{"date": "2026-02-27", ...} {"date": "2026-02-28", ...} ...'
# — which is NOT valid JSON and causes json.loads() to raise "Extra data".
#
# This helper handles both cases:
#   1. Try parsing the joined string — works for single dict/value returns.
#   2. If that fails, parse each TextContent piece separately — works for lists.
# ---------------------------------------------------------------------------
def parse_mcp_result(result):
    pieces = [c.text for c in result.content if hasattr(c, "text")]
    if not pieces:
        return None
    try:
        return json.loads(" ".join(pieces))
    except json.JSONDecodeError:
        # List return value: each item came back as its own TextContent
        return [json.loads(p) for p in pieces]


# ---------------------------------------------------------------------------
# MCP session helper
# ---------------------------------------------------------------------------
# This is an async context manager — a reusable "open, use, close" block.
#
# Why a context manager?
#   The MCP server runs as a subprocess (stdio transport). We need to:
#     1. Start the subprocess
#     2. Do the handshake
#     3. Use the session
#     4. Shut down cleanly when done
#   Context managers guarantee step 4 even if something goes wrong in step 3.
#
# Usage in any route:
#   async with get_mcp_session() as session:
#       result = await session.call_tool("get_market_overview", {})
#
# @asynccontextmanager turns a plain async generator function into a context
# manager. Everything before `yield` is the "enter" code; everything after
# is the "exit" code (cleanup). The value after `yield` is what gets bound
# to the `as session` variable.
# ---------------------------------------------------------------------------
@asynccontextmanager
async def get_mcp_session():
    """Start the MCP server subprocess, handshake, and yield a ready session."""
    server_params = StdioServerParameters(
        command="uv",
        args=["run", "python", "main.py"],
        cwd=str(MCP_SERVER_DIR),
    )
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield session  # ← routes use the session here


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="MarketMind API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# GET /health  (Phase 1, unchanged)
# ---------------------------------------------------------------------------
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "marketmind-backend"}


# ---------------------------------------------------------------------------
# GET /api/market/overview
# ---------------------------------------------------------------------------
# Calls the MCP get_market_overview tool directly — no Claude, no tokens.
# FastMCP serialises our Python dict return value as JSON text inside a
# TextContent object. We join all text pieces and parse back to a dict so
# FastAPI can return it as JSON.
# ---------------------------------------------------------------------------
@app.get("/api/market/overview")
async def market_overview():
    """Return a real-time snapshot of S&P 500, NASDAQ, and Dow Jones."""
    async with get_mcp_session() as session:
        result = await session.call_tool("get_market_overview", {})
        return parse_mcp_result(result)


# ---------------------------------------------------------------------------
# GET /api/market/history/{symbol}
# ---------------------------------------------------------------------------
# {symbol} is a path parameter — e.g. /api/market/history/AAPL
# ?period=  is an optional query parameter — defaults to "1mo"
# Valid period values: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, ytd, max
# ---------------------------------------------------------------------------
@app.get("/api/market/history/{symbol}")
async def market_history(symbol: str, period: str = "1mo"):
    """Return OHLCV price history for a ticker. Add ?period=3mo to change range."""
    async with get_mcp_session() as session:
        result = await session.call_tool(
            "get_historical_prices",
            {"symbol": symbol.upper(), "period": period},
        )
        return parse_mcp_result(result)


# ---------------------------------------------------------------------------
# GET /api/economics/overview
# ---------------------------------------------------------------------------
@app.get("/api/economics/overview")
async def economics_overview():
    """Return the latest value for Fed Rate, CPI YoY, Unemployment, and 10Y Yield."""
    async with get_mcp_session() as session:
        result = await session.call_tool("get_economic_overview", {})
        return parse_mcp_result(result)


# ---------------------------------------------------------------------------
# GET /api/economics/history/{series_id}
# ---------------------------------------------------------------------------
# {series_id} is a path parameter — e.g. /api/economics/history/FEDFUNDS
# ?period=    is an optional query parameter — defaults to "5y"
# Valid period values match get_economic_series(): 1y, 2y, 5y, 10y, 20y, max
# ---------------------------------------------------------------------------
@app.get("/api/economics/history/{series_id}")
async def economics_history(series_id: str, period: str = "5y"):
    """Return historical data for a FRED series. Add ?period=10y to change range."""
    async with get_mcp_session() as session:
        result = await session.call_tool(
            "get_economic_series",
            {"series_id": series_id.upper(), "period": period},
        )
        return parse_mcp_result(result)


# ---------------------------------------------------------------------------
# GET /api/economics/search
# ---------------------------------------------------------------------------
@app.get("/api/economics/search")
async def economics_search(q: str, limit: int = 8):
    """Search FRED series by keyword. Returns title, units, frequency."""
    async with get_mcp_session() as session:
        result = await session.call_tool("search_fred", {"query": q, "limit": limit})
        return parse_mcp_result(result)


# ---------------------------------------------------------------------------
# GET /api/economics/categories
# ---------------------------------------------------------------------------
@app.get("/api/economics/categories")
async def economics_categories(parent_id: int = 0):
    """Browse FRED category tree. parent_id=0 returns top-level categories."""
    async with get_mcp_session() as session:
        result = await session.call_tool("get_fred_categories", {"parent_id": parent_id})
        return parse_mcp_result(result)


# ---------------------------------------------------------------------------
# GET /api/economics/categories/{category_id}/series
# ---------------------------------------------------------------------------
@app.get("/api/economics/categories/{category_id}/series")
async def economics_category_series(category_id: int):
    """
    Get contents of a FRED category.
    Returns { is_leaf, subcategories, series } — is_leaf tells you which to use.
    """
    async with get_mcp_session() as session:
        result = await session.call_tool("get_category_series", {"category_id": category_id})
        return parse_mcp_result(result)


# ---------------------------------------------------------------------------
# POST /api/chat  — SSE streaming
# ---------------------------------------------------------------------------
# This is the full agentic loop from agent.py, adapted for streaming.
#
# Key difference from agent.py:
#   agent.py uses client.messages.create(...)  → waits for the full response
#   Here we use  client.messages.stream(...)   → yields tokens as they arrive
#
# SSE format (what we send back to the browser):
#   data: "Hello"\n\n          ← one message per text token (JSON-encoded)
#   data: ", world"\n\n
#   event: done\ndata: \n\n   ← signals the stream is complete
#
# Why JSON-encode the text chunk?
#   Claude's response can contain newlines. A bare newline in the data field
#   would break the SSE framing. JSON encoding escapes \n → \\n safely.
#
# Why StreamingResponse instead of a regular JSON response?
#   Regular responses wait until the async function returns, then send
#   everything at once. StreamingResponse consumes our async generator
#   and forwards each yielded chunk to the client immediately.
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Verbosity → system prompt mapping
# Phase 7 will expose a toggle in the ChatPanel settings popover.
# The backend already accepts the parameter so Phase 7 is frontend-only.
# ---------------------------------------------------------------------------
SYSTEM_PROMPTS = {
    "brief": (
        "You are a concise financial assistant. Answer in 1–3 short sentences or a "
        "tight bullet list. Omit caveats and filler phrases."
    ),
    "normal": (
        "You are a helpful financial assistant. Give clear, accurate answers with "
        "enough context to be useful. Use bullet points for lists of data."
    ),
    "detailed": (
        "You are a thorough financial analyst assistant. Provide comprehensive "
        "answers with context, trends, and relevant caveats. Use headers to "
        "structure longer responses."
    ),
}


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []         # prior turns: [{"role": "user"|"assistant", "content": str}, ...]
    verbosity: str = "normal"        # "brief" | "normal" | "detailed"
    model: str = "claude-opus-4-6"   # any valid Claude model slug


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Run the Claude + MCP agentic loop and stream tokens back as SSE."""

    async def stream_response():
        async with get_mcp_session() as session:

            # --- Tool discovery (same as agent.py) ---
            tools_result = await session.list_tools()
            tools = [
                {
                    "name": t.name,
                    "description": t.description,
                    "input_schema": t.inputSchema,
                }
                for t in tools_result.tools
            ]

            system_prompt = SYSTEM_PROMPTS.get(request.verbosity, SYSTEM_PROMPTS["normal"])
            client = anthropic.AsyncAnthropic()
            messages = [
                *request.history,
                {"role": "user", "content": request.message},
            ]

            tools_called: list[str] = []  # accumulates tool names across all loop iterations

            # --- Agentic loop ---
            # Identical logic to agent.py, but uses client.messages.stream()
            # instead of client.messages.create().
            while True:
                final_message = None

                async with client.messages.stream(
                    model=request.model,
                    max_tokens=4096,
                    system=system_prompt,
                    tools=tools,
                    messages=messages,
                ) as stream:
                    # stream.text_stream is an async iterator of text chunks.
                    # On tool_use turns, Claude generates no text, so this
                    # loop body never runs — that's expected and fine.
                    async for text in stream.text_stream:
                        yield f"data: {json.dumps(text)}\n\n"

                    # get_final_message() returns the complete accumulated
                    # Message (including all tool_use blocks) after the stream
                    # finishes. Must be called inside the `async with` block.
                    final_message = await stream.get_final_message()

                # Tool use turn: execute tools and loop back to Claude
                if final_message.stop_reason == "tool_use":
                    messages.append({
                        "role": "assistant",
                        "content": final_message.content,
                    })

                    tool_results = []
                    for block in final_message.content:
                        if block.type == "tool_use":
                            tools_called.append(block.name)
                            result = await session.call_tool(block.name, block.input)
                            result_text = " ".join(
                                c.text for c in result.content if hasattr(c, "text")
                            )
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": result_text,
                            })

                    messages.append({"role": "user", "content": tool_results})
                    # Loop continues — Claude reads tool results and either
                    # answers (end_turn) or calls more tools (tool_use again).

                # End turn: Claude has given its final answer
                elif final_message.stop_reason == "end_turn":
                    meta = {"model": request.model, "tools": tools_called}
                    yield f"event: meta\ndata: {json.dumps(meta)}\n\n"
                    yield "event: done\ndata: \n\n"
                    break

                else:
                    break

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            # These two headers prevent proxies and browsers from buffering
            # the stream — without them, chunks might be held back until
            # a buffer fills up, defeating the point of streaming.
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
