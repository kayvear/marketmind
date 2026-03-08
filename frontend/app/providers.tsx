"use client";

/**
 * providers.tsx
 *
 * A thin Client Component wrapper around next-themes' ThemeProvider.
 *
 * Why a separate file?
 *   ThemeProvider requires 'use client' because it reads/writes localStorage
 *   and listens to system preference changes. But our root layout.tsx should
 *   stay a Server Component (better performance, no client bundle overhead).
 *
 *   The pattern is: layout.tsx (Server) → <Providers> (Client) → children
 *   Server Components can be passed as children to Client Components — they
 *   just can't be imported inside a Client Component file directly.
 *
 * Props:
 *   attribute="class"   → next-themes toggles class="dark" on <html>
 *   defaultTheme="dark" → start dark; falls back to localStorage on revisit
 *   enableSystem        → respect OS dark/light preference if no saved choice
 */

import { ThemeProvider } from "next-themes";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      {children}
    </ThemeProvider>
  );
}
