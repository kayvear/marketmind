# MarketMind — Project Plan

> **Progress:** Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅ (pending API key test) | Phase 4 🔜 Next
> See `/Users/krish/Code/marketmind/progress.md` for the detailed execution log.

## Project Overview

**What you're building:** A finance/markets dashboard with an AI chat assistant powered by Claude, backed by real market data.

```
┌─────────────────────────────────────────────────┐
│              Browser (Next.js)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │Dashboard │  │  Chat UI │  │    Graphs    │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
└────────────────────┬────────────────────────────┘
                     │ HTTP / WebSocket
┌────────────────────▼────────────────────────────┐
│           FastAPI Backend (Python)              │
│  /api/dashboard    /api/chat (streaming)        │
└────────────────────┬────────────────────────────┘
                     │ Anthropic SDK
┌────────────────────▼────────────────────────────┐
│         Claude Agent (claude-sonnet-4-6)        │
└────────────────────┬────────────────────────────┘
                     │ MCP protocol
┌────────────────────▼────────────────────────────┐
│              MCP Server (Python)                │
│  tools: get_quote, get_history, get_overview... │
└────────────────────┬────────────────────────────┘
                     │ HTTP
┌────────────────────▼────────────────────────────┐
│         Finance API (Alpha Vantage / yfinance)  │
└─────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Charts | Recharts |
| Backend | Python 3.11+, FastAPI |
| Agent | Anthropic Python SDK (`anthropic`) |
| MCP Server | Python `mcp` package |
| Finance Data | `yfinance` (free, no key needed to start) |
| Dev tooling | `uv` (Python), `npm` (Node v22 built-in) |

---

## Phases

### Phase 1 — Project Scaffold ✅

#### Goal

Pure scaffolding — no real logic yet. The goal is to have all 3 servers boot successfully so every future phase starts from a known-good state.

#### What each piece does in Phase 1 only

| Piece | Role in Phase 1 |
|---|---|
| `frontend/` | Default Next.js welcome page — just proves it boots |
| `backend/main.py` | Single `/health` endpoint — just proves FastAPI boots |
| `mcp-server/server.py` | Single `ping` tool — just proves MCP server boots and can be called |

#### Key tools explained

- **`uv`** — Python package manager. Much faster than `pip`. `uv init` creates a project, `uv add` installs packages, `uv run` executes inside the virtual env automatically (no need to activate it manually).
- **`npx create-next-app`** — Official Next.js scaffolding CLI. Sets up TypeScript, Tailwind, and App Router in one command.
- **`mcp dev`** — Launches your MCP server and opens MCP Inspector in the browser — a visual tool to call your tools and see responses interactively.

#### Why a monorepo?

One git repo, one place to look, easy to run everything together. Each subfolder (`frontend/`, `backend/`, `mcp-server/`) is its own independent project with its own dependencies — they just live under one root.

#### Location

`/Users/krish/Code/marketmind/`

---

#### Steps

#### Step 1 — Create the root structure

```bash
mkdir marketmind && cd marketmind
```

#### Step 2 — Initialize the Next.js frontend

```bash
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

When asked "Would you like to use Turbopack?" → press `Enter` for Yes.

> Flags: `--typescript` (type safety), `--tailwind` (utility CSS), `--app` (App Router), `--no-src-dir` (simpler structure)

#### Step 3 — Initialize the Python backend

```bash
uv init backend
cd backend
uv add fastapi "uvicorn[standard]" anthropic python-dotenv
cd ..
```

#### Step 4 — Initialize the MCP server

```bash
uv init mcp-server
cd mcp-server
uv add "mcp[cli]" yfinance python-dotenv
cd ..
```

#### Step 5 — Create the FastAPI entry point

**`backend/main.py`**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MarketMind API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "marketmind-backend"}
```

```bash
rm backend/hello.py
```

#### Step 6 — Create the MCP server entry point

**`mcp-server/server.py`**
```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("MarketMind Finance Tools")

@mcp.tool()
def ping() -> str:
    """Test tool to verify the MCP server is running."""
    return "MCP server is alive!"

if __name__ == "__main__":
    mcp.run()
```

```bash
rm mcp-server/hello.py
```

#### Step 7 — Create environment files

**`backend/.env`**
```
ANTHROPIC_API_KEY=your_key_here
```

**`mcp-server/.env`**
```
# FRED_API_KEY=your_key_here   ← add in a later phase
```

#### Step 8 — Create root `.gitignore`

**`marketmind/.gitignore`**
```gitignore
# Python
__pycache__/
*.py[cod]
*.pyo
.venv/

# Environment files
.env
.env.*
!.env.example

# uv
.python-version
uv.lock

# Node / Next.js
node_modules/
.next/
out/
*.local

# OS
.DS_Store
Thumbs.db
```

#### Step 9 — Test everything

**Terminal 1 — Backend:**
```bash
cd backend
uv run uvicorn main:app --reload --port 8000
```
→ Visit http://localhost:8000/health — expect `{"status":"ok","service":"marketmind-backend"}`

**Terminal 2 — MCP server:**
```bash
cd mcp-server
uv run mcp dev server.py
```
→ MCP Inspector opens in browser. Click "ping" — expect `"MCP server is alive!"`

**Terminal 3 — Frontend:**
```bash
cd frontend
npm run dev
```
→ Visit http://localhost:3000 — expect default Next.js welcome page.

#### Final folder structure

```
marketmind/
├── .gitignore
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── package.json
│   └── tailwind.config.ts
├── backend/
│   ├── main.py
│   ├── .env
│   └── pyproject.toml
└── mcp-server/
    ├── server.py
    ├── .env
    └── pyproject.toml
```

---

### Phase 2 — MCP Server with Finance Tools ✅

#### Goal
Build real finance tools into the MCP server using `yfinance`. At the end of this phase, you can call tools directly via the MCP Inspector and get live market data back — no Claude involved yet.

#### Tools to build

| Tool | Input | Output |
|---|---|---|
| `get_stock_quote(symbol)` | e.g. `"AAPL"` | Current price, change, change % |
| `get_historical_prices(symbol, period)` | e.g. `"AAPL", "1mo"` | OHLCV data (open, high, low, close, volume) |
| `get_market_overview()` | none | S&P 500, NASDAQ, Dow Jones snapshot |
| `search_ticker(query)` | e.g. `"apple"` | Matching ticker symbols |

#### Why `yfinance`?
Wraps Yahoo Finance's API — completely free, no API key required. We'll layer FRED (Federal Reserve economic data) on top in a later phase.

#### Test method
Use `uv run mcp dev server.py` to open MCP Inspector and call each tool manually before wiring Claude to it.

---

### Phase 3 — Claude Agent wired to MCP ✅

#### Goal
Connect Claude to the MCP server so it can call your finance tools autonomously. Test with a simple CLI script — no web server yet.

#### What you'll build
- A Python script that creates an Anthropic client, connects it to the MCP server via `stdio`, and sends a query
- Example: ask "What is Apple's stock price?" → Claude calls `get_stock_quote("AAPL")` → formats and returns the answer

#### Key concepts learned
- **Tool use**: How Claude decides when and which tool to call
- **MCP stdio transport**: The MCP client/server handshake over stdin/stdout
- **Streaming responses**: How to consume `AssistantMessage` chunks as they arrive vs. the final `ResultMessage`

---

### Phase 4 — FastAPI Backend 🔜 NEXT

#### Goal
Wrap the Claude agent in HTTP endpoints so the frontend can talk to it. Two types of endpoints: REST (for data) and streaming SSE (for chat).

#### Endpoints to build

| Endpoint | Type | Purpose |
|---|---|---|
| `GET /health` | REST | Already done in Phase 1 |
| `GET /api/market/overview` | REST | Dashboard market data |
| `GET /api/market/history/{symbol}` | REST | Chart OHLCV data |
| `POST /api/chat` | SSE stream | Claude agent responses, streamed token by token |

#### Why SSE for chat?
Server-Sent Events (SSE) let the backend push text chunks to the browser as Claude generates them — this is what makes the chat feel real-time. WebSockets are bidirectional; SSE is simpler and sufficient for this use case.

---

### Phase 5 — Next.js Frontend (static data first)

#### Goal
Build the full UI with hardcoded/static data. Get the layout, components, and styling right before connecting to any real data.

#### Pages & components

| Component | Description |
|---|---|
| Sidebar | Navigation between Dashboard and Chat |
| Dashboard page | Metric cards (price, change %) + chart |
| Chart component | Recharts `LineChart` or `AreaChart` with static OHLCV |
| Chat interface | Message list + input box, static messages |

#### Why static data first?
Separates UI concerns from data concerns. You can iterate on the design without needing a running backend.

---

### Phase 6 — Connect Frontend to Backend

#### Goal
Replace all static data with live data from the FastAPI backend. Wire up the streaming chat.

#### Changes per component

| Component | Change |
|---|---|
| Dashboard metrics | `fetch("/api/market/overview")` on page load |
| Chart | `fetch("/api/market/history/{symbol}")` with symbol selector |
| Chat | `EventSource` or `fetch` with `ReadableStream` to `/api/chat` |

#### Streaming chat pattern (SSE in React)
```ts
const res = await fetch("/api/chat", { method: "POST", body: JSON.stringify({ message }) })
const reader = res.body.getReader()
// read chunks and append to message state as they arrive
```

---

### Phase 7 — Polish & Features

#### Goal
Production-readiness and quality-of-life improvements.

#### Feature list

| Feature | Details |
|---|---|
| Loading skeletons | Pulse animations while data fetches |
| Error boundaries | Graceful fallback UI on API failures |
| Symbol search | Autocomplete input using `search_ticker` MCP tool |
| Watchlist | Save a list of symbols to localStorage, quick-switch on dashboard |
| Chat context | Pass conversation history to Claude so it remembers prior questions |
| FRED integration | Add Federal Reserve economic data (interest rates, CPI, etc.) as additional MCP tools |

---

## Notes

- Start with `yfinance` (no API key needed). Add FRED (St. Louis Federal Reserve) in a later phase.
- Get Anthropic API key at https://console.anthropic.com → API Keys
