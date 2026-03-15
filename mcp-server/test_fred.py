"""
Quick test script for the FRED tools.
Run with: uv run python test_fred.py
"""
import json
from main import (
    get_economic_overview,
    get_economic_series,
    search_fred,
    get_fred_categories,
    get_fred_series_info,
)

SEP = "-" * 60

def show(title: str, result):
    print(f"\n{SEP}\n{title}\n{SEP}")
    print(json.dumps(result, indent=2))


# 1. Snapshot of the 4 key indicators
show("get_economic_overview()", get_economic_overview())

# 2. Historical data for Fed Funds Rate (last 2 years, first 3 records shown)
series = get_economic_series("FEDFUNDS", "2y")
show("get_economic_series('FEDFUNDS', '2y')  [first 3 records]", series[:3])

# 3. Keyword search
show("search_fred('housing starts', limit=3)", search_fred("housing starts", limit=3))

# 4. Top-level FRED categories
show("get_fred_categories(parent_id=0)", get_fred_categories(parent_id=0))

# 5. Metadata for CPI series
show("get_fred_series_info('CPIAUCSL')", get_fred_series_info("CPIAUCSL"))
