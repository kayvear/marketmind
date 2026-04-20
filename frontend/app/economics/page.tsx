"use client";

/**
 * Economics page — /economics
 *
 * Phase 8D: live FRED data from FastAPI backend.
 *
 * Layout:
 *   Row 1 — 3 hardcoded indicator cards (Fed Funds, CPI, 10Y Yield)
 *            + 1 dynamic FRED search/browse card
 *   Row 2 — period pills + line chart for the active series
 *
 * Clicking any card sets it as the active series for the chart.
 * The 4th card lets the user search FRED by keyword or browse categories.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE = "http://localhost:8000";

// ─── Period options ───────────────────────────────────────────────────────────

const PERIODS = [
  { label: "1Y",  value: "1y"  },
  { label: "2Y",  value: "2y"  },
  { label: "5Y",  value: "5y"  },
  { label: "10Y", value: "10y" },
  { label: "20Y", value: "20y" },
] as const;

type PeriodValue = typeof PERIODS[number]["value"];

// ─── Hardcoded series (3 cards) ───────────────────────────────────────────────

const HARDCODED = [
  { series_id: "FEDFUNDS", label: "Federal Funds Rate",    units: "%" },
  { series_id: "CPIAUCSL", label: "CPI (YoY)",             units: "%" },
  { series_id: "DGS10",    label: "10-Year Treasury Yield", units: "%" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Indicator {
  series_id: string;
  label: string;
  value: number;
  unit: string;
  date: string;
}

interface OverviewData {
  fed_funds_rate: Indicator;
  cpi_yoy: Indicator;
  treasury_10y: Indicator;
}

interface DataPoint {
  date: string;
  value: number;
}

interface FREDSeries {
  series_id: string;
  title: string;
  units: string;
  frequency: string;
}

interface FREDCategory {
  id: number;
  name: string;
}

interface CategoryResponse {
  is_leaf: boolean;
  subcategories: FREDCategory[];
  series: FREDSeries[];
}

interface BrowseEntry {
  id: number | null;
  name: string;
}

// ─── Skeleton components ──────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div
      className="rounded-xl p-4 border animate-pulse"
      style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <div className="h-3 w-24 rounded mb-3" style={{ backgroundColor: "var(--bg-active)" }} />
      <div className="h-7 w-20 rounded mb-2" style={{ backgroundColor: "var(--bg-active)" }} />
      <div className="h-3 w-28 rounded"       style={{ backgroundColor: "var(--bg-hover)"   }} />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div
      className="rounded-xl border p-5 animate-pulse"
      style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <div className="h-4 w-36 rounded mb-4" style={{ backgroundColor: "var(--bg-active)" }} />
      <div className="h-56 rounded"           style={{ backgroundColor: "var(--bg-hover)"   }} />
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

// ─── Hardcoded indicator card ─────────────────────────────────────────────────

function IndicatorCard({
  indicator,
  isActive,
  onClick,
}: {
  indicator: Indicator;
  isActive: boolean;
  onClick: () => void;
}) {
  const dateLabel = new Date(indicator.date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <button
      onClick={onClick}
      className="rounded-xl p-5 border flex flex-col gap-2 text-left w-full transition-colors"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: isActive ? "var(--blue)" : "var(--border)",
        outline: "none",
        cursor: "pointer",
      }}
    >
      <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
        {indicator.label}
      </span>
      <span className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
        {indicator.value.toFixed(2)}{indicator.unit}
      </span>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        as of {dateLabel}
      </span>
    </button>
  );
}

// ─── Dynamic 4th card: Search + Browse ───────────────────────────────────────

function FREDSearchCard({
  selected,
  isActive,
  latest,
  onSelect,
  onClear,
  onClick,
}: {
  selected: FREDSeries | null;
  isActive: boolean;
  latest: DataPoint | null;
  onSelect: (s: FREDSeries) => void;
  onClear: () => void;
  onClick: () => void;
}) {
  const [tab, setTab] = useState<"search" | "browse">("search");

  // Search state
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FREDSeries[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Browse state
  const [browseStack, setBrowseStack] = useState<BrowseEntry[]>([
    { id: null, name: "All Categories" },
  ]);
  const [browseIsLeaf, setBrowseIsLeaf] = useState(false);
  const [browseCategories, setBrowseCategories] = useState<FREDCategory[]>([]);
  const [browseSeries, setBrowseSeries] = useState<FREDSeries[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const browseInitialized = useRef(false);

  // Fetch a browse level — stable reference, only uses setters
  const fetchBrowseLevel = useCallback(async (entry: BrowseEntry) => {
    setBrowseLoading(true);
    try {
      if (entry.id === null) {
        const r = await fetch(`${API_BASE}/api/economics/categories?parent_id=0`);
        const data: FREDCategory[] = await r.json();
        setBrowseCategories(Array.isArray(data) ? data : []);
        setBrowseSeries([]);
        setBrowseIsLeaf(false);
      } else {
        const r = await fetch(`${API_BASE}/api/economics/categories/${entry.id}/series`);
        const data: CategoryResponse = await r.json();
        setBrowseIsLeaf(data.is_leaf ?? false);
        setBrowseCategories(data.subcategories ?? []);
        setBrowseSeries(data.series ?? []);
      }
    } catch {
      // leave existing state on error
    }
    setBrowseLoading(false);
  }, []);

  // Initialize browse when tab first opened
  useEffect(() => {
    if (tab === "browse" && !browseInitialized.current) {
      browseInitialized.current = true;
      fetchBrowseLevel({ id: null, name: "All Categories" });
    }
  }, [tab, fetchBrowseLevel]);

  // Debounced search — fires 300 ms after the user stops typing
  useEffect(() => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      setSearchLoading(true);
      fetch(`${API_BASE}/api/economics/search?q=${encodeURIComponent(query)}&limit=8`)
        .then((r) => r.json())
        .then((data) => {
          setSearchResults(Array.isArray(data) ? data : []);
          setShowDropdown(true);
          setSearchLoading(false);
        })
        .catch(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function handleCategoryClick(cat: FREDCategory) {
    const entry: BrowseEntry = { id: cat.id, name: cat.name };
    setBrowseStack((prev) => [...prev, entry]);
    fetchBrowseLevel(entry);
  }

  function handleBreadcrumbClick(index: number) {
    const newStack = browseStack.slice(0, index + 1);
    setBrowseStack(newStack);
    fetchBrowseLevel(newStack[newStack.length - 1]);
  }

  // ── Selected state ────────────────────────────────────────────────────────

  if (selected) {
    const isPercentage = selected.units === "%" || selected.units.toLowerCase().includes("percent");
    return (
      <button
        onClick={onClick}
        className="rounded-xl p-5 border flex flex-col gap-3 text-left w-full transition-colors"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: isActive ? "var(--blue)" : "var(--border)",
          outline: "none",
          cursor: "pointer",
        }}
      >
        {/* Label row + clear button */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-snug" style={{ color: "var(--text-secondary)" }}>
            {selected.title}
          </span>
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="text-xs shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
            style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-hover)" }}
          >
            ✕
          </span>
        </div>

        {/* Value — shown once chart data has loaded */}
        {latest ? (
          <>
            <span className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {isPercentage
                ? `${latest.value.toFixed(2)}%`
                : latest.value.toLocaleString()}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              as of {latest.date}
            </span>
          </>
        ) : (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {selected.units} · {selected.frequency}
          </span>
        )}
      </button>
    );
  }

  // ── Search / browse state ─────────────────────────────────────────────────

  const tabStyle = (active: boolean) => ({
    fontSize: "0.75rem",
    fontWeight: 500,
    padding: "2px 10px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    backgroundColor: active ? "var(--bg-active)" : "transparent",
    color: active ? "var(--text-primary)" : "var(--text-muted)",
  } as React.CSSProperties);

  return (
    <div
      className="rounded-xl p-4 border flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      {/* Tab bar */}
      <div className="flex gap-1 mb-3">
        <button style={tabStyle(tab === "search")} onClick={() => setTab("search")}>Search</button>
        <button style={tabStyle(tab === "browse")} onClick={() => setTab("browse")}>Browse</button>
      </div>

      {/* ── Search tab ── */}
      {tab === "search" && (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onFocus={() => query.length >= 2 && setShowDropdown(true)}
            placeholder="e.g. housing starts"
            className="w-full rounded-lg px-3 py-1.5 text-sm border outline-none"
            style={{
              backgroundColor: "var(--bg-input)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
          {searchLoading && (
            <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Searching…
            </div>
          )}
          {showDropdown && searchResults.length > 0 && (
            <div
              className="mt-1 rounded-lg border overflow-y-auto"
              style={{
                maxHeight: "180px",
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border)",
              }}
            >
              {searchResults.map((s) => (
                <button
                  key={s.series_id}
                  onMouseDown={() => { onSelect(s); setShowDropdown(false); setQuery(""); }}
                  className="w-full text-left px-3 py-2 border-b last:border-b-0"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {s.title}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {s.series_id} · {s.frequency}
                  </div>
                </button>
              ))}
            </div>
          )}
          {showDropdown && searchResults.length === 0 && !searchLoading && (
            <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              No results found
            </div>
          )}
        </div>
      )}

      {/* ── Browse tab ── */}
      {tab === "browse" && (
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center flex-wrap gap-0.5 mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
            {browseStack.map((entry, i) => (
              <span key={i} className="flex items-center gap-0.5">
                {i > 0 && <span style={{ color: "var(--border)" }}>›</span>}
                <button
                  onClick={() => handleBreadcrumbClick(i)}
                  className="hover:underline"
                  style={{
                    color: i === browseStack.length - 1 ? "var(--text-secondary)" : "var(--text-muted)",
                    fontWeight: i === browseStack.length - 1 ? 500 : 400,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {entry.name}
                </button>
              </span>
            ))}
          </div>

          {/* Items list */}
          {browseLoading ? (
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Loading…</div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: "180px" }}>
              {/* Subcategories */}
              {browseCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat)}
                  className="w-full flex items-center justify-between text-left px-2 py-1.5 rounded text-xs border-b last:border-b-0"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    color: "var(--text-primary)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <span className="truncate">{cat.name}</span>
                  <span style={{ color: "var(--text-muted)" }}>›</span>
                </button>
              ))}
              {/* Series (leaf level) */}
              {browseIsLeaf && browseSeries.map((s) => (
                <button
                  key={s.series_id}
                  onClick={() => onSelect(s)}
                  className="w-full text-left px-2 py-1.5 rounded text-xs border-b last:border-b-0"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.title}</div>
                  <div style={{ color: "var(--text-muted)" }}>{s.series_id} · {s.frequency}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
  isPercentage,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  isPercentage: boolean;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm shadow-lg border"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border)",
        color: "var(--text-primary)",
      }}
    >
      <div style={{ color: "var(--text-secondary)" }}>{label}</div>
      <div className="font-semibold">
        {isPercentage ? `${val.toFixed(2)}%` : val.toLocaleString()}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EconomicsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [chartData, setChartData] = useState<DataPoint[] | null>(null);
  const [activeSeries, setActiveSeries] = useState("FEDFUNDS");
  const [customSeries, setCustomSeries] = useState<FREDSeries | null>(null);
  const [period, setPeriod] = useState<PeriodValue>("5y");
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);

  // Fetch overview on mount
  useEffect(() => {
    setOverviewLoading(true);
    fetch(`${API_BASE}/api/economics/overview`)
      .then((r) => { if (!r.ok) throw new Error(`Server returned ${r.status}`); return r.json(); })
      .then((data: OverviewData) => { setOverview(data); setOverviewLoading(false); })
      .catch((err) => {
        setOverviewError(`Could not load economics overview — ${err.message}. Is the backend running on port 8000?`);
        setOverviewLoading(false);
      });
  }, []);

  // Fetch chart history when series or period changes
  const fetchHistory = useCallback((seriesId: string, per: PeriodValue) => {
    setChartLoading(true);
    setChartError(null);
    fetch(`${API_BASE}/api/economics/history/${encodeURIComponent(seriesId)}?period=${per}`)
      .then((r) => { if (!r.ok) throw new Error(`Server returned ${r.status}`); return r.json(); })
      .then((data: { date: string; value: number }[]) => {
        if (!Array.isArray(data) || data.length === 0)
          throw new Error(`No data found for "${seriesId}"`);
        const formatted = data.map((d) => {
          const [year, month] = d.date.split("-").map(Number);
          const dt = new Date(year, month - 1, 1);
          return {
            date: dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
            value: d.value,
          };
        });
        setChartData(formatted);
        setChartLoading(false);
      })
      .catch((err) => { setChartError(err.message); setChartLoading(false); });
  }, []);

  useEffect(() => {
    fetchHistory(activeSeries, period);
  }, [activeSeries, period, fetchHistory]);

  // ── Derived values ──────────────────────────────────────────────────────────

  const indicators: Indicator[] = overview
    ? [overview.fed_funds_rate, overview.cpi_yoy, overview.treasury_10y]
    : [];

  const customLatest =
    customSeries && activeSeries === customSeries.series_id && chartData && chartData.length > 0
      ? chartData[chartData.length - 1]
      : null;

  const activeHardcoded = HARDCODED.find((s) => s.series_id === activeSeries);
  const activeLabel  = activeHardcoded?.label  ?? customSeries?.title ?? activeSeries;
  const activeUnits  = activeHardcoded?.units  ?? customSeries?.units ?? "";
  const isPercentage = activeUnits === "%" || activeUnits.toLowerCase().includes("percent");

  const yDomain = (() => {
    if (!chartData) return ["auto", "auto"] as const;
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.1 || 0.5;
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10] as const;
  })();

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Editorial header */}
      <header style={{ marginBottom: 32 }}>
        <div style={{
          fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500,
          textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg2)",
        }}>
          Federal Reserve · FRED
        </div>
        <h1 style={{
          fontFamily: "var(--serif-display)", fontSize: 44, fontWeight: 400,
          lineHeight: 1.1, letterSpacing: "-0.015em",
          color: "var(--fg1)", margin: "6px 0",
        }}>
          US economy
        </h1>
        <p style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--fg2)", margin: 0 }}>
          Key macroeconomic indicators
        </p>
      </header>

      {overviewError && <ErrorBanner message={overviewError} />}

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 items-start">
        {overviewLoading
          ? [1, 2, 3, 4].map((n) => <CardSkeleton key={n} />)
          : (
            <>
              {indicators.map((ind) => (
                <IndicatorCard
                  key={ind.series_id}
                  indicator={ind}
                  isActive={activeSeries === ind.series_id}
                  onClick={() => setActiveSeries(ind.series_id)}
                />
              ))}
              <FREDSearchCard
                selected={customSeries}
                isActive={customSeries !== null && activeSeries === customSeries.series_id}
                latest={customLatest}
                onSelect={(s) => { setCustomSeries(s); setActiveSeries(s.series_id); }}
                onClear={() => { setCustomSeries(null); setActiveSeries("FEDFUNDS"); }}
                onClick={() => { if (customSeries) setActiveSeries(customSeries.series_id); }}
              />
            </>
          )}
      </div>

      {/* Period pills + active series label */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          {activeLabel}
        </span>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => {
            const isActive = period === p.value;
            return (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className="px-3 py-1 rounded-md text-xs font-medium"
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

      {chartError && <ErrorBanner message={chartError} />}

      {/* Chart */}
      {chartLoading ? (
        <ChartSkeleton />
      ) : chartData && (
        <div
          className="rounded-xl border p-5"
          style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          <div className="mb-6">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              {activeLabel} — Historical
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {chartData.length} observations · {activeUnits || "FRED"} · Source: FRED
            </p>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={false}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis
                domain={yDomain}
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => isPercentage ? `${v}%` : v.toLocaleString()}
                width={50}
              />
              <Tooltip content={<CustomTooltip isPercentage={isPercentage} />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--chart-line)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "var(--chart-line)", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Attribution */}
      <p style={{
        marginTop: 24, fontFamily: "var(--sans)", fontSize: 11,
        color: "var(--fg3)", textAlign: "right",
      }}>
        Economic data via <a href="https://fred.stlouisfed.org" target="_blank" rel="noopener noreferrer"
          style={{ color: "inherit", textDecoration: "underline", textDecorationColor: "var(--border)" }}>
          FRED
        </a> · Federal Reserve Bank of St. Louis
      </p>
    </div>
  );
}
