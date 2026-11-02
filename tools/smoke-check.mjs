/**
 * Smoke check: plays through the main screens in a real browser, keeps a
 * screenshot of each and fails on any console error or step that does not
 * happen. A passing test says nothing about a menu drawn off-screen; this looks.
 *
 *   npm run dev                      # in another terminal (needs the dev build's world mapping)
 *   BROWSER="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npm run smoke
 *
 * Output: docs/qa/smoke/<date>/ with the screenshots and report.md. Exit code 1 on FAIL.
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const URL = process.env.GAME_URL ?? 'http://localhost:5173/';
const executablePath = process.env.BROWSER;
if (!executablePath) throw new Error('Set BROWSER to a Chromium-based browser executable.');
const date = new Date().toISOString().slice(0, 10);
const OUT = `docs/qa/smoke/${date}`;
fs.mkdirSync(OUT, { recursive: true });

/** Read from the sources, so the check follows the game instead of a copy of it. */
const FEATURES = [...fs.readFileSync('src/content/features.ts', 'utf8').match(/FEATURE_IDS = \[([^\]]*)\]/)[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
const ankara = JSON.parse(fs.readFileSync('src/content/levels/ankara.json', 'utf8'));
const JOB = (ankara.levels ?? ankara).find((l) => l.id === 'w1-10');

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

/** A player who finished Ankara but nine: every city's first job is open, settings as given. */
const seed = (settings) =>
  page.evaluateOnNewDocument((s, seenFeatures) => {
    if (sessionStorage.getItem('smoke-seeded') === JSON.stringify(s)) return;
    sessionStorage.setItem('smoke-seeded', JSON.stringify(s));
    const stars = {};
    for (let i = 1; i <= 9; i++) stars[`w1-${String(i).padStart(2, '0')}`] = 3;
    localStorage.setItem(
      'fuse-and-fall/progress',
      JSON.stringify({
        version: 1, stars, best: {}, achievements: [], daily: {}, wallet: { balance: 900, earned: 900 },
        // Every feature card already seen, so the shots show the job and not its introduction.
        seenFeatures,
        settings: { language: 'tr', sfxVolume: 0, musicVolume: 0, ...s },
      }),
    );
  }, settings, FEATURES);

const steps = [];
/** Runs one step: a screenshot after it, and a row in the report whatever happens. */
const step = async (name, what, run) => {
  try {
    const note = (await run()) ?? '';
    await page.evaluate(() => document.querySelectorAll('.toast, .coach').forEach((e) => (e.style.visibility = 'hidden')));
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 70 });
    steps.push({ name, what, ok: true, note });
  } catch (e) {
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 70 }).catch(() => {});
    steps.push({ name, what, ok: false, note: String(e.message ?? e).split('\n')[0] });
  }
};
const click = (selector, index = 0) =>
  page.evaluate(([s, i]) => {
    const el = document.querySelectorAll(s)[i];
    if (!el) throw new Error(`no ${s}[${i}]`);
    el.click();
  }, [selector, index]);
const tapWorld = async (x, y) => {
  const p = await page.evaluate(([wx, wy]) => window.__fuse.toClient(wx, wy), [x, y]);
  await page.mouse.click(p.x, p.y);
  await sleep(200);
};
const openLevel = async (city, level) => {
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => (document.querySelector('.menu-main .btn:not(.continue)') ?? document.querySelector('.panel.menu .btn.big')).click());
  await page.waitForSelector('.city-card');
  await click('.city-card', city);
  await page.waitForSelector('.level-card');
  await click('.level-card', level);
  await sleep(1000);
};

// Portrait phone, as most players hold it.
await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await seed({});

await step('01-menu', 'Ana menü açılır', async () => {
  const start = Date.now();
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.panel.menu', { timeout: 5000 });
  return `menü ${Date.now() - start} ms içinde`;
});
await step('02-cities', 'Şehir listesi', async () => {
  await page.evaluate(() => (document.querySelector('.menu-main .btn:not(.continue)') ?? document.querySelector('.panel.menu .btn.big')).click());
  await page.waitForSelector('.city-card');
  return `${await page.$$eval('.city-card', (c) => c.length)} şehir`;
});
await step('03-levels', 'Ankara görev listesi', async () => {
  await click('.city-card', 0);
  await page.waitForSelector('.level-card');
  return `${await page.$$eval('.level-card', (c) => c.length)} görev`;
});
/** Places the job's own saved solution through the real touch input, `nudge` px to the side. */
const placeSolution = async (nudge = 0) => {
  for (const c of JOB.solution.charges) await tapWorld(c.x + nudge, c.y);
};
await step('04-placing', 'Ankara 10: çözümdeki şarjlar yerleştirilir', async () => {
  await openLevel(0, 9);
  await placeSolution();
  if (await page.$('.feature-card')) throw new Error('özellik kartı sahayı kapatıyor');
});
await step('05-collapse', 'ATEŞLE: yapı çöker', async () => {
  await click('.fire-btn:not(.detonate-btn)');
  await sleep(700);
});
const reportStamp = async () => {
  await page.waitForSelector('.panel.report', { timeout: 25000 });
  await sleep(1400);
  return page.$eval('.panel.report .stamp', (e) => e.textContent);
};
await step('06-report', 'Sonuç raporu; çözüm "Tekrar dene" ile birkaç denemede kazanır', async () => {
  // Ankara 10 is a hard job: a pixel of tap rounding can change its collapse (docs/level-balance.md
  // puts its near-miss clear rate at 57%). Retry with small nudges, as a player would.
  let stamp = await reportStamp();
  const tries = [0];
  for (const nudge of [4, -4, 8, -8]) {
    if (!(await page.$('.panel.report.lose'))) break;
    await click('.report .actions .btn', 0); // Retry
    await sleep(900);
    await placeSolution(nudge);
    await click('.fire-btn:not(.detonate-btn)');
    stamp = await reportStamp();
    tries.push(nudge);
  }
  if (await page.$('.panel.report.lose')) throw new Error(`${tries.length} denemede kazanılmadı: ${stamp}`);
  return `${stamp} · ${tries.length}. denemede`;
});
await step('07-workshop', 'Atölye', async () => {
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await click('.menu-row .btn', 0);
  await page.waitForSelector('.panel.workshop');
});
await step('08-settings', 'Ayarlar', async () => {
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => [...document.querySelectorAll('.panel.menu button')].find((b) => /ayar/i.test(b.textContent))?.click());
  await page.waitForSelector('.panel label');
});

// Large text: the page and the labels on the field grow.
await seed({ largeText: true });
await step('09-large-text', 'Büyük yazı: şarj numaraları ve HUD büyür', async () => {
  await openLevel(0, 9);
  await placeSolution();
  const on = await page.evaluate(() => document.documentElement.classList.contains('large-text'));
  if (!on) throw new Error('large-text sınıfı yok');
});

// English, landscape.
await seed({ language: 'en' });
await page.setViewport({ width: 640, height: 360, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await step('10-landscape-en', 'Yatay ekran, İngilizce menü', async () => {
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.panel.menu');
  const lang = await page.evaluate(() => document.documentElement.lang);
  if (lang !== 'en') throw new Error(`dil ${lang}`);
});

// The way out when the game keeps failing (#18). Its errors are ours, so they are not counted.
await step('11-crash', 'Hata ekranı ve yeniden başlat', async () => {
  const before = errors.length;
  await page.evaluate(() => {
    for (let i = 0; i < 40; i++) window.dispatchEvent(new ErrorEvent('error', { message: 'smoke' }));
  });
  await page.waitForSelector('.screen.crash');
  await sleep(400); // past the panel's fade-in, so the shot shows what a player reads
  errors.length = before;
});

await browser.close();

const failed = steps.filter((s) => !s.ok);
const verdict = failed.length > 0 || errors.length > 0 ? 'FAIL' : 'PASS';
const report = [
  `# Duman testi — ${date}`,
  '',
  `**Sonuç: ${verdict}** · ${steps.length - failed.length}/${steps.length} adım · konsol hatası: ${errors.length}`,
  '',
  `\`npm run smoke\` (tools/smoke-check.mjs) ile, \`${URL}\` geliştirme sunucusunda, headless Chromium'da üretildi.`,
  '',
  '| Adım | Kontrol | Sonuç | Not | Görüntü |',
  '|---|---|---|---|---|',
  ...steps.map((s) => `| ${s.name} | ${s.what} | ${s.ok ? 'PASS' : 'FAIL'} | ${s.note.replace(/\|/g, '/')} | [${s.name}.jpg](${s.name}.jpg) |`),
  '',
  ...(errors.length ? ['## Konsol hataları', '', ...errors.map((e) => `- \`${e.replace(/`/g, "'")}\``), ''] : []),
].join('\n');
fs.writeFileSync(`${OUT}/report.md`, report);
console.log(report);
process.exit(verdict === 'PASS' ? 0 : 1);
