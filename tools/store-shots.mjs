/**
 * Makes the Play Store assets from real play: phone screenshots (portrait and
 * landscape), the 1024x500 feature graphic and a vertical promo clip.
 *
 *   npm run dev                      # in another terminal (needs the dev build's world mapping)
 *   BROWSER="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npm run store-shots
 *
 * Output: store-assets/ (git-ignored). Any Chromium-based browser works.
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const URL = process.env.GAME_URL ?? 'http://localhost:5173/';
const OUT = 'store-assets';
const executablePath = process.env.BROWSER;
if (!executablePath) throw new Error('Set BROWSER to a Chromium-based browser executable.');
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (sel, i = 0) => page.evaluate(([s, n]) => document.querySelectorAll(s)[n].click(), [sel, i]);
const tapWorld = async (x, y) => {
  const p = await page.evaluate(([wx, wy]) => window.__fuse.toClient(wx, wy), [x, y]);
  await page.mouse.click(p.x, p.y);
  await sleep(180);
};
/** Store shots show the game, not the passing hint and coaching messages. */
const shot = async (name) => {
  await page.evaluate(() => document.querySelectorAll('.toast, .coach').forEach((e) => (e.style.visibility = 'hidden')));
  await page.screenshot({ path: `${OUT}/${name}.png` });
};

/** A seasoned player's save: cities open, some scrap, a few workshop looks. */
const seed = (language) =>
  page.evaluate((lang) => {
    const stars = {};
    for (const w of [1, 2, 3, 4, 5, 6]) for (let i = 1; i <= 10; i++) if (!(w === 1 && i === 10)) stars[`w${w}-${String(i).padStart(2, '0')}`] = 3;
    localStorage.setItem(
      'fuse-and-fall/progress',
      JSON.stringify({
        version: 1, stars, best: {}, achievements: ['first-job', 'lean', 'chain', 'clean', 'total'], daily: {},
        wallet: { balance: 1240, earned: 3480 }, workshop: { owned: ['thermite', 'neon', 'theme:ice'], blastStyle: 'classic', blockTheme: 'theme:standard' },
        settings: { language: lang, sfxVolume: 0, screenShake: true, flashes: true, haptics: false },
      }),
    );
  }, language);

const openLevel = async (city, level) => {
  await page.goto(URL, { waitUntil: 'networkidle0' });
  // Operations: beside Continue while a mission is still open, the main button once all are won.
  await page.evaluate(() => (document.querySelector('.menu-main .btn:not(.continue)') ?? document.querySelector('.panel.menu .btn.big')).click());
  await page.waitForSelector('.city-card');
  await click('.city-card', city);
  await page.waitForSelector('.level-card');
  await click('.level-card', level);
  await sleep(900);
};

for (const language of ['tr', 'en']) {
  // Portrait phone: 1080x1920.
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await seed(language);
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(500);
  await shot(`${language}-1-menu`);

  await openLevel(0, 9); // Ankara 10: three towers and a barrel.
  // Physics is deterministic, but a pixel of tap rounding can change a many-piece collapse:
  // nudge the charges between attempts until the report shows a perfect job.
  for (const nudge of [0, 4, -4, 8, -8, 12]) {
    if (nudge !== 0) {
      await click('.report .actions .btn', 0); // Retry
      await sleep(900);
    }
    for (const x of [420, 600]) await tapWorld(x + nudge, 470);
    await shot(`${language}-2-placing`);
    await click('.fire-btn:not(.detonate-btn)');
    await sleep(650);
    await shot(`${language}-3-collapse`);
    await page.waitForSelector('.panel.report', { timeout: 25000 });
    await sleep(1400);
    if (await page.evaluate(() => !!document.querySelector('.report.perfect'))) break;
  }
  await shot(`${language}-4-report`);

  // The promo clip, recorded by the game itself from the replay.
  if (language === 'tr') {
    await page.evaluate(() => {
      const original = URL.createObjectURL;
      URL.createObjectURL = (blob) => ((window.__clip = blob), original.call(URL, blob));
    });
    await page.evaluate(() => document.querySelector('.report .actions button[aria-label]').click());
    await page.waitForFunction(() => window.__clip, { timeout: 60000, polling: 500 });
    const clip = await page.evaluate(async () => {
      const buffer = new Uint8Array(await window.__clip.arrayBuffer());
      let text = '';
      for (let i = 0; i < buffer.length; i += 0x8000) text += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
      return { data: btoa(text), type: window.__clip.type };
    });
    fs.writeFileSync(`${OUT}/promo-clip.${clip.type.includes('mp4') ? 'mp4' : 'webm'}`, Buffer.from(clip.data, 'base64'));
  }

  await page.goto(URL, { waitUntil: 'networkidle0' });
  await click('.menu-row .btn', 0);
  await sleep(500);
  await shot(`${language}-5-workshop`);

  // Landscape phone: 1920x1080, Rome's implosion folding a gallery onto its site.
  await page.setViewport({ width: 640, height: 360, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await openLevel(3, 7);
  await page.evaluate(() => document.querySelector('.kind-toggle [data-kind="implosion"]').click());
  for (const [x, y] of [[480, 410], [540, 410]]) await tapWorld(x, y);
  await click('.fire-btn:not(.detonate-btn)');
  await sleep(500);
  await shot(`${language}-6-landscape`);
}

// Feature graphic: 1024x500, a collapse with the title over the sky.
await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
await openLevel(0, 9);
for (const x of [420, 600]) await tapWorld(x, 470);
await click('.fire-btn:not(.detonate-btn)');
await sleep(700);
await page.evaluate(() => {
  document.querySelectorAll('.hud, .toast, .coach').forEach((e) => (e.style.visibility = 'hidden'));
  const title = document.createElement('div');
  title.innerHTML = 'FUSE <span style="color:#f2b134">&amp;</span> FALL';
  Object.assign(title.style, {
    position: 'fixed', left: '0', right: '0', top: '34px', textAlign: 'center', zIndex: 99,
    font: '800 72px Bahnschrift, "Arial Narrow", system-ui, sans-serif', letterSpacing: '0.12em', color: '#ebe8e2',
    textShadow: '0 4px 18px rgba(0,0,0,0.55)',
  });
  document.body.append(title);
});
await page.screenshot({ path: `${OUT}/feature-graphic.png` });

await browser.close();
console.log(`Store assets written to ${OUT}/:`, fs.readdirSync(OUT).join(', '));
