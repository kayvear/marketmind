# MarketMind

An AI-powered finance and economics dashboard. Ask questions about markets and economic data in natural language — Claude looks up live data, reasons about it, and streams an answer back.

## What it does

- **Markets** — live S&P 500, NASDAQ, and Dow Jones index cards with an interactive OHLCV price chart (1W / 1M / 3M / 6M / 1Y)
- **Economics** — key US macro indicators from the Federal Reserve (FRED): Fed Funds Rate, CPI, Unemployment, 10-Year Treasury Yield
- **AI Chat** — streaming conversation powered by Claude. Remembers the full session history. Configurable verbosity, model, and theme from the settings panel.

## Architecture

```
Browser (Next.js)
  └── TopNav (Overview / Markets / Economics) + ChatPanel
        │
        │ HTTP / SSE
        ▼
FastAPI Backend (Python)
  ├── GET  /api/market/overview
  ├── GET  /api/market/history/{symbol}
  ├── GET  /api/economics/overview
  ├── GET  /api/economics/history/{series_id}
  ├── GET  /api/economics/search
  ├── GET  /api/economics/categories
  ├── GET  /api/economics/categories/{id}/series
  └── POST /api/chat  (SSE stream + meta event)
        │
        │ Anthropic SDK + MCP stdio
        ▼
Claude (claude-opus-4-6 / sonnet / haiku)
        │
        │ MCP protocol
        ▼
MCP Server (Python / FastMCP)
  ├── get_stock_quote          yfinance
  ├── get_historical_prices    yfinance
  ├── get_market_overview      yfinance
  ├── search_ticker            yfinance
  ├── get_economic_overview    FRED API
  ├── get_economic_series      FRED API
  ├── search_fred              FRED API
  ├── get_fred_categories      FRED API
  ├── get_category_series      FRED API
  └── get_fred_series_info     FRED API
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, next-themes |
| Charts | Recharts |
| Backend | Python, FastAPI, uvicorn |
| AI | Anthropic SDK (`claude-opus-4-6` default) |
| MCP Server | Python `mcp` package, FastMCP |
| Market data | `yfinance` (free, no key needed) |
| Economic data | FRED API via `fredapi` + direct REST |
| Package manager (Python) | `uv` |
| Package manager (Node) | `npm` |

## Prerequisites

- Node.js 22+
- Python 3.11+
- `uv` — install with `curl -LsSf https://astral.sh/uv/install.sh | sh`
- API keys (see below)

## Setup

### 1. Clone and enter the repo

```bash
git clone <your-repo-url>
cd marketmind
```

### 2. Backend — set your API key

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and add your Anthropic API key
# ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at [console.anthropic.com](https://console.anthropic.com) → API Keys.

### 3. MCP server — set your FRED API key

```bash
cp mcp-server/.env.example mcp-server/.env
# Edit mcp-server/.env and add your FRED API key
# FRED_API_KEY=...
```

Get a free key at [fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html).

### 4. Install dependencies

```bash
# Backend
cd backend && uv sync && cd ..

# MCP server
cd mcp-server && uv sync && cd ..

# Frontend
cd frontend && npm install && cd ..
```

## Running locally

Open three terminals:

```bash
# Terminal 1 — Backend (port 8000)
cd backend
uv run uvicorn main:app --reload --port 8000

# Terminal 2 — MCP server
cd mcp-server
uv run python main.py

# Terminal 3 — Frontend (port 3000)
cd frontend
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Testing the MCP tools

The MCP Inspector lets you call tools interactively without the frontend:

```bash
cd mcp-server
uv run mcp dev main.py
```

Or run the included test script:

```bash
cd mcp-server
uv run python test_fred.py
```

## Project structure

```
marketmind/
├── README.md
├── plan.md                  ← full phase-by-phase build plan
├── progress.md              ← detailed session log
├── backend/
│   ├── main.py              ← FastAPI app — 6 endpoints + Claude SSE agent
│   ├── agent.py             ← standalone CLI agent (dev/testing)
│   └── pyproject.toml
├── frontend/
│   ├── app/
│   │   ├── layout.tsx       ← TopNav + ChatPanel shell
│   │   ├── page.tsx         ← root redirect → /markets
│   │   ├── markets/         ← live market cards + OHLCV chart
│   │   └── economics/       ← placeholder (Phase 8D)
│   ├── components/
│   │   ├── TopNav.tsx       ← Overview / Markets / Economics tabs
│   │   ├── ChatPanel.tsx    ← settings gear, model/verbosity/theme
│   │   ├── MarketCard.tsx   ← index snapshot card
│   │   └── PriceChart.tsx   ← Recharts area chart
│   └── package.json
└── mcp-server/
    ├── main.py              ← 10 MCP tools (yfinance + FRED)
    ├── test_fred.py         ← FRED tool smoke tests
    └── pyproject.toml
```

## Roadmap

- [x] MCP server with live market data (yfinance)
- [x] Claude agent wired to MCP tools
- [x] FastAPI backend with streaming SSE chat
- [x] Next.js frontend with charts and dark/light theme
- [x] Chat settings — model, verbosity, theme
- [x] Conversation memory
- [x] FRED economic data tools (MCP layer)
- [x] Backend economics endpoints
- [x] Navigation restructure (Overview / Markets / Economics)
- [x] Economics page (3 indicator cards + dynamic FRED search/browse card + line chart)
- [x] FRED series search and category browse
- [x] Chat tooltip showing model and tools used per response
- [ ] Overview landing page (markets + economy at a glance)
- [ ] Symbol search / watchlist
- [ ] Loading skeletons + error boundaries
