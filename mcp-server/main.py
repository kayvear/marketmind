import yfinance as yf
from mcp.server.fastmcp import FastMCP

# Creates an MCP server — exposes "tools" that Claude can call,
# like functions in a plugin panel.
mcp = FastMCP("MarketMind Finance Tools")


# ---------------------------------------------------------------------------
# Utility tool — sanity check
# ---------------------------------------------------------------------------

@mcp.tool()
def ping() -> str:
    """Test tool to verify the MCP server is running."""
    return "MCP server is alive!"


# ---------------------------------------------------------------------------
# Tool 1: get_stock_quote
# ---------------------------------------------------------------------------
# yf.Ticker(symbol)  → a handle to that stock on Yahoo Finance
# ticker.info        → fires an HTTP request and returns a dict with ~100 fields
#                      (price, volume, market cap, PE ratio, 52-week high, etc.)
# We use .get("key") instead of ["key"] so we get None instead of a crash
# when a field is missing (some tickers are missing certain fields).
# ---------------------------------------------------------------------------

@mcp.tool()
def get_stock_quote(symbol: str) -> dict:
    """
    Get the current quote for a stock ticker symbol.

    Returns the company name, current price, price change, percent change,
    trading volume, and market cap.

    Example: get_stock_quote("AAPL")
    """
    try:
        ticker = yf.Ticker(symbol.upper())
        info = ticker.info

        return {
            "symbol": symbol.upper(),
            "name": info.get("shortName", "N/A"),
            # currentPrice is the regular market price during trading hours.
            # regularMarketPrice is a fallback used by some ticker types (e.g. ETFs).
            "price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "change": round(info.get("regularMarketChange", 0), 4),
            "change_percent": round(info.get("regularMarketChangePercent", 0), 4),
            "volume": info.get("volume"),
            "market_cap": info.get("marketCap"),
            "currency": info.get("currency", "USD"),
        }
    except Exception as e:
        return {"error": str(e), "symbol": symbol.upper()}


# ---------------------------------------------------------------------------
# Tool 2: get_historical_prices
# ---------------------------------------------------------------------------
# ticker.history(period=...)  → returns a pandas DataFrame.
# A DataFrame is like a spreadsheet in memory: rows are dates, columns are
# Open/High/Low/Close/Volume.
# We convert it to a list of dicts so it's easy to JSON-serialize and
# send back over MCP (and later, render as a chart in the frontend).
#
# Valid period values: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
# ---------------------------------------------------------------------------

@mcp.tool()
def get_historical_prices(symbol: str, period: str = "1mo") -> list[dict]:
    """
    Get historical OHLCV (Open, High, Low, Close, Volume) prices for a ticker.

    period options: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max

    Example: get_historical_prices("AAPL", "3mo")
    """
    try:
        ticker = yf.Ticker(symbol.upper())
        hist = ticker.history(period=period)

        if hist.empty:
            return []

        records = []
        for date, row in hist.iterrows():
            records.append({
                # strftime formats the pandas Timestamp into a plain "YYYY-MM-DD" string
                "date": date.strftime("%Y-%m-%d"),
                "open":  round(float(row["Open"]),  2),
                "high":  round(float(row["High"]),  2),
                "low":   round(float(row["Low"]),   2),
                "close": round(float(row["Close"]), 2),
                # Volume is an integer — cast it explicitly to avoid numpy int issues
                "volume": int(row["Volume"]),
            })
        return records
    except Exception as e:
        return [{"error": str(e)}]


# ---------------------------------------------------------------------------
# Tool 3: get_market_overview
# ---------------------------------------------------------------------------
# The three major US indices and their Yahoo Finance symbols:
#   ^GSPC  = S&P 500   (500 large US companies, the most-watched benchmark)
#   ^IXIC  = NASDAQ    (tech-heavy index)
#   ^DJI   = Dow Jones (30 "blue chip" companies)
#
# Note: indices use regularMarketPrice (not currentPrice) because they're
# not directly tradeable securities — they don't have a "current price"
# field in Yahoo Finance's API the same way stocks do.
# ---------------------------------------------------------------------------

@mcp.tool()
def get_market_overview() -> dict:
    """
    Get a real-time snapshot of the three major US market indices:
    S&P 500, NASDAQ Composite, and Dow Jones Industrial Average.

    Returns price, change, and percent change for each index.
    """
    indices = {
        "S&P 500":   "^GSPC",
        "NASDAQ":    "^IXIC",
        "Dow Jones": "^DJI",
    }

    result = {}
    for name, symbol in indices.items():
        try:
            info = yf.Ticker(symbol).info
            result[name] = {
                "symbol": symbol,
                "price":          info.get("regularMarketPrice"),
                "change":         round(info.get("regularMarketChange", 0), 2),
                "change_percent": round(info.get("regularMarketChangePercent", 0), 4),
            }
        except Exception as e:
            result[name] = {"error": str(e)}

    return result


# ---------------------------------------------------------------------------
# Tool 4: search_ticker
# ---------------------------------------------------------------------------
# yf.Search(query) hits Yahoo Finance's search endpoint and returns a list
# of matching securities. Each result ("quote") is a dict with fields like:
#   symbol    → the ticker (e.g. "AAPL")
#   shortname → company name (e.g. "Apple Inc.")
#   quoteType → type of security: EQUITY (stock), ETF, INDEX, MUTUALFUND, etc.
#   exchange  → where it trades (e.g. "NMS" = NASDAQ Market System)
# ---------------------------------------------------------------------------

@mcp.tool()
def search_ticker(query: str) -> list[dict]:
    """
    Search for ticker symbols by company name or keyword.

    Returns up to 5 matching results with symbol, name, type, and exchange.

    Example: search_ticker("tesla")
    """
    try:
        search = yf.Search(query, max_results=5)
        results = []
        for quote in search.quotes:
            results.append({
                "symbol":   quote.get("symbol"),
                "name":     quote.get("shortname") or quote.get("longname", "N/A"),
                "type":     quote.get("quoteType"),
                "exchange": quote.get("exchange"),
            })
        return results
    except Exception as e:
        return [{"error": str(e)}]


if __name__ == "__main__":
    mcp.run()
