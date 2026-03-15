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

const TABS = [
  { href: "/dashboard", label: "Dashboard" },
  // Add future tabs here, e.g.:
  // { href: "/fred", label: "FRED" },
];

export default function TopNav() {
  const pathname = usePathname();

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
          const isActive = pathname === href || pathname.startsWith(href + "/");
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

      {/* Right — spacer for layout balance */}
      <div className="w-28" />
    </header>
  );
}
