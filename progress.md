# MarketMind — Project Progress Log

> Last updated: 2026-03-03
> Next session: Start Phase 4 — FastAPI Backend

---

## Overall Status

| Phase | Title | Status |
|---|---|---|
| 1 | Project Scaffold | ✅ Complete |
| 2 | MCP Server with Finance Tools | ✅ Complete |
| 3 | Claude Agent wired to MCP | ✅ Complete |
| 4 | FastAPI Backend | 🔜 Next |
| 5 | Next.js Frontend (static data) | ⬜ Not started |
| 6 | Connect Frontend to Backend | ⬜ Not started |
| 7 | Polish & Features | ⬜ Not started |

---

## Phase 1 — Project Scaffold ✅

**Completed:** 2026-03-01

### What was built
- Monorepo at `/Users/krish/Code/marketmind/`
- `frontend/` — Next.js 16, TypeScript, Tailwind CSS, App Router
- `backend/` — FastAPI + uvicorn, uv-managed virtualenv
- `mcp-server/` — MCP server, uv-managed virtualenv
- Root `.gitignore`
- `backend/.env` and `mcp-server/.env` created (see notes)

### How to run
```bash
# Terminal 1 — Backend (port 8000)
cd backend && uv run uvicorn main:app --reload --port 8000

# Terminal 2 — MCP Inspector
cd mcp-server && uv run mcp dev main.py

# Terminal 3 — Frontend (port 3000)
cd frontend && npm run dev
```

### Verified working
- `GET http://localhost:8000/health` → `{"status":"ok","service":"marketmind-backend"}`
- Next.js welcome page at `http://localhost:3000`

---

## Phase 2 — MCP Server with Finance Tools ✅

**Completed:** 2026-03-01

### What was built
File: `mcp-server/main.py`

| Tool | Description | Tested |
|---|---|---|
| `ping()` | Sanity check — returns "MCP server is alive!" | ✅ |
| `get_stock_quote(symbol)` | Current price, change %, volume, market cap via yfinance | ✅ |
| `get_historical_prices(symbol, period)` | OHLCV data as list of dicts, period = 1d/5d/1mo/etc | ✅ |
| `get_market_overview()` | S&P 500 (`^GSPC`), NASDAQ (`^IXIC`), Dow Jones (`^DJI`) | ✅ |
| `search_ticker(query)` | Search for tickers by company name using `yf.Search` | ✅ |

### Key notes
- `yfinance` is free, no API key needed
- Tools return plain Python dicts/lists — FastMCP serialises to JSON automatically
- All tools have `try/except` error handling — return `{"error": ...}` on failure
- Verified all tools directly via `uv run python -c "import main; ..."` before MCP Inspector

### How to test with MCP Inspector
```bash
cd mcp-server
uv run mcp dev main.py
# Opens http://localhost:5173 in browser
# Click Connect → pick a tool → fill args → Run Tool
```

---

## Phase 3 — Claude Agent wired to MCP ✅

**Completed:** 2026-03-01
**Status:** Code written, pending first live run (needs API key)

### What was built
File: `backend/agent.py`

A standalone async CLI script that:
1. Launches the MCP server as a subprocess via **stdio transport**
2. Does the MCP handshake (`session.initialize()`)
3. Discovers tools (`session.list_tools()`)
4. Converts MCP tool format → Anthropic tool format
5. Runs the **agentic loop** until `stop_reason == "end_turn"`

### Key concepts implemented
- **stdio transport**: MCP server runs as a subprocess; communication via stdin/stdout pipes
- **Agentic loop**: Claude calls tools → we execute via MCP → feed results back → repeat
- **Message history**: Full conversation (user + assistant + tool_results) rebuilt on each API call
- **tool_use_id matching**: Every `tool_result` must reference the `tool_use_id` from Claude's `tool_use` block

### Dependencies added
- Added `mcp>=1.26.0` to `backend/pyproject.toml` (was only in mcp-server before)

### How to run (once API key is set)
```bash
cd backend
uv run python agent.py
```

### Verified working (2026-03-03)
- API key set in `backend/.env` ✅
- `uv run python agent.py` runs successfully ✅
- Claude calls `get_stock_quote("AAPL")` + `get_market_overview()` and returns a formatted answer ✅

---

## Session Notes — 2026-03-03

### Agent SDK Reference File
Created `backend/agent_sdk_version.py` — a reference-only implementation of `agent.py` using
`claude_agent_sdk` instead of the raw `AsyncAnthropic` client. NOT used in Phase 4.
Requires `uv add claude-agent-sdk` in `backend/` before running.

#### Key lessons learned getting it working:
1. **`cwd` is silently ignored** in Agent SDK `mcp_servers` — use `uv run --directory <path>` instead
2. **`permission_mode="dontAsk"` is not enough** for MCP tools — they require `"bypassPermissions"`
3. **Built-in tools take priority** — Agent SDK ships with WebSearch, Read, Bash etc. enabled by default;
   use `disallowed_tools` to force Claude to use your MCP tools instead

#### Why raw SDK is better for Phase 4:
- Agent SDK gives per-message results, not per-token streaming
- Per-token streaming is required for the real-time chat SSE endpoint
- Raw SDK loop in `agent.py` gives full control over what gets streamed

---

## Phase 4 — FastAPI Backend 🔜 (NEXT)

### Goal
Wrap the agent in HTTP endpoints so the Next.js frontend can call it.

### Endpoints to build
| Endpoint | Method | Type | Purpose |
|---|---|---|---|
| `/health` | GET | REST | Already done ✅ |
| `/api/market/overview` | GET | REST | Calls `get_market_overview()` directly via MCP |
| `/api/market/history/{symbol}` | GET | REST | Calls `get_historical_prices()` directly via MCP |
| `/api/chat` | POST | SSE stream | Runs full agent loop, streams Claude's response token by token |

### Key concept: SSE (Server-Sent Events)
- SSE lets the server push text chunks to the browser as they arrive
- FastAPI has `EventSourceResponse` from the `sse-starlette` package (already installed)
- The chat endpoint will stream Claude's text tokens one by one — this is what makes it feel real-time

### What to add to `backend/main.py`
- Import and instantiate a shared MCP session (or create per-request — TBD)
- Add the three new route handlers
- Use `async def` throughout (FastAPI + MCP client are both async)

### Starting point for Phase 4
The agent loop logic from `backend/agent.py` gets split into:
- A reusable `get_mcp_session()` helper
- A `stream_agent_response()` async generator (yields text chunks)
- Route handlers that call these

---

## Current File Tree

```
marketmind/
├── .gitignore
├── progress.md                        ← this file
├── backend/
│   ├── .env                           ← ANTHROPIC_API_KEY set ✅
│   ├── agent.py                       ← Phase 3: standalone CLI agent (verified working)
│   ├── agent_sdk_version.py           ← REFERENCE ONLY: Agent SDK equivalent of agent.py
│   ├── main.py                        ← Phase 1: FastAPI app (health endpoint only)
│   └── pyproject.toml                 ← deps: fastapi, uvicorn, anthropic, mcp, python-dotenv, claude-agent-sdk
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx                   ← default Next.js page
│   └── package.json
└── mcp-server/
    ├── .env                           ← FRED_API_KEY placeholder (not needed yet)
    ├── main.py                        ← Phase 2: 5 finance tools
    └── pyproject.toml                 ← deps: mcp[cli], yfinance, python-dotenv
```

---

## Environment / Tool Versions

| Tool | Version |
|---|---|
| Node.js | v22.12.0 |
| Python | 3.14.3 (via pyenv) |
| uv | 0.10.7 |
| Next.js | 16.x |
| FastAPI | 0.135.1 |
| anthropic SDK | 0.84.0 |
| mcp | 1.26.0 |
| yfinance | 1.2.0 |

---

## Notes & Decisions

- **pnpm not installed** — using `npm` instead (comes with Node v22)
- **uv init creates `main.py`** (not `hello.py` as older versions did) — we overwrote it in place
- **Python 3.14** is very new; `uv` handles the virtualenv correctly
- **MCP server file** is `main.py` (not `server.py` as originally planned) — agent.py references it correctly
- **No turbopack** — passed `--no-turbopack` to `create-next-app` to avoid interactive prompt
- **Individual .git repos** inside `backend/` and `mcp-server/` — created by `uv init`. If you want a single root git repo later, we'll need to remove these and reinitialise at the `marketmind/` level.
