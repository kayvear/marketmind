"use client";

/**
 * Dashboard page — /dashboard
 *
 * Phase 6A: live data from FastAPI backend.
 *
 * Data flow:
 *   GET /api/market/overview        → three MarketCard components
 *   GET /api/market/history/{sym}   → PriceChart (area chart)
 *
 * UX:
 *   - Skeleton placeholders while fetching
 *   - Inline error banner if the backend is unreachable
 *   - Symbol input lets the user switch the chart to any ticker
 */

import { useEffect, useState, useCallback } from "react";
import MarketCard from "@/components/MarketCard";
import PriceChart from "@/components/PriceChart";

const API_BASE = "http://localhost:8000";

// ─── Period options ───────────────────────────────────────────────────────────

const PERIODS = [
  { label: "1W", value: "5d"  },
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y"  },
] as const;

type PeriodValue = typeof PERIODS[number]["value"];

// ─── Types ──────────────────────────────────────────────────────────────────

interface IndexData {
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

interface PricePoint {
  date: string;
  close: number;
}

// ─── Skeleton components ─────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div
      className="rounded-xl p-4 border animate-pulse"
      style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <div className="h-3 w-20 rounded mb-3" style={{ backgroundColor: "var(--bg-active)" }} />
      <div className="h-6 w-28 rounded mb-2" style={{ backgroundColor: "var(--bg-active)" }} />
      <div className="h-3 w-16 rounded" style={{ backgroundColor: "var(--bg-hover)" }} />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div
      className="rounded-xl border p-5 animate-pulse"
      style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <div className="h-4 w-32 rounded mb-4" style={{ backgroundColor: "var(--bg-active)" }} />
      <div className="h-56 rounded" style={{ backgroundColor: "var(--bg-hover)" }} />
    </div>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm border mb-6"
      style={{
        backgroundColor: "rgba(220, 38, 38, 0.08)",
        borderColor: "var(--red)",
        color: "var(--red)",
      }}
    >
      ⚠ {message}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [overview, setOverview] = useState<IndexData[] | null>(null);
  const [chartData, setChartData] = useState<PricePoint[] | null>(null);
  const [symbol, setSymbol] = useState("AAPL");
  const [inputSymbol, setInputSymbol] = useState("AAPL");
  const [period, setPeriod] = useState<PeriodValue>("1mo");
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);

  // Fetch market overview on mount
  useEffect(() => {
    setOverviewLoading(true);
    setOverviewError(null);
    fetch(`${API_BASE}/api/market/overview`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then((raw: Record<string, { symbol: string; price: number; change: number; change_percent: number }>) => {
        // Backend returns { "S&P 500": { symbol, price, change, change_percent }, ... }
        // Transform to the array format MarketCard expects
        const normalized: IndexData[] = Object.entries(raw).map(([name, v]) => ({
          name,
          symbol: v.symbol,
          price: v.price,
          change: v.change,
          changePercent: v.change_percent,
        }));
        setOverview(normalized);
        setOverviewLoading(false);
      })
      .catch((err) => {
        setOverviewError(`Could not load market overview — ${err.message}. Is the backend running on port 8000?`);
        setOverviewLoading(false);
      });
  }, []);

  // Fetch price history whenever symbol or period changes
  const fetchHistory = useCallback((sym: string, per: PeriodValue) => {
    setChartLoading(true);
    setChartError(null);
    fetch(`${API_BASE}/api/market/history/${encodeURIComponent(sym)}?period=${per}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then((data: { date: string; close: number }[]) => {
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error(`No price data found for "${sym}"`);
        }
        // Backend returns ISO dates like "2026-02-09".
        // For 1Y, include the year ("Feb 9 '25"); otherwise just "Feb 9".
        const showYear = per === "1y";
        const formatted = data.map((d) => {
          const [year, month, day] = d.date.split("-").map(Number);
          const dt = new Date(year, month - 1, day);
          const label = showYear
            ? dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
            : dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return { date: label, close: d.close };
        });
        setChartData(formatted);
        setChartLoading(false);
      })
      .catch((err) => {
        setChartError(err.message);
        setChartLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchHistory(symbol, period);
  }, [symbol, period, fetchHistory]);

  // Handle symbol form submit
  function handleSymbolSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputSymbol.trim().toUpperCase();
    if (!trimmed) return;
    if (trimmed === symbol) {
      // Same ticker — force a refresh anyway
      fetchHistory(trimmed, period);
    } else {
      setSymbol(trimmed);
      setInputSymbol(trimmed);
    }
  }

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Editorial header */}
      <header style={{ marginBottom: 32 }}>
        <div style={{
          fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500,
          textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg2)",
        }}>
          {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </div>
        <h1 style={{
          fontFamily: "var(--serif-display)", fontSize: 44, fontWeight: 400,
          lineHeight: 1.1, letterSpacing: "-0.015em",
          color: "var(--fg1)", margin: "6px 0",
        }}>
          Market overview
        </h1>
        <p style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--fg2)", margin: 0 }}>
          US equity indices · Live
        </p>
      </header>

      {/* Overview error */}
      {overviewError && <ErrorBanner message={overviewError} />}

      {/* Market index cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {overviewLoading
          ? [1, 2, 3].map((n) => <CardSkeleton key={n} />)
          : overview?.map((idx) => <MarketCard key={idx.symbol} {...idx} />)}
      </div>

      {/* Symbol selector + period pills */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        {/* Left: ticker input */}
        <form onSubmit={handleSymbolSubmit} className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Symbol
          </label>
          <input
            type="text"
            value={inputSymbol}
            onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
            placeholder="e.g. MSFT"
            className="rounded-lg px-3 py-1.5 text-sm border outline-none w-28"
            style={{
              backgroundColor: "var(--bg-input)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--blue)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: "var(--blue)" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Load
          </button>
        </form>

        {/* Right: period pills */}
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => {
            const isActive = period === p.value;
            return (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? "var(--bg-active)" : "transparent",
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  border: `1px solid ${isActive ? "var(--border)" : "transparent"}`,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-hover)";
                    (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                  }
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart error */}
      {chartError && <ErrorBanner message={chartError} />}

      {/* Price chart */}
      {chartLoading ? (
        <ChartSkeleton />
      ) : (
        chartData && (
          <div data-accent="blue">
            <PriceChart data={chartData} symbol={symbol} />
          </div>
        )
      )}

      {/* Attribution */}
      <p style={{
        marginTop: 24, fontFamily: "var(--sans)", fontSize: 11,
        color: "var(--fg3)", textAlign: "right",
      }}>
        Market data via <a href="https://github.com/ranaroussi/yfinance" target="_blank" rel="noopener noreferrer"
          style={{ color: "inherit", textDecoration: "underline", textDecorationColor: "var(--border)" }}>
          yFinance
        </a> · Yahoo Finance
      </p>
    </div>
  );
}
