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
 * Output: ../docs/demo-overview.gif  and  ../docs/demo-economics.gif
 *
 * How it works:
 *   Playwright records each page as a WebM video (built-in), then we use
 *   ffmpeg (macOS built-in via Homebrew, or installed separately) to convert
 *   the video to a palette-optimised GIF.
 *
 * If ffmpeg is not installed:
 *   brew install ffmpeg
 */

import { chromium } from "@playwright/test";
import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
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

  try {
    await fn(page);
  } finally {
    await context.close(); // flushes the video
    await browser.close();
  }

  // Playwright names the file by context id — find the latest .webm
  const { readdirSync, statSync } = await import("fs");
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

// ── Overview demo ─────────────────────────────────────────────────────────────
await capture("overview", async (page) => {
  console.log("📸  Recording: Overview page…");
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await wait(3000); // let briefing card populate

  // Scroll down slightly to show movers
  await page.evaluate(() => window.scrollBy(0, 80));
  await wait(1500);

  // Hover over a board card
  const cards = page.locator("[data-board-card]");
  if ((await cards.count()) > 0) {
    await cards.nth(0).hover();
    await wait(800);
    await cards.nth(2).hover();
    await wait(800);
  }

  // Open chat rail pop-out and back
  const popOutBtn = page.locator("button[title='Pop out']");
  if ((await popOutBtn.count()) > 0) {
    await popOutBtn.click();
    await wait(1200);
    const popInBtn = page.locator("button[title='Merge back']");
    if ((await popInBtn.count()) > 0) {
      await popInBtn.click();
      await wait(800);
    }
  }

  await wait(1000);
});

// ── Economics demo ────────────────────────────────────────────────────────────
await capture("economics", async (page) => {
  console.log("📸  Recording: Economics page…");
  await page.goto(`${BASE_URL}/economics`, { waitUntil: "networkidle" });
  await wait(2500); // let indicator cards load

  // Click each indicator card to change the chart series
  const indicatorCards = page.locator("[data-indicator-card]");
  const count = await indicatorCards.count();
  for (let i = 0; i < count; i++) {
    await indicatorCards.nth(i).click();
    await wait(1200);
  }

  // Change time period
  const periodBtns = page.locator("[data-period-btn]");
  const pCount = await periodBtns.count();
  for (let i = 0; i < pCount; i++) {
    await periodBtns.nth(i).click();
    await wait(900);
  }

  // Type in the FRED search box
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

console.log("\nDone! GIFs written to docs/. Add them to git and push.");
