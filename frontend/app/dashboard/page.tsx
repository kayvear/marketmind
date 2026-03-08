/**
 * Dashboard page — /dashboard
 *
 * Shows three market index cards + a price history chart.
 * All data is static/hardcoded this phase — Phase 6 replaces it with
 * live calls to the FastAPI backend.
 *
 * Server Component: no client state or browser APIs needed here.
 * The child components (MarketCard, PriceChart) handle their own needs.
 */

import MarketCard from "@/components/MarketCard";
import PriceChart from "@/components/PriceChart";

// ---------------------------------------------------------------------------
// Static market index data
// Mixed positive/negative so we can see both green and red in the UI.
// ---------------------------------------------------------------------------
const MARKET_INDICES = [
  { name: "S&P 500",   symbol: "^GSPC", price: 5789.15,  change: 28.47,   changePercent: 0.49  },
  { name: "NASDAQ",    symbol: "^IXIC", price: 18342.67, change: 156.23,  changePercent: 0.86  },
  { name: "Dow Jones", symbol: "^DJI",  price: 42156.34, change: -89.12,  changePercent: -0.21 },
];

// ---------------------------------------------------------------------------
// Static AAPL price history — 22 trading days (roughly 1 month)
// Prices loosely based on a realistic range to make the chart look natural.
// ---------------------------------------------------------------------------
const CHART_DATA = [
  { date: "Feb 3",  close: 227.53 },
  { date: "Feb 4",  close: 232.87 },
  { date: "Feb 5",  close: 229.14 },
  { date: "Feb 6",  close: 231.60 },
  { date: "Feb 7",  close: 235.00 },
  { date: "Feb 10", close: 233.42 },
  { date: "Feb 11", close: 228.76 },
  { date: "Feb 12", close: 226.50 },
  { date: "Feb 13", close: 230.21 },
  { date: "Feb 14", close: 236.87 },
  { date: "Feb 18", close: 239.55 },
  { date: "Feb 19", close: 244.60 },
  { date: "Feb 20", close: 241.83 },
  { date: "Feb 21", close: 238.10 },
  { date: "Feb 24", close: 242.30 },
  { date: "Feb 25", close: 247.96 },
  { date: "Feb 26", close: 244.01 },
  { date: "Feb 27", close: 239.75 },
  { date: "Feb 28", close: 236.30 },
  { date: "Mar 3",  close: 241.50 },
  { date: "Mar 4",  close: 244.72 },
  { date: "Mar 5",  close: 247.18 },
];

export default function DashboardPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Market Overview
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          US equity indices · Today
        </p>
      </div>

      {/* Market index cards — 3-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {MARKET_INDICES.map((idx) => (
          <MarketCard key={idx.symbol} {...idx} />
        ))}
      </div>

      {/* Price chart */}
      <PriceChart data={CHART_DATA} symbol="AAPL" />
    </div>
  );
}
