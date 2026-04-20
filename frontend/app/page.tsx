"use client";

/**
 * Overview page — /
 *
 * Editorial variant (Option A from design file):
 *   - Big serif headline
 *   - AI briefing card (live from Claude, with ⓘ model/tools tooltip)
 *   - Today's board: S&P 500 · 10Y Yield · Gold · VIX
 *   - Biggest movers: top 4 gainers + 4 losers
 */

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = "http://localhost:8000";

const MODEL_SHORT: Record<string, string> = {
  "claude-opus-4-6":           "Opus 4.6",
  "claude-sonnet-4-6":         "Sonnet 4.6",
  "claude-haiku-4-5-20251001": "Haiku 4.5",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoardItem {
  name: string;
  symbol: string;
  label: string;
  unit: string;
  price: number;
  change: number;
  changePercent: number;
}

interface Mover {
  sym: string;
  name: string;
  price: number;
  changePercent: number;
}

interface Movers {
  gainers: Mover[];
  losers: Mover[];
}

interface Briefing {
  text: string;
  tags: string[];
  model: string;
  tools_called: string[];
}

// ─── Skeleton primitives ──────────────────────────────────────────────────────

function Skeleton({ w, h, style }: { w?: number | string; h?: number; style?: React.CSSProperties }) {
  return (
    <div className="animate-pulse rounded" style={{
      width: w, height: h ?? 14,
      backgroundColor: "var(--bg-active)",
      ...style,
    }} />
  );
}

// ─── Board card ───────────────────────────────────────────────────────────────

function BoardCard({ item }: { item: BoardItem }) {
  const up = item.change >= 0;
  const sign = up ? "+" : "";
  const formatPrice = (sym: string, p: number, unit: string) => {
    const num = sym === "^GSPC"
      ? p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : p.toFixed(2);
    return unit === "%" ? `${num}%` : num;
  };

  return (
    <div style={{
      backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", padding: "12px 16px",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--fg2)" }}>
          {item.name}
        </span>
        <span style={{
          fontFamily: "var(--mono)", fontSize: 10, fontWeight: 500,
          padding: "2px 6px", borderRadius: "var(--r-sm)",
          backgroundColor: "var(--bg-page)", color: "var(--fg3)",
        }}>
          {item.label}
        </span>
      </div>
      <div style={{
        fontFamily: "var(--sans)", fontSize: 18, fontWeight: 600,
        letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums",
        color: "var(--fg1)", lineHeight: 1.1,
      }}>
        {formatPrice(item.symbol, item.price, item.unit)}
      </div>
      <div style={{
        fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500,
        color: up ? "var(--up)" : "var(--down)",
        fontVariantNumeric: "tabular-nums",
      }}>
        {up ? "▲" : "▼"} {sign}{item.change.toFixed(2)} ({sign}{item.changePercent.toFixed(2)}%)
      </div>
    </div>
  );
}

function BoardCardSkeleton() {
  return (
    <div style={{
      backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", padding: 20,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <Skeleton w={80} h={12} />
      <Skeleton w={120} h={22} />
      <Skeleton w={90} h={12} />
    </div>
  );
}

// ─── Mover row ────────────────────────────────────────────────────────────────

function MoverRow({ m, isUp }: { m: Mover; isUp: boolean }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "52px 1fr auto auto",
      alignItems: "baseline", gap: 12,
      padding: "5px 0", borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--fg1)", letterSpacing: "0.02em" }}>
        {m.sym}
      </span>
      <span style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--fg2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {m.name}
      </span>
      <span style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--fg1)", fontVariantNumeric: "tabular-nums" }}>
        ${m.price.toFixed(2)}
      </span>
      <span style={{
        fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, fontVariantNumeric: "tabular-nums",
        color: isUp ? "var(--up)" : "var(--down)", minWidth: 56, textAlign: "right",
      }}>
        {isUp ? "+" : ""}{m.changePercent.toFixed(2)}%
      </span>
    </div>
  );
}

// ─── Movers section ───────────────────────────────────────────────────────────

function MoversSection({ movers }: { movers: Movers | null }) {
  if (!movers) {
    return (
      <div style={{
        backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", padding: 24,
      }}>
        <Skeleton w={200} h={12} style={{ marginBottom: 16 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          {[0, 1].map(i => (
            <div key={i}>{[0,1,2,3].map(j => <Skeleton key={j} h={12} style={{ marginBottom: 12 }} />)}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", padding: "12px 16px",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg2)" }}>
          Biggest movers · Large cap
        </span>
        <span style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--fg3)" }}>today</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 600, color: "var(--up)", marginBottom: 4, letterSpacing: "0.04em" }}>
            ▲ GAINERS
          </div>
          {movers.gainers.map(m => <MoverRow key={m.sym} m={m} isUp />)}
        </div>
        <div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 600, color: "var(--down)", marginBottom: 4, letterSpacing: "0.04em" }}>
            ▼ LOSERS
          </div>
          {movers.losers.map(m => <MoverRow key={m.sym} m={m} isUp={false} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Briefing card ────────────────────────────────────────────────────────────

function BriefingCard({ briefing }: { briefing: Briefing | null }) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!briefing) {
    return (
      <div style={{
        backgroundColor: "var(--bg-subtle, var(--bg-surface))",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", padding: "16px 20px",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--accent)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
            </svg>
          </span>
          <Skeleton w={220} h={11} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton w="100%" h={20} />
          <Skeleton w="85%" h={20} />
          <Skeleton w="60%" h={20} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[100, 120, 90, 110].map((w, i) => <Skeleton key={i} w={w} h={24} style={{ borderRadius: 99 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", padding: "16px 20px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--accent)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
            </svg>
          </span>
          <span style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg2)" }}>
            Today&apos;s briefing · Generated{" "}
            {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
          </span>
        </div>

        {/* ⓘ tooltip */}
        <div
          style={{ position: "relative" }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <span style={{ fontSize: 13, color: "var(--fg3)", cursor: "default", userSelect: "none" }}>ⓘ</span>
          {showTooltip && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
              backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-md)", padding: "8px 12px",
              whiteSpace: "nowrap", boxShadow: "var(--shadow-2)", lineHeight: 1.8,
            }}>
              <div style={{ fontSize: 11 }}>
                <span style={{ color: "var(--fg3)" }}>Model  </span>
                <span style={{ color: "var(--fg1)", fontWeight: 500 }}>
                  {MODEL_SHORT[briefing.model] ?? briefing.model}
                </span>
              </div>
              <div style={{ fontSize: 11 }}>
                <span style={{ color: "var(--fg3)" }}>Tools  </span>
                <span style={{ color: "var(--fg1)", fontWeight: 500 }}>
                  {briefing.tools_called.length > 0 ? briefing.tools_called.join(", ") : "none"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Briefing text */}
      <p style={{
        margin: 0,
        fontFamily: "var(--sans)",
        fontSize: 14, fontWeight: 400, lineHeight: 1.6,
        color: "var(--fg1)",
      }}>
        {briefing.text}
      </p>

      {/* Topic tags */}
      {briefing.tags.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {briefing.tags.map(tag => (
            <span key={tag} style={{
              fontFamily: "var(--sans)", fontSize: 11, fontWeight: 500,
              padding: "4px 10px",
              border: "1px solid var(--border)",
              borderRadius: 99, color: "var(--fg2)",
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Eyebrow label ────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "var(--sans)", fontSize: 11, fontWeight: 500,
      textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg2)",
      marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [board,   setBoard]   = useState<BoardItem[] | null>(null);
  const [movers,  setMovers]  = useState<Movers | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  // Board + movers in parallel (fast)
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/market/board`).then(r => r.json()),
      fetch(`${API_BASE}/api/market/movers`).then(r => r.json()),
    ]).then(([b, m]) => {
      setBoard(b);
      setMovers(m);
    }).catch(console.error);
  }, []);

  // Briefing separately (slower — Claude call)
  useEffect(() => {
    fetch(`${API_BASE}/api/overview/briefing`)
      .then(r => r.json())
      .then(setBriefing)
      .catch(console.error);
  }, []);

  return (
    <div style={{ padding: "28px 40px 24px", maxWidth: 1040, display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Editorial header */}
      <header>
        <div style={{
          fontFamily: "var(--sans)", fontSize: 11, fontWeight: 500,
          textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg2)",
        }}>
          {today}
        </div>
        <h1 style={{
          fontFamily: "var(--serif-display)", fontSize: 36, fontWeight: 400,
          lineHeight: 1.1, letterSpacing: "-0.02em",
          color: "var(--fg1)", margin: "6px 0 0", whiteSpace: "nowrap",
        }}>
          The markets, at a glance.
        </h1>
      </header>

      {/* AI briefing */}
      <BriefingCard briefing={briefing} />

      {/* Today's board */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Eyebrow>Today&apos;s board</Eyebrow>
          <Link href="/markets" style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--fg3)", textDecoration: "none" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--fg1)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--fg3)")}
          >
            Go to Markets →
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {board
            ? board.map(item => <BoardCard key={item.symbol} item={item} />)
            : [1,2,3,4].map(n => <BoardCardSkeleton key={n} />)
          }
        </div>
      </section>

      {/* Biggest movers */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Eyebrow>Biggest movers</Eyebrow>
          <Link href="/markets" style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--fg3)", textDecoration: "none" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--fg1)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--fg3)")}
          >
            Go to Markets →
          </Link>
        </div>
        <MoversSection movers={movers} />
      </section>

    </div>
  );
}
