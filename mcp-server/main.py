import os
import json
from datetime import datetime, timedelta

import requests
import yfinance as yf
from fredapi import Fred
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

load_dotenv()
_fred     = Fred(api_key=os.environ["FRED_API_KEY"])
_fred_key = os.environ["FRED_API_KEY"]
_fred_url = "https://api.stlouisfed.org/fred"

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


# ---------------------------------------------------------------------------
# Tool 5: get_economic_overview
# ---------------------------------------------------------------------------
# Four key US macro indicators, hardcoded for the dashboard snapshot.
#
# FRED series IDs used:
#   FEDFUNDS  – Federal Funds Effective Rate (monthly average, %)
#   CPIAUCSL  – Consumer Price Index; units='pc1' converts to YoY % change
#   UNRATE    – Unemployment Rate (%)
#   DGS10     – 10-Year Treasury Constant Maturity Rate (daily, %)
#
# .dropna() removes any trailing NaN rows that FRED sometimes returns
# before the latest observation is published.
# ---------------------------------------------------------------------------

@mcp.tool()
def get_economic_overview() -> dict:
    """
    Get the latest values for four key US macroeconomic indicators:
    Federal Funds Rate, CPI (year-over-year %), Unemployment Rate,
    and 10-Year Treasury Yield.

    Returns the most recent value and observation date for each.
    """
    series = {
        "fed_funds_rate": ("FEDFUNDS", "Federal Funds Rate",     "%",  {}),
        "cpi_yoy":        ("CPIAUCSL", "CPI (YoY)",              "%",  {"units": "pc1"}),
        "unemployment":   ("UNRATE",   "Unemployment Rate",      "%",  {}),
        "treasury_10y":   ("DGS10",    "10-Year Treasury Yield", "%",  {}),
    }

    result = {}
    for key, (series_id, label, unit, kwargs) in series.items():
        try:
            data = _fred.get_series(series_id, **kwargs).dropna()
            result[key] = {
                "series_id": series_id,
                "label":     label,
                "value":     round(float(data.iloc[-1]), 2),
                "unit":      unit,
                "date":      data.index[-1].strftime("%Y-%m-%d"),
            }
        except Exception as e:
            result[key] = {"error": str(e), "series_id": series_id}

    return result


# ---------------------------------------------------------------------------
# Tool 6: get_economic_series
# ---------------------------------------------------------------------------
# Generic historical data fetcher for any FRED series.
# Used by the Economics page chart and by Claude when asked about trends.
#
# period_days maps friendly period strings to a lookback window.
# "max" omits observation_start so FRED returns the full history.
# ---------------------------------------------------------------------------

@mcp.tool()
def get_economic_series(series_id: str, period: str = "5y") -> list[dict]:
    """
    Get historical data for any FRED series.

    series_id: any valid FRED series ID (e.g. FEDFUNDS, UNRATE, DGS10, CPIAUCSL)
    period:    how far back to fetch — 1y, 2y, 5y, 10y, or max

    Returns a list of { date, value } dicts sorted oldest to newest.
    """
    period_days = {"1y": 365, "2y": 730, "5y": 1825, "10y": 3650}
    try:
        kwargs = {}
        if series_id == "CPIAUCSL":
            kwargs["units"] = "pc1"
        if period in period_days:
            start = datetime.today() - timedelta(days=period_days[period])
            kwargs["observation_start"] = start.strftime("%Y-%m-%d")
        data = _fred.get_series(series_id, **kwargs).dropna()
        return [
            {"date": d.strftime("%Y-%m-%d"), "value": round(float(v), 4)}
            for d, v in data.items()
        ]
    except Exception as e:
        return [{"error": str(e)}]


# ---------------------------------------------------------------------------
# Tool 7: search_fred
# ---------------------------------------------------------------------------
# Hits FRED's full-text search endpoint. Returns series metadata so the
# caller (Claude or a future UI) can decide which series_id to fetch next.
#
# fred.search() returns a pandas DataFrame where each row is a series.
# Columns include: id, title, units, frequency, observation_start/end, etc.
# ---------------------------------------------------------------------------

@mcp.tool()
def search_fred(query: str, limit: int = 10) -> list[dict]:
    """
    Search all FRED series by keyword.

    Returns up to `limit` results with series ID, title, units, and frequency.
    Use the returned series_id with get_economic_series() to fetch data.

    Example: search_fred("housing starts")
    """
    try:
        df = _fred.search(query, limit=limit)
        results = []
        for series_id, row in df.iterrows():
            results.append({
                "series_id": series_id,
                "title":     row.get("title", "N/A"),
                "units":     row.get("units", "N/A"),
                "frequency": row.get("frequency", "N/A"),
                "seasonal_adjustment": row.get("seasonal_adjustment", "N/A"),
            })
        return results
    except Exception as e:
        return [{"error": str(e)}]


# ---------------------------------------------------------------------------
# Tool 8: get_fred_categories
# ---------------------------------------------------------------------------
# FRED organises series into a tree of categories.
# Root (id=0) has top-level children like "Money, Banking, & Finance",
# "National Accounts", "Population, Employment, & Labor Markets", etc.
# Pass a child id to drill down into subcategories.
#
# fred.get_category_children() returns a list of dicts:
#   { id, name, parent_id }
# ---------------------------------------------------------------------------

@mcp.tool()
def get_fred_categories(parent_id: int = 0) -> list[dict]:
    """
    Browse the FRED category hierarchy.

    parent_id=0 returns the top-level categories.
    Pass a category id to see its subcategories.

    Use the returned id values to drill deeper, then use search_fred()
    or get_fred_series_info() to find specific series.
    """
    # fredapi doesn't expose category browsing, so we call the REST API directly.
    # GET /fred/category/children?category_id=0 → top-level categories
    try:
        r = requests.get(
            f"{_fred_url}/category/children",
            params={"category_id": parent_id, "api_key": _fred_key, "file_type": "json"},
            timeout=10,
        )
        r.raise_for_status()
        return r.json().get("categories", [])
    except Exception as e:
        return [{"error": str(e)}]


# ---------------------------------------------------------------------------
# Tool 9: get_category_series
# ---------------------------------------------------------------------------
# FRED categories are either:
#   parent  → has subcategories, no direct series  (e.g. "Prices", id=32455)
#   leaf    → has series directly                  (e.g. "Consumer Price Indexes", id=9)
#
# We detect this by calling /category/children first:
#   - non-empty → parent: return subcategories so the caller can drill deeper
#   - empty     → leaf:   return the series inside it
#
# This means the caller never has to guess — the response always tells them
# what type the category is and what to do next.
# ---------------------------------------------------------------------------

@mcp.tool()
def get_category_series(category_id: int, limit: int = 20) -> dict:
    """
    Get the series inside a FRED category.

    If the category is a parent (has subcategories), returns those subcategories
    so you can drill deeper. If it's a leaf, returns the series directly.

    The response always includes an `is_leaf` boolean so you know which case
    you're in:
      is_leaf=False → use the returned subcategories to go deeper
      is_leaf=True  → use the returned series with get_economic_series()

    Example: get_category_series(32455)  → parent, returns subcategories
             get_category_series(9)      → leaf, returns CPI series list
    """
    try:
        # Step 1: check for subcategories
        r = requests.get(
            f"{_fred_url}/category/children",
            params={"category_id": category_id, "api_key": _fred_key, "file_type": "json"},
            timeout=10,
        )
        r.raise_for_status()
        children = r.json().get("categories", [])

        if children:
            # Parent category — return subcategories, not series
            return {
                "is_leaf": False,
                "message": "This is a parent category. Drill into a subcategory to find series.",
                "subcategories": children,
                "series": [],
            }

        # Step 2: leaf category — fetch its series
        r2 = requests.get(
            f"{_fred_url}/category/series",
            params={"category_id": category_id, "api_key": _fred_key,
                    "file_type": "json", "limit": limit},
            timeout=10,
        )
        r2.raise_for_status()
        raw = r2.json().get("seriess", [])
        series = [
            {
                "series_id": s["id"],
                "title":     s.get("title", "N/A"),
                "units":     s.get("units", "N/A"),
                "frequency": s.get("frequency", "N/A"),
            }
            for s in raw
        ]
        return {
            "is_leaf": True,
            "message": f"Leaf category with {len(series)} series (up to {limit} shown).",
            "subcategories": [],
            "series": series,
        }

    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Tool 10: get_fred_series_info
# ---------------------------------------------------------------------------
# Returns metadata for a single series — useful before plotting so you
# know the units (e.g. "Percent", "Thousands of Units") and frequency
# (Monthly, Weekly, Daily) to label the chart correctly.
# ---------------------------------------------------------------------------

@mcp.tool()
def get_fred_series_info(series_id: str) -> dict:
    """
    Get metadata for a specific FRED series: title, units, frequency,
    observation range, and seasonal adjustment status.

    Useful before fetching data to understand what you're looking at.

    Example: get_fred_series_info("CPIAUCSL")
    """
    try:
        info = _fred.get_series_info(series_id)
        return {
            "series_id":           series_id,
            "title":               info.get("title", "N/A"),
            "units":               info.get("units", "N/A"),
            "frequency":           info.get("frequency", "N/A"),
            "seasonal_adjustment": info.get("seasonal_adjustment", "N/A"),
            "observation_start":   str(info.get("observation_start", "")),
            "observation_end":     str(info.get("observation_end", "")),
            "notes":               str(info.get("notes", ""))[:300],
        }
    except Exception as e:
        return {"error": str(e), "series_id": series_id}


if __name__ == "__main__":
    mcp.run()
