# MarketMind — Frontend Documentation

> Tech stack: Next.js 16 · TypeScript · Tailwind CSS v4 · Recharts · next-themes
> Router: App Router (Next.js 13+ style)

---

## Key Concepts

### What is TSX?

TSX = TypeScript + JSX.

- **TypeScript** is JavaScript with types. `let price: number = 5789` — the compiler
  catches type mismatches before they reach the browser.
- **JSX** lets you write HTML-like syntax inside JavaScript functions.
  `<div className="card">Hello</div>` is really a JavaScript function call that
  React converts to real DOM elements.
- **TSX** is both in one file.

### Server Components vs Client Components

Next.js App Router has two kinds of components. This is the most important
distinction to understand.

| | Server Component | Client Component |
|---|---|---|
| Marker | *(none — default)* | `"use client"` at top of file |
| Runs on | Server (generates HTML) | Browser (interactive) |
| Can use | `fetch`, async/await, server secrets | `useState`, `useEffect`, browser APIs |
| When to use | Display-only, data fetching | Interactivity, hooks, event listeners |

**Rule of thumb:** start with a Server Component. Only add `"use client"` when
you need hooks or browser APIs.

### Props and Interfaces

A **prop** is an input passed to a component — like a function argument.

```tsx
// Interface defines what props this component accepts
interface MarketCardProps {
  name: string;       // TypeScript enforces these types
  price: number;
  change: number;
}

// Props are destructured from the function argument
export default function MarketCard({ name, price, change }: MarketCardProps) {
  return <div>{name}: {price}</div>;
}

// Usage — TypeScript errors if you pass wrong types
<MarketCard name="S&P 500" price={5789.15} change={28.47} />
```

### CSS Custom Properties (Design Tokens)

All colours are defined as CSS variables in `globals.css`. Components use
`var(--token-name)` instead of hardcoded hex values. This is how theme
switching works without any per-component logic.

```css
/* globals.css */
:root        { --bg-surface: #ffffff; }  /* light */
.dark        { --bg-surface: #18181b; }  /* dark  */

/* Component — automatically correct in both themes */
<div style={{ backgroundColor: "var(--bg-surface)" }}>
```

---

## File Structure

```
frontend/
├── app/                        Next.js App Router pages
│   ├── layout.tsx              Root layout — wraps every page
│   ├── globals.css             Global styles + CSS colour variables
│   ├── providers.tsx           Client wrapper for next-themes ThemeProvider
│   ├── page.tsx                Root route — redirects to /dashboard
│   ├── dashboard/
│   │   └── page.tsx            Dashboard page (/dashboard)
│   └── chat/
│       └── page.tsx            Chat page (/chat)
└── components/                 Reusable UI components
    ├── Sidebar.tsx             Left navigation + theme toggle
    ├── MarketCard.tsx          Single market index card
    └── PriceChart.tsx          Recharts area chart
```

---

## File Reference

### `app/globals.css`

**Purpose:** Global stylesheet. Defines CSS custom properties (design tokens)
for every colour used in the app, in both light and dark variants.

**Key sections:**

```css
@custom-variant dark (&:is(.dark *));
```
Tells Tailwind v4 to activate `dark:` utility classes when an ancestor element
has `class="dark"`. Without this, Tailwind v4 uses the OS media query instead
of next-themes' class toggling.

```css
:root { --bg-base: #f4f4f5; ... }   /* light theme */
.dark { --bg-base: #09090b; ... }   /* dark theme  */
```
The `.dark` class is added to `<html>` by next-themes when the user picks dark
mode. All variables redefine automatically.

**Available tokens:**

| Token | Purpose |
|---|---|
| `--bg-base` | Page background |
| `--bg-surface` | Cards, panels |
| `--bg-sidebar` | Sidebar background |
| `--bg-hover` | Nav link hover state |
| `--bg-active` | Nav link active state |
| `--bg-input` | Text input background |
| `--bg-chat-user` | User message bubble |
| `--bg-chat-ai` | Assistant message bubble |
| `--text-primary` | Main body text |
| `--text-secondary` | Subdued labels |
| `--text-muted` | Placeholder / hint text |
| `--border` | Card and panel borders |
| `--green` | Positive price change |
| `--red` | Negative price change |
| `--blue` | Accent / interactive elements |
| `--chart-line` | Chart stroke colour |
| `--chart-fill` | Chart gradient fill colour |

---

### `app/providers.tsx`

**Type:** Client Component (`"use client"`)
**Purpose:** Thin wrapper that gives the whole app access to `next-themes`.

`ThemeProvider` needs `"use client"` because it reads/writes `localStorage`.
`layout.tsx` stays a Server Component and just renders `<Providers>` as a
wrapper around its children.

**Props passed to ThemeProvider:**

| Prop | Value | Meaning |
|---|---|---|
| `attribute` | `"class"` | Toggles `class="dark"` on `<html>` |
| `defaultTheme` | `"dark"` | Start dark if no saved preference |
| `enableSystem` | `true` | Respect OS dark/light setting if no saved choice |

---

### `app/layout.tsx`

**Type:** Server Component
**Purpose:** Root layout. Wraps every page in the app. Runs on every request.

**What it does:**
- Loads Geist fonts via Next.js font optimisation
- Sets `<title>` and `<meta description>` for the whole site
- Adds `suppressHydrationWarning` to `<html>` — required by next-themes to
  suppress the React warning when the dark class is added after hydration
- Renders the two-column shell: `<Sidebar />` (fixed left) + `<main>` (scrollable right)
- Wraps everything in `<Providers>` so all child components can use `useTheme()`

---

### `app/page.tsx`

**Type:** Server Component
**Purpose:** Handles the root URL `/`. Immediately redirects to `/dashboard`.

Uses Next.js's built-in `redirect()` function — no JavaScript sent to the
browser, redirect happens at the server/edge level.

---

### `app/dashboard/page.tsx`

**Type:** Server Component
**Purpose:** The main dashboard page at `/dashboard`.

**Current state (Phase 5):** All data is hardcoded as static arrays at the
top of the file.

**Phase 6 change:** The hardcoded arrays will be replaced with:
```tsx
const data = await fetch("http://localhost:8000/api/market/overview").then(r => r.json());
```

**Static data defined here:**
- `MARKET_INDICES` — S&P 500, NASDAQ, Dow Jones with price/change values
- `CHART_DATA` — 22 days of AAPL close prices for the chart

**Renders:**
- A 3-column grid of `<MarketCard>` components
- A `<PriceChart>` component below

---

### `app/chat/page.tsx`

**Type:** Client Component (`"use client"`)
**Purpose:** The AI chat interface at `/chat`.

**Why Client Component?** The chat will need `useState` in Phase 6 to track
the message list and input value. Making it a Client Component now avoids a
refactor later.

**Current state (Phase 5):** Renders static pre-written messages. Input box
and send button are `disabled` (visual placeholders).

**Phase 6 change:** Will add `useState` for messages + input, and a `handleSubmit`
function that streams the response from `POST /api/chat` using `fetch` with
`ReadableStream`.

**`useRef` / `useEffect` usage:**
```tsx
const bottomRef = useRef<HTMLDivElement>(null);
useEffect(() => bottomRef.current?.scrollIntoView(), []);
```
Places an invisible `<div>` at the bottom of the message list, then scrolls
to it on mount — ensuring the user always sees the latest message.

---

### `components/Sidebar.tsx`

**Type:** Client Component (`"use client"`)
**Purpose:** Fixed left navigation panel with theme toggle.

**Why Client Component?** Uses two hooks that need the browser:
- `usePathname()` — reads the current URL to highlight the active nav link
- `useTheme()` — reads and sets the current theme

**`mounted` state pattern:**
```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
// Only render toggle after hydration
{mounted && <ThemeButton />}
```
next-themes doesn't know the theme on the server (it reads localStorage).
Without this guard, the toggle button renders with `theme = undefined` on
first paint, causing a flash of the wrong icon. We hide it until the browser
has hydrated and the theme is known.

**Nav links** are defined as a static array at the top:
```tsx
const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: <svg>...</svg> },
  { href: "/chat",      label: "Chat",      icon: <svg>...</svg> },
];
```
Adding a new page is one array entry.

---

### `components/MarketCard.tsx`

**Type:** Server Component
**Purpose:** Displays a single market index snapshot.

**Props:**

| Prop | Type | Example |
|---|---|---|
| `name` | `string` | `"S&P 500"` |
| `symbol` | `string` | `"^GSPC"` |
| `price` | `number` | `5789.15` |
| `change` | `number` | `28.47` or `-89.12` |
| `changePercent` | `number` | `0.49` or `-0.21` |

**Colour logic:**
```tsx
const isPositive = change >= 0;
// Green arrow + text if positive, red if negative
color: isPositive ? "var(--green)" : "var(--red)"
```

**Number formatting:**
```tsx
price.toLocaleString("en-US", { minimumFractionDigits: 2 })
// 5789.15 → "5,789.15"
```

---

### `components/PriceChart.tsx`

**Type:** Client Component (`"use client"`)
**Purpose:** Recharts area chart for price history.

**Why Client Component?** Recharts uses browser DOM APIs (SVG measurement,
resize observers) that aren't available on the server.

**Props:**

| Prop | Type | Description |
|---|---|---|
| `data` | `PricePoint[]` | Array of `{ date: string, close: number }` |
| `symbol` | `string` | Ticker shown in the card header |

**Key Recharts components used:**

| Component | Role |
|---|---|
| `ResponsiveContainer` | Makes chart fill parent width (responsive) |
| `AreaChart` | The chart type — line with filled area below |
| `Area` | The actual data line + fill |
| `XAxis` / `YAxis` | Axis labels |
| `CartesianGrid` | Dashed horizontal grid lines |
| `Tooltip` | Hover popup (custom styled) |

**Y-axis auto-scaling:**
```tsx
const padding = (maxPrice - minPrice) * 0.1;
const yMin = Math.floor(minPrice - padding);
const yMax = Math.ceil(maxPrice + padding);
```
Adds 10% breathing room above and below the data range so the line isn't
crammed against the chart edges.

**SVG gradient:**
```tsx
<defs>
  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%"  stopColor="var(--chart-line)" stopOpacity={0.3} />
    <stop offset="95%" stopColor="var(--chart-line)" stopOpacity={0}   />
  </linearGradient>
</defs>
<Area fill="url(#priceGradient)" />
```
The gradient fades from 30% opacity at the top to transparent at the bottom,
creating the filled area effect under the line.

---

## Data Flow (Phase 5 vs Phase 6)

```
Phase 5 (now)                    Phase 6 (next)
─────────────────────────────    ─────────────────────────────────────────
page.tsx                         page.tsx
  └── hardcoded arrays     →       └── fetch("localhost:8000/api/...")
        │                                  │
        ▼                                  ▼
  <MarketCard />                     <MarketCard />   (same components,
  <PriceChart />                     <PriceChart />    different data source)


chat/page.tsx                    chat/page.tsx
  └── STATIC_MESSAGES       →      └── useState([]) + fetch SSE stream
                                         │
                                         ▼
                                   POST /api/chat → tokens arrive
                                   one by one → appended to state
```

---

## How to Run

```bash
cd frontend
npm run dev       # starts on http://localhost:3000
```

The root `/` redirects automatically to `/dashboard`.
