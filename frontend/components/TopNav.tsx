"use client";

/**
 * TopNav.tsx
 *
 * Full-width horizontal navigation bar at the top of every page.
 * Contains: logo (left), tab links (centre-left), theme toggle (right).
 *
 * Client Component because:
 *  - usePathname() reads the current URL to highlight the active tab
 *  - useTheme() reads/writes localStorage for theme toggling
 *
 * Adding a new tab: add one entry to the TABS array.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const TABS = [
  { href: "/",           label: "Overview"  },
  { href: "/markets",    label: "Markets"   },
  { href: "/economics",  label: "Economics" },
];

export default function TopNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header
      className="flex items-center justify-between px-5 h-14 border-b shrink-0"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      {/* Left — logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center w-7 h-7 rounded-md text-white text-xs font-bold shrink-0"
          style={{ backgroundColor: "var(--blue)" }}
        >
          M
        </div>
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          MarketMind
        </span>
      </div>

      {/* Centre — horizontal tabs */}
      <nav className="flex items-center gap-1">
        {TABS.map(({ href, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: isActive ? "var(--bg-active)" : "transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
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
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Right — theme toggle */}
      {mounted && (
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ backgroundColor: "var(--bg-hover)" }}>
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors"
              style={{
                backgroundColor: theme === t ? "var(--bg-surface)" : "transparent",
                color: theme === t ? "var(--text-primary)" : "var(--text-secondary)",
                boxShadow: theme === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {t === "light" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
              {t === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
