/**
 * MarketCard.tsx
 *
 * Displays a single market index snapshot: name, price, change, change%.
 * Green for positive change, red for negative — the universal finance convention.
 *
 * Server Component (no client-side hooks needed — pure display).
 */

interface MarketCardProps {
  name: string;        // e.g. "S&P 500"
  symbol: string;      // e.g. "^GSPC"
  price: number;       // e.g. 5789.15
  change: number;      // e.g. +28.47 or -12.30
  changePercent: number; // e.g. 0.49 (represents 0.49%)
}

export default function MarketCard({ name, symbol, price, change, changePercent }: MarketCardProps) {
  const isPositive = change >= 0;
  const sign = isPositive ? "+" : ""; // negative numbers already include the minus

  return (
    <div
      className="rounded-xl p-5 border flex flex-col gap-3"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      {/* Index name + symbol */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          {name}
        </span>
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{
          backgroundColor: "var(--bg-base)",
          color: "var(--text-muted)",
        }}>
          {symbol}
        </span>
      </div>

      {/* Price */}
      <div style={{
        fontFamily: "var(--sans)", fontSize: 22, fontWeight: 600,
        letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums",
        color: "var(--fg1)",
      }}>
        {price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>

      {/* Change + change % */}
      <div
        className="flex items-center gap-2 text-sm font-medium"
        style={{ color: isPositive ? "var(--green)" : "var(--red)" }}
      >
        {/* Triangle arrow */}
        <span>{isPositive ? "▲" : "▼"}</span>
        <span>
          {sign}{change.toFixed(2)} ({sign}{changePercent.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}
