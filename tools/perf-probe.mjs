/**
 * Performance probe for NFR-01 (≥ 55 FPS in the worst job) and NFR-03 (playable
 * ≤ 2 s from a cold start), with the CPU slowed 4× as Lighthouse does to stand
 * in for a mid-range phone. A desktop browser is not a phone: treat the numbers
 * as a regression guard and confirm on a device before calling a target met.
 *
 *   npm run build && npx vite preview --port 4173   # cold start is measured on the store build
 *   npm run dev                                     # frame rate needs the dev build's world mapping
 *   BROWSER="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npm run perf
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const PREVIEW = process.env.PREVIEW_URL ?? 'http://localhost:4173/';
const DEV = process.env.GAME_URL ?? 'http://localhost:5173/';
const THROTTLE = Number(process.env.CPU_THROTTLE ?? 4);
const executablePath = process.env.BROWSER;
if (!executablePath) throw new Error('Set BROWSER to a Chromium-based browser executable.');

/** The heaviest job with a plain solution: Berlin 10, 28 blocks and a wrecking ball, shattering as it falls. */
const berlin = JSON.parse(fs.readFileSync('src/content/levels/berlin.json', 'utf8'));
const JOB = (berlin.levels ?? berlin).find((l) => l.id === 'w7-10');
const FEATURES = [...fs.readFileSync('src/content/features.ts', 'utf8').match(/FEATURE_IDS = \[([^\]]*)\]/)[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);

const browser = await puppeteer.launch({ executablePath, headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** A fresh page on a phone screen with the CPU slowed down. */
const phone = async (throttle) => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  return { page, context };
};

/** NFR-03: from navigation to the menu a player can tap, on the store build with an empty cache. */
const coldStart = async (throttle) => {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const { page, context } = await phone(throttle);
    await page.goto(PREVIEW, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.panel.menu button', { timeout: 30000 });
    runs.push(await page.evaluate(() => performance.now()));
    await context.close();
  }
  return median(runs);
};

/** NFR-01: frame times while Berlin 10 comes down, from requestAnimationFrame. */
const collapseFps = async (throttle) => {
  const { page, context } = await phone(throttle);
  await page.evaluateOnNewDocument((seen) => {
    const stars = {};
    for (let w = 1; w <= 7; w++) for (let i = 1; i <= 10; i++) stars[`w${w}-${String(i).padStart(2, '0')}`] = 3;
    localStorage.setItem(
      'fuse-and-fall/progress',
      JSON.stringify({ version: 1, stars, best: {}, achievements: [], daily: {}, seenFeatures: seen, settings: { sfxVolume: 0, musicVolume: 0 } }),
    );
  }, FEATURES);
  await page.goto(DEV, { waitUntil: 'networkidle0' });
  await page.evaluate(() => (document.querySelector('.menu-main .btn:not(.continue)') ?? document.querySelector('.panel.menu .btn.big')).click());
  await page.waitForSelector('.city-card');
  await page.evaluate(() => document.querySelectorAll('.city-card')[6].click());
  await page.waitForSelector('.level-card');
  await page.evaluate(() => document.querySelectorAll('.level-card')[9].click());
  await sleep(1500);
  for (const c of JOB.solution.charges) {
    const p = await page.evaluate(([x, y]) => window.__fuse.toClient(x, y), [c.x, c.y]);
    await page.mouse.click(p.x, p.y);
    await sleep(200);
  }
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const tick = (now) => {
      window.__frames.push(now - last);
      last = now;
      if (window.__frames.length < 2000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    document.querySelector('.fire-btn:not(.detonate-btn)').click();
  });
  await sleep(1500);
  // Proof the numbers come from a collapse and not an idle screen: PERF_SHOT=dir keeps a frame of it.
  if (process.env.PERF_SHOT) await page.screenshot({ path: `${process.env.PERF_SHOT}/collapse-${throttle}x.jpg`, type: 'jpeg', quality: 70 });
  const title = await page.$eval('.hud', (e) => e.textContent ?? '');
  if (!title.includes('10')) throw new Error(`Berlin 10 did not open: ${title.slice(0, 60)}`);
  await sleep(4500);
  const frames = (await page.evaluate(() => window.__frames)).slice(1);
  await context.close();
  const sorted = [...frames].sort((a, b) => a - b);
  const mean = frames.reduce((s, f) => s + f, 0) / frames.length;
  return {
    frames: frames.length,
    avgFps: 1000 / mean,
    lowFps: 1000 / sorted[Math.floor(sorted.length * 0.95)],
    worstMs: sorted[sorted.length - 1],
  };
};

const rows = [];
for (const throttle of [1, THROTTLE]) {
  const start = await coldStart(throttle);
  const fps = await collapseFps(throttle);
  rows.push({ throttle, start, ...fps });
}
await browser.close();

const fmt = (n, d = 0) => n.toFixed(d);
console.log(
  [
    `| CPU | Soğuk açılış (NFR-03 ≤ 2000 ms) | Ort. FPS (NFR-01 ≥ 55) | %5 en düşük FPS | En uzun kare | Kare |`,
    '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.throttle}× | ${fmt(r.start)} ms | ${fmt(r.avgFps, 1)} | ${fmt(r.lowFps, 1)} | ${fmt(r.worstMs)} ms | ${r.frames} |`),
  ].join('\n'),
);
