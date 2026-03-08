"use client";

/**
 * PriceChart.tsx
 *
 * An area chart showing close price over time for a given ticker.
 * Client Component because Recharts uses browser DOM APIs internally.
 *
 * ResponsiveContainer makes the chart fill whatever width its parent gives it.
 * The gradient fill under the line makes it visually richer than a bare line.
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface PricePoint {
  date: string;
  close: number;
}

interface PriceChartProps {
  data: PricePoint[];
  symbol: string;
}

// Custom tooltip that shows on hover — cleaner than Recharts' default style
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
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
        ${payload[0].value.toFixed(2)}
      </div>
    </div>
  );
}

export default function PriceChart({ data, symbol }: PriceChartProps) {
  // Compute the Y-axis domain with a bit of padding so the line isn't
  // crammed against the top/bottom edges of the chart.
  const prices = data.map((d) => d.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = (maxPrice - minPrice) * 0.1;
  const yMin = Math.floor(minPrice - padding);
  const yMax = Math.ceil(maxPrice + padding);

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {symbol} — Price History
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Last {data.length} trading days · Close price
          </p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
          {/*
           * defs holds the SVG gradient definition.
           * linearGradient fades from the line colour at the top to transparent
           * at the bottom — this is the "filled area" effect.
           */}
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-line)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--chart-line)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={false}
            // Only show every 5th label so they don't overlap
            interval={Math.floor(data.length / 5)}
          />

          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v}`}
            width={55}
          />

          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="close"
            stroke="var(--chart-line)"
            strokeWidth={2}
            fill="url(#priceGradient)"
            dot={false}
            activeDot={{ r: 4, fill: "var(--chart-line)", strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
