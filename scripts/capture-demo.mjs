/**
 * capture-demo.mjs
 *
 * Captures animated GIFs of the MarketMind UI for the README.
 * Requires the full app to be running locally (frontend + backend + MCP server).
 *
 * Usage:
 *   npm install && npx playwright install chromium
 *   node capture-demo.mjs
 *
 * Output (in ../docs/):
 *   demo-overview.gif
 *   demo-markets.gif
 *   demo-economics.gif
 *   demo-chat.gif
 *
 * Requires ffmpeg:
 *   brew install ffmpeg
 */

import { chromium } from "@playwright/test";
import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, "../docs");
const BASE_URL = "http://localhost:3000";

if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });

// Check ffmpeg
try {
  execSync("ffmpeg -version", { stdio: "ignore" });
} catch {
  console.error("❌  ffmpeg not found. Install with: brew install ffmpeg");
  process.exit(1);
}

function videoToGif(videoPath, gifPath, fps = 8, scale = 1200) {
  const palette = videoPath.replace(".webm", "-palette.png");
  execSync(
    `ffmpeg -y -i "${videoPath}" -vf "fps=${fps},scale=${scale}:-1:flags=lanczos,palettegen" "${palette}"`,
    { stdio: "ignore" }
  );
  execSync(
    `ffmpeg -y -i "${videoPath}" -i "${palette}" -lavfi "fps=${fps},scale=${scale}:-1:flags=lanczos [x]; [x][1:v] paletteuse" "${gifPath}"`,
    { stdio: "ignore" }
  );
  execSync(`rm "${palette}"`);
  console.log(`✅  Saved ${gifPath}`);
}

async function capture(name, fn) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: DOCS_DIR, size: { width: 1440, height: 900 } },
    colorScheme: "light",
  });
  const page = await context.newPage();

  // Force next-themes into light mode before any page loads
  await context.addInitScript(() => {
    localStorage.setItem("theme", "light");
  });

  try {
    await fn(page);
  } finally {
    await context.close();
    await browser.close();
  }

  const videos = readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => ({ f, t: statSync(path.join(DOCS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);

  if (!videos.length) throw new Error("No video file found in docs/");
  const videoPath = path.join(DOCS_DIR, videos[0].f);
  const gifPath = path.join(DOCS_DIR, `demo-${name}.gif`);
  videoToGif(videoPath, gifPath);
  execSync(`rm "${videoPath}"`);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── 1. Overview ───────────────────────────────────────────────────────────────
await capture("overview", async (page) => {
  console.log("📸  Recording: Overview page…");
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await wait(3500); // let AI briefing card populate

  // Scroll slightly to reveal movers
  await page.evaluate(() => window.scrollBy(0, 80));
  await wait(1500);
  await page.evaluate(() => window.scrollBy(0, -80));
  await wait(1000);
});

// ── 2. Markets ────────────────────────────────────────────────────────────────
await capture("markets", async (page) => {
  console.log("📸  Recording: Markets page…");
  await page.goto(`${BASE_URL}/markets`, { waitUntil: "networkidle" });
  await wait(2500);

  // Click each index card to switch the chart
  const marketCards = page.locator("[data-market-card]");
  const count = await marketCards.count();
  for (let i = 0; i < count; i++) {
    await marketCards.nth(i).click();
    await wait(1200);
  }

  // Cycle through a few time periods
  const periodBtns = page.locator("[data-period-btn]");
  const pCount = await periodBtns.count();
  for (let i = 0; i < pCount; i++) {
    await periodBtns.nth(i).click();
    await wait(900);
  }

  await wait(1000);
});

// ── 3. Economics ──────────────────────────────────────────────────────────────
await capture("economics", async (page) => {
  console.log("📸  Recording: Economics page…");
  await page.goto(`${BASE_URL}/economics`, { waitUntil: "networkidle" });
  await wait(2500);

  // Click each indicator card
  const indicatorCards = page.locator("[data-indicator-card]");
  const count = await indicatorCards.count();
  for (let i = 0; i < count; i++) {
    await indicatorCards.nth(i).click();
    await wait(1200);
  }

  // Cycle through time periods
  const periodBtns = page.locator("[data-period-btn]");
  const pCount = await periodBtns.count();
  for (let i = 0; i < pCount; i++) {
    await periodBtns.nth(i).click();
    await wait(900);
  }

  // Type in FRED search
  const searchInput = page.locator("input[placeholder*='Search']").first();
  if ((await searchInput.count()) > 0) {
    await searchInput.click();
    await searchInput.type("inflation", { delay: 80 });
    await wait(1800);
    await searchInput.clear();
    await wait(500);
  }

  await wait(1000);
});

// ── 4. AI Chat — Haiku, Brief, 3-month comparison ────────────────────────────
await capture("chat", async (page) => {
  console.log("📸  Recording: AI chat demo…");
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await wait(1500);

  // Open settings popover
  const settingsBtn = page.locator("button[title='Settings']").first();
  await settingsBtn.click();
  await wait(600);

  // Set verbosity to Brief
  const briefBtn = page.locator("button", { hasText: "Brief" }).first();
  await briefBtn.click();
  await wait(400);

  // Set model to Haiku
  const haikuBtn = page.locator("button", { hasText: "Haiku 4.5" }).first();
  await haikuBtn.click();
  await wait(400);

  // Close settings by clicking elsewhere
  await page.keyboard.press("Escape");
  await wait(500);

  // Type and send the question
  const input = page.locator("input[placeholder*='stock']").first();
  await input.click();
  await input.type(
    "Compare US equities, oil prices, and the 30-year mortgage rate over the last 3 months",
    { delay: 40 }
  );
  await wait(600);
  await page.keyboard.press("Enter");

  // Wait for the full streaming response (up to 45 seconds)
  await page.waitForSelector("text=ⓘ", { timeout: 45000 });
  await wait(2000);
});

console.log("\n🎬  All done! GIFs written to docs/. Run: git add docs/ && git commit && git push");
